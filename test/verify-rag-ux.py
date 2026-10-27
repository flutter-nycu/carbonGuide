"""Exercise real React views with synthetic data; deny all external requests."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4186'
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('reports/rag-ux-navigation/browser')
out.mkdir(parents=True, exist_ok=True)
checks, errors, external = [], [], []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    context = browser.new_context()
    def route(request):
        if request.request.url.startswith(base + '/'):
            request.continue_()
        else:
            external.append(request.request.url.split('?')[0])
            request.abort()
    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    for width in [1440, 1024, 768, 390, 375]:
        page.set_viewport_size({'width': width, 'height': 900 if width > 720 else 812})
        page.goto(base + '/test/rag-ux-preview.html')
        docs = page.get_by_role('button', name='檢視 測試文件 10：氣候與生活指南', exact=True)
        docs.scroll_into_view_if_needed()
        y = page.evaluate('window.scrollY')
        docs.click()
        dialog = page.get_by_role('dialog', name='測試文件 10：氣候與生活指南', exact=True)
        expect(dialog).to_be_visible()
        expect(dialog.locator('.rag-chunk > p').filter(has_text='段落內容 1。')).to_be_visible()
        box = dialog.bounding_box()
        assert box['y'] >= -1 and box['y'] + box['height'] <= page.viewport_size['height'] + 1
        for _ in range(12):
            page.keyboard.press('Tab')
            assert dialog.evaluate('(el) => el.contains(document.activeElement)'), page.evaluate('document.activeElement.outerHTML.slice(0, 300)')
        dialog.locator('.rag-detail-body').evaluate('(el) => { el.scrollTop = el.scrollHeight }')
        close = dialog.get_by_role('button', name='關閉詳情', exact=True)
        assert close.bounding_box()['y'] < 120
        dialog.get_by_role('button', name='下一頁', exact=True).click()
        expect(dialog.locator('.rag-chunk > p').filter(has_text='段落內容 26。')).to_be_visible()
        first_chunk = dialog.locator('.rag-chunk').first.bounding_box()
        assert first_chunk['y'] >= dialog.locator('.rag-detail-header').bounding_box()['height']
        assert first_chunk['y'] < page.viewport_size['height'] - 100
        page.screenshot(path=str(out / f'{width}-document-detail.png'))
        page.keyboard.press('Escape')
        expect(dialog).to_have_count(0)
        assert docs.evaluate('(el) => el === document.activeElement')
        assert abs(page.evaluate('window.scrollY') - y) <= 2
        assert page.evaluate('document.documentElement.style.overflow') != 'hidden'
        page.get_by_role('button', name='下一頁文件').click()
        expect(page.get_by_role('button', name='檢視 測試文件 13：氣候與生活指南', exact=True)).to_be_visible()
        page.get_by_label('搜尋文件', exact=True).fill('測試文件 60')
        expect(page.get_by_role('button', name='檢視 測試文件 60：氣候與生活指南', exact=True)).to_be_visible()
        checks.append({'width': width, 'documents_dialog_focus_scroll_pagination': 'passed'})

        page.get_by_role('button', name='互動紀錄', exact=True).click()
        opener = page.get_by_role('button', name='查看問答 request-', exact=True).first
        expect(page.get_by_text('測試問題 1：如何減少生活碳排放？', exact=True)).to_be_visible()
        opener.click()
        detail = page.get_by_role('dialog', name='問答詳情', exact=True)
        expect(detail.get_by_text('測試問題 1：如何減少生活碳排放？', exact=True)).to_be_visible()
        expect(detail.get_by_text('先規劃需要的份量，並依照來源資料核對適用條件。', exact=True)).to_be_visible()
        detail.locator('summary').filter(has_text='引用 1').click()
        expect(detail.get_by_text('先規劃需要的份量。', exact=True)).to_be_visible()
        page.screenshot(path=str(out / f'{width}-question-detail.png'))
        detail.get_by_role('button', name='關閉詳情', exact=True).click()
        assert opener.evaluate('(el) => el === document.activeElement')
        page.get_by_role('button', name='查看問答 request-', exact=True).nth(1).click()
        expect(page.get_by_role('dialog').get_by_text('問題與回答已超過保留期限；題數與費用帳仍保留。', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).to_have_count(0)
        page.get_by_role('combobox', name='紀錄來源', exact=True).select_option('evaluation')
        expect(page.get_by_text('測試問題 26：如何減少生活碳排放？', exact=True)).to_be_visible()
        page.get_by_role('combobox', name='紀錄來源', exact=True).select_option('query')
        page.get_by_role('button', name='下一頁問答', exact=True).click()
        expect(page.get_by_text('測試問題 21：如何減少生活碳排放？', exact=True)).to_be_visible()
        checks.append({'width': width, 'saved_question_answer_citation_expiry_filter_pagination': 'passed'})

        page.get_by_role('button', name='通用 QA', exact=True).click()
        edit = page.get_by_role('button', name='編輯 生活問題 15', exact=True)
        edit.scroll_into_view_if_needed()
        before = page.evaluate('window.scrollY')
        edit.click()
        editor = page.get_by_role('dialog', name='通用 QA · 編輯草稿', exact=True)
        expect(editor.get_by_label('問題', exact=True)).to_have_value('生活問題 15')
        assert editor.bounding_box()['y'] >= 0
        page.keyboard.press('Escape')
        expect(editor).to_have_count(0)
        assert edit.evaluate('(el) => el === document.activeElement')
        assert abs(page.evaluate('window.scrollY') - before) <= 2
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        checks.append({'width': width, 'editor_visible_close_returns_to_list_no_horizontal_overflow': 'passed'})
    browser.close()
report = {'mode': 'synthetic_browser', 'checks': checks, 'errors': errors, 'external_requests': external, 'paid_calls': 0}
(out / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'checks': len(checks), 'errors': errors, 'external_requests': external, 'paid_calls': 0}, ensure_ascii=False))
assert not errors and not external
