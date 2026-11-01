// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

vi.mock('./SystemPushTab', () => ({ default: () => <div>system panel</div> }))
vi.mock('./RulesTab', () => ({ default: () => <div>rules panel</div> }))
vi.mock('./HistoryTab', () => ({ default: () => <div>history panel</div> }))
vi.mock('./UsageTab', () => ({ default: () => <div>usage panel</div> }))

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/') })

describe('Dashboard role navigation', () => {
  it('only mounts the isolated RAG demo when selected and preserves it on return', () => {
    const { container } = render(<Dashboard role="viewer" onLogout={() => undefined} />)
    expect(container.querySelector('.rag-workspace')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'RAG 知識工作台 假資料示範' }))
    const frame = screen.getByLabelText('RAG 知識工作台（假資料示範）')
    expect(frame.shadowRoot?.querySelector('#nav')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '推播管理 正式功能' }))
    expect(screen.getByLabelText('RAG 知識工作台（假資料示範）')).toBe(frame)
    expect(frame.parentElement?.hidden).toBe(true)
  })
  it('ignores hashes other than #rag, #push or an empty hash', () => {
    render(<Dashboard role="editor" onLogout={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'RAG 知識工作台 假資料示範' }))
    const ragPanel = () => screen.getByLabelText('RAG 知識工作台（假資料示範）').parentElement!
    for (const hash of ['#main', '#workspace-content']) {
      window.history.replaceState(null, '', hash)
      fireEvent(window, new HashChangeEvent('hashchange'))
      expect(ragPanel().hidden).toBe(false)
    }
    window.history.replaceState(null, '', '/')
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(ragPanel().hidden).toBe(true)
  })

  it('moves focus with the skip link without switching workspaces', () => {
    const { container } = render(<Dashboard role="editor" onLogout={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'RAG 知識工作台 假資料示範' }))
    const link = screen.getByText('跳至主要內容')
    const notPrevented = fireEvent.click(link)
    expect(notPrevented).toBe(false)
    expect(document.activeElement).toBe(container.querySelector('#workspace-content'))
    expect(screen.getByLabelText('RAG 知識工作台（假資料示範）').parentElement!.hidden).toBe(false)
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
