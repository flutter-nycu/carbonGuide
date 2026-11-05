"""Browser QA of the RAG workspace on the in-memory API (test/rag-live-preview.html).

Start the Vite dev server first, then run:
  npx vite --host 127.0.0.1 --port 5199 --strictPort
  python3 test/verify-rag-workspace.py http://127.0.0.1:5199 ../verify-out/rag-workspace

Checks the eleven pages at 1440, 1024, 768 and 390 px wide: page-level horizontal overflow, dialogs (focus moves
in, Esc closes, focus returns), the main flows, the viewer role, console errors and requests leaving the page.
Nothing here talks to Supabase; real data is checked separately after the backend is deployed.
"""
import json, re, sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5199'
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('../verify-out/rag-workspace')
out.mkdir(parents=True, exist_ok=True)
PAGES = [('documents', '知識庫與文件'), ('import', '匯入與預檢'), ('playground', '檢索試問台'), ('evaluation', 'RAG 評測'),
         ('releases', '知識版本'), ('personas', '人格設定'), ('prompt', '全域提示詞'), ('qa', '基本通用 QA'),
         ('settings', '檢索設定'), ('logs', '互動紀錄'), ('conversations', '對話使用者')]
WIDTHS = [1440, 1024, 768, 390]
checks, errors, outside = [], [], []


def open_workspace(context, role):
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(f'{role}: {e}'))
    page.on('console', lambda m: errors.append(f'{role}: {m.text}') if m.type == 'error' else None)
    page.on('request', lambda r: outside.append(r.url) if urlparse(r.url).netloc != urlparse(base).netloc and not r.url.startswith('data:') else None)
    page.goto(f'{base}/test/rag-live-preview.html?role={role}')
    page.get_by_role('heading', name='知識庫與文件', exact=True).wait_for()
    return page


def go(page, page_id, title):
    select = page.locator('#page-select')
    if select.is_visible():
        select.select_option(page_id)
    else:
        page.get_by_role('navigation', name='RAG 工作台頁面').get_by_role('button', name=title if page_id != 'prompt' else 'System Prompt').click()
    section = page.locator(f'[data-page="{page_id}"]')
    expect(section.get_by_role('heading', level=1)).to_have_text(title)
    expect(section.locator('.empty[role="status"]')).to_have_count(0)
    return section


def no_overflow(page, label):
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'page overflow: {label}'
    assert not page.locator('#host').evaluate('h => h.shadowRoot.querySelector(".shell").scrollWidth > innerWidth'), f'shell overflow: {label}'


def active_label(page):
    return page.locator('#host').evaluate('h => { const a = h.shadowRoot.activeElement; return a ? (a.getAttribute("aria-label") || a.textContent || "").trim() : "" }')


def check_dialog(page, section, opener, label, shot):
    opener.click()
    dialog = section.get_by_role('dialog')
    expect(dialog).to_be_visible()
    assert page.locator('#host').evaluate('h => !!h.shadowRoot.activeElement?.closest("dialog")'), f'focus not in dialog: {label}'
    no_overflow(page, f'{label} dialog')
    if shot: page.screenshot(path=str(out / shot), full_page=False)
    page.keyboard.press('Escape')
    expect(dialog).to_be_hidden()
    returned = active_label(page)
    assert returned == opener.get_attribute('aria-label') or returned == (opener.text_content() or '').strip(), f'focus did not return: {label} → {returned}'


with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = open_workspace(context, 'owner')

    for width in WIDTHS:
        page.set_viewport_size({'width': width, 'height': 1000 if width > 720 else 844})
        for number, (page_id, title) in enumerate(PAGES, start=1):
            section = go(page, page_id, title)
            no_overflow(page, f'{width} {page_id}')
            if width in (1440, 390):
                page.screenshot(path=str(out / f'{width}-{number:02d}-{page_id}.png'), full_page=True)
        checks.append(f'All 11 pages open at {width}px without page-level horizontal scrolling')

        shot = width in (1440, 390)
        section = go(page, 'documents', '知識庫與文件')
        check_dialog(page, section, section.get_by_role('button', name='檢視 綠生活指引.pdf'), f'{width} document', shot and f'{width}-dialog-document.png')
        section = go(page, 'releases', '知識版本')
        check_dialog(page, section, section.get_by_role('button', name='檢視 2026-11 候選版'), f'{width} release', shot and f'{width}-dialog-release.png')
        section = go(page, 'qa', '基本通用 QA')
        check_dialog(page, section, section.get_by_role('button', name='編輯 如何減少食物浪費？'), f'{width} qa', shot and f'{width}-dialog-qa.png')
        section = go(page, 'logs', '互動紀錄')
        check_dialog(page, section, section.get_by_role('button', name='檢視').first, f'{width} log', shot and f'{width}-dialog-log.png')
        section = go(page, 'conversations', '對話使用者')
        section.get_by_role('button', name='查看 張俊隆 的對話').click()
        expect(section.get_by_role('table', name='張俊隆 的對話')).to_be_visible()
        no_overflow(page, f'{width} person')
        if shot: page.screenshot(path=str(out / f'{width}-11-person.png'), full_page=True)
        check_dialog(page, section, section.get_by_role('table', name='張俊隆 的對話').get_by_role('button').first, f'{width} person detail', False)
        section.get_by_role('button', name='← 回到使用者列表').click()
        expect(section.get_by_role('table', name='對話使用者')).to_be_visible()
        checks.append(f'Dialogs at {width}px take focus, close with Esc and return focus to their button')

    page.set_viewport_size({'width': 1440, 'height': 1000})
    section = go(page, 'playground', '檢索試問台')
    section.get_by_label('問題').fill('每月少用 20 度電，少多少碳排？')
    section.get_by_role('button', name='試問', exact=True).click()
    expect(section.get_by_role('region', name='引用來源')).to_contain_text('綠生活指引.pdf')
    expect(section.get_by_role('region', name='費用')).to_contain_text('google-standard-text-2026-10-26')
    page.screenshot(path=str(out / 'flow-playground.png'), full_page=True)
    checks.append('Playground answers with citations, steps and costs')

    section = go(page, 'evaluation', 'RAG 評測')
    # A label that wraps a select also reads out the chosen option, so match the start of the name.
    section.get_by_role('combobox', name=re.compile('^題組')).select_option(label='驗收題組 v1 · 驗收題組 · 40 題')
    section.get_by_role('combobox', name=re.compile('^知識版本')).select_option(label='2026-11 候選版')
    section.get_by_role('button', name='開始評測').click()
    expect(section.get_by_role('region', name='評測報告')).to_contain_text('40／40')
    page.screenshot(path=str(out / 'flow-evaluation.png'), full_page=True)
    checks.append('Evaluation runs every case and shows the report')

    section = go(page, 'releases', '知識版本')
    section.get_by_role('button', name='檢視 2026-11 候選版').click()
    dialog = section.get_by_role('dialog')
    dialog.get_by_label('核准').check()
    dialog.get_by_label('審核意見').fill('瀏覽器驗證')
    dialog.get_by_label('已核對版本內容與評測結果').check()
    dialog.get_by_role('button', name='送出審核').click()
    expect(dialog.get_by_role('button', name='發布這個版本')).to_be_enabled()
    dialog.get_by_role('button', name='發布這個版本').click()
    expect(section.get_by_role('table', name='知識版本列表').get_by_role('row').filter(has_text='2026-11 候選版')).to_contain_text('使用中')
    page.keyboard.press('Escape')
    checks.append('A reviewed version that passed acceptance can be published')

    section = go(page, 'settings', '檢索設定')
    section.get_by_label('先找幾筆資料').fill('5')
    section.get_by_role('button', name='儲存設定').click()
    expect(section.get_by_role('alert')).to_have_text('回答時參考的段數，不能比先找的資料筆數多。')
    checks.append('Settings explain an invalid combination in plain words')

    viewer = open_workspace(context, 'viewer')
    section = go(viewer, 'logs', '互動紀錄')
    expect(section).to_contain_text('這一頁只有 owner 可以查看。')
    section = go(viewer, 'documents', '知識庫與文件')
    expect(section.get_by_role('button', name='＋ 匯入來源')).to_have_count(0)
    section = go(viewer, 'prompt', '全域提示詞')
    expect(section.get_by_label('提示詞內容')).not_to_be_editable()
    viewer.screenshot(path=str(out / 'viewer-07-prompt.png'), full_page=True)
    checks.append('A viewer can read but not change anything, and cannot open the owner-only pages')
    browser.close()

result = {'mode': 'fake-api', 'checks': checks, 'errors': errors, 'requests_outside_page': outside}
(out / 'browser-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
assert not errors, errors
assert not outside, outside
