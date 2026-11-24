"""Browser QA of the integrated admin. All Supabase traffic is mocked.

Build without VITE_RAG_ENABLED: the RAG workspace must say the backend is not enabled and send no RAG request.
The RAG pages themselves are checked on the in-memory API by test/verify-rag-workspace.py.
"""
import json, re, sys, base64, time, os
from pathlib import Path
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4185'
out = Path(sys.argv[2]) if len(sys.argv)>2 else Path('../carbon-navigation/outputs/admin-integration')
out.mkdir(parents=True, exist_ok=True)
env_file = Path('.env.local')
env = dict(re.findall(r'^(\w+)=(.*)$',env_file.read_text(encoding='utf-8-sig'),re.M)) if env_file.exists() else {}
url = os.environ.get('VITE_SUPABASE_URL', env.get('VITE_SUPABASE_URL', 'https://admin-test.supabase.co')).strip('"\'')
ref = url.split('//')[1].split('.')[0]
config = json.loads(Path('vercel.json').read_text())
headers = {v['key']:v['value'] for v in next(x for x in config['headers'] if x['source']=='/push-admin')['headers']}
checks, errors, writes, rag_requests = [], [], [], []
mock_role = {'value': 'owner'}
RAG_PATHS = ('/functions/v1/rag-v1', '/rest/v1/rag_', '/rest/v1/knowledge_', '/rest/v1/documents', '/rest/v1/chunks', '/rest/v1/personas', '/rest/v1/prompts', '/rest/v1/qa_entries', '/storage/v1/')
def encode(v): return base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
token = encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':'test-admin','exp':int(time.time())+3600,'role':'authenticated'})+'.test'
session = {'access_token':token,'refresh_token':'test-refresh','expires_at':int(time.time())+3600,'expires_in':3600,'token_type':'bearer','user':{'id':'test-admin','email':'j20692091@gmail.com','aud':'authenticated','role':'authenticated'}}
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width':1440,'height':1000})
    def local(route):
        response = route.fetch()
        route.fulfill(response=response,headers={**response.headers,**headers})
    context.route(base+'/push-admin.html*',local)
    def backend(route):
        req = route.request
        if req.method == 'OPTIONS':
            route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body=''); return
        path = req.url.split(url)[-1]
        if path.startswith(RAG_PATHS): rag_requests.append(path)
        if 'admin_users' in path: data = {'role':mock_role['value']}
        elif 'push_campaigns' in path:
            data = [{'id':'test-campaign','type':'system','status':'sent','title':'測試紀錄（假資料）','audience_count':42,'success_count':40,'failure_count':2,'created_at':'2026-10-24T08:00:00Z'}]
        elif 'push_rules' in path:
            data = [{'id':'test-rule','rule_key':'monthly_emission_reminder','name':'碳排提醒（假資料）','description':'用於版面驗證，不會發送','enabled':False,'title_zh':'本月碳排提醒','body_zh':'提醒填寫問卷','route':'/home','config':{'multiplier':1.5,'limit':100}}]
        elif 'onesignal-usage' in path:
            data = {'success':True,'oneSignal':{'totalDevices':120},'audience':{'marketing':80,'system':100},'sends':{'today':{'sent':10,'failed':0,'total':10}}}
        elif '/logout' in path: data = {}
        elif '/functions/' in path:
            writes.append(path); data = {'success':True,'audienceCount':42,'dryRun':True}
        else: data = {}
        route.fulfill(status=200,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*'})
    context.route(url+'/**',backend)
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto(base+'/push-admin.html#rag')
    page.get_by_role('heading',name='登入管理工作台').wait_for()
    assert page.locator('.rag-workspace').count()==0
    page.screenshot(path=str(out/'login-desktop.png'),full_page=True)
    checks.append('Signed-out #rag deep link shows login and no RAG workspace')
    page.evaluate("([key,value])=>localStorage.setItem(key,JSON.stringify(value))",[f'sb-{ref}-auth-token',session])
    page.reload()
    frame=page.locator('.rag-workspace')
    try:
        frame.get_by_role('heading',name='文件',exact=True).wait_for(timeout=10000)
    except Exception:
        print(json.dumps({'errors':errors,'body':page.locator('body').inner_text()},ensure_ascii=True))
        page.screenshot(path=str(out/'failure.png'),full_page=True)
        raise
    page.screenshot(path=str(out/'rag-desktop.png'),full_page=True)
    checks.append('Authorized RAG renders with production CSP and scoped styles')
    for width in [1440,1024,768,390,375]:
        page.set_viewport_size({'width':width,'height':1000 if width>720 else 844})
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        assert not frame.evaluate('(host)=>host.scrollWidth>innerWidth')
        if width==390: page.screenshot(path=str(out/'rag-mobile.png'),full_page=True)
        for tab in ['運作原理','使用者']:
            page.get_by_role('navigation',name='切換工作台').get_by_role('button',name=tab,exact=True).click()
            frame.get_by_role('heading',name=tab,exact=True).wait_for()
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), (width,tab)
            if width in [390,375]:page.screenshot(path=str(out/f'rag-{tab}-{width}.png'),full_page=True)
        page.get_by_role('button',name='知識庫',exact=True).click()
        page.get_by_role('button',name='推播管理',exact=True).click()
        page.get_by_role('heading',name='系統推播',exact=True).wait_for()
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        if width in [1440,390]:page.screenshot(path=str(out/f'push-{width}.png'),full_page=True)
        for tab,ready in [('個人化規則','碳排提醒（假資料）'),('發送紀錄','測試紀錄（假資料）'),('推播用量','OneSignal 訂閱裝置數')]:
            page.get_by_role('navigation',name='推播功能').get_by_role('button',name=tab,exact=True).click()
            page.get_by_text(ready,exact=True).wait_for()
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), (width,tab)
            if width in [1440,390]:page.screenshot(path=str(out/f'push-{tab}-{width}.png'),full_page=True)
        page.get_by_role('navigation',name='推播功能').get_by_role('button',name='系統推播',exact=True).click()
        page.get_by_role('button',name='知識庫',exact=True).click()
    checks.append('RAG, both new top tabs and all four populated push tabs fit 1440, 1024, 768, 390 and 375px')
    # One 52px header row on wide screens that stays put while scrolling; two rows on phones.
    page.set_viewport_size({'width':1440,'height':700})
    header=page.locator('.admin-header')
    assert abs(header.bounding_box()['height']-52)<=1, header.bounding_box()
    assert header.evaluate('h => getComputedStyle(h).position')=='sticky'
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('scrollTo(0,0)')
    assert 88<=header.bounding_box()['height']<=96, header.bounding_box()
    assert page.locator('.admin-breadcrumb').count()==0
    checks.append('The header is one 52px row that stays at the top on wide screens, two rows on phones; push pages have no breadcrumb')
    page.set_viewport_size({'width':1440,'height':1000})
    tabs=page.get_by_role('navigation',name='切換工作台')
    assert [' '.join(b.text_content().split()) for b in tabs.get_by_role('button').all()]==['推播管理','知識庫','使用者','運作原理']
    # The tab bar scrolls sideways, so a keyboard focus ring has to sit inside it rather than be clipped.
    tabs.get_by_role('button',name='知識庫',exact=True).focus()
    page.keyboard.press('Tab')
    assert tabs.get_by_role('button',name='使用者').evaluate('b => b === document.activeElement && b.matches(":focus-visible") && getComputedStyle(b).outlineOffset')=='-3px'
    nav=frame.get_by_role('navigation',name='知識庫頁面')
    assert nav.get_by_role('button').count()==10
    tabs.get_by_role('button',name='運作原理').click()
    assert page.evaluate('location.hash')=='#guide'
    frame.get_by_role('heading',name='運作原理',exact=True).wait_for()
    assert frame.get_by_role('list',name='架構總覽圖').is_visible()
    assert frame.get_by_text('RAG 後端尚未啟用，這裡還沒有設定可以顯示。').filter(visible=True).count()==1
    tabs.get_by_role('button',name='使用者').click()
    assert page.evaluate('location.hash')=='#conversations'
    frame.get_by_role('heading',name='使用者',exact=True).wait_for()
    assert frame.get_by_text('RAG 後端尚未啟用，這裡還沒有資料。').filter(visible=True).count()==1
    # A fresh load, not a same-page hash change, so the first render reads the address.
    page.evaluate("location.hash='#guide'")
    page.reload()
    frame.get_by_role('heading',name='運作原理',exact=True).wait_for()
    assert tabs.get_by_role('button',name='運作原理').get_attribute('aria-current')=='page'
    tabs.get_by_role('button',name='知識庫',exact=True).click()
    for name in ['上傳文件','教練人格','回答規則','常見問答','搜尋設定','版本與發布','試問','自動測驗','問答紀錄','文件']:
        nav.get_by_role('button',name=name,exact=True).click()
        frame.get_by_role('heading',name=name,exact=True).wait_for()
        assert frame.get_by_text('RAG 後端尚未啟用，這裡還沒有資料。').filter(visible=True).count()==1, name
    checks.append('Owner sees four top tabs; #guide opens the guide; the 10 sidebar pages and conversation users say the backend is not enabled yet and the guide still teaches')
    frame.locator('a.skip').focus()
    page.keyboard.press('Enter')
    assert page.evaluate('location.hash')=='#rag'
    assert frame.evaluate('(host)=>host.shadowRoot.activeElement?.id')=='main'
    page.locator('a.admin-skip').focus()
    page.keyboard.press('Enter')
    assert page.evaluate('location.hash')=='#rag'
    assert page.evaluate('document.activeElement.id')=='workspace-content'
    assert frame.get_by_role('heading',name='文件',exact=True).is_visible()
    checks.append('Both skip links move focus without switching away from RAG')
    nav.get_by_role('button',name='版本與發布',exact=True).click()
    page.get_by_role('button',name='推播管理',exact=True).click()
    page.get_by_placeholder('例：本月碳排提醒').fill('驗證用草稿，未發送')
    page.get_by_role('button',name='知識庫',exact=True).click()
    assert frame.get_by_role('heading',name='版本與發布',exact=True).is_visible()
    page.get_by_role('button',name='推播管理',exact=True).click()
    assert page.get_by_placeholder('例：本月碳排提醒').input_value()=='驗證用草稿，未發送'
    checks.append('Workspace switching keeps the push draft and the open RAG page')
    page.get_by_role('button',name='登出',exact=True).click()
    page.get_by_role('heading',name='登入管理工作台').wait_for()
    assert page.locator('.rag-workspace').count()==0
    assert not writes, writes
    assert not rag_requests, rag_requests
    checks.append('Logout removes both workspaces; no push function or RAG request was sent')
    mock_role['value']='editor'
    editor=context.new_page()
    editor.on('pageerror',lambda e:errors.append(str(e)))
    editor.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    editor.goto(base+'/push-admin.html')
    editor.evaluate("([key,value])=>localStorage.setItem(key,JSON.stringify(value))",[f'sb-{ref}-auth-token',session])
    editor.evaluate("location.hash='#conversations'")
    editor.reload()
    editor.get_by_role('heading',name='系統推播',exact=True).wait_for()
    editor_tabs=editor.get_by_role('navigation',name='切換工作台')
    assert [' '.join(b.text_content().split()) for b in editor_tabs.get_by_role('button').all()]==['推播管理','知識庫','運作原理']
    assert editor.locator('.rag-workspace').count()==0
    editor.screenshot(path=str(out/'editor-conversations-hash.png'),full_page=True)
    checks.append('An editor has three top tabs and #conversations stays on push management')
    browser.close()
result={'mode':'mock','checks':checks,'errors':errors,'push_function_requests':writes,'rag_requests':rag_requests}
(out/'browser-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
assert not errors,errors
