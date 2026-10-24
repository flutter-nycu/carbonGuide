"""Local Chromium checks for the static preview; does not attach to user Chrome."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/rag-preview/'
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('verification/rag-preview')
out.mkdir(parents=True, exist_ok=True)
results = {'base': base, 'checks': [], 'errors': [], 'external_requests': []}

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    def go(tab):
        if page.locator('#page-select').is_visible():
            page.locator('#page-select').select_option(tab)
        else:
            page.locator(f'#nav [data-id="{tab}"]').click()
    page.on('pageerror', lambda error: results['errors'].append(str(error)))
    page.on('console', lambda msg: results['errors'].append(msg.text) if msg.type == 'error' else None)
    page.on('request', lambda request: results['external_requests'].append(request.url) if not request.url.startswith(base.split('/rag-preview/')[0]) else None)
    page.goto(base)
    page.get_by_role('heading', name='知識庫與文件').wait_for()
    page.screenshot(path=str(out / 'knowledge-desktop.png'), full_page=True)
    tabs = page.locator('#nav button').evaluate_all('(els) => els.map(e => e.dataset.id)')
    for width in [1440, 1024, 768, 390, 375]:
        page.set_viewport_size({'width': width, 'height': 1000 if width > 720 else 844})
        for tab in tabs:
            go(tab)
            assert page.locator('h1').is_visible(), tab
            overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
            assert not overflow, f'Page overflow: {width}/{tab}'
            if width in [1440, 390] and tab in ['documents', 'import', 'playground', 'releases', 'evaluation', 'settings', 'prompt', 'personas']:
                page.screenshot(path=str(out / f'{tab}-{width}.png'), full_page=True)
        results['checks'].append(f'12 screens without page overflow at {width}px')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    go('import')
    page.get_by_role('button', name='載入示範批次').click()
    assert page.get_by_text('超過單檔 20 MiB 上限，請拆分文件').is_visible()
    page.get_by_role('button', name='建立示範草稿').click()
    assert page.locator('#doc-rows tr').count() == 8
    results['checks'].append('Batch preflight excludes oversized file and creates only drafts')
    go('playground')
    page.locator('[data-action="question"][data-id="如何減少食物浪費？"]').click()
    page.get_by_role('button', name='試問', exact=True).click()
    assert '[1]' in page.locator('.answer').inner_text()
    page.locator('#toast').wait_for(state='hidden')
    page.screenshot(path=str(out / 'playground-answer-desktop.png'), full_page=True)
    page.get_by_role('button', name='查看來源 →').click()
    assert page.locator('dialog').is_visible()
    page.screenshot(path=str(out / 'document-preview.png'), full_page=True)
    page.keyboard.press('Escape')
    assert not page.locator('dialog').is_visible()
    results['checks'].append('QA answer has source preview; Escape dismisses modal')
    go('releases')
    assert page.get_by_role('button', name='模擬發布下一版').is_disabled()
    go('evaluation')
    page.get_by_role('button', name='執行評測').click()
    assert page.get_by_text('失敗 · 同義詞未命中').is_visible()
    page.get_by_label('切換為修正後情境（示範）').check()
    page.get_by_role('button', name='執行評測').click()
    go('releases')
    page.get_by_role('button', name='模擬審核通過').click()
    page.get_by_role('button', name='模擬發布下一版').click()
    page.get_by_role('button', name='模擬回滾').click()
    results['checks'].append('Evaluation, review, publication and rollback work in Chromium')
    page.reload()
    assert page.locator('#doc-rows tr').count() == 6
    go('logs')
    assert page.get_by_text('還沒有試問紀錄。', exact=False).is_visible()
    results['checks'].append('Reload restores original data and clears logs')
    go('documents')
    page.locator('.quick-start summary').click()
    go('import'); go('documents')
    assert not page.locator('.quick-start').evaluate('(el) => el.open')
    results['checks'].append('Guidance can be collapsed and stays collapsed during navigation')
    go('prompt')
    page.locator('#prompt-draft').fill('示範草稿：保留來源引用。')
    page.get_by_role('button', name='儲存草稿', exact=True).click()
    assert '尚未套用' in page.locator('#prompt-draft-status').inner_text()
    assert '草稿使用 p1' in page.locator('main').inner_text()
    page.get_by_role('button', name='前往草稿試問 →').click()
    assert page.locator('#test-scope').input_value() == 'draft'
    page.locator('#question').fill('如何減少食物浪費？')
    page.locator('#test-scope').select_option('published')
    assert page.locator('#question').input_value() == '如何減少食物浪費？'
    results['checks'].append('Prompt draft stays unapplied; scope switching preserves typed question')
    go('settings')
    assert not page.locator('.setting-details').first.evaluate('(el) => el.open')
    page.locator('.setting-details').first.locator('summary').click()
    page.locator('#chunk').fill('700')
    page.locator('#candidate').fill('24')
    assert '24' in page.locator('#candidate-preview').inner_text()
    page.get_by_role('button', name='儲存檢索設定').click()
    assert page.locator('#chunk').input_value() == '700'
    results['checks'].append('Advanced settings expand, explain impact and save without losing values')
    go('personas')
    assert page.locator('.persona-tone').count() == 2
    page.locator('[data-action="edit-persona"][data-id="0"]').click()
    page.locator('#persona-example-0').fill('先比較每個選項的時間和花費。')
    page.get_by_role('button', name='取消', exact=True).click()
    assert '先比較碳排' in page.locator('.persona-tone').first.inner_text()
    page.locator('[data-action="edit-persona"][data-id="0"]').click()
    page.locator('#persona-example-0').fill('先比較每個選項的時間和花費。')
    page.get_by_role('button', name='儲存人格', exact=True).click()
    assert '先比較每個選項' in page.locator('.persona-tone').first.inner_text()
    page.get_by_role('switch', name='理性型啟用狀態').click()
    page.get_by_role('switch', name='共感型啟用狀態').click()
    assert page.get_by_role('switch', name='共感型啟用狀態').get_attribute('aria-checked') == 'true'
    results['checks'].append('Persona tone cards support cancel/save and preserve at least one enabled persona')
    page.goto(base + 'prototype.html')
    assert page.get_by_role('button', name='管理後台', exact=True).is_visible()
    results['checks'].append('Original coach/commute prototype is preserved and loads')
    browser.close()

assert not results['errors'], results['errors']
assert not results['external_requests'], results['external_requests']
results['status'] = 'mock_verified'
(out / 'verification.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
