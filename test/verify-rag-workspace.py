"""Browser QA of the RAG workspace on the in-memory API (test/rag-live-preview.html).

Start the Vite dev server first, then run:
  npx vite --host 127.0.0.1 --port 5199 --strictPort
  python3 test/verify-rag-workspace.py http://127.0.0.1:5199 ../verify-out/rag-workspace

Checks the ten sidebar pages and the two top-tab pages (users, the guide) at 1440, 1024, 768 and 390 px wide: page-level horizontal overflow, dialogs (focus moves
in, Esc closes, focus returns), the folding sidebar and its hover names, the guide's steps by mouse and keyboard, the main flows,
the viewer role, console errors and requests leaving the page.
Nothing here talks to Supabase; real data is checked separately after the backend is deployed.
"""
import json, re, sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5199'
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('../verify-out/rag-workspace')
out.mkdir(parents=True, exist_ok=True)
PAGES = [('documents', '文件'), ('import', '上傳文件'), ('personas', '教練人格'), ('prompt', '回答規則'), ('qa', '常見問答'),
         ('settings', '搜尋設定'), ('releases', '版本與發布'), ('playground', '試問'), ('evaluation', '自動測驗'),
         ('logs', '問答紀錄'), ('conversations', '使用者'), ('guide', '運作原理')]
TAB_PAGES = {'conversations': '使用者', 'guide': '運作原理'}
WIDTHS = [1440, 1024, 768, 390]
checks, errors, outside = [], [], []


def open_workspace(context, role):
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(f'{role}: {e}'))
    page.on('console', lambda m: errors.append(f'{role}: {m.text}') if m.type == 'error' else None)
    page.on('request', lambda r: outside.append(r.url) if urlparse(r.url).netloc != urlparse(base).netloc and not r.url.startswith('data:') else None)
    page.goto(f'{base}/test/rag-live-preview.html?role={role}')
    page.get_by_role('heading', name='文件', exact=True).wait_for()
    return page


def top_tab(page, name):
    return page.get_by_role('navigation', name='切換工作台').get_by_role('button', name=name, exact=True)


def go(page, page_id, title):
    if page_id in TAB_PAGES:
        top_tab(page, TAB_PAGES[page_id]).click()
        section = page.locator(f'[data-page="{page_id}"]')
        expect(section.get_by_role('heading', level=1)).to_have_text(title)
        expect(section.locator('.empty[role="status"]')).to_have_count(0)
        # A top-tab page has no sidebar column: its content is as wide as the workspace.
        main, shell = page.locator('#host').evaluate('h => ["main", ".shell"].map(s => h.shadowRoot.querySelector(s).getBoundingClientRect().width)')
        assert main >= min(shell, 1550) - 1, f'{page_id} is not full width: {main} of {shell}'
        return section
    top_tab(page, '知識庫').click()
    select = page.locator('#page-select')
    if select.is_visible():
        select.select_option(page_id)
    else:
        page.get_by_role('navigation', name='知識庫頁面').get_by_role('button', name=title, exact=True).click()
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
        checks.append(f'All 10 sidebar pages and both top-tab pages open at {width}px without page-level horizontal scrolling')

        shot = width in (1440, 390)
        section = go(page, 'documents', '文件')
        check_dialog(page, section, section.get_by_role('button', name='檢視 綠生活指引.pdf'), f'{width} document', shot and f'{width}-dialog-document.png')
        section = go(page, 'releases', '版本與發布')
        check_dialog(page, section, section.get_by_role('button', name='檢視 2026-11 候選版'), f'{width} release', shot and f'{width}-dialog-release.png')
        section = go(page, 'qa', '常見問答')
        check_dialog(page, section, section.get_by_role('button', name='編輯 如何減少食物浪費？'), f'{width} qa', shot and f'{width}-dialog-qa.png')
        section = go(page, 'logs', '問答紀錄')
        check_dialog(page, section, section.get_by_role('button', name='檢視').first, f'{width} log', shot and f'{width}-dialog-log.png')
        section = go(page, 'conversations', '使用者')
        expect(section.get_by_role('table', name='使用者').get_by_role('row').filter(has_text='張俊隆')).to_contain_text('帳號正常')
        expect(section.get_by_role('table', name='使用者').get_by_role('row').filter(has_text='陳小華')).to_contain_text('還沒有對話')
        expect(section.get_by_role('navigation', name='使用者列表分頁')).to_contain_text('共 5 位')
        size = section.get_by_role('table', name='使用者').locator('td').first.evaluate('td => getComputedStyle(td).fontSize')
        assert size == '14px', f'users list font size {size} at {width}'
        section.get_by_role('button', name='查看 張俊隆 的對話').click()
        expect(section.get_by_role('table', name='張俊隆 的對話')).to_be_visible()
        expect(section.get_by_role('region', name='目前狀態')).to_contain_text('今日用量')
        no_overflow(page, f'{width} person')
        if shot: page.screenshot(path=str(out / f'{width}-11-person.png'), full_page=True)
        # Switching top tabs keeps the open list.
        top_tab(page, '知識庫').click()
        top_tab(page, '使用者').click()
        expect(section.get_by_role('table', name='張俊隆 的對話')).to_be_visible()
        check_dialog(page, section, section.get_by_role('table', name='張俊隆 的對話').get_by_role('button').first, f'{width} person detail', False)
        section.get_by_role('button', name='回到使用者列表').click()
        expect(section.get_by_role('table', name='使用者')).to_be_visible()
        checks.append(f'Dialogs at {width}px take focus, close with Esc and return focus to their button; switching top tabs keeps the open list; the users list shows every account with its status, page total and 14px text')

        section = go(page, 'guide', '運作原理')
        tabs = section.get_by_role('tablist', name='選擇流程')
        current = section.locator('[aria-live="polite"] h3')
        tabs.get_by_role('tab', name='文件怎麼變成知識').click()
        for _ in range(3): section.get_by_role('button', name='下一步').click()
        expect(current).to_have_text('轉成可搜尋的格式')
        expect(section.get_by_role('list', name='架構總覽圖').locator('[aria-current="true"]')).to_contain_text('AI 模型')
        no_overflow(page, f'{width} guide')
        if shot: page.screenshot(path=str(out / f'{width}-12-guide-step.png'), full_page=True)
        tabs.get_by_role('tab', name='文件怎麼變成知識').focus()
        page.keyboard.press('ArrowRight')
        expect(tabs.get_by_role('tab', name='一個問題怎麼被回答')).to_have_attribute('aria-selected', 'true')
        assert active_label(page) == '一個問題怎麼被回答', f'arrow key did not move focus: {width}'
        section.get_by_role('button', name='第 4 步：找資料').focus()
        page.keyboard.press('Enter')
        expect(current).to_have_text('找資料')
        section.get_by_role('button', name=re.compile('^前往「')).focus()
        page.keyboard.press('Enter')
        expect(page.locator('[data-page="settings"]').get_by_role('heading', level=1)).to_have_text('搜尋設定')
        expect(top_tab(page, '知識庫')).to_have_attribute('aria-current', 'page')
        checks.append(f'The guide at {width}px follows both routes by mouse and keyboard and opens the related page in the RAG tab')

    page.set_viewport_size({'width': 1440, 'height': 1000})
    # The sidebar folds to icons, names each icon on hover, and stays folded after a reload.
    host = page.locator('#host')
    shell_folded = lambda: host.evaluate('h => h.shadowRoot.querySelector(".shell").classList.contains("folded")')
    go(page, 'documents', '文件')
    if shell_folded(): page.get_by_role('button', name='展開側欄').click()
    page.get_by_role('button', name='收合側欄').click()
    assert shell_folded(), 'sidebar did not fold'
    rail = page.get_by_role('navigation', name='知識庫頁面')
    rail.get_by_role('button', name='常見問答', exact=True).hover()
    page.wait_for_timeout(300)
    opacity = rail.get_by_role('button', name='常見問答', exact=True).locator('.nav-text').evaluate('e => getComputedStyle(e).opacity')
    assert opacity == '1', f'hover name not shown: {opacity}'
    width = host.evaluate('h => h.shadowRoot.querySelector(".sidebar").getBoundingClientRect().width')
    assert width <= 60, f'folded sidebar is {width}px wide'
    page.screenshot(path=str(out / '1440-folded-hover.png'))
    page.reload()
    page.get_by_role('heading', name='文件', exact=True).wait_for()
    assert shell_folded(), 'folded sidebar not remembered'
    page.get_by_role('button', name='展開側欄').click()
    assert not shell_folded()
    checks.append('The sidebar folds to a 56px icon rail, names each icon on hover, and stays folded after a reload')

    section = go(page, 'playground', '試問')
    section.get_by_label('問題').fill('每月少用 20 度電，少多少碳排？')
    section.get_by_role('button', name='試問', exact=True).click()
    expect(section.get_by_role('region', name='引用')).to_contain_text('綠生活指引.pdf')
    expect(section.get_by_role('region', name='費用')).to_contain_text('google-standard-text-2026-10-26')
    page.screenshot(path=str(out / 'flow-playground.png'), full_page=True)
    checks.append('Playground answers with citations, steps and costs')

    section = go(page, 'evaluation', '自動測驗')
    # A label that wraps a select also reads out the chosen option, so match the start of the name.
    section.get_by_role('combobox', name=re.compile('^題組')).select_option(label='驗收題組 v1 · 驗收題組 · 40 題')
    section.get_by_role('combobox', name=re.compile('^版本')).select_option(label='2026-11 候選版')
    section.get_by_role('button', name='開始測驗').click()
    expect(section.get_by_role('region', name='測驗報告')).to_contain_text('40／40')
    page.screenshot(path=str(out / 'flow-evaluation.png'), full_page=True)
    checks.append('Evaluation runs every case and shows the report')

    section = go(page, 'releases', '版本與發布')
    section.get_by_role('button', name='檢視 2026-11 候選版').click()
    dialog = section.get_by_role('dialog')
    dialog.get_by_label('核准').check()
    dialog.get_by_label('審核意見').fill('瀏覽器驗證')
    dialog.get_by_label('已核對版本內容和測驗結果').check()
    dialog.get_by_role('button', name='送出審核').click()
    expect(dialog.get_by_role('button', name='發布這個版本')).to_be_enabled()
    dialog.get_by_role('button', name='發布這個版本').click()
    expect(section.get_by_role('table', name='版本列表').get_by_role('row').filter(has_text='2026-11 候選版')).to_contain_text('使用中')
    page.keyboard.press('Escape')
    checks.append('A reviewed version that passed acceptance can be published')

    section = go(page, 'settings', '搜尋設定')
    section.get_by_label('先找幾筆資料').fill('5')
    section.get_by_role('button', name='儲存設定').click()
    expect(section.get_by_role('alert')).to_have_text('回答時參考的段數，不能比先找的資料筆數多。')
    checks.append('Settings explain an invalid combination in plain words')

    viewer = open_workspace(context, 'viewer')
    section = go(viewer, 'logs', '問答紀錄')
    expect(section).to_contain_text('這一頁只有管理者可以看。')
    section = go(viewer, 'documents', '文件')
    expect(section.get_by_role('button', name='上傳文件')).to_have_count(0)
    section = go(viewer, 'prompt', '回答規則')
    expect(section.get_by_label('規則內容')).not_to_be_editable()
    viewer.screenshot(path=str(out / 'viewer-07-prompt.png'), full_page=True)
    section = go(viewer, 'guide', '運作原理')
    expect(section.get_by_role('region', name='目前的實際設定').locator('dt')).to_have_text(['文件', '搜尋設定', 'AI 模型'])
    viewer.screenshot(path=str(out / 'viewer-12-guide.png'), full_page=True)
    checks.append('A viewer can read but not change anything, cannot open the owner-only pages, and sees only its own live settings in the guide')
    browser.close()

result = {'mode': 'fake-api', 'checks': checks, 'errors': errors, 'requests_outside_page': outside}
(out / 'browser-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
assert not errors, errors
assert not outside, outside
