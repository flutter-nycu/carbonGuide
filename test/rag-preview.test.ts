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
    const added = [...document.querySelectorAll('#doc-rows tr')].filter(row => /綠生活示範指南\.pdf|家庭節能手冊\.docx/.test(row.textContent!))
    expect(added).toHaveLength(2)
    for (const row of added) expect(row.textContent).toContain('待處理')
    expect(document.querySelector('#doc-rows')!.textContent).not.toContain('待核對表格')
    nav('import')
    value('#source-name', '示範網址'); value('#source-url', 'https://example.org/guide'); action('add-url'); action('commit-import')
    const url = [...document.querySelectorAll('#doc-rows tr')].find(row => row.textContent!.includes('示範網址'))
    expect(url!.textContent).toContain('待讀取網址')
  })

  it('can retry a failure without silently publishing the result', () => {
    action('document', '6'); action('retry-document', '6')
    expect(document.querySelector('#dialog-body')!.textContent).toContain('待審核')
    action('approve-document', '6')
    expect(document.querySelectorAll('#doc-rows tr')[5].textContent).toContain('尚未發布')
  })

  it('blocks publication until current-revision evaluation and review both pass', () => {
    nav('releases'); expect(disabled('publish-release')).toBe(true)
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
    expect(document.querySelector('.answer')!.textContent).toContain('還沒有能回答')
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
  })

  it('leaves personas to the persona page instead of the playground', () => {
    nav('playground')
    expect(document.querySelector('#ask-persona')).toBeNull()
    expect(document.querySelector('main')!.textContent).not.toContain('回覆人格')
    ask()
    expect(document.querySelector('main')!.textContent).toContain('不套用人格語氣')
    expect(document.querySelector('main')!.textContent).not.toContain('理性型')
    nav('logs')
    expect(document.querySelector('thead')!.textContent).not.toContain('人格')
    action('run-detail', '1')
    expect(document.querySelector('#dialog-body')!.textContent).not.toContain('人格')
  })

  it('asks for missing bill inputs and answers carbon questions from a cited document', () => {
    nav('playground'); ask('少用 20 度電能省多少錢？')
    expect(document.querySelector('.answer')!.textContent).toContain('先不提供金額')
    ask('每月少用 20 度電，少多少碳排？')
    expect(document.querySelector('main .section-head .tag')!.textContent).toBe('文件回答')
    expect(document.querySelector('.answer')!.textContent).toContain('[1]')
    expect(document.querySelector('.source-result h3')!.textContent).toContain('綠生活指引.pdf')
    expect(document.querySelector('main')!.textContent).not.toContain('計算')
  })

  it('renders every section and resets all ephemeral state', () => {
    const sections = [...document.querySelectorAll('[data-action="nav"]')].map(n => (n as HTMLElement).dataset.id!).filter((id, i, all) => all.indexOf(id) === i)
    for (const section of sections) { nav(section); expect(document.querySelector('h1')).not.toBeNull() }
    nav('playground'); ask(); click('#reset'); nav('logs')
    expect(document.querySelector('main')!.textContent).toContain('還沒有試問紀錄')
  })

  it('supports the mobile selector', () => {
    value('#page-select', 'settings')
    expect(document.querySelector('h1')!.textContent).toBe('檢索設定')
  })

  it('preserves the question when switching scope and links QA guidance to draft testing', () => {
    nav('playground'); value('#question', '如何減少食物浪費？')
    value('#test-scope', 'draft')
    expect((document.querySelector('#question') as HTMLTextAreaElement).value).toBe('如何減少食物浪費？')
    submit('#ask-form')
    expect(document.querySelector('.answer')!.textContent).toContain('[1]')
    expect(document.querySelector('.decision')!.textContent).toContain('對應的文件')
    nav('qa'); action('draft-test')
    expect((document.querySelector('#test-scope') as HTMLSelectElement).value).toBe('draft')
  })

  it('keeps retrieval settings without document indexing fields and invalidates evaluation after changes', () => {
    evaluatePass(); nav('settings')
    for (const id of ['#chunk', '#overlap', '#dimension']) expect(document.querySelector(id)).toBeNull()
    expect(document.querySelector('.setting-details')).toBeNull()
    value('#candidate', '24'); value('#context', '6')
    submit('#settings-form')
    nav('releases'); expect(disabled('review-release')).toBe(true)
    nav('settings'); expect((document.querySelector('#context') as HTMLInputElement).value).toBe('6')
  })

  it('explains source exclusions using processing, approval and selected release', () => {
    action('document', '4'); action('retry-document', '4'); action('approve-document', '4')
    nav('playground'); ask()
    const exclusions = () => [...document.querySelectorAll('.source-result.excluded')].map(e => e.textContent).join(' ')
    expect(exclusions()).toContain('還沒收進這個發布版本')
    expect(exclusions()).not.toContain('待讀取網址')
    value('#test-scope', 'draft'); ask()
    expect(exclusions()).not.toContain('IPCC')
    expect(exclusions()).toContain('內容還沒核准')
  })

  it('explains saved prompt drafts without activating them', () => {
    nav('prompt'); value('#prompt-draft', '尚未套用的新指令'); action('save-prompt')
    expect(document.querySelector('#prompt-draft-status')!.textContent).toContain('還沒套用')
    action('draft-test'); ask()
    expect(document.querySelector('main')!.textContent).toContain('p1 / r1')
  })

  it('shows ten sections in order without factor or connection pages', () => {
    const labels = [...document.querySelectorAll('#nav [data-action="nav"]')].map(n => n.textContent)
    expect(labels).toEqual(['01知識庫與文件', '02匯入與預檢', '03檢索試問台', '04RAG 評測', '05知識版本', '06人格設定', '07System Prompt', '08基本通用 QA', '09進階檢索設定', '10互動紀錄'])
    expect([...document.querySelectorAll('#page-select option')].map(o => (o as HTMLOptionElement).value)).toEqual(['documents', 'import', 'playground', 'evaluation', 'releases', 'personas', 'prompt', 'qa', 'settings', 'logs'])
    expect(document.querySelector('[data-id="numbers"], [data-id="connection"]')).toBeNull()
  })

  it('removes onboarding and explanation blocks from every section', () => {
    for (const option of document.querySelectorAll('#page-select option')) {
      nav((option as HTMLOptionElement).value)
      expect(document.querySelector('details[data-help], .page-help, .quick-start, .guide-side')).toBeNull()
      expect(document.querySelector('.subtitle')!.textContent!.trim()).not.toBe('')
      for (const text of ['第一次使用', '操作說明', '文件何時會用在回答裡', '設定會用在哪裡', '怎麼判斷有沒有變好', '指令怎麼套用']) {
        expect(document.querySelector('main')!.textContent).not.toContain(text)
      }
    }
  })

  it('imports only PDF, DOCX and TXT files besides URLs', () => {
    nav('import')
    const input = document.querySelector('#files') as HTMLInputElement
    expect(input.getAttribute('accept')).toBe('.pdf,.docx,.txt')
    Object.defineProperty(input, 'files', { value: [new dom.window.File(['{}'], '係數.json'), new dom.window.File(['text'], '手冊.txt'), new dom.window.File([], '空白.pdf')] })
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    const rows = [...document.querySelectorAll('main tbody tr')]
    expect(rows[0].querySelector('.tag.error')).not.toBeNull()
    expect(rows[0].textContent).toContain('格式不支援')
    expect(rows[1].querySelector('.tag.error')).toBeNull()
    expect(rows[2].textContent).toContain('檔案是空的')
    action('sample-import')
    expect(document.querySelector('main')!.textContent).not.toMatch(/json/i)
  })

  it('never shows the separate calculation flow', () => {
    const seen: string[] = []
    for (const option of document.querySelectorAll('#page-select option')) { nav((option as HTMLOptionElement).value); seen.push(document.querySelector('main')!.textContent!) }
    nav('playground'); ask('每月少用 20 度電，少多少碳排？'); seen.push(document.querySelector('main')!.textContent!)
    nav('logs'); action('run-detail', '1'); seen.push(document.querySelector('#dialog-body')!.textContent!)
    const all = seen.join(' ')
    for (const word of ['計算資訊', '合成計算', '計算資料', '排放係數', '計算工具', '計算規則', '係數與費率', '服務連線', '文件處理與向量', '向量維度']) expect(all).not.toContain(word)
  })

  it('keeps the skip link inside the workspace', () => {
    const link = document.querySelector('a.skip') as HTMLAnchorElement
    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('main')
  })

  it('pads dialog content through a valid selector', () => {
    const css = readFileSync(resolve('src/push-admin/rag/styles.css'), 'utf8')
    expect(css).not.toContain('#dialog-.rag-body')
    expect(css).toMatch(/#dialog-body\{padding:24px/)
  })

  it('prevents backend connections through the page content security policy', () => {
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')!.getAttribute('content')!
    expect(csp).toContain("connect-src 'none'")
    const source = readFileSync(resolve('src/push-admin/rag/app.js'), 'utf8')
    expect(source).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b/)
  })
})
