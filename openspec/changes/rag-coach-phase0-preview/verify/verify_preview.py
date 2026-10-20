#!/usr/bin/env python3
"""Phase 0 AI 氣候教練原型驗證。

用法：
  python3 verify_preview.py <HTML 檔案路徑或網址> [--only 關鍵字] [--screens 截圖資料夾]

每個測試都開新分頁，彼此獨立。結束時列出通過與失敗，任何失敗時 exit code 為 1。
"""
from __future__ import annotations

import argparse
import pathlib
import sys
import traceback
from contextlib import contextmanager

from playwright.sync_api import Page, sync_playwright

DESKTOP = (1440, 1000)
MOBILE = (390, 844)
AI_NAV = [
    "知識庫與文件",
    "人格設定",
    "System Prompt",
    "RAG 設定",
    "基本通用 QA",
    "測試對話",
    "互動紀錄",
    "服務連線",
]
ADMIN_TABS = ["knowledge", "personas", "prompt", "rag", "qa", "playground", "logs", "connection"]
APP_TABS = ["主頁", "碳足跡", "行動", "資訊", "個人"]
COMMUTE_WORDS = ["通勤日誌", "通勤模型評估", "GPS", "研究分享", "軌跡"]
OLD_SLOGANS = [
    "每個好回答，都有好依據。",
    "不同風格，一樣用心。",
    "把教練的原則，說清楚。",
    "常見問題，先準備好答案。",
    "理解對話，持續改善。",
    "連接知識與模型。",
    "讓減碳，從聊聊開始。",
    "讓業主看見功能，也走得完流程。",
]

TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


class Env:
    def __init__(self, browser, target: str):
        self.browser = browser
        self.target = target

    @contextmanager
    def page(self, size=DESKTOP):
        context = self.browser.new_context(viewport={"width": size[0], "height": size[1]})
        context.set_default_timeout(3000)
        page = context.new_page()
        page.external_requests = []
        page.errors = []
        page.on(
            "request",
            lambda r: None
            if r.url.startswith("data:") or r.url.split("#")[0] == self.target.split("#")[0]
            else page.external_requests.append(r.url),
        )
        page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page.errors.append(str(e)))
        page.goto(self.target)
        page.wait_for_load_state("load")
        try:
            yield page
        finally:
            context.close()


# ---------- 共用操作 ----------

def nav(page: Page, label: str):
    page.click(f'.review-nav button:text-is("{label}")')


def admin(page: Page, tab: str):
    nav(page, "管理後台")
    page.click(f'.sidebar [data-tab="{tab}"]')


def screen(page: Page) -> str:
    return page.get_attribute(".phone", "data-screen")


def open_chat(page: Page, persona="rational"):
    nav(page, "氣候教練")
    page.click('.phone [data-act="open-coach"]')
    page.click(f'.phone [data-act="pick-persona"][data-id="{persona}"]')
    assert screen(page) == "chat", f"選人格後應進入對話畫面，實際為 {screen(page)}"


def assistant_count(page: Page) -> int:
    return page.locator("#chat-feed .message:not(.user)").count()


def wait_reply(page: Page, before: int):
    # 頁面 CSP 禁止 eval，所以用 locator 等待，不用字串版 wait_for_function。
    page.locator("#chat-feed .message:not(.user)").nth(before).wait_for(timeout=3000)


def last_assistant(page: Page):
    return page.locator("#chat-feed .message:not(.user)").last


def rag_fallback_default(page: Page) -> str:
    admin(page, "rag")
    return page.input_value("#rag-fallback").strip()


def logs_count(page: Page) -> int:
    admin(page, "logs")
    return page.locator("#logs-body tr").count()


def toast_text(page: Page) -> str:
    page.wait_for_selector("#toast:not([hidden])", timeout=2000)
    return page.inner_text("#toast")


def small_buttons(page: Page):
    return page.evaluate(
        """() => [...document.querySelectorAll('.phone button')]
          .filter(b => b.offsetParent !== null)
          .map(b => { const r = b.getBoundingClientRect();
                      return [b.innerText.trim() || b.getAttribute('aria-label') || b.dataset.act,
                              Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; })
          .filter(([, w, h]) => w < 43.5 || h < 43.5)"""
    )


def all_visible_text(page: Page) -> str:
    chunks = []
    for label in ["展示說明", "氣候教練"]:
        nav(page, label)
        chunks.append(page.inner_text("body"))
    page.click('.phone [data-act="open-coach"]')
    chunks.append(page.inner_text("body"))
    page.click('.phone [data-act="pick-persona"]')
    chunks.append(page.inner_text("body"))
    for tab in ADMIN_TABS:
        admin(page, tab)
        chunks.append(page.inner_text("body"))
    return "\n".join(chunks)


# ---------- 頁面邊界 ----------

@test
def banner_and_landing_on_guide(env):
    with env.page() as page:
        assert "示範原型，全部為假資料" in page.inner_text(".demo-banner")
        current = page.locator('.review-nav button[aria-current="page"]').inner_text()
        assert current == "展示說明", f"預設頁應為展示說明，實際為 {current}"
        assert page.locator(".review-info").is_visible()


@test
def noindex_meta(env):
    with env.page() as page:
        assert page.get_attribute('meta[name="robots"]', "content") == "noindex, nofollow"


def walk_everything(page: Page):
    all_visible_text(page)
    nav(page, "氣候教練")
    if screen(page) != "chat":
        page.click('.phone [data-act="open-coach"]')
        page.click('.phone [data-act="pick-persona"]')
    before = assistant_count(page)
    page.click('.phone [data-act="suggest"]')
    wait_reply(page, before)
    page.locator('.phone [data-act="source"]').last.click()
    page.click('.phone [data-act="close-sheet"]')
    page.click('.phone [data-act="switch-persona"]')
    page.click('.phone .phone-sheet [data-act="pick-persona"]:not(.selected)')
    for act in ["new-chat", "fail-chat", "restore-chat"]:
        page.click('.phone [data-act="chat-settings"]')
        page.click(f'#modal [data-act="{act}"]')
    page.click('.phone [data-act="phone-back"]')
    page.click('.phone [data-act="app-tab"]')
    admin(page, "knowledge")
    page.click('[data-act="upload"]')
    page.click('#modal [data-act="close"]')
    page.click('[data-act="doc-detail"]')
    page.click('#modal [data-act="close"]')
    admin(page, "personas")
    page.click('[data-act="edit-persona"][data-id="empathy"]')
    page.click('#modal [data-act="close"]')
    admin(page, "qa")
    page.click('[data-act="edit-qa"][data-id="1"]')
    page.click('#modal [data-act="close"]')
    admin(page, "logs")
    page.click('[data-act="log-detail"]')
    page.click('#modal [data-act="close"]')
    if page.locator('[data-act="existing"]').first.is_visible():  # 手機寬度沿用原型設計，隱藏既有推播入口
        page.click('[data-act="existing"]')
        page.click('#modal [data-act="close"]')
    admin(page, "rag")
    page.click('[data-act="rag-toggle"]')
    page.fill("#rag-topk", "6")
    page.click('#rag-form button[type="submit"]')
    page.click('[data-act="rag-reset"]')


@test
def no_external_requests_or_errors_desktop(env):
    with env.page(DESKTOP) as page:
        walk_everything(page)
        assert page.external_requests == [], page.external_requests
        assert page.errors == [], page.errors


@test
def no_external_requests_or_errors_mobile(env):
    with env.page(MOBILE) as page:
        walk_everything(page)
        assert page.external_requests == [], page.external_requests
        assert page.errors == [], page.errors


@test
def reload_resets_data(env):
    with env.page() as page:
        admin(page, "qa")
        before = page.locator("#qa-list .qa-item").count()
        page.click('[data-act="edit-qa"][data-id="new"]')
        page.fill("#qa-question", "重新整理測試題")
        page.fill("#qa-answer", "重新整理測試答案")
        page.click('#qa-form button:not([type="button"])')
        assert page.locator("#qa-list .qa-item").count() == before + 1
        page.reload()
        admin(page, "qa")
        assert page.locator("#qa-list .qa-item").count() == before


# ---------- 頂部導覽 ----------

@test
def top_nav_has_three_entries(env):
    with env.page() as page:
        labels = page.locator(".review-nav button").all_inner_texts()
        assert labels == ["氣候教練", "管理後台", "展示說明"], labels


# ---------- 手機框 ----------

@test
def phone_frame_is_390x844_on_desktop(env):
    with env.page(DESKTOP) as page:
        nav(page, "氣候教練")
        box = page.locator(".phone").bounding_box()
        assert abs(box["width"] - 390) <= 1 and abs(box["height"] - 844) <= 1, box


@test
def phone_home_has_tabs_and_entry_card(env):
    with env.page() as page:
        nav(page, "氣候教練")
        assert screen(page) == "home"
        tabs = page.locator(".phone .tabbar button")
        assert tabs.all_inner_texts() == APP_TABS, tabs.all_inner_texts()
        assert tabs.first.get_attribute("aria-current") == "page"
        assert "氣候教練" in page.inner_text('.phone [data-act="open-coach"]')


@test
def other_app_tab_only_shows_toast(env):
    with env.page() as page:
        nav(page, "氣候教練")
        page.click('.phone .tabbar button:has-text("碳足跡")')
        assert "主頁" in toast_text(page)
        assert screen(page) == "home"


@test
def entry_card_opens_persona_screen(env):
    with env.page() as page:
        nav(page, "氣候教練")
        page.click('.phone [data-act="open-coach"]')
        assert screen(page) == "persona"


@test
def left_column_has_no_persona_cards(env):
    with env.page() as page:
        nav(page, "氣候教練")
        assert page.locator(".scene .intro .persona-card").count() == 0


@test
def persona_screen_shows_name_desc_sample(env):
    with env.page() as page:
        nav(page, "氣候教練")
        page.click('.phone [data-act="open-coach"]')
        cards = page.locator('.phone [data-act="pick-persona"]')
        assert cards.count() == 2
        for i in range(cards.count()):
            card = cards.nth(i)
            assert card.locator(".persona-name").inner_text().strip()
            assert card.locator(".persona-desc").inner_text().strip()
            assert card.locator(".persona-sample").inner_text().strip()


@test
def picking_persona_enters_chat(env):
    with env.page() as page:
        open_chat(page, "empathy")
        assert "共感型" in page.inner_text(".phone .persona-strip")
        labels = page.locator("#chat-feed .msg-label").all_inner_texts()
        assert labels and all("共感型" in l for l in labels), labels


@test
def disabled_persona_is_hidden(env):
    with env.page() as page:
        admin(page, "personas")
        page.click('[data-act="toggle-persona"][data-id="rational"]')
        nav(page, "氣候教練")
        page.click('.phone [data-act="open-coach"]')
        ids = page.locator('.phone [data-act="pick-persona"]').evaluate_all("els => els.map(e => e.dataset.id)")
        assert ids == ["empathy"], ids


@test
def suggestion_hits_qa_with_loading_and_source(env):
    with env.page() as page:
        open_chat(page)
        before = assistant_count(page)
        page.click('.phone [data-act="suggest"]:text-is("吃素真的能減碳嗎？")')
        page.wait_for_selector(".phone .typing", timeout=500)
        wait_reply(page, before)
        assert "日常減碳行動手冊.pdf" in last_assistant(page).inner_text()


@test
def source_sheet_opens_inside_phone_and_closes(env):
    with env.page() as page:
        open_chat(page)
        page.locator('.phone [data-act="source"]').last.click()
        sheet = page.locator(".phone .phone-sheet")
        assert sheet.is_visible()
        page.wait_for_timeout(400)
        phone = page.locator(".phone").bounding_box()
        box = sheet.bounding_box()
        assert box["x"] >= phone["x"] - 1 and box["x"] + box["width"] <= phone["x"] + phone["width"] + 1
        assert box["y"] + box["height"] <= phone["y"] + phone["height"] + 1
        page.click('.phone [data-act="close-sheet"]')
        assert page.locator(".phone .phone-sheet").count() == 0


@test
def unknown_question_gets_fallback_and_logs_miss(env):
    with env.page() as page:
        fallback = rag_fallback_default(page)
        assert fallback
        open_chat(page)
        before = assistant_count(page)
        page.fill("#chat-input", "家裡冷氣要開幾度？")
        page.click(".phone .send")
        wait_reply(page, before)
        assert fallback in last_assistant(page).inner_text()
        admin(page, "logs")
        first = page.locator("#logs-body tr").first.inner_text()
        assert "家裡冷氣要開幾度？" in first and "查無資料" in first, first


@test
def failed_reply_can_retry(env):
    with env.page() as page:
        open_chat(page)
        page.click('.phone [data-act="chat-settings"]')
        page.click('[data-act="fail-chat"]')
        assert page.locator(".phone .message-error").is_visible()
        before = assistant_count(page)
        page.click('.phone [data-act="retry-chat"]')
        wait_reply(page, before)
        assert page.locator(".phone .message-error").count() == 0
        reply = last_assistant(page).inner_text()
        assert "日常減碳行動手冊.pdf" in reply, f"重試後應拿到 QA 回答：{reply}"
        assert "知識庫裡目前找不到" not in reply, reply


@test
def new_chat_shows_welcome_only(env):
    with env.page() as page:
        open_chat(page)
        page.click('.phone [data-act="chat-settings"]')
        page.click('[data-act="new-chat"]')
        assert assistant_count(page) == 1
        assert page.locator("#chat-feed .message.user").count() == 0


@test
def switching_persona_keeps_messages(env):
    with env.page() as page:
        open_chat(page, "rational")
        total = page.locator("#chat-feed .message").count()
        before_texts = page.locator("#chat-feed .message").all_inner_texts()
        page.click('.phone [data-act="switch-persona"]')
        page.click('.phone .phone-sheet [data-act="pick-persona"][data-id="empathy"]')
        assert page.locator("#chat-feed .message").count() == total
        assert page.locator("#chat-feed .message").all_inner_texts() == before_texts, "換人格不應改寫舊訊息"
        assert "共感型" in page.inner_text(".phone .persona-strip")
        before = assistant_count(page)
        page.click('.phone [data-act="suggest"]:text-is("吃素真的能減碳嗎？")')
        wait_reply(page, before)
        assert "共感型" in last_assistant(page).inner_text()


@test
def suggestions_have_no_commute_topics(env):
    with env.page() as page:
        open_chat(page)
        texts = page.locator('.phone [data-act="suggest"]').all_inner_texts()
        assert texts and not any(w in t for t in texts for w in ["通勤", "GPS"]), texts


@test
def phone_tap_targets_at_least_44px(env):
    for size in (DESKTOP, MOBILE):
        with env.page(size) as page:
            nav(page, "氣候教練")
            problems = small_buttons(page)
            page.click('.phone [data-act="open-coach"]')
            problems += small_buttons(page)
            page.click('.phone [data-act="pick-persona"]')
            problems += small_buttons(page)
            page.locator('.phone [data-act="source"]').last.click()
            problems += small_buttons(page)
            assert problems == [], f"{size}: {problems}"


# ---------- 後台 ----------

@test
def sidebar_lists_eight_pages_in_order(env):
    with env.page() as page:
        nav(page, "管理後台")
        labels = page.locator('.sidebar nav[aria-label="後台功能"] button').all_inner_texts()
        assert [l.strip() for l in labels] == AI_NAV, labels


@test
def existing_push_entry_shows_unchanged_notice(env):
    with env.page() as page:
        nav(page, "管理後台")
        entries = page.locator('[data-act="existing"]')
        assert entries.count() == 4
        entries.first.click()
        assert "既有功能，本次不變" in page.inner_text("#dialog-body")


@test
def rag_settings_defaults(env):
    with env.page() as page:
        admin(page, "rag")
        assert page.get_attribute("#rag-strict", "aria-checked") == "true"
        assert page.input_value("#rag-fallback").strip()
        assert page.get_attribute("#rag-qa-first", "aria-checked") == "true"
        expected = {
            "#rag-qa-threshold": 0.85,
            "#rag-topk": 5,
            "#rag-threshold": 0.70,
            "#rag-temperature": 0.3,
            "#rag-daily-limit": 30,
        }
        for sel, value in expected.items():
            assert abs(float(page.input_value(sel)) - value) < 1e-9, (sel, page.input_value(sel))
        readonly = page.locator(".rag-readonly input")
        assert readonly.count() >= 5
        assert all(readonly.nth(i).get_attribute("readonly") is not None for i in range(readonly.count()))
        assert "實作時確認" in page.inner_text(".rag-readonly")


@test
def rag_rejects_out_of_range_values(env):
    cases = [
        ("#rag-topk", "11", "#err-rag-topk"),
        ("#rag-topk", "2.5", "#err-rag-topk"),
        ("#rag-threshold", "0.4", "#err-rag-threshold"),
        ("#rag-threshold", "0.755", "#err-rag-threshold"),
        ("#rag-qa-threshold", "0.99", "#err-rag-qa-threshold"),
        ("#rag-daily-limit", "201", "#err-rag-daily-limit"),
        ("#rag-fallback", "", "#err-rag-fallback"),
    ]
    with env.page() as page:
        for sel, bad, err in cases:
            admin(page, "rag")
            original = page.input_value(sel)
            page.fill(sel, bad)
            page.click('#rag-form button[type="submit"]')
            assert page.inner_text(err).strip(), f"{sel}={bad} 應顯示錯誤"
            assert page.get_attribute(sel, "aria-invalid") == "true"
            admin(page, "knowledge")
            admin(page, "rag")
            assert page.input_value(sel) == original, f"{sel} 不應被儲存"


@test
def rag_save_success_shows_toast(env):
    with env.page() as page:
        admin(page, "rag")
        assert "示範資料，不影響真實回答" in page.inner_text(".admin-main")
        page.fill("#rag-threshold", "0.75")
        page.click('#rag-form button[type="submit"]')
        assert "已儲存" in toast_text(page)
        admin(page, "knowledge")
        admin(page, "rag")
        assert abs(float(page.input_value("#rag-threshold")) - 0.75) < 1e-9


@test
def playground_has_three_fixed_cases_without_input(env):
    with env.page() as page:
        admin(page, "playground")
        cases = page.locator(".pg-case").evaluate_all("els => els.map(e => e.dataset.case)")
        assert cases == ["qa", "doc", "none"], cases
        assert page.locator(".admin-main input, .admin-main textarea").count() == 0


@test
def playground_results_sorted_with_threshold_marks(env):
    with env.page() as page:
        admin(page, "playground")
        for case in ["qa", "doc", "none"]:
            rows = page.locator(f'.pg-case[data-case="{case}"] .pg-result')
            scores = [float(s) for s in rows.evaluate_all("els => els.map(e => e.dataset.score)")]
            assert scores and scores == sorted(scores, reverse=True), (case, scores)
        doc_rows = page.locator('.pg-case[data-case="doc"] .pg-result')
        marks = doc_rows.evaluate_all(
            "els => els.map(e => [e.dataset.kind, +e.dataset.score, !!e.querySelector('.pg-below')])"
        )
        assert any(below for _, _, below in marks), "命中文件段落那段應至少有一筆低於門檻"
        for kind, score, below in marks:
            if kind == "doc":
                assert below == (score < 0.70), (kind, score, below)


@test
def playground_meta_shows_settings_used(env):
    with env.page() as page:
        admin(page, "playground")
        for i in range(3):
            meta = page.locator(".pg-case .pg-meta").nth(i).inner_text()
            for word in ["System Prompt：v3", "參考段落數：5", "相似度門檻：0.70", "QA 門檻：0.85"]:
                assert word in meta, (i, word, meta)
            assert "人格：理性型" in meta or "人格：共感型" in meta, meta


@test
def playground_none_case_uses_fallback(env):
    with env.page() as page:
        fallback = rag_fallback_default(page)
        admin(page, "playground")
        answer = page.inner_text('.pg-case[data-case="none"] .pg-answer')
        assert fallback in answer, answer


@test
def playground_does_not_write_logs(env):
    with env.page() as page:
        before = logs_count(page)
        admin(page, "playground")
        assert logs_count(page) == before


@test
def new_qa_answers_in_phone_chat(env):
    with env.page() as page:
        admin(page, "qa")
        page.click('[data-act="edit-qa"][data-id="new"]')
        page.fill("#qa-question", "家裡可以怎麼省電？")
        page.fill("#qa-answer", "先把冷氣調高一度，再檢查待機電器。")
        page.click('#qa-form button:not([type="button"])')
        open_chat(page)
        before = assistant_count(page)
        page.fill("#chat-input", "家裡可以怎麼省電？")
        page.click(".phone .send")
        wait_reply(page, before)
        assert "先把冷氣調高一度" in last_assistant(page).inner_text()


@test
def existing_admin_pages_still_work(env):
    with env.page() as page:
        admin(page, "knowledge")
        page.click('[data-act="upload"]')
        assert page.locator("#upload-form").is_visible()
        page.click('#modal [data-act="close"]')
        admin(page, "personas")
        page.click('[data-act="edit-persona"][data-id="rational"]')
        assert page.locator("#persona-form").is_visible()
        page.click('#modal [data-act="close"]')
        admin(page, "prompt")
        page.fill("#system-prompt", "測試草稿")
        page.click('#prompt-form button[type="submit"]')
        assert page.locator('[data-act="activate-prompt"]').is_enabled()
        admin(page, "logs")
        page.select_option("#log-filter", "共感型")
        assert all("共感型" in t for t in page.locator("#logs-body tr").all_inner_texts())
        admin(page, "connection")
        assert "Supabase" in page.inner_text(".admin-main")


# ---------- 移除通勤 ----------

@test
def no_commute_content_anywhere(env):
    with env.page() as page:
        text = all_visible_text(page)
        found = [w for w in COMMUTE_WORDS if w in text]
        assert found == [], found
        admin(page, "knowledge")
        assert "低碳通勤指南.pdf" in page.inner_text(".admin-main")


# ---------- 展示說明 ----------

@test
def guide_page_covers_demo_order_without_commute(env):
    with env.page() as page:
        nav(page, "展示說明")
        info = page.inner_text(".review-info")
        assert "通勤" not in info.replace("低碳通勤指南", ""), "展示說明不應提到通勤"
        steps = " ".join(page.locator(".review-info ol li").all_inner_texts())
        for word in ["主頁", "人格", "來源", "QA", "RAG 設定", "測試對話", "互動紀錄"]:
            assert word in steps, (word, steps)
        assert "主頁" in info and "卡片" in info


# ---------- 文字 ----------

@test
def admin_titles_are_plain_descriptions(env):
    with env.page() as page:
        titles = []
        for tab in ADMIN_TABS:
            admin(page, tab)
            titles.append(page.inner_text(".page-title h1").strip())
        text = all_visible_text(page)
        assert not [s for s in OLD_SLOGANS if s in text], [s for s in OLD_SLOGANS if s in text]
        assert not [t for t in titles if t.endswith("。")], titles


@test
def english_labels_kept(env):
    with env.page() as page:
        text = all_visible_text(page)
        for label in [
            "KNOWLEDGE BASE",
            "COACH PERSONALITIES",
            "SYSTEM PROMPT",
            "COMMON QUESTIONS",
            "CONVERSATION HISTORY",
            "SERVICE CONNECTIONS",
            "DESIGN PREVIEW",
        ]:
            assert label in text.upper(), label


# ---------- RWD ----------

def overflow_report(page: Page, width: int):
    views = []
    for label in ["展示說明", "氣候教練"]:
        nav(page, label)
        views.append((label, page.evaluate("document.documentElement.scrollWidth")))
    page.click('.phone [data-act="open-coach"]')
    page.click('.phone [data-act="pick-persona"]')
    views.append(("對話", page.evaluate("document.documentElement.scrollWidth")))
    for tab in ADMIN_TABS:
        admin(page, tab)
        views.append((tab, page.evaluate("document.documentElement.scrollWidth")))
    return [(name, w) for name, w in views if w > width + 1]


@test
def no_horizontal_overflow_mobile(env):
    with env.page(MOBILE) as page:
        assert overflow_report(page, MOBILE[0]) == []


@test
def no_horizontal_overflow_desktop(env):
    with env.page(DESKTOP) as page:
        assert overflow_report(page, DESKTOP[0]) == []


@test
def phone_fits_mobile_viewport(env):
    with env.page(MOBILE) as page:
        nav(page, "氣候教練")
        box = page.locator(".phone").bounding_box()
        assert box["x"] >= 0 and box["x"] + box["width"] <= MOBILE[0] + 0.5, box


# ---------- 審查後補的測試 ----------

@test
def rag_accepts_boundary_values(env):
    with env.page() as page:
        admin(page, "rag")
        values = {"#rag-qa-threshold": "0.950", "#rag-topk": "10", "#rag-threshold": ".5", "#rag-daily-limit": "0"}
        for sel, v in values.items():
            page.fill(sel, v)
        page.click('#rag-form button[type="submit"]')
        assert "已儲存" in toast_text(page)
        admin(page, "knowledge")
        admin(page, "rag")
        for sel, v in values.items():
            assert abs(float(page.input_value(sel)) - float(v)) < 1e-9, (sel, page.input_value(sel))


@test
def phone_controls_visible_on_mobile(env):
    # 390×664 是 iPhone 13 在 Safari 工具列展開時的實際可視範圍
    for size in (MOBILE, (390, 664)):
        with env.page(size) as page:
            nav(page, "氣候教練")
            bar = page.locator(".phone .tabbar").bounding_box()
            assert bar["y"] + bar["height"] <= size[1] + 0.5, f"{size} 底部分頁超出畫面：{bar}"
            page.click('.phone [data-act="open-coach"]')
            page.click('.phone [data-act="pick-persona"]')
            box = page.locator(".phone .composer").bounding_box()
            assert box["y"] + box["height"] <= size[1] + 0.5, f"{size} 輸入框超出畫面：{box}"


@test
def escape_does_not_reset_admin_form(env):
    with env.page() as page:
        open_chat(page)
        page.locator('.phone [data-act="source"]').last.click()
        admin(page, "rag")
        page.fill("#rag-topk", "7")
        page.keyboard.press("Escape")
        assert page.input_value("#rag-topk") == "7"


@test
def switching_page_clears_toast(env):
    with env.page() as page:
        admin(page, "rag")
        page.fill("#rag-topk", "99")
        page.click('#rag-form button[type="submit"]')
        toast_text(page)
        page.click('.sidebar [data-tab="playground"]')
        assert page.locator("#toast").is_hidden()


@test
def mobile_admin_active_tab_visible(env):
    with env.page(MOBILE) as page:
        for tab in ["playground", "logs", "connection", "knowledge"]:
            admin(page, tab)
            box = page.locator(".sidebar nav .active").bounding_box()
            assert box["x"] >= -0.5 and box["x"] + box["width"] <= MOBILE[0] + 0.5, (tab, box)


@test
def no_horizontal_overflow_mid_widths(env):
    for width in (768, 1024, 1150):
        with env.page((width, 900)) as page:
            assert overflow_report(page, width) == [], width


@test
def sheet_moves_focus_and_traps_tab(env):
    with env.page() as page:
        open_chat(page)
        page.locator('.phone [data-act="source"]').last.click()
        inside = "() => !!document.activeElement.closest('.phone-sheet')"
        assert page.evaluate(inside), "開 sheet 後焦點應在 sheet 內"
        for _ in range(6):
            page.keyboard.press("Tab")
            assert page.evaluate(inside), "Tab 不應離開 sheet"
        page.keyboard.press("Escape")
        assert page.locator(".phone .phone-sheet").count() == 0
        assert page.evaluate("() => document.activeElement.dataset.act") == "source", "關閉後焦點應回到來源標籤"


@test
def copy_is_consistent(env):
    with env.page() as page:
        text = all_visible_text(page)
        for word in ["未命中", "合成", "新竹到台北", "很高興你想多了解一點"]:
            assert word not in text, word
        nav(page, "氣候教練")
        chip = page.locator('.phone [data-act="source"]').first.inner_text()
        assert chip.strip().startswith("來源："), chip


@test
def rag_accepts_equivalent_number_forms(env):
    with env.page() as page:
        admin(page, "rag")
        page.fill("#rag-topk", "5.0")
        page.fill("#rag-threshold", ".75")
        page.click('#rag-form button[type="submit"]')
        assert "已儲存" in toast_text(page)


@test
def reply_does_not_steal_focus(env):
    with env.page() as page:
        open_chat(page)
        # 點建議問題送出：回覆完成後不該把焦點搶到輸入框（手機上會跳出鍵盤）
        before = assistant_count(page)
        page.click('.phone [data-act="suggest"]:text-is("吃素真的能減碳嗎？")')
        wait_reply(page, before)
        assert page.evaluate("() => document.activeElement.id") != "chat-input"
        # 從輸入框送出後馬上開來源 sheet：回覆完成時焦點要留在 sheet 裡
        before = assistant_count(page)
        page.fill("#chat-input", "吃素真的能減碳嗎？")
        page.press("#chat-input", "Enter")
        page.locator('.phone [data-act="source"]').first.click()
        wait_reply(page, before)
        assert page.evaluate("() => !!document.activeElement.closest('.phone-sheet')"), "焦點不應離開 sheet"
        page.keyboard.press("Escape")
        # 從輸入框送出、沒有開 sheet：回覆完成後焦點回到輸入框，方便繼續打字
        before = assistant_count(page)
        page.fill("#chat-input", "吃素真的能減碳嗎？")
        page.press("#chat-input", "Enter")
        wait_reply(page, before)
        assert page.evaluate("() => document.activeElement.id") == "chat-input"


@test
def restore_chat_keeps_focus_in_phone(env):
    with env.page() as page:
        open_chat(page)
        page.click('.phone [data-act="chat-settings"]')
        page.click('#modal [data-act="restore-chat"]')
        assert page.evaluate("() => !!document.activeElement.closest('.phone')"), "回到範例後焦點應在手機框內"


# ---------- 截圖 ----------

def capture(env: Env, out: pathlib.Path):
    out.mkdir(parents=True, exist_ok=True)
    for size, prefix in [(DESKTOP, "desktop"), (MOBILE, "mobile")]:
        with env.page(size) as page:
            def shot(name):
                page.wait_for_timeout(250)
                page.screenshot(path=str(out / f"{prefix}-{name}.png"), full_page=True)

            shot("guide")
            nav(page, "氣候教練")
            shot("coach-home")
            page.click('.phone [data-act="open-coach"]')
            shot("coach-persona")
            page.click('.phone [data-act="pick-persona"]')
            shot("coach-chat")
            page.locator('.phone [data-act="source"]').last.click()
            shot("coach-source")
            for tab in ADMIN_TABS:
                admin(page, tab)
                shot(f"admin-{tab}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("target")
    parser.add_argument("--only", default="")
    parser.add_argument("--screens", default="")
    parser.add_argument("-v", action="store_true", help="失敗時印出完整 traceback")
    args = parser.parse_args()
    target = args.target
    if "://" not in target:
        target = pathlib.Path(target).resolve().as_uri()

    passed, failed = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        env = Env(browser, target)
        for fn in TESTS:
            if args.only and args.only not in fn.__name__:
                continue
            try:
                fn(env)
                passed.append(fn.__name__)
                print(f"PASS {fn.__name__}")
            except Exception as exc:  # noqa: BLE001
                failed.append(fn.__name__)
                detail = str(exc).strip().splitlines()[0][:220] if str(exc).strip() else type(exc).__name__
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
