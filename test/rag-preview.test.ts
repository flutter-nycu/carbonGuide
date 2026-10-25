import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'

describe('RAG static preview', () => {
  let dom: JSDOM
  let document: Document
  const click = (selector: string) => (document.querySelector(selector) as HTMLElement).click()
  const action = (name: string, id?: string) => click(`[data-action="${name}"]${id === undefined ? '' : `[data-id="${id}"]`}`)
  const nav = (id: string) => action('nav', id)
  const value = (selector: string, text: string) => {
    const input = document.querySelector(selector) as HTMLInputElement
    input.value = text
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  }
  const submit = (selector: string) => document.querySelector(selector)!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  const ask = (question = '如何減少食物浪費？') => { value('#question', question); submit('#ask-form') }
  const disabled = (name: string) => (document.querySelector(`[data-action="${name}"]`) as HTMLButtonElement).disabled
  const evaluatePass = () => {
    nav('evaluation')
    click('#eval-fixed')
    action('evaluate')
  }
  beforeEach(() => {
    dom = new JSDOM(readFileSync(resolve('src/push-admin/rag/index.html'), 'utf8'), { runScripts: 'outside-only', url: 'https://example.test/rag-preview/' })
    document = dom.window.document
    dom.window.structuredClone = structuredClone
    dom.window.scrollTo = () => {}
    dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
    dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
    dom.window.eval(readFileSync(resolve('src/push-admin/rag/app.js'), 'utf8').replace('export function mountRag(document)', 'function mountRag(document)') + '\nmountRag(document);')
  })
  afterEach(() => dom.window.close())

  it('separates processing, approval and release; filters without losing focus', () => {
    expect(document.querySelectorAll('#doc-rows tr')).toHaveLength(6)
    expect([...document.querySelectorAll('#doc-rows tr:first-child td')].map(td => td.getAttribute('data-label')))
      .toEqual(['文件與版本', '用途 / 範圍', '處理狀態', '審核 / 發布', '操作'])
    value('#doc-search', '通勤')
    expect(document.querySelectorAll('#doc-rows tr')).toHaveLength(1)
    expect(document.querySelector('#doc-rows')!.textContent).toContain('待審核')
    action('document', '3'); action('approve-document', '3')
    expect(document.querySelector('#doc-rows')!.textContent).toContain('尚未發布')
    value('#doc-search', '<img src=x onerror=alert(1)>')
    expect(document.querySelector('#doc-rows')!.textContent).toContain('沒有符合條件')
  })

  it('rejects unsafe URLs and only imports valid batch metadata as drafts', () => {
    nav('import')
    value('#source-name', 'Unsafe'); value('#source-url', 'javascript:alert(1)'); action('add-url')
    expect(document.querySelector('#url-error')!.textContent).toContain('http / https')
    action('sample-import'); action('commit-import')
    expect(document.querySelectorAll('#doc-rows tr')).toHaveLength(8)
    expect(document.querySelector('#doc-rows')!.textContent).not.toContain('大型掃描文件.pdf')
    expect(document.querySelector('#doc-rows')!.textContent).toContain('待核對表格')
  })

  it('can retry a failure without silently publishing the result', () => {
    action('document', '6'); action('retry-document', '6')
    expect(document.querySelector('#dialog-body')!.textContent).toContain('待審核')
    action('approve-document', '6')
    expect(document.querySelectorAll('#doc-rows tr')[5].textContent).toContain('尚未發布')
  })

  it('blocks publication until current-revision evaluation and review both pass', () => {
    nav('releases'); expect(disabled('publish-release')).toBe(true); expect(disabled('review-release')).toBe(true)
    expect(document.querySelector('main .notice')!.textContent).toContain('沒有需要發布的修改')
    nav('documents'); action('document', '3'); action('approve-document', '3')
    nav('evaluation'); action('evaluate')
    nav('releases'); expect(disabled('review-release')).toBe(true)
    evaluatePass(); nav('releases'); expect(disabled('review-release')).toBe(false)
    action('review-release'); expect(disabled('publish-release')).toBe(false)
    nav('prompt'); value('#prompt-draft', '新的示範指令'); submit('#prompt-form')
    nav('releases'); expect(disabled('publish-release')).toBe(true)
  })

  it('freezes QA and prompt snapshots and restores them when rolling back', () => {
    nav('prompt'); value('#prompt-draft', '版本二指令'); submit('#prompt-form')
    nav('qa'); action('edit-qa', '1'); value('#qa-answer', '新版答案'); submit('#qa-form')
    nav('playground'); ask()
    expect(document.querySelector('.answer')!.textContent).not.toContain('新版答案')
    expect(document.querySelector('main')!.textContent).toContain('p1 / r1')
    value('#test-scope', 'draft'); ask()
    expect(document.querySelector('.answer')!.textContent).toContain('新版答案')
    evaluatePass(); nav('releases'); action('review-release'); action('publish-release')
    nav('playground'); value('#test-scope', 'published'); ask()
    expect(document.querySelector('.answer')!.textContent).toContain('新版答案')
    expect(document.querySelector('main')!.textContent).toContain('p2 / r1')
    nav('releases'); action('rollback', 'v0.1')
    nav('playground'); ask()
    expect(document.querySelector('.answer')!.textContent).not.toContain('新版答案')
    expect(document.querySelector('main')!.textContent).toContain('p1 / r1')
    nav('logs'); expect(document.querySelectorAll('tbody tr')).toHaveLength(4)
  })

  it('keeps a persona enabled and escapes text in answers and logs', () => {
    nav('personas'); action('toggle-persona', '0'); action('toggle-persona', '1')
    expect(document.querySelectorAll('[data-action="toggle-persona"]')[1].textContent).toBe('停用')
    nav('playground'); ask('<img src=x onerror=alert(1)>')
    expect(document.querySelector('.answer')!.textContent).toContain('沒有可支撐')
    nav('logs'); expect(document.querySelector('tbody img')).toBeNull()
    expect(document.querySelector('tbody')!.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('shows tone examples on persona cards and saves edits only on submission', () => {
    nav('personas')
    expect(document.querySelectorAll('.persona-tone')).toHaveLength(2)
    expect(document.querySelector('.persona-tone')!.textContent).toContain('先比較碳排')
    action('edit-persona', '0'); value('#persona-example-0', '取消的示例'); action('cancel-persona')
    expect(document.querySelector('.persona-tone')!.textContent).not.toContain('取消的示例')
    action('edit-persona', '0')
    value('#persona-name-0', '比較型')
    value('#persona-example-0', '<img src=x onerror=alert(1)>')
    value('#persona-instruction-0', '列出假設，再比較選項。')
    submit('[data-persona-form="0"]')
    expect((document.querySelector('dialog') as HTMLDialogElement).open).toBe(false)
    expect(document.querySelector('.persona-card')!.textContent).toContain('列出假設，再比較選項。')
    expect(document.querySelector('.persona-tone')!.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(document.querySelector('.persona-tone img')).toBeNull()
    nav('playground')
    expect(document.querySelector('#ask-persona')!.textContent).toContain('比較型')
  })

  it('asks for missing tariff inputs and labels synthetic arithmetic', () => {
    nav('playground'); ask('少用 20 度電能省多少錢？')
    expect(document.querySelector('.answer')!.textContent).toContain('先不提供金額')
    ask('每月少用 20 度電，少多少碳排？')
    expect(document.querySelector('.answer')!.textContent).toContain('10.00 kg CO₂e')
    expect(document.querySelector('.answer')!.textContent).toContain('合成係數')
  })

  it('renders every section and resets all ephemeral state', () => {
    const sections = [...document.querySelectorAll('[data-action="nav"]')].map(n => (n as HTMLElement).dataset.id!).filter((id, i, all) => all.indexOf(id) === i)
    for (const section of sections) { nav(section); expect(document.querySelector('h1')).not.toBeNull() }
    nav('connection'); expect(document.querySelector('a[href*="prototype"]')).toBeNull()
    expect(document.querySelector('main')!.textContent).toContain('src/push-admin/rag/prototype.html')
    nav('playground'); ask(); click('#reset'); nav('logs')
    expect(document.querySelector('main')!.textContent).toContain('還沒有試問紀錄')
  })

  it('opens the quick start only on the first visit and keeps page help collapsed', () => {
    const start = () => document.querySelector('details[data-help="start"]') as HTMLDetailsElement
    expect(start().open).toBe(true)
    nav('import')
    expect((document.querySelector('details[data-help="import"]') as HTMLDetailsElement).open).toBe(false)
    nav('documents'); expect(start().open).toBe(false)
    click('details[data-help="start"] > summary'); nav('import'); nav('documents')
    expect(start().open).toBe(true)
    value('#page-select', 'settings')
    expect(document.querySelector('h1')!.textContent).toBe('RAG 設定')
  })

  it('groups navigation by workflow without step numbers or breadcrumbs', () => {
    const labels = [...document.querySelectorAll('#nav .nav-label')].map(n => n.textContent)
    expect(labels).toEqual(['知識內容', '教練', '驗證與發布', '紀錄與設定'])
    expect([...document.querySelectorAll('#nav .nav-button')].map(n => (n as HTMLElement).dataset.id))
      .toEqual(['documents', 'import', 'numbers', 'qa', 'personas', 'prompt', 'playground', 'evaluation', 'releases', 'logs', 'settings', 'connection'])
    expect(document.querySelector('#nav')!.textContent).not.toMatch(/\d{2}/)
    expect([...document.querySelectorAll('#page-select optgroup')].map(g => g.getAttribute('label'))).toEqual(labels)
    expect(document.querySelector('main')!.textContent).not.toContain('管理工作台 /')
  })

  it('shows the active release and the draft status in the sidebar', () => {
    const status = () => document.querySelector('#release-status')!.textContent
    expect(status()).toContain('目前使用 v0.1'); expect(status()).toContain('草稿與目前版本相同')
    nav('prompt'); value('#prompt-draft', '新的示範指令'); submit('#prompt-form')
    expect(status()).toContain('有未發布的修改')
    expect(document.querySelector('#release-status [data-action="nav"]')!.getAttribute('data-id')).toBe('evaluation')
    evaluatePass(); expect(status()).toContain('已通過評測，待審核')
    nav('releases'); action('review-release'); action('publish-release')
    expect(status()).toContain('目前使用 v0.2'); expect(status()).toContain('草稿與目前版本相同')
    expect(disabled('review-release')).toBe(true)
    action('rollback', 'v0.1')
    expect(status()).toContain('目前使用 v0.1'); expect(status()).toContain('已通過評測，待審核')
  })

  it('sets purpose and domain per preflight row and remembers the last choice', () => {
    nav('import'); action('sample-import')
    const selects = [...document.querySelectorAll('select[data-import]')] as HTMLSelectElement[]
    expect(selects.map(s => `${s.dataset.import}:${s.dataset.field}`)).toEqual(['0:purpose', '0:domain', '1:domain'])
    value('select[data-import="0"][data-field="purpose"]', '科學證據')
    value('select[data-import="1"][data-field="domain"]', '飲食')
    value('#source-name', 'IPCC 第 6 章'); value('#source-url', 'https://example.org/ipcc'); action('add-url')
    expect((document.querySelector('select[data-import="3"][data-field="purpose"]') as HTMLSelectElement).value).toBe('科學證據')
    expect((document.querySelector('select[data-import="3"][data-field="domain"]') as HTMLSelectElement).value).toBe('飲食')
    action('commit-import')
    const rows = [...document.querySelectorAll('#doc-rows tr')].map(r => r.textContent!)
    expect(rows.find(r => r.includes('綠生活示範指南.pdf'))).toContain('科學證據')
    expect(rows.find(r => r.includes('排放係數示範.json'))).toContain('排放係數')
    expect(rows.find(r => r.includes('排放係數示範.json'))).toContain('飲食')
    expect(rows.some(r => r.includes('大型掃描文件.pdf'))).toBe(false)
  })

  it('keeps keyboard focus after re-rendering and moves it to the answer', () => {
    nav('qa')
    const toggle = document.querySelector('[data-action="toggle-qa"][data-id="1"]') as HTMLButtonElement
    toggle.focus(); toggle.click()
    expect(document.activeElement).toBe(document.querySelector('[data-action="toggle-qa"][data-id="1"]'))
    expect(document.activeElement!.textContent).toBe('啟用')
    nav('playground'); ask()
    expect(document.activeElement).toBe(document.querySelector('.answer'))
  })

  it('keeps scoped selectors for help and dialog bodies intact', () => {
    const css = readFileSync(resolve('src/push-admin/rag/styles.css'), 'utf8')
    expect(css).not.toMatch(/[\w-]\.rag-body/)
    expect(css).toContain('.help-body{')
    expect(css).toContain('#dialog-body{')
  })

  it('preserves the question when switching scope and links QA guidance to draft testing', () => {
    nav('playground'); value('#question', '如何減少食物浪費？')
    value('#test-scope', 'draft')
    expect((document.querySelector('#question') as HTMLTextAreaElement).value).toBe('如何減少食物浪費？')
    submit('#ask-form')
    expect(document.querySelector('.answer')!.textContent).toContain('[1]')
    expect(document.querySelector('.decision')!.textContent).toContain('關聯文件')
    nav('qa'); action('draft-test')
    expect((document.querySelector('#test-scope') as HTMLSelectElement).value).toBe('draft')
  })

  it('validates RAG settings, keeps the index profile read-only and invalidates evaluation', () => {
    action('document', '3'); action('approve-document', '3'); evaluatePass()
    nav('releases'); expect(disabled('review-release')).toBe(false)
    nav('settings')
    expect(document.querySelector('#chunk, #overlap, #dimension, #temperature')).toBeNull()
    expect(document.querySelector('.with-guide')!.textContent).toContain('text-embedding-3-large · 1,536 維')
    expect([...document.querySelectorAll('#style option')].map(o => o.textContent)).toEqual(['精簡', '標準', '詳細'])
    value('#candidate', '8'); value('#context', '9'); submit('#settings-form')
    expect(document.querySelector('#settings-error')!.textContent).toContain('不可超過')
    value('#context', '6'); value('#similarity', '0.4'); submit('#settings-form')
    expect(document.querySelector('#settings-error')!.textContent).toContain('向量相似度門檻')
    value('#similarity', '0.72'); value('#candidate', '24')
    expect(document.querySelector('#candidate-preview')!.textContent).toContain('24')
    expect(document.querySelector('#context-preview')!.textContent).toContain('6')
    submit('#settings-form')
    nav('releases'); expect(disabled('review-release')).toBe(true)
    nav('settings'); expect((document.querySelector('#context') as HTMLInputElement).value).toBe('6')
    action('index-version'); expect(document.querySelector('#dialog-body')!.textContent).toContain('重算向量')
  })

  it('uses the configured no-evidence reply for the draft and keeps the published snapshot', () => {
    nav('settings'); value('#fallback', '草稿版查無資料回覆'); submit('#settings-form')
    nav('playground'); ask('量子電池能減碳多少？')
    expect(document.querySelector('.answer')!.textContent).toContain('沒有可支撐')
    value('#test-scope', 'draft'); ask('量子電池能減碳多少？')
    expect(document.querySelector('.answer')!.textContent).toContain('草稿版查無資料回覆')
  })

  it('explains source exclusions using processing, approval and selected release', () => {
    action('document', '4'); action('retry-document', '4'); action('approve-document', '4')
    nav('playground'); ask()
    const exclusions = () => [...document.querySelectorAll('.source-result.excluded')].map(e => e.textContent).join(' ')
    expect(exclusions()).toContain('尚未納入所選發布版本')
    expect(exclusions()).not.toContain('待擷取')
    value('#test-scope', 'draft'); ask()
    expect(exclusions()).not.toContain('IPCC')
    expect(exclusions()).toContain('內容尚未核准')
  })

  it('explains saved prompt drafts without activating them', () => {
    nav('prompt'); value('#prompt-draft', '尚未套用的新指令'); action('save-prompt')
    expect(document.querySelector('#prompt-draft-status')!.textContent).toContain('尚未套用')
    action('draft-test'); ask()
    expect(document.querySelector('main')!.textContent).toContain('p1 / r1')
  })

  it('prevents backend connections through the page content security policy', () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content')!
    expect(csp).toContain("connect-src 'none'")
    const source = readFileSync(resolve('src/push-admin/rag/app.js'), 'utf8')
    expect(source).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b/)
  })
})
