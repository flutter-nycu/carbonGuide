#!/usr/bin/env python3
"""RAG 知識工作台靜態 UI/UX 驗證。

在網站 repo 根目錄啟一個本機靜態 server，用 verify/harness.html 以 shadow DOM 掛載工作台
（和正式站 RagWorkspace.tsx 相同的方式），逐項檢查 spec 情境。

用法（在網站 repo 根目錄）：
  python3 openspec/changes/rag-admin-static-uiux-cleanup/verify/verify_uiux.py [--only 關鍵字] [--screens 資料夾] [-v]

任何失敗時 exit code 為 1。不需要網路，也不會連任何後端。
"""
from __future__ import annotations

import argparse
import functools
import http.server
import pathlib
import socketserver
import sys
import threading
import traceback
from contextlib import contextmanager

from playwright.sync_api import Page, sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[4]
HARNESS = "/openspec/changes/rag-admin-static-uiux-cleanup/verify/harness.html"
DESKTOP = (1440, 1000)
MOBILE = (390, 844)
PAGES = [
    ("documents", "01", "知識庫與文件"),
    ("import", "02", "匯入與預檢"),
    ("playground", "03", "檢索試問台"),
    ("evaluation", "04", "RAG 評測"),
    ("releases", "05", "知識版本"),
    ("personas", "06", "人格設定"),
    ("prompt", "07", "System Prompt"),
    ("qa", "08", "基本通用 QA"),
    ("settings", "09", "進階檢索設定"),
    ("logs", "10", "互動紀錄"),
]
REMOVED_BLOCKS = [
    "第一次使用",
    "操作說明",
    "操作路徑",
    "文件何時會用在回答裡",
    "設定會用在哪裡",
    "怎麼判斷有沒有變好",
    "指令怎麼套用",
]
BANNED_WORDS = REMOVED_BLOCKS + [
    "係數與費率",
    "服務連線",
    "計算資訊",
    "合成計算",
    "計算資料",
    "排放係數",
    "計算工具",
    "計算輸入",
    "計算規則",
    "文件處理與向量",
    "每段大小",
    "前後重疊",
    "向量維度",
    "JSON",
]

TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@contextmanager
def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as httpd:
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{httpd.server_address[1]}"
        finally:
            httpd.shutdown()


class Env:
    def __init__(self, browser, origin: str):
        self.browser = browser
        self.origin = origin

    @contextmanager
    def page(self, size=DESKTOP):
        context = self.browser.new_context(viewport={"width": size[0], "height": size[1]})
        context.set_default_timeout(4000)
        page = context.new_page()
        page.external_requests = []
        page.errors = []
        page.on("request", lambda r: None if r.url.startswith((self.origin, "data:")) else page.external_requests.append(r.url))
        page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page.errors.append(str(e)))
        page.goto(self.origin + HARNESS)
        page.wait_for_function("() => window.__ready === true")
        try:
            yield page
        finally:
            context.close()


# ---------- 共用操作（Playwright 的 CSS 選擇器會穿透 open shadow root） ----------

def nav(page: Page, key: str):
    if page.locator("#nav").is_visible():
        page.click(f'#nav [data-action="nav"][data-id="{key}"]')
    else:
        page.select_option("#page-select", key)


def main_text(page: Page) -> str:
    return page.inner_text("#main")


def ask(page: Page, question: str):
    nav(page, "playground")
    page.fill("#question", question)
    page.click('#ask-form button[type="submit"]')


def all_text(page: Page) -> str:
    chunks = []
    for key, _, _ in PAGES:
        nav(page, key)
        chunks.append(main_text(page))
    nav(page, "documents")
    page.click('[data-action="document"][data-id="1"]')
    chunks.append(page.inner_text("#dialog"))
    page.click("#close-dialog")
    ask(page, "如何減少食物浪費？")
    chunks.append(main_text(page))
    nav(page, "logs")
    page.click('[data-action="run-detail"]')
    chunks.append(page.inner_text("#dialog"))
    page.click("#close-dialog")
    nav(page, "import")
    page.click('[data-action="sample-import"]')
    chunks.append(main_text(page))
    chunks.append(page.inner_text(".sidebar"))
    return "\n".join(chunks)


# ---------- 導覽 ----------

@test
def nav_has_ten_pages(env):
    with env.page() as page:
        buttons = page.locator('#nav [data-action="nav"]')
        got = [(b.get_attribute("data-id"), b.inner_text().split("\n")[0].strip(), b.inner_text().split("\n")[-1].strip()) for b in buttons.all()]
        expected = [(k, n, label) for k, n, label in PAGES]
        assert got == expected, got


@test
def mobile_select_matches_nav(env):
    with env.page(MOBILE) as page:
        values = page.locator("#page-select option").evaluate_all("els => els.map(e => [e.value, e.textContent.trim()])")
        assert values == [[k, label] for k, _, label in PAGES], values


# ---------- 說明區塊 ----------

@test
def no_help_blocks_and_every_page_has_subtitle(env):
    with env.page() as page:
        for key, _, label in PAGES:
            nav(page, key)
            assert page.locator("details.page-help, details.quick-start, .guide-side").count() == 0, key
            text = main_text(page)
            found = [w for w in REMOVED_BLOCKS if w in text]
            assert not found, (key, found)
            assert page.locator("#main .subtitle").inner_text().strip(), f"{key} 沒有副標"


# ---------- 進階檢索設定 ----------

@test
def settings_without_index_fields(env):
    with env.page() as page:
        nav(page, "settings")
        for sel in ["#chunk", "#overlap", "#dimension"]:
            assert page.locator(sel).count() == 0, sel
        for sel in ["#candidate", "#context", "#rerank"]:
            assert page.locator(sel).count() == 1, sel


@test
def settings_save_requires_reevaluation(env):
    with env.page() as page:
        nav(page, "evaluation")
        page.click('[data-action="evaluate"]')
        nav(page, "settings")
        page.fill("#context", "4")
        page.click('#settings-form button[type="submit"]')
        assert "r2" in main_text(page)
        nav(page, "evaluation")
        assert "重新評測" in main_text(page)


@test
def settings_copy_is_plain(env):
    with env.page() as page:
        nav(page, "settings")
        text = main_text(page)
        found = [w for w in ["索引", "去重", "候選", "Cosine", "RRF", "tokens", "Embedding"] if w in text]
        assert not found, found


# ---------- 匯入 ----------

@test
def import_rejects_json(env):
    with env.page() as page:
        nav(page, "import")
        assert ".json" not in (page.get_attribute("#files", "accept") or "")
        page.set_input_files("#files", files=[{"name": "係數.json", "mimeType": "application/json", "buffer": b"{}"}])
        row = page.locator("#main tbody tr").last
        assert row.locator(".tag.error").count() == 1, row.inner_text()
        assert page.locator('[data-action="commit-import"]').is_disabled()


@test
def sample_batch_goes_to_rag_only(env):
    with env.page() as page:
        nav(page, "import")
        page.click('[data-action="sample-import"]')
        assert ".json" not in main_text(page).lower()
        page.click('[data-action="commit-import"]')
        rows = page.inner_text("#doc-rows")
        for word in ["待核對表格", "排放係數", "計算資料"]:
            assert word not in rows, word


# ---------- 試問 ----------

@test
def electricity_question_is_document_answer_with_citation(env):
    with env.page() as page:
        ask(page, "每月少用 20 度電，少多少碳排？")
        text = main_text(page)
        assert "文件回答" in text, text[:300]
        assert "[1]" in page.inner_text("#main .answer")
        assert "綠生活指引.pdf" in page.locator("#main .source-result").first.inner_text()
        assert "計算" not in text
        assert page.locator("#ask-persona").count() == 0
        assert "回覆人格" not in text


@test
def bill_question_asks_follow_up(env):
    with env.page() as page:
        ask(page, "少用 20 度電能省多少錢？")
        assert "需要追問" in main_text(page)


@test
def log_detail_has_no_calculation(env):
    with env.page() as page:
        ask(page, "每月少用 20 度電，少多少碳排？")
        nav(page, "logs")
        page.click('[data-action="run-detail"]')
        text = page.inner_text("#dialog")
        assert "計算" not in text, text
        assert "綠生活指引.pdf" in text, text
        assert "人格" not in text, text


@test
def banned_words_nowhere(env):
    with env.page() as page:
        text = all_text(page)
        found = [w for w in BANNED_WORDS if w in text]
        assert not found, found


# ---------- bug 修正 ----------

@test
def dialog_body_has_padding(env):
    with env.page() as page:
        page.click('[data-action="document"][data-id="1"]')
        pad = page.locator("#dialog-body").evaluate("el => parseFloat(getComputedStyle(el).paddingLeft)")
        assert pad > 0, pad


@test
def skip_link_keeps_hash_and_focuses_main(env):
    with env.page() as page:
        page.keyboard.press("Tab")
        page.keyboard.press("Enter")
        assert page.evaluate("() => location.hash") == "", page.evaluate("() => location.hash")
        focused = page.evaluate("() => document.getElementById('host').shadowRoot.activeElement?.id")
        assert focused == "main", focused


# ---------- 整體 ----------

def walk(page: Page):
    all_text(page)
    nav(page, "personas")
    page.click('[data-action="edit-persona"][data-id="0"]')
    page.click('[data-action="cancel-persona"]')
    nav(page, "qa")
    page.click('[data-action="add-qa"]')
    page.click("#close-dialog")


@test
def no_external_requests_or_errors(env):
    for size in (DESKTOP, MOBILE):
        with env.page(size) as page:
            walk(page)
            assert page.external_requests == [], page.external_requests
            assert page.errors == [], page.errors


@test
def no_horizontal_overflow(env):
    for size in (DESKTOP, (1024, 900), (768, 900), MOBILE):
        with env.page(size) as page:
            bad = []
            for key, _, _ in PAGES:
                nav(page, key)
                width = page.evaluate("document.documentElement.scrollWidth")
                if width > size[0] + 1:
                    bad.append((key, width))
            assert bad == [], (size, bad)


def capture(env: Env, out: pathlib.Path):
    out.mkdir(parents=True, exist_ok=True)
    for size, prefix in [(DESKTOP, "desktop"), (MOBILE, "mobile")]:
        with env.page(size) as page:
            for key, n, _ in PAGES:
                nav(page, key)
                if key == "playground":
                    page.fill("#question", "每月少用 20 度電，少多少碳排？")
                    page.click('#ask-form button[type="submit"]')
                if key == "import":
                    page.click('[data-action="sample-import"]')
                page.wait_for_timeout(150)
                page.screenshot(path=str(out / f"{prefix}-{n}-{key}.png"), full_page=True)
            nav(page, "documents")
            page.click('[data-action="document"][data-id="1"]')
            page.wait_for_timeout(150)
            page.screenshot(path=str(out / f"{prefix}-dialog-document.png"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="")
    parser.add_argument("--screens", default="")
    parser.add_argument("-v", action="store_true")
    args = parser.parse_args()
    passed, failed = [], []
    with serve() as origin, sync_playwright() as p:
        browser = p.chromium.launch()
        env = Env(browser, origin)
        for fn in TESTS:
            if args.only and args.only not in fn.__name__:
                continue
            try:
                fn(env)
                passed.append(fn.__name__)
                print(f"PASS {fn.__name__}")
            except Exception as exc:  # noqa: BLE001
                failed.append(fn.__name__)
                detail = str(exc).strip().splitlines()[0][:240] if str(exc).strip() else type(exc).__name__
                print(f"FAIL {fn.__name__}: {detail}")
                if args.v:
                    traceback.print_exc()
        if args.screens:
            capture(env, pathlib.Path(args.screens))
            print(f"screenshots -> {args.screens}")
        browser.close()
    print(f"\n{len(passed)} passed, {len(failed)} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
