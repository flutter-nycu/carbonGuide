"""Production-build browser checks: synthetic metadata, mock transport/auth, no live writes."""
import base64
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4186'
out = Path('reports/rag-trace-viewer/browser')
out.mkdir(parents=True, exist_ok=True)
recorded = json.loads(Path('test/fixtures/rag-traces.synthetic.json').read_text(encoding='utf-8'))
recorded.sort(key=lambda row: (row['trace']['started_at'], row['trace']['id']), reverse=True)
by_id = {row['trace']['id']: row for row in recorded}
ref = 'abcdefghijklmnopqrst'
remote = f'https://{ref}.supabase.co'
headers = {h['key']: h['value'] for h in next(item for item in json.loads(Path('vercel.json').read_text())['headers'] if item['source'] == '/push-admin')['headers']}
def encode(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
token = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode({'sub': 'test-admin', 'exp': int(time.time()) + 3600, 'role': 'authenticated'}) + '.test'
session = {'access_token': token, 'refresh_token': 'test-refresh', 'expires_at': int(time.time()) + 3600, 'expires_in': 3600, 'token_type': 'bearer', 'user': {'id': 'test-admin', 'email': 'j20692091@gmail.com', 'aud': 'authenticated', 'role': 'authenticated'}}
errors, unexpected, calls, checks = [], [], [], []
state = {'role': 'owner', 'fail_list': False, 'missing_detail': False}
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    def route_all(route):
        request = route.request
        if request.url.startswith(base + '/'):
            if '/push-admin.html' in request.url:
                response = route.fetch()
                route.fulfill(response=response, headers={**response.headers, **headers})
            else:
                route.continue_()
            return
        if not request.url.startswith(remote + '/'):
            unexpected.append(request.url); route.abort(); return
        cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'}
        if request.method == 'OPTIONS':
            route.fulfill(status=200, headers=cors, body=''); return
        name = urlparse(request.url).path.split('/')[-1]
        if name == 'admin_users': result = {'role': state['role']}
        elif name == 'rag_list_traces':
            args = request.post_data_json; calls.append({'rpc': name, 'args': args})
            assert args['p_limit'] == 25
            if state['fail_list']:
                state['fail_list'] = False
                route.fulfill(status=503, headers=cors, content_type='application/json', body='{"code":"unavailable"}'); return
            start = next((i + 1 for i, row in enumerate(recorded) if row['trace']['id'] == args['p_before_id']), 0)
            if start:
                assert args['p_before'] == recorded[start - 1]['trace']['started_at']
            result = [row['trace'] for row in recorded[start:start + 25]]
        elif name == 'rag_get_trace':
            args = request.post_data_json; calls.append({'rpc': name, 'args': args})
            result = None if state['missing_detail'] else by_id[args['p_trace_id']]
        elif name in ('documents', 'document_versions', 'rag_runs', 'push_campaigns'): result = []
        elif name == 'logout': result = {}
        else:
            unexpected.append(request.url); result = []
        route.fulfill(status=200, headers=cors, content_type='application/json', body=json.dumps(result))
    context.route('**/*', route_all)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/push-admin.html#rag')
    page.get_by_role('heading', name='登入管理工作台').wait_for()
    assert page.locator('.rag-workspace').count() == 0
    page.evaluate('([key, value]) => localStorage.setItem(key, JSON.stringify(value))', [f'sb-{ref}-auth-token', session])
    page.reload()
    nav = page.get_by_role('navigation', name='RAG 功能')
    nav.get_by_role('button', name='互動紀錄', exact=True).click()
    page.get_by_text('第 1 頁 · 本頁 25 筆', exact=True).wait_for()
    assert len(calls) == 1
    checks.append('Owner list loads 25 rows with no detail N+1 requests; signed-out entry protected')
    for page_index, batch in enumerate([recorded[:25], recorded[25:]]):
        for row_index, row in enumerate(batch):
            opener = page.get_by_role('button', name=f"查看流程 {row['trace']['question_key']} {row['trace']['prompt_version']}", exact=True)
            opener.click()
            inspector = page.get_by_role('region', name='節點明細')
            inspector.wait_for()
            expect(page.get_by_role('heading', name='流程詳情')).to_be_focused()
            assert page.get_by_label('處理流程節點').get_by_role('button').count() == len(row['spans'])
            cost = page.get_by_label('本次費用明細')
            assert cost.get_by_text('未知', exact=True).count() == (3 if not row['charges'] else 2)
            if row_index == 0:
                for width in [1440, 1024, 768, 390, 375]:
                    page.set_viewport_size({'width': width, 'height': 1000 if width > 720 else 844})
                    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), width
                    for button in page.get_by_label('處理流程節點').get_by_role('button').all():
                        button.focus(); page.keyboard.press('Enter'); expect(button).to_have_attribute('aria-pressed', 'true')
                    if width in (1440, 390):
                        page.evaluate('window.scrollTo(0, 0)')
                        page.screenshot(path=str(out / f'page{page_index + 1}-{width}-detail.png'), full_page=True)
                page.set_viewport_size({'width': 1440, 'height': 1000})
            page.get_by_role('button', name='← 返回追蹤列表', exact=True).click()
            expect(opener).to_be_focused()
        page.evaluate('window.scrollTo(0, 0)')
        page.screenshot(path=str(out / f'page{page_index + 1}-list.png'), full_page=True)
        if page_index == 0:
            page.get_by_role('button', name='下一頁追蹤', exact=True).click()
            page.get_by_text('第 2 頁 · 本頁 15 筆', exact=True).wait_for()
    expect(page.get_by_role('button', name='下一頁追蹤', exact=True)).to_be_disabled()
    checks.append('All 40 synthetic traces render, 297 nodes and 39 charges; unknown billed/estimated amounts preserved')
    checks.append('1440/1024/768/390/375px, keyboard node activation and opener focus, no document overflow')
    state['missing_detail'] = True
    page.get_by_role('button', name='查看流程', exact=False).first.click()
    page.get_by_text('這筆追蹤已過期、已清除或目前無權讀取。請返回列表重新整理。', exact=True).wait_for()
    page.get_by_role('button', name='← 返回追蹤列表', exact=True).click()
    state['fail_list'] = True
    page.get_by_role('button', name='重新整理追蹤', exact=True).click()
    page.get_by_role('button', name='重試讀取追蹤', exact=True).click()
    page.get_by_text('第 1 頁 · 本頁 25 筆', exact=True).wait_for()
    checks.append('Missing detail, failed list and retry are distinct and recoverable')
    for role in ['editor', 'viewer']:
        state['role'] = role
        count = len(calls)
        page.reload()
        page.get_by_role('navigation', name='RAG 功能').get_by_role('button', name='互動紀錄', exact=True).click()
        page.get_by_text('只有管理者可查看互動紀錄。這項限制也由資料庫權限執行。', exact=True).wait_for()
        assert len(calls) == count
        assert page.get_by_label('歷史評測追蹤').count() == 0
    page.get_by_role('button', name='登出', exact=True).click()
    page.get_by_role('heading', name='登入管理工作台').wait_for()
    assert page.locator('.rag-workspace').count() == 0
    checks.append('Editor/viewer request no trace RPC; logout unmounts workspace')
    browser.close()
result = {'mode': 'mock_transport_synthetic_metadata', 'source': 'test/fixtures/rag-traces.synthetic.json', 'checks': checks, 'rpc_calls': calls, 'errors': errors, 'unexpected_requests': unexpected, 'live_model_calls': 0}
(out / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in result.items() if key != 'rpc_calls'}, ensure_ascii=False, indent=2))
assert not errors and not unexpected
