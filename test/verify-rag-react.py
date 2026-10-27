"""React workspace browser regression. All Supabase requests are mocked; no live writes."""
import base64
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4185'
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('reports/rag-react-foundation/browser')
out.mkdir(parents=True, exist_ok=True)
ref = 'abcdefghijklmnopqrst'
url = f'https://{ref}.supabase.co'
headers = {h['key']: h['value'] for h in next(item for item in json.loads(Path('vercel.json').read_text())['headers'] if item['source'] == '/push-admin')['headers']}
def encode(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
token = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode({'sub': 'test-admin', 'exp': int(time.time()) + 3600, 'role': 'authenticated'}) + '.test'
session = {'access_token': token, 'refresh_token': 'test-refresh', 'expires_at': int(time.time()) + 3600, 'expires_in': 3600, 'token_type': 'bearer', 'user': {'id': 'test-admin', 'email': 'j20692091@gmail.com', 'aud': 'authenticated', 'role': 'authenticated'}}
stamp = '2026-10-25T00:00:00Z'
pilot_fixture = json.loads(Path('test/fixtures/rag-pilot.synthetic.json').read_text(encoding='utf-8'))
v1_fixture = json.loads(Path('test/fixtures/rag-v1.synthetic.json').read_text(encoding='utf-8'))
data = {
    'documents': [{'id': 'doc', 'title': '居家節電指南（測試資料）', 'source_type': 'pdf', 'purpose': '生活指引', 'domain': '居家', 'created_at': stamp}],
    'document_versions': [{'id': 'version', 'document_id': 'doc', 'version': 1, 'processing_status': 'ready', 'content_status': 'draft', 'failure_reason': None, 'created_at': stamp}],
    'chunk_sets': [{'id': 'set1', 'document_version_id': 'version', 'content_hash': 'a' * 64, 'chunker_version': 'v1', 'sealed': True, 'created_at': stamp}],
    'chunks': [{'id': 'chunk', 'document_version_id': 'version', 'ordinal': 1, 'page_start': 2, 'page_end': 2, 'section_path': '節電習慣', 'original_text': '先記錄用電量，再比較改善前後的差異。'}],
    'qa_entries': [], 'personas': [], 'prompts': [], 'knowledge_releases': [], 'evaluation_runs': [], 'rag_runs': [],
    'embedding_profiles': [{'id': 'profile', 'model': 'text-embedding-3-large', 'dimensions': 1536, 'distance_metric': 'cosine', 'chunker_version': 'structure-v1'}],
    'rag_service_state': [{'id': True, 'service_enabled': False, 'active_release_id': None, 'answer_style': 'standard', 'daily_question_limit': 20, 'retrieval_candidates': 20, 'context_chunks': 6, 'similarity_threshold': .72, 'qa_threshold': .9, 'fallback_reply': '目前沒有足夠的已核定資料。', 'rewrite_enabled': False, 'tools_enabled': False, 'updated_at': stamp}],
    **{key: [] for key in ('rag_v1_originals', 'rag_v1_jobs', 'rag_v1_urls', 'rag_v1_sets', 'rag_v1_reviews', 'rag_v1_activations', 'rag_v1_evaluations', 'rag_v1_calculation_drafts', 'rag_v1_datasets', 'rag_v1_evaluation_batches', 'rag_v1_evaluation_receipts', 'rag_v1_qa_citations')},
    'rag_v1_campaigns': [v1_fixture['campaign']], 'rag_v1_rounds': [v1_fixture['round']],
    'rag_v1_requests': [{**v1_fixture['request'], 'origin': 'query', 'rag_v1_request_details': {'question': '如何減少生活碳排放？', 'answer': '先核對來源資料。', 'expires_at': '2099-01-01T00:00:00Z'}}],
    'rag_v1_request_details': {'question': '如何減少生活碳排放？', 'expires_at': '2099-01-01T00:00:00Z'},
    'rag_v1_run_calls': [{'rag_v1_model_calls': call} for call in v1_fixture['result']['calls']],
}
errors, writes, unexpected, checks = [], [], [], []
data['rag_v1_originals'] = [{'id': 'original', 'document_version_id': 'version', 'sha256': 'a' * 64, 'byte_size': 1000,
    'source_name': '居家節電指南（測試資料）.pdf', 'upload_state': 'verified', 'created_at': stamp}]
data['rag_v1_jobs'] = [{'id': 'parse-job', 'original_id': 'original', 'stage': 'parse', 'status': 'completed', 'attempt': 1,
    'output_set_id': 'set1', 'failure_reason': None, 'updated_at': stamp,
    'quality': {'human_approved': False, 'quarantine': {'count': 2, 'physical_pages': [3, 7], 'chunk_ordinals': [4, 9]}}}]
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    def route_all(route):
        request = route.request
        if request.url.startswith(base):
            if '/push-admin.html' in request.url:
                response = route.fetch()
                route.fulfill(response=response, headers={**response.headers, **headers})
            else:
                route.continue_()
            return
        if not request.url.startswith(url + '/'):
            unexpected.append(request.url)
            route.abort()
            return
        cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'}
        if request.method == 'OPTIONS':
            route.fulfill(status=200, headers=cors, body='')
            return
        entity = urlparse(request.url).path.split('/')[-1]
        if entity == 'admin_users':
            result = {'role': 'owner'}
        elif entity == 'rag_usage_today':
            result = [{'day': '2026-10-25', 'question_count': 0}]
        elif entity == 'rag_list_traces':
            result = []
        elif entity == 'rag_pilot_status':
            result = {**pilot_fixture['status'], 'enabled': False}
        elif entity == 'rag_pilot_history':
            result = [item['run'] for item in pilot_fixture['details']]
        elif entity == 'rag_pilot_detail':
            result = next((item for item in pilot_fixture['details'] if item['run']['id'] == request.post_data_json['p_id']), None)
        elif entity == 'rag-v1':
            action = request.post_data_json.get('action')
            if action == 'request_read': result = v1_fixture['result']
            elif action == 'operations': result = v1_fixture['operations']
            else:
                unexpected.append('Unexpected v1 action: ' + str(action))
                route.abort()
                return
        elif entity == 'logout':
            result = {}
        elif entity in data:
            if request.method in ('POST', 'PATCH'):
                writes.append(entity)
                row = {**request.post_data_json, 'id': 'saved', 'updated_at': stamp}
                data[entity].append(row)
                result = {'id': 'saved'}
            else:
                result = data[entity]
        elif entity == 'push_campaigns':
            result = []
        else:
            unexpected.append(request.url)
            result = {}
        route.fulfill(status=200, content_type='application/json', body=json.dumps(result), headers=cors)
    context.route('**/*', route_all)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/push-admin.html#rag')
    page.get_by_role('heading', name='登入管理工作台').wait_for()
    assert page.locator('.rag-workspace').count() == 0
    checks.append('Signed-out deep link is protected')
    page.evaluate('([key, value]) => localStorage.setItem(key, JSON.stringify(value))', [f'sb-{ref}-auth-token', session])
    page.reload()
    try:
        page.get_by_role('button', name='檢視 居家節電指南（測試資料）').wait_for()
    except Exception:
        page.screenshot(path=str(out / 'failure.png'), full_page=True)
        (out / 'failure.json').write_text(json.dumps({'errors': errors, 'unexpected': unexpected, 'body': page.locator('body').inner_text()}, ensure_ascii=False, indent=2), encoding='utf-8')
        raise
    assert page.locator('.rag-workspace').evaluate('(node) => node.shadowRoot === null')
    page.get_by_role('button', name='檢視 居家節電指南（測試資料）').click()
    page.get_by_role('paragraph').filter(has_text='先記錄用電量，再比較改善前後的差異。').wait_for()
    checks.append('Native React document/version/chunk-set preview with production CSP')
    page.get_by_role('button', name='關閉詳情').click()
    navigation = page.get_by_role('navigation', name='RAG 功能')
    for width in [1440, 1024, 768, 390, 375]:
        page.set_viewport_size({'width': width, 'height': 1000 if width > 720 else 844})
        for title in ['文件與段落', '通用 QA', '人格與提示詞', '試問', '知識版本', '互動紀錄', 'RAG 設定']:
            navigation.get_by_role('button', name=title, exact=True).click()
            page.get_by_role('heading', name=title, exact=True).wait_for()
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), (width, title)
            if width > 720:
                sidebar = page.locator('.rag-sidebar').bounding_box()
                main = page.locator('.rag-main').bounding_box()
                assert sidebar['width'] <= 250 and main['x'] >= sidebar['x'] + sidebar['width'], (width, sidebar, main)
                assert sidebar['y'] >= -1, (width, 'sticky sidebar must remain accessible')
            if width in (1440, 390) and title in ('文件與段落', '人格與提示詞', 'RAG 設定'):
                if title == '文件與段落':
                    for summary in ('匯入文件與查看處理進度', '查看逐檔處理進度與下載原檔', '已隔離 2 個原始段落，內容不完整'):
                        element = page.get_by_text(summary, exact=True)
                        if not element.evaluate('(node) => node.parentElement.open'): element.click()
                    page.get_by_text('受影響物理頁：3、7', exact=True).wait_for()
                    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), (width, 'quality notice')
                page.evaluate('window.scrollTo(0, 0)')
                page.screenshot(path=str(out / f'{width}-{title}.png'), full_page=True)
    checks.append('All seven screens fit 1440/1024/768/390/375px without page overflow')
    navigation.get_by_role('button', name='試問', exact=True).click()
    for width in [1440, 1024, 768, 390, 375]:
        page.set_viewport_size({'width': width, 'height': 1000 if width > 720 else 844})
        page.get_by_role('button', name='查看 syntheti 流程', exact=True).click()
        result = page.get_by_role('region', name='版本試問結果')
        result.wait_for()
        expect(result.locator('.rag-pilot-flow button')).to_have_count(5)
        result.get_by_role('button', name=re.compile('模型回答')).click()
        result.get_by_role('heading', name='模型回答').wait_for()
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), (width, 'v1 history')
        if width in (1440, 390):
            page.screenshot(path=str(out / f'{width}-v1-flow.png'), full_page=True)
        page.get_by_role('dialog').get_by_role('button', name='關閉詳情', exact=True).click()
    checks.append('Synthetic v1 history renders immutable answer/citations, selectable executed nodes and separate cost amounts at five widths; no live requests')
    page.get_by_text('舊版 24 段落小量測試與紀錄', exact=True).click()
    for width in [1440, 1024, 768, 390, 375]:
        page.set_viewport_size({'width': width, 'height': 1000 if width > 720 else 844})
        for detail in pilot_fixture['details']:
            run = detail['run']
            with page.expect_response('**/rest/v1/rpc/rag_pilot_detail') as detail_response:
                page.get_by_role('button', name=f"查看 {run['id'][:8]} 流程").click()
            assert detail_response.value.json()['run']['id'] == run['id']
            flow = page.get_by_role('region', name='本次試問流程')
            flow.wait_for()
            expect(flow.locator('.rag-pilot-flow button')).to_have_count(7)
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), (width, run['state'])
            for node in flow.locator('.rag-pilot-flow button').all():
                box = node.bounding_box()
                assert box['height'] >= 44 and box['width'] >= 44
            flow.get_by_role('button', name=re.compile('06 · .*Gemini 回答')).click()
            node_detail = flow.get_by_label('試問節點詳情')
            if run['state'] == 'answered':
                node_detail.get_by_text('1000 / 100', exact=True).wait_for()
                node_detail.get_by_text('gemini-3.1-flash-lite', exact=True).wait_for()
                assert '單價估算 未知' in flow.inner_text()
            else:
                expect(flow.locator('.is-skipped')).to_have_count(4)
                node_detail.get_by_text('未呼叫模型', exact=True).wait_for()
            if width in (1440, 390):
                assert page.locator('.admin-skip').bounding_box()['y'] < 0
                page.evaluate('window.scrollTo(0, 0)')
                page.screenshot(path=str(out / f'{width}-pilot-{run["state"]}.png'), full_page=True)
    checks.append('Synthetic answer/refusal journals render seven selectable nodes, usage and unknown costs at five widths (mock transport; zero model calls)')
    page.set_viewport_size({'width': 1440, 'height': 1000})
    navigation.get_by_role('button', name='通用 QA', exact=True).click()
    page.get_by_role('button', name='新增 QA', exact=True).click()
    editor = page.get_by_role('form', name='通用 QA草稿編輯')
    editor.get_by_label('問題', exact=True).fill('瀏覽器測試草稿')
    editor.get_by_label('標準回答', exact=True).fill('草稿保存測試')
    editor.get_by_label('來源說明（尚待核定）', exact=True).fill('測試來源')
    assert editor.get_by_label('問題', exact=True).input_value() == '瀏覽器測試草稿'
    page.get_by_role('button', name='儲存草稿', exact=True).click()
    page.get_by_text('草稿已儲存，尚未發布。', exact=True).wait_for()
    page.get_by_role('heading', name='瀏覽器測試草稿', exact=True).wait_for()
    page.get_by_role('button', name='推播管理 正式功能', exact=True).click()
    page.get_by_role('button', name='RAG 知識工作台 第一階段', exact=True).click()
    page.get_by_role('heading', name='瀏覽器測試草稿', exact=True).wait_for()
    checks.append('Modal draft saves through repository and remains after workspace switching (mock)')
    navigation.get_by_role('button', name='試問', exact=True).click()
    assert page.get_by_role('button', name='送出一次試問').is_disabled()
    page.get_by_role('button', name='登出', exact=True).click()
    page.get_by_role('heading', name='登入管理工作台').wait_for()
    assert page.locator('.rag-workspace').count() == 0
    checks.append('Disabled pilot cannot submit; logout removes state')
    browser.close()
result = {'mode': 'mock', 'checks': checks, 'errors': errors, 'mock_writes': writes, 'unexpected_requests': unexpected}
(out / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
assert writes == ['qa_entries'] and not errors and not unexpected
