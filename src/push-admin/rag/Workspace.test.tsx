// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createFakeRagApi } from './api/fake'
import { Dialog, PageAction, useNavigate } from './ui'
import { PAGES, SIDEBAR_PAGES, viewOf, type PageId } from './pageList'
import Workspace, { SIDEBAR_KEY } from './Workspace'
import { ALL_PAGES_TIMEOUT, WorkspaceHost, showPage } from './pages/testing'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) }
})
afterEach(() => { cleanup(); localStorage.clear() })

const fake = () => createFakeRagApi({ role: 'owner' })
const nav = () => screen.getByRole('navigation', { name: '知識庫頁面' })

function Draft() {
  const [value, setValue] = useState('')
  return <label className="field">草稿<input value={value} onChange={event => setValue(event.target.value)} /></label>
}

function TitledDialog({ title }: { title: string }) {
  return <Dialog open={false} title={title} onClose={() => undefined}><p>內容</p></Dialog>
}

describe('RAG workspace shell', () => {
  it('lists the ten sidebar pages in the order of the work, in four groups, with matching mobile options', () => {
    render(<Workspace api={fake()} role="owner" />)
    const buttons = within(nav()).getAllByRole('button').map(b => b.textContent)
    expect(buttons).toEqual(SIDEBAR_PAGES.map(p => p.label))
    expect(buttons).toEqual(['文件', '上傳文件', '教練人格', '回答規則', '常見問答', '搜尋設定', '版本與發布', '試問', '自動測驗', '問答紀錄'])
    expect([...nav().querySelectorAll('.nav-label')].map(l => l.textContent)).toEqual(['資料', '教練', '測試與發布', '紀錄'])
    const options = [...(screen.getByLabelText('切換頁面') as HTMLSelectElement).options].map(o => o.textContent)
    expect(options).toEqual(SIDEBAR_PAGES.map(p => p.label))
    // The users list and the guide live in the admin's top tabs.
    expect(PAGES.filter(p => p.placement === 'tab').map(p => p.label)).toEqual(['使用者', '運作原理'])
    for (const page of PAGES) expect(viewOf(page.id) === 'workspace', page.id).toBe(page.placement === 'sidebar')
    for (const page of PAGES) expect(page.subtitle.length, page.id).toBeLessThanOrEqual(20)
  })

  it('folds the sidebar to icons and remembers the choice on this browser', () => {
    window.innerWidth = 1440
    const first = render(<Workspace api={fake()} role="owner" />)
    const shell = () => first.container.querySelector('.shell')!
    expect(shell().classList.contains('folded')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '收合側欄' }))
    expect(shell().classList.contains('folded')).toBe(true)
    expect(screen.getByRole('button', { name: '展開側欄' }).getAttribute('aria-expanded')).toBe('false')
    // Folded, every page keeps its name for screen readers and the hover label.
    expect(within(nav()).getAllByRole('button').map(b => b.textContent)).toEqual(SIDEBAR_PAGES.map(p => p.label))
    expect(localStorage.getItem(SIDEBAR_KEY)).toBe('1')
    first.unmount()
    const again = render(<Workspace api={fake()} role="owner" />)
    expect(again.container.querySelector('.shell')!.classList.contains('folded')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '展開側欄' }))
    expect(localStorage.getItem(SIDEBAR_KEY)).toBe('0')
  })

  it('starts folded on narrow screens until the admin chooses, and works without storage', () => {
    window.innerWidth = 1024
    const narrow = render(<Workspace api={fake()} role="owner" />)
    expect(narrow.container.querySelector('.shell')!.classList.contains('folded')).toBe(true)
    narrow.unmount()
    localStorage.setItem(SIDEBAR_KEY, '0')
    const chosen = render(<Workspace api={fake()} role="owner" />)
    expect(chosen.container.querySelector('.shell')!.classList.contains('folded')).toBe(false)
    chosen.unmount()
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const view = render(<Workspace api={fake()} role="owner" />)
    fireEvent.click(screen.getByRole('button', { name: '展開側欄' }))
    expect(view.container.querySelector('.shell')!.classList.contains('folded')).toBe(false)
    blocked.mockRestore()
    vi.restoreAllMocks()
  })

  it("puts a page's main button at the right of its heading", () => {
    const { container } = render(<Workspace api={fake()} role="owner"
      renderPage={id => (id === 'documents' ? <PageAction><button type="button">新增</button></PageAction> : null)} />)
    const head = container.querySelector('[data-page="documents"] .page-head')!
    expect(head.querySelector('h1')!.textContent).toBe('文件')
    expect(within(head as HTMLElement).getByRole('button', { name: '新增' })).toBeTruthy()
    expect(container.querySelector('.breadcrumb')).toBeNull()
  })

  it('shows a top-tab page full width, without the sidebar or other pages', () => {
    const { container } = render(<Workspace api={fake()} role="owner" view="guide" />)
    expect(container.querySelector('.shell')!.classList.contains('single')).toBe(true)
    expect((container.querySelector('.sidebar') as HTMLElement).hidden).toBe(true)
    expect((container.querySelector('[data-page="guide"]') as HTMLElement).hidden).toBe(false)
    expect(container.querySelector('[data-page="documents"]')).toBeNull()
  })

  it('keeps every visited page mounted while switching between the three views', () => {
    const view = render(<WorkspaceHost api={fake()} role="owner" renderPage={id => (id === 'prompt' ? <Draft /> : null)} />)
    showPage(view, 'prompt')
    fireEvent.change(screen.getByLabelText('草稿'), { target: { value: '還沒存的內容' } })
    showPage(view, 'guide')
    showPage(view, 'conversations')
    expect(view.container.querySelector('[data-page="prompt"]')!.hasAttribute('hidden')).toBe(true)
    expect(view.container.querySelector('[data-page="guide"]')!.hasAttribute('hidden')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '知識庫' }))
    expect((screen.getByLabelText('草稿') as HTMLInputElement).value).toBe('還沒存的內容')
    expect(view.container.querySelector('[data-page="prompt"]')!.hasAttribute('hidden')).toBe(false)
  })

  it('moves focus to the content when the sidebar it was in gets hidden', () => {
    const view = render(<WorkspaceHost api={fake()} role="owner" />)
    within(nav()).getByRole('button', { name: '搜尋設定' }).focus()
    fireEvent.click(screen.getByRole('button', { name: '運作原理' }))
    expect(document.activeElement?.id).toBe('main')
    // Focus elsewhere is left alone.
    const tab = screen.getByRole('button', { name: '知識庫' })
    tab.focus()
    fireEvent.click(tab)
    fireEvent.click(screen.getByRole('button', { name: '使用者' }))
    expect(document.activeElement).toBe(tab)
    view.unmount()
  })

  it('sends a link to the view that holds the page', () => {
    function Links() {
      const navigate = useNavigate()
      return <>{(['conversations', 'guide', 'settings'] as PageId[]).map(id => <button key={id} type="button" onClick={() => navigate(id)}>去 {id}</button>)}</>
    }
    const onView = vi.fn()
    const { container } = render(<Workspace api={fake()} role="owner" onView={onView} renderPage={id => (id === 'documents' ? <Links /> : null)} />)
    fireEvent.click(screen.getByRole('button', { name: '去 conversations' }))
    expect(onView).toHaveBeenLastCalledWith('conversations')
    fireEvent.click(screen.getByRole('button', { name: '去 guide' }))
    expect(onView).toHaveBeenLastCalledWith('guide')
    onView.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '去 settings' }))
    expect(onView).not.toHaveBeenCalled()
    expect((container.querySelector('[data-page="settings"]') as HTMLElement).hidden).toBe(false)
  })

  it('gives every page a heading and a one-line subtitle, and only the guide teaches', () => {
    const view = render(<WorkspaceHost api={fake()} role="owner" />)
    const { container } = view
    for (const page of PAGES) {
      showPage(view, page.id)
      const current = container.querySelector(`[data-page="${page.id}"]`)!
      expect(current.querySelector('h1')!.textContent).toBe(page.label)
      expect(current.querySelector('.subtitle')!.textContent!.length).toBeGreaterThan(5)
    }
    for (const page of PAGES.filter(p => p.id !== 'guide')) {
      const current = container.querySelector(`[data-page="${page.id}"]`)!
      expect(current.querySelector('details, .page-help, .quick-start, .guide-side, [class*="guide-"]'), page.id).toBeNull()
    }
    expect(container.querySelector('[data-page="guide"] .guide-diagram')).toBeTruthy()
  }, ALL_PAGES_TIMEOUT)

  it('keeps visited pages mounted so typed input survives switching', () => {
    render(<Workspace api={fake()} role="owner" renderPage={id => (id === 'prompt' ? <Draft /> : null)} />)
    fireEvent.click(within(nav()).getByRole('button', { name: '回答規則' }))
    fireEvent.change(screen.getByLabelText('草稿'), { target: { value: '還沒存的內容' } })
    fireEvent.click(within(nav()).getByRole('button', { name: '文件' }))
    expect((screen.getByLabelText('草稿', { selector: 'input' }) as HTMLInputElement).closest('[data-page]')!.hasAttribute('hidden')).toBe(true)
    fireEvent.change(screen.getByLabelText('切換頁面'), { target: { value: 'prompt' } })
    expect((screen.getByLabelText('草稿') as HTMLInputElement).value).toBe('還沒存的內容')
  })

  it('shows a not-connected notice on every page when the backend is off', () => {
    const view = render(<WorkspaceHost api={null} role="owner" renderPage={() => <p>真實內容</p>} />)
    const { container } = view
    for (const page of PAGES.filter(p => p.id !== 'guide')) {
      showPage(view, page.id)
      const current = container.querySelector(`[data-page="${page.id}"]`)!
      expect(current.textContent).toContain('RAG 後端尚未啟用')
      expect(current.textContent).not.toContain('真實內容')
    }
    // The guide still teaches; only its live-settings section says the backend is off.
    showPage(view, 'guide')
    const guide = container.querySelector('[data-page="guide"]')!
    expect(guide.querySelector('.guide-diagram')).toBeTruthy()
    expect(guide.querySelector('.guide-live')!.textContent).toContain('RAG 後端尚未啟用')
  })

  it('shows each role only the pages its account can read', () => {
    const visible = (role: 'editor' | 'viewer') => {
      const view = render(<WorkspaceHost api={createFakeRagApi({ role })} role={role} renderPage={() => <p>真實內容</p>} />)
      const shown = PAGES.filter(page => {
        showPage(view, page.id)
        const current = view.container.querySelector(`[data-page="${page.id}"]`)!
        return current.textContent!.includes('真實內容') || current.querySelector('.guide-diagram') !== null
      }).map(page => page.id)
      view.unmount()
      return shown
    }
    expect(visible('editor')).toEqual(['documents', 'import', 'personas', 'prompt', 'qa', 'settings', 'releases', 'guide'])
    expect(visible('viewer')).toEqual(['documents', 'import', 'personas', 'prompt', 'qa', 'settings', 'guide'])
  })

  it('gives every kept-alive dialog its own name', () => {
    const { container } = render(<Workspace api={fake()} role="owner" renderPage={id => (id === 'documents' || id === 'qa' ? <TitledDialog title={id} /> : null)} />)
    fireEvent.change(screen.getByLabelText('切換頁面'), { target: { value: 'qa' } })
    const dialogs = [...container.querySelectorAll('dialog')]
    expect(dialogs).toHaveLength(2)
    expect(new Set(dialogs.map(d => d.getAttribute('aria-labelledby'))).size).toBe(2)
    for (const dialog of dialogs) {
      const title = container.querySelector(`[id="${dialog.getAttribute('aria-labelledby')}"]`)
      expect(dialog.contains(title)).toBe(true)
    }
  })

  it('keeps one status region for messages so screen readers announce them', () => {
    const { container } = render(<Workspace api={fake()} role="owner" />)
    const toast = container.querySelector('#toast')!
    expect(toast.getAttribute('role')).toBe('status')
    expect(toast.hasAttribute('hidden')).toBe(false)
  })

  it('tells editors that conversations and interaction history are owner-only', () => {
    const view = render(<WorkspaceHost api={createFakeRagApi({ role: 'editor' })} role="editor" renderPage={() => <p>真實內容</p>} />)
    const { container } = view
    for (const id of ['conversations', 'logs'] as PageId[]) {
      showPage(view, id)
      const current = container.querySelector(`[data-page="${id}"]`)!
      expect(current.textContent).toContain('只有管理者可以看')
      expect(current.textContent).not.toContain('真實內容')
    }
    showPage(view, 'documents')
    expect(container.querySelector('[data-page="documents"]')!.textContent).toContain('真實內容')
  })

  it('moves focus to the main content without changing the address', () => {
    render(<Workspace api={fake()} role="owner" />)
    const before = window.location.href
    const link = screen.getByText('跳至主要內容')
    expect(fireEvent.click(link)).toBe(false)
    expect(document.activeElement?.id).toBe('main')
    expect(window.location.href).toBe(before)
  })

  it('closes a page dialog when the page is hidden', () => {
    function WithDialog() {
      const [open, setOpen] = useState(false)
      return <><button type="button" onClick={() => setOpen(true)}>打開詳情</button>
        <Dialog open={open} title="文件詳情" onClose={() => setOpen(false)}><p>詳情內容</p></Dialog></>
    }
    const { container } = render(<Workspace api={fake()} role="owner" renderPage={id => (id === 'documents' ? <WithDialog /> : null)} />)
    fireEvent.click(screen.getByText('打開詳情'))
    expect((container.querySelector('dialog') as HTMLDialogElement).open).toBe(true)
    fireEvent.click(within(nav()).getByRole('button', { name: '版本與發布' }))
    expect((container.querySelector('dialog') as HTMLDialogElement).open).toBe(false)
  })

  it('restores focus to the opener when a dialog closes', () => {
    function WithDialog() {
      const [open, setOpen] = useState(false)
      return <><button type="button" onClick={() => setOpen(true)}>打開詳情</button>
        <Dialog open={open} title="文件詳情" onClose={() => setOpen(false)}><p>詳情內容</p></Dialog></>
    }
    render(<Workspace api={fake()} role="owner" renderPage={id => (id === 'documents' ? <WithDialog /> : null)} />)
    const opener = screen.getByText('打開詳情')
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(screen.getByRole('button', { name: '關閉' }))
    expect(document.activeElement).toBe(opener)
  })
})
