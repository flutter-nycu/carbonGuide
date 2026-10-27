// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DocumentsPage } from './DocumentsPage'
import { LogsPage } from './OperationsPages'
import type { RagRepository } from './repository'
import { DetailDialog, DetailVisibility } from './DetailDialog'
import { InteractionHistory } from './InteractionHistory'
import { TrialFlow } from './TrialFlow'
import type { InteractionRecord, TrialRepository, TrialResult } from './v1'

afterEach(cleanup)
const repo = () => ({ list: vi.fn(async () => []), listTraces: vi.fn(async () => []), getTrace: vi.fn(), saveDraft: vi.fn(), saveSettings: vi.fn() } as unknown as RagRepository)

it('opens document inspection as a named viewport dialog and restores focus', async () => {
  const repository = repo()
  repository.list = vi.fn(async (kind: string) => kind === 'documents' ? Array.from({ length: 60 }, (_, i) => ({ id: String(i), title: `測試文件 ${i}`, source_type: 'pdf', purpose: '指引', domain: '生活', created_at: '' })) : []) as RagRepository['list']
  render(<DocumentsPage repo={repository} />)
  const opener = await screen.findByRole('button', { name: '檢視 測試文件 0' })
  opener.focus(); fireEvent.click(opener)
  const dialog = await screen.findByRole('dialog', { name: /測試文件 0/ })
  fireEvent.click(within(dialog).getByRole('button', { name: '關閉詳情' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
  expect(screen.getAllByRole('button', { name: /^檢視/ })).toHaveLength(12)
  fireEvent.click(screen.getByRole('button', { name: '下一頁文件' }))
  expect(screen.getByRole('button', { name: '檢視 測試文件 12' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('搜尋文件'), { target: { value: '測試文件 59' } })
  expect(screen.getByRole('button', { name: '檢視 測試文件 59' })).toBeTruthy()
})

it('opens a saved v1 interaction with its question and answer without asking a model', async () => {
  const repository = repo()
  const trials = { list: vi.fn(async () => ({ rounds: [], requests: [{ id: 'request-1', round_id: 'round', state: 'answered', reason: 'validated', created_at: '2026-10-27T00:00:00Z' }] })), detail: vi.fn(async () => ({ id: 'request-1', state: 'answered', input: { question: '如何減少剩食？' }, output: { answer: { answer: '先規劃需要的份量。', citations: [] } }, trace: [], calls: [] })), ask: vi.fn() }
  repository.v1 = { trials } as unknown as NonNullable<RagRepository['v1']>
  repository.v1.trials!.history = vi.fn(async () => [{ id: 'request-1', round_id: 'round', origin: 'query' as const, state: 'answered', reason: 'validated', created_at: '2026-10-27T00:00:00Z', question: '如何減少剩食？', answer: '先規劃需要的份量。', details_expired: false }])
  render(<LogsPage repo={repository} role="owner" />)
  const opener = await screen.findByRole('button', { name: /查看問答/ })
  fireEvent.click(opener)
  const dialog = await screen.findByRole('dialog', { name: /問答詳情/ })
  expect(await within(dialog).findByText('如何減少剩食？')).toBeTruthy()
  expect(within(dialog).getByText('先規劃需要的份量。')).toBeTruthy()
  expect(trials.ask).not.toHaveBeenCalled()
})

it('dismisses with Escape, releases scroll lock when hidden and keeps draft content', () => {
  const close = vi.fn()
  document.documentElement.style.overflow = 'auto'
  const content = (active: boolean) => <DetailVisibility.Provider value={active}><DetailDialog title="草稿" onClose={close}><input aria-label="未存內容" defaultValue="保留內容" /></DetailDialog></DetailVisibility.Provider>
  const view = render(content(true))
  expect(document.documentElement.style.overflow).toBe('hidden')
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }))
  expect(close).toHaveBeenCalledOnce()
  view.rerender(content(false))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.documentElement.style.overflow).toBe('auto')
  view.rerender(content(true))
  expect((screen.getByLabelText('未存內容') as HTMLInputElement).value).toBe('保留內容')
  view.unmount()
  expect(document.documentElement.style.overflow).toBe('auto')
  document.documentElement.style.overflow = ''
})

function interactionApi() {
  const row: InteractionRecord = { id: 'saved-one', round_id: 'round', origin: 'query', state: 'answered', reason: 'validated', created_at: '2026-10-27', question: '已存問題', answer: '已存回答', details_expired: false }
  const api = { history: vi.fn(async () => [row]), detail: vi.fn(async () => ({ id: row.id, state: 'answered', input: { question: row.question! }, output: { answer: { answer: row.answer } } })), ask: vi.fn() } as unknown as TrialRepository
  return { api, row }
}

it('does not fetch owner interaction data for editor or viewer', async () => {
  const repository = repo(), { api } = interactionApi()
  repository.v1 = { trials: api } as NonNullable<RagRepository['v1']>
  const view = render(<LogsPage repo={repository} role="editor" />)
  view.rerender(<LogsPage repo={repository} role="viewer" />)
  expect(api.history).not.toHaveBeenCalled()
  expect(api.detail).not.toHaveBeenCalled()
})

it('does not reopen a dismissed pending detail or let it overwrite another question', async () => {
  const { api, row } = interactionApi()
  vi.mocked(api.history!).mockResolvedValue([row, { ...row, id: 'saved-two', question: '第二題' }])
  let resolve!: (result: TrialResult) => void
  vi.mocked(api.detail).mockImplementation(id => id === row.id ? new Promise(done => { resolve = done }) : Promise.resolve({ id, state: 'answered', input: { question: '第二題' }, output: { answer: { answer: '第二題回答' } } }))
  render(<InteractionHistory api={api} />)
  fireEvent.click(await screen.findByRole('button', { name: '查看問答 saved-on' }))
  const signal = vi.mocked(api.detail).mock.calls[0][1]
  fireEvent.click(screen.getByRole('button', { name: '關閉詳情' }))
  expect(signal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '查看問答 saved-tw' }))
  await screen.findByText('第二題回答')
  await act(async () => resolve({ id: row.id, state: 'answered', output: { answer: { answer: '過時回應' } } }))
  expect(screen.queryByText('過時回應')).toBeNull()
  expect(screen.getByText('第二題回答')).toBeTruthy()
  expect(api.ask).not.toHaveBeenCalled()
})

it('handles list failure, retry, source filtering and bounded pagination', async () => {
  const { api, row } = interactionApi()
  vi.mocked(api.history!).mockRejectedValueOnce(new Error('private database error')).mockResolvedValue(Array.from({ length: 21 }, (_, i) => ({ ...row, id: `item-${i}` })))
  render(<InteractionHistory api={api} />)
  await screen.findByRole('alert')
  expect(screen.queryByText('private database error')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '重新整理問答' }))
  await waitFor(() => expect(screen.getAllByRole('button', { name: /查看問答/ })).toHaveLength(20))
  fireEvent.click(screen.getByRole('button', { name: '下一頁問答' }))
  await waitFor(() => expect(api.history).toHaveBeenLastCalledWith(expect.any(AbortSignal), 20, 'query'))
  fireEvent.change(screen.getByLabelText('紀錄來源'), { target: { value: 'evaluation' } })
  await waitFor(() => expect(api.history).toHaveBeenLastCalledWith(expect.any(AbortSignal), 0, 'evaluation'))
})

it('suppresses expired question and answer bodies while retaining cost evidence', () => {
  render(<TrialFlow result={{ id: 'expired', state: 'answered', details_expired: true, input: { question: '不該顯示的問題' }, output: { answer: { answer: '不該顯示的回答' } }, calls: [] }} />)
  expect(screen.getByText(/問題與回答已超過保留期限/)).toBeTruthy()
  expect(screen.queryByText('不該顯示的問題')).toBeNull()
  expect(screen.queryByText('不該顯示的回答')).toBeNull()
})

it('renders hostile saved content as text and includes source title/page', () => {
  const { container } = render(<TrialFlow result={{ id: 'safe', state: 'answered', input: { question: '<img src=x onerror=alert(1)>' }, output: { answer: { answer: '<script>alert(1)</script>', citations: [{ chunk_id: 'chunk', quote: '<svg onload=alert(1)>' }] }, evidence: [{ id: 'chunk', title: '研究報告', page_start: 7, page_end: 8 }] } }} />)
  expect(container.querySelector('script,img,svg')).toBeNull()
  expect(screen.getByText(/引用 1 · 研究報告 · 第 7–8 頁/)).toBeTruthy()
})
