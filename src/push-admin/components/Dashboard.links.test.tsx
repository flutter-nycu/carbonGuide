// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RagView } from '../rag/pageList'
import Dashboard from './Dashboard'

// A stand-in workspace whose pages link to each top tab, to test what Dashboard lets a link open.
vi.mock('./RagWorkspace', () => ({
  default: ({ onView }: { onView: (view: RagView) => void }) => <div aria-label="RAG 知識工作台">
    {(['conversations', 'guide', 'workspace'] as const).map(view => <button key={view} type="button" onClick={() => onView(view)}>連到 {view}</button>)}
  </div>,
}))
vi.mock('./SystemPushTab', () => ({ default: () => <div>system panel</div> }))
vi.mock('./HistoryTab', () => ({ default: () => <div>history panel</div> }))
vi.mock('./UsageTab', () => ({ default: () => <div>usage panel</div> }))
vi.mock('./RulesTab', () => ({ default: () => <div>rules panel</div> }))

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/') })

const current = () => screen.getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'page' && b.closest('nav[aria-label="切換工作台"]')).map(b => b.textContent)

describe('Dashboard links between top tabs', () => {
  it('lets a page link open the tabs the role can see', async () => {
    render(<Dashboard role="owner" onLogout={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'RAG 知識工作台 內部測試' }))
    fireEvent.click(await screen.findByRole('button', { name: '連到 conversations' }))
    expect(current()).toEqual(['對話使用者'])
    expect(window.location.hash).toBe('#conversations')
  })

  it('ignores a link to conversation users for an editor', async () => {
    render(<Dashboard role="editor" onLogout={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'RAG 知識工作台 內部測試' }))
    fireEvent.click(await screen.findByRole('button', { name: '連到 conversations' }))
    expect(current()).toEqual(['RAG 知識工作台 內部測試'])
    expect(window.location.hash).toBe('#rag')
    fireEvent.click(screen.getByRole('button', { name: '連到 guide' }))
    expect(current()).toEqual(['技術架構導覽'])
  })
})
