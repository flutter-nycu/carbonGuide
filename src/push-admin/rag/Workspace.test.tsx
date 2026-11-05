// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createFakeRagApi } from './api/fake'
import { Dialog } from './ui'
import { PAGES } from './pageList'
import Workspace from './Workspace'

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
  it('lists the eleven pages in order with matching mobile options', () => {
    render(<Workspace api={fake()} role="owner" />)
    const buttons = within(nav()).getAllByRole('button').map(b => b.textContent)
    expect(buttons).toEqual(PAGES.map(p => p.number + p.label))
    expect(buttons).toEqual(['01知識庫與文件', '02匯入與預檢', '03檢索試問台', '04RAG 評測', '05知識版本', '06人格設定', '07System Prompt',
      '08基本通用 QA', '09進階檢索設定', '10互動紀錄', '11對話使用者'])
    const options = [...(screen.getByLabelText('切換管理功能') as HTMLSelectElement).options].map(o => o.textContent)
    expect(options).toEqual(PAGES.map(p => p.label))
    expect(within(nav()).getByText('進階與紀錄')).toBeTruthy()
  })

  it('gives every page a heading and a one-line subtitle, without help blocks', () => {
    const { container } = render(<Workspace api={fake()} role="owner" />)
    for (const page of PAGES) {
      fireEvent.click(within(nav()).getByRole('button', { name: page.number + page.label }))
      const current = container.querySelector(`[data-page="${page.id}"]`)!
      expect(current.querySelector('h1')!.textContent).toBe(page.title)
      expect(current.querySelector('.subtitle')!.textContent!.length).toBeGreaterThan(5)
    }
    expect(container.querySelector('details, .page-help, .quick-start, .guide-side')).toBeNull()
  })

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
    const { container } = render(<Workspace api={null} role="owner" renderPage={() => <p>真實內容</p>} />)
    for (const page of PAGES) {
      fireEvent.click(within(nav()).getByRole('button', { name: page.number + page.label }))
      const current = container.querySelector(`[data-page="${page.id}"]`)!
      expect(current.textContent).toContain('RAG 後端尚未啟用')
      expect(current.textContent).not.toContain('真實內容')
    }
  })

  it('shows each role only the pages its account can read', () => {
    const visible = (role: 'editor' | 'viewer') => {
      const { container, unmount } = render(<Workspace api={createFakeRagApi({ role })} role={role} renderPage={() => <p>真實內容</p>} />)
      const shown = PAGES.filter(page => {
        fireEvent.change(screen.getByLabelText('切換管理功能'), { target: { value: page.id } })
        return container.querySelector(`[data-page="${page.id}"]`)!.textContent!.includes('真實內容')
      }).map(page => page.number)
      unmount()
      return shown
    }
    expect(visible('editor')).toEqual(['01', '02', '05', '06', '07', '08', '09'])
    expect(visible('viewer')).toEqual(['01', '02', '06', '07', '08', '09'])
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
    const { container } = render(<Workspace api={createFakeRagApi({ role: 'editor' })} role="editor" renderPage={() => <p>真實內容</p>} />)
    for (const id of ['conversations', 'logs']) {
      fireEvent.change(screen.getByLabelText('切換管理功能'), { target: { value: id } })
      const current = container.querySelector(`[data-page="${id}"]`)!
      expect(current.textContent).toContain('只有 owner 可以查看')
      expect(current.textContent).not.toContain('真實內容')
    }
    fireEvent.change(screen.getByLabelText('切換管理功能'), { target: { value: 'documents' } })
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
