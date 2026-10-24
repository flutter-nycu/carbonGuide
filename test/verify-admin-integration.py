"""Browser QA of the integrated admin. All Supabase traffic is mocked."""
import json, re, sys, base64, time, os
from pathlib import Path
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4185'
out = Path(sys.argv[2]) if len(sys.argv)>2 else Path('../carbon-navigation/outputs/admin-integration')
out.mkdir(parents=True, exist_ok=True)
env = dict(re.findall(r'^(\w+)=(.*)$',Path('.env.local').read_text(encoding='utf-8-sig'),re.M))
url = os.environ.get('VITE_SUPABASE_URL', env.get('VITE_SUPABASE_URL', 'https://admin-test.supabase.co')).strip('"\'')
ref = url.split('//')[1].split('.')[0]
config = json.loads(Path('vercel.json').read_text())
headers = {v['key']:v['value'] for v in next(x for x in config['headers'] if x['source']=='/push-admin')['headers']}
checks, errors, writes = [], [], []
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
        if 'admin_users' in path: data = {'role':'owner'}
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
        frame.get_by_role('heading',name='知識庫與文件',exact=True).wait_for(timeout=10000)
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
        page.get_by_role('button',name='推播管理 正式功能',exact=True).click()
        page.get_by_role('heading',name='系統推播',exact=True).wait_for()
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        if width in [1440,390]:page.screenshot(path=str(out/f'push-{width}.png'),full_page=True)
        for tab,ready in [('個人化規則','碳排提醒（假資料）'),('發送紀錄','測試紀錄（假資料）'),('推播用量','OneSignal 訂閱裝置數')]:
            page.get_by_role('navigation',name='推播功能').get_by_role('button',name=tab,exact=True).click()
            page.get_by_text(ready,exact=True).wait_for()
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), (width,tab)
            if width in [1440,390]:page.screenshot(path=str(out/f'push-{tab}-{width}.png'),full_page=True)
        page.get_by_role('navigation',name='推播功能').get_by_role('button',name='系統推播',exact=True).click()
        page.get_by_role('button',name='RAG 知識工作台 假資料示範',exact=True).click()
    checks.append('RAG and all four populated push tabs fit 1440, 1024, 768, 390 and 375px')
    page.set_viewport_size({'width':1440,'height':1000})
    for tab in ['import','numbers','playground','evaluation','releases','personas','prompt','qa','settings','logs','connection','documents']:
        frame.locator(f'#nav [data-id="{tab}"]').click()
        assert frame.locator('h1').is_visible()
    checks.append('All 12 RAG sections open')
    frame.locator('#nav [data-id="playground"]').click()
    frame.locator('[data-action="question"][data-id="如何減少食物浪費？"]').click()
    frame.get_by_role('button',name='試問',exact=True).click()
    assert '[1]' in frame.locator('.answer').inner_text()
    frame.get_by_role('button',name='查看來源 →').click()
    assert frame.locator('dialog').is_visible()
    page.keyboard.press('Escape')
    assert not frame.locator('dialog').is_visible()
    frame.locator('#nav [data-id="documents"]').click()
    checks.append('RAG mock question, source dialog and Escape dismissal work after integration')
    frame.locator('#doc-search').fill('通勤')
    assert frame.locator('#doc-rows tr').count()==1
    page.get_by_role('button',name='推播管理 正式功能',exact=True).click()
    page.get_by_placeholder('例：本月碳排提醒').fill('驗證用草稿，未發送')
    page.get_by_role('button',name='RAG 知識工作台 假資料示範',exact=True).click()
    assert frame.locator('#doc-search').input_value()=='通勤'
    page.get_by_role('button',name='推播管理 正式功能',exact=True).click()
    assert page.get_by_placeholder('例：本月碳排提醒').input_value()=='驗證用草稿，未發送'
    checks.append('Workspace switching preserves push draft and RAG state')
    page.get_by_role('button',name='登出',exact=True).click()
    page.get_by_role('heading',name='登入管理工作台').wait_for()
    assert page.locator('.rag-workspace').count()==0
    assert not writes, writes
    checks.append('Logout removes both workspaces; no push function invoked')
    browser.close()
result={'mode':'mock','checks':checks,'errors':errors,'push_function_requests':writes}
(out/'browser-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
assert not errors,errors
