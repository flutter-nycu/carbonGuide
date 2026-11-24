// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PAGES } from '../rag/pageList'
import Dashboard from './Dashboard'

vi.mock('./SystemPushTab', () => ({ default: () => <div>system panel</div> }))
vi.mock('./RulesTab', () => ({ default: () => <div>rules panel</div> }))
vi.mock('./HistoryTab', () => ({ default: () => <div>history panel</div> }))
vi.mock('./UsageTab', () => ({ default: () => <div>usage panel</div> }))

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/') })

const topTabs = () => within(screen.getByRole('navigation', { name: '切換工作台' })).getAllByRole('button')
const ragFrame = () => screen.findByLabelText('知識庫', undefined, { timeout: 5000 })
const inFrame = (frame: HTMLElement, selector: string) => frame.shadowRoot!.querySelector(selector) as HTMLElement
const frameButton = (frame: HTMLElement, name: string | RegExp) => [...frame.shadowRoot!.querySelectorAll('button')]
  .find(b => (typeof name === 'string' ? (b.getAttribute('aria-label') ?? b.textContent) === name : name.test(b.textContent ?? ''))) as HTMLElement

describe('Dashboard top tabs', () => {
  it('shows owners four top tabs with the guide last', () => {
    render(<Dashboard role="owner" onLogout={() => undefined} />)
    expect(topTabs().map(b => b.textContent)).toEqual(['推播管理', '知識庫', '使用者', '運作原理'])
  })

  it('names the two new tabs after their pages', () => {
    expect(PAGES.filter(p => p.placement === 'tab').map(p => p.label)).toEqual(['使用者', '運作原理'])
  })

  it('leaves conversation users out for editors and viewers', () => {
    for (const role of ['editor', 'viewer'] as const) {
      render(<Dashboard role={role} onLogout={() => undefined} />)
      expect(topTabs().map(b => b.textContent)).toEqual(['推播管理', '知識庫', '運作原理'])
      cleanup()
    }
  })

  it('opens a tab from the address and keeps one workspace across the RAG tabs', async () => {
    window.history.replaceState(null, '', '/#guide')
    const { container } = render(<Dashboard role="owner" onLogout={() => undefined} />)
    const frame = await ragFrame()
    await waitFor(() => expect(inFrame(frame, '[data-page="guide"]')).toBeTruthy())
    expect(screen.getByRole('button', { name: '運作原理' }).getAttribute('aria-current')).toBe('page')
    expect(inFrame(frame, '.sidebar').hidden).toBe(true)
    const panels = () => [(container.querySelector('.push-shell') as HTMLElement).hidden, (container.querySelector('.rag-panel') as HTMLElement).hidden]
    expect(panels()).toEqual([true, false])

    fireEvent.click(screen.getByRole('button', { name: '使用者' }))
    expect(window.location.hash).toBe('#conversations')
    await waitFor(() => expect(inFrame(frame, '[data-page="conversations"]').hidden).toBe(false))
    expect(inFrame(frame, '[data-page="conversations"]').textContent).toContain('RAG 後端尚未啟用')
    expect(panels()).toEqual([true, false])

    fireEvent.click(screen.getByRole('button', { name: '知識庫' }))
    expect(window.location.hash).toBe('#rag')
    await waitFor(() => expect(inFrame(frame, '.sidebar').hidden).toBe(false))
    expect(screen.getByLabelText('知識庫')).toBe(frame)
    expect(inFrame(frame, '[data-page="guide"]')).toBeTruthy()
  })

  it('does not open conversation users from the address for an editor', () => {
    window.history.replaceState(null, '', '/#conversations')
    const { container } = render(<Dashboard role="editor" onLogout={() => undefined} />)
    expect((container.querySelector('.rag-panel') as HTMLElement).hidden).toBe(true)
    expect(container.querySelector('.rag-workspace')).toBeNull()
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect((container.querySelector('.rag-panel') as HTMLElement).hidden).toBe(true)
  })

  it('follows the guide to the related page in the RAG workspace tab', async () => {
    window.history.replaceState(null, '', '/#guide')
    render(<Dashboard role="owner" onLogout={() => undefined} />)
    const frame = await ragFrame()
    await waitFor(() => expect(inFrame(frame, '[data-page="guide"]')).toBeTruthy())
    fireEvent.click(frameButton(frame, '一個問題怎麼被回答'))
    fireEvent.click(frameButton(frame, '第 4 步：找資料'))
    fireEvent.click(frameButton(frame, /^前往「/))
    expect(window.location.hash).toBe('#rag')
    expect(screen.getByRole('button', { name: '知識庫' }).getAttribute('aria-current')).toBe('page')
    await waitFor(() => expect(inFrame(frame, '[data-page="settings"]').hidden).toBe(false))
    expect(inFrame(frame, '[data-page="guide"]').hidden).toBe(true)
  })
})

describe('Dashboard role navigation', () => {
  it('only mounts the isolated RAG workspace when selected and preserves it on return', async () => {
    const { container } = render(<Dashboard role="viewer" onLogout={() => undefined} />)
    expect(container.querySelector('.rag-workspace')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '知識庫' }))
    const frame = await screen.findByLabelText('知識庫', undefined, { timeout: 5000 })
    await waitFor(() => expect(frame.shadowRoot?.querySelector('#nav')).toBeTruthy())
    expect(frame.shadowRoot!.textContent).toContain('RAG 後端尚未啟用')
    fireEvent.click(screen.getByRole('button', { name: '推播管理' }))
    expect(screen.getByLabelText('知識庫')).toBe(frame)
    expect(frame.closest('[hidden]')).not.toBeNull()
  })
  it('ignores hashes other than the four tabs or an empty hash', async () => {
    render(<Dashboard role="editor" onLogout={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: '知識庫' }))
    await screen.findByLabelText('知識庫', undefined, { timeout: 5000 })
    const ragPanel = () => screen.getByLabelText('知識庫').closest('.rag-panel') as HTMLElement
    for (const hash of ['#main', '#workspace-content']) {
      window.history.replaceState(null, '', hash)
      fireEvent(window, new HashChangeEvent('hashchange'))
      expect(ragPanel().hidden).toBe(false)
    }
    window.history.replaceState(null, '', '/')
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(ragPanel().hidden).toBe(true)
  })

  it('moves focus with the skip link without switching workspaces', async () => {
    const { container } = render(<Dashboard role="editor" onLogout={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: '知識庫' }))
    await screen.findByLabelText('知識庫', undefined, { timeout: 5000 })
    const link = screen.getByText('跳至主要內容')
    const notPrevented = fireEvent.click(link)
    expect(notPrevented).toBe(false)
    expect(document.activeElement).toBe(container.querySelector('#workspace-content'))
    expect((screen.getByLabelText('知識庫').closest('.rag-panel') as HTMLElement).hidden).toBe(false)
  })

  it('keeps viewer accounts on read-only tabs', () => {
    render(<Dashboard role="viewer" onLogout={() => undefined} />)

    expect(screen.queryByRole('button', { name: '系統推播' })).toBeNull()
    expect(screen.queryByRole('button', { name: '個人化規則' })).toBeNull()
    expect(screen.getByRole('button', { name: '發送紀錄' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '推播用量' })).toBeTruthy()
    expect(screen.getByText('history panel')).toBeTruthy()
  })

  it('shows write tabs to editor accounts', () => {
    render(<Dashboard role="editor" onLogout={() => undefined} />)

    expect(screen.getByRole('button', { name: '系統推播' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '個人化規則' })).toBeTruthy()
    expect(screen.getByText('system panel')).toBeTruthy()
  })
})
