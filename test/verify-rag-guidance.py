"""Read-only UX verification on actual React views with explicitly synthetic data."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

base='http://127.0.0.1:4186'
out=Path('reports/rag-guidance/guidance-browser'); out.mkdir(parents=True,exist_ok=True)
errors=[]; external=[]; checks=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    context=browser.new_context()
    def route(r):
        if r.request.url.startswith(base+'/'): r.continue_()
        else: external.append(r.request.url.split('?')[0]); r.abort()
    context.route('**/*',route)
    page=context.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
    for width in [1440,1024,768,390,375]:
        page.set_viewport_size({'width':width,'height':900 if width>720 else 812})
        page.goto(base+'/test/rag-ux-preview.html')
        help=page.locator('.rag-page-help')
        help.locator('summary').click()
        expect(help.get_by_text('先搜尋文件',exact=False)).to_be_visible()
        page.screenshot(path=str(out/f'{width}-page-help.png'))
        action=page.get_by_role('button',name='檢視 測試文件 1：氣候與生活指南',exact=True)
        # A short action must fit on one text line even when the title is long.
        assert action.evaluate('(e)=>{const r=document.createRange();r.selectNodeContents(e);return r.getClientRects().length===1}')
        action.click()
        dialog=page.get_by_role('dialog')
        correction=dialog.locator('.rag-chunk').first.locator('details')
        correction.locator('summary').click()
        correction.get_by_label('從新集合排除此段',exact=True).check()
        expect(correction.get_by_label('修訂文字',exact=True)).to_be_disabled()
        expect(correction.get_by_text('將在新版本中不收錄第 1 段。',exact=False)).to_be_visible()
        correction.scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'{width}-exclusion-draft.png'))
        page.keyboard.press('Escape')
        page.get_by_role('button',name='通用 QA',exact=True).click()
        citations=page.locator('details').filter(has=page.locator('summary').filter(has_text='核對 QA 引用')).first
        citations.locator('summary').click()
        expect(citations.get_by_label('段落識別碼',exact=True)).to_have_value('chunk-0')
        citations.get_by_role('button',name='移除引用 1',exact=True).click()
        expect(citations.get_by_text('引用清單尚未儲存。',exact=True)).to_be_visible()
        citations.scroll_into_view_if_needed()
        page.screenshot(path=str(out/f'{width}-citation-draft.png'))
        citations.locator('summary').click(); citations.locator('summary').click()
        expect(citations.get_by_label('段落識別碼',exact=True)).to_have_value('chunk-0')
        page.get_by_role('button',name='互動紀錄',exact=True).click()
        page.get_by_role('button',name='查看問答 request-',exact=True).nth(2).click()
        dialog=page.get_by_role('dialog')
        expect(dialog.get_by_role('heading',name='本次實際回覆（拒答）')).to_be_visible()
        expect(dialog.get_by_text('目前這個知識版本沒有足夠且可核對的資料回答，請補充問題或交由管理員確認。',exact=True)).to_be_visible()
        page.screenshot(path=str(out/f'{width}-saved-refusal.png'))
        page.keyboard.press('Escape')
        page.get_by_role('button',name='查看問答 request-',exact=True).nth(3).click()
        expect(page.get_by_role('dialog').get_by_text('無法確認本次是否完成',exact=False)).to_be_visible()
        page.keyboard.press('Escape')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        checks.append({'width':width,'help_short_action_exclusion_local_citation_reset_refusal_uncertainty_no_overflow':'passed'})
    browser.close()
report={'mode':'synthetic_browser','checks':checks,'page_errors':errors,'external_requests':external,'paid_calls':0,'saves':0}
(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
assert not errors and not external
