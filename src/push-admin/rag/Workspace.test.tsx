// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createFakeRagApi } from './api/fake'
import { Dialog, useNavigate } from './ui'
import { PAGES, SIDEBAR_PAGES, pageName, viewOf, type PageId } from './pageList'
import Workspace from './Workspace'
import { ALL_PAGES_TIMEOUT, WorkspaceHost, showPage } from './pages/testing'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) }
})
afterEach(() => cleanup())

const fake = () => createFakeRagApi({ role: 'owner' })
const nav = () => screen.getByRole('navigation', { name: 'RAG 工作台頁面' })

function Draft() {
  const [value, setValue] = useState('')
  return <label className="field">草稿<input value={value} onChange={event => setValue(event.target.value)} /></label>
}

function TitledDialog({ title }: { title: string }) {
  return <Dialog open={false} title={title} onClose={() => undefined}><p>內容</p></Dialog>
}

describe('RAG workspace shell', () => {
  it('lists the ten sidebar pages in order with matching mobile options', () => {
    render(<Workspace api={fake()} role="owner" />)
    const buttons = within(nav()).getAllByRole('button').map(b => b.textContent)
    expect(buttons).toEqual(SIDEBAR_PAGES.map(p => p.number + p.label))
    expect(buttons).toEqual(['01知識庫與文件', '02匯入與預檢', '03檢索試問台', '04RAG 評測', '05知識版本', '06人格設定', '07System Prompt',
      '08基本通用 QA', '09進階檢索設定', '10互動紀錄'])
    const options = [...(screen.getByLabelText('切換管理功能') as HTMLSelectElement).options].map(o => o.textContent)
    expect(options).toEqual(SIDEBAR_PAGES.map(p => p.label))
    expect(within(nav()).getByText('進階與紀錄')).toBeTruthy()
    expect(within(nav()).queryByText('認識系統')).toBeNull()
    // Conversation users and the guide live in the admin's top tabs, without numbers.
    expect(PAGES.filter(p => p.placement === 'tab').map(p => [p.id, p.number])).toEqual([['conversations', undefined], ['guide', undefined]])
    for (const page of PAGES) expect(viewOf(page.id) === 'workspace', page.id).toBe(page.placement === 'sidebar')
    expect(PAGES.map(pageName).slice(8)).toEqual(['09 進階檢索設定', '10 互動紀錄', '使用者', '技術架構導覽'])
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
    fireEvent.click(screen.getByRole('button', { name: 'RAG 知識工作台' }))
    expect((screen.getByLabelText('草稿') as HTMLInputElement).value).toBe('還沒存的內容')
    expect(view.container.querySelector('[data-page="prompt"]')!.hasAttribute('hidden')).toBe(false)
  })

  it('moves focus to the content when the sidebar it was in gets hidden', () => {
    const view = render(<WorkspaceHost api={fake()} role="owner" />)
    within(nav()).getByRole('button', { name: '09進階檢索設定' }).focus()
    fireEvent.click(screen.getByRole('button', { name: '技術架構導覽' }))
    expect(document.activeElement?.id).toBe('main')
    // Focus elsewhere is left alone.
    const tab = screen.getByRole('button', { name: 'RAG 知識工作台' })
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
      expect(current.querySelector('h1')!.textContent).toBe(page.title)
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
    fireEvent.click(within(nav()).getByRole('button', { name: '07System Prompt' }))
    fireEvent.change(screen.getByLabelText('草稿'), { target: { value: '還沒存的內容' } })
    fireEvent.click(within(nav()).getByRole('button', { name: '01知識庫與文件' }))
    expect((screen.getByLabelText('草稿', { selector: 'input' }) as HTMLInputElement).closest('[data-page]')!.hasAttribute('hidden')).toBe(true)
    fireEvent.change(screen.getByLabelText('切換管理功能'), { target: { value: 'prompt' } })
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
    expect(visible('editor')).toEqual(['documents', 'import', 'releases', 'personas', 'prompt', 'qa', 'settings', 'guide'])
    expect(visible('viewer')).toEqual(['documents', 'import', 'personas', 'prompt', 'qa', 'settings', 'guide'])
  })

  it('gives every kept-alive dialog its own name', () => {
    const { container } = render(<Workspace api={fake()} role="owner" renderPage={id => (id === 'documents' || id === 'qa' ? <TitledDialog title={id} /> : null)} />)
    fireEvent.change(screen.getByLabelText('切換管理功能'), { target: { value: 'qa' } })
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
      expect(current.textContent).toContain('只有 owner 可以查看')
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
    fireEvent.click(within(nav()).getByRole('button', { name: '05知識版本' }))
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
