// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LogsPage } from './OperationsPages'
import { TraceHistory } from './TraceHistory'
import type { RagRepository } from './repository'
import { parseTraceDetail, parseTraceList, usd, type TraceDetail } from './traces'

const recorded = JSON.parse(readFileSync('test/fixtures/rag-traces.synthetic.json', 'utf8')) as TraceDetail[]
const rows = recorded.map(value => parseTraceDetail(value)!)
const first = rows[0]
function repository(): RagRepository {
  return { list: vi.fn(async () => []), saveDraft: vi.fn(), saveSettings: vi.fn(),
    listTraces: vi.fn(async () => rows.slice(0, 25).map(row => row.trace)), getTrace: vi.fn(async () => first) }
}
function openFirst() { fireEvent.click(screen.getAllByRole('button', { name: /查看流程/ })[0]) }
afterEach(cleanup)

describe('trace RPC contracts', () => {
  it('accepts 40 synthetic RPC contract cases without turning unknown charges into zero', () => {
    expect(rows).toHaveLength(40)
    expect(rows.reduce((sum, row) => sum + row.spans.length, 0)).toBe(297)
    expect(rows.reduce((sum, row) => sum + row.charges.length, 0)).toBe(39)
    expect(rows.every(row => row.cost.billed_usd === null && row.cost.estimated_usd === null)).toBe(true)
    expect(usd(null)).toBe('未知'); expect(usd(0)).toBe('US$ 0.00')
    expect(usd(.00539125)).toBe('US$ 0.00539125')
    expect(usd(.0000000001)).toBe('US$ 0.0000000001')
    expect(parseTraceDetail(null)).toBeNull()
    expect(parseTraceList([])).toEqual([])
  })
  it('sorts spans by recorded ordinal and rejects broken relationships, fabricated totals and malformed amounts', () => {
    expect(parseTraceDetail({ ...first, spans: [...first.spans].reverse() })?.spans[0].ordinal).toBe(1)
    for (const mutate of [
      (row: TraceDetail) => { row.spans[0].duration_ms = 0 },
      (row: TraceDetail) => { row.spans[1].id = row.spans[0].id },
      (row: TraceDetail) => { row.spans[1].ordinal = row.spans[0].ordinal },
      (row: TraceDetail) => { row.spans[0].parent_span_id = row.spans[1].id },
      (row: TraceDetail) => { row.charges[0].span_id = row.spans[0].id },
      (row: TraceDetail) => { row.charges[0].total_tokens = -1 },
      (row: TraceDetail) => { row.trace.duration_ms = Infinity },
      (row: TraceDetail) => { row.cost.billed_usd = 0 },
      (row: TraceDetail) => { row.cost.charge_count = 2 },
      (row: TraceDetail) => { row.trace.started_at = 'invalid' },
      (row: TraceDetail) => { row.trace.question_key = 'x'.repeat(65) },
    ]) {
      const value = structuredClone(first); mutate(value)
      expect(() => parseTraceDetail(value)).toThrow('追蹤資料格式不符')
    }
    expect(() => parseTraceList(rows.map(row => row.trace))).toThrow()
    expect(() => parseTraceList([first.trace, first.trace])).toThrow()
  })
})
describe('trace history', () => {
  it('paginates with both cursor fields, loads details on demand and restores opener focus', async () => {
    const repo = repository()
    vi.mocked(repo.listTraces).mockResolvedValueOnce(rows.slice(0, 25).map(row => row.trace)).mockResolvedValueOnce(rows.slice(25).map(row => row.trace))
    render(<TraceHistory repo={repo} />)
    await screen.findByText('第 1 頁 · 本頁 25 筆')
    expect(repo.getTrace).not.toHaveBeenCalled()
    const opener = screen.getAllByRole('button', { name: /查看流程/ })[0]
    fireEvent.click(opener)
    await screen.findByRole('region', { name: '節點明細' })
    expect(repo.getTrace).toHaveBeenCalledWith(first.trace.id, expect.any(AbortSignal))
    expect(screen.getByRole('heading', { name: '歷史評測流程詳情' })).toBe(document.activeElement)
    const cost = within(screen.getByLabelText('本次費用明細'))
    expect(cost.getAllByText('未知')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /01重用文件向量/ }))
    expect(screen.getByText('無新增請求，不重複計費')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /返回追蹤列表/ }))
    expect(document.activeElement).toBe(opener)
    fireEvent.click(screen.getByRole('button', { name: '下一頁追蹤' }))
    await screen.findByText('第 2 頁 · 本頁 15 筆')
    expect(repo.listTraces).toHaveBeenLastCalledWith({ started_at: rows[24].trace.started_at, id: rows[24].trace.id }, expect.any(AbortSignal))
    expect((screen.getByRole('button', { name: '下一頁追蹤' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('shows failure, retry, no-access detail and empty list as different states', async () => {
    const repo = repository()
    vi.mocked(repo.listTraces).mockRejectedValueOnce(new Error('private server message'))
    vi.mocked(repo.getTrace).mockResolvedValue(null)
    render(<TraceHistory repo={repo} />)
    await screen.findByRole('alert')
    expect(screen.queryByText('private server message')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重試讀取追蹤' }))
    await screen.findByText('第 1 頁 · 本頁 25 筆'); openFirst()
    await screen.findByText(/這筆追蹤已過期/)
    fireEvent.click(screen.getByRole('button', { name: /返回追蹤列表/ }))
    vi.mocked(repo.listTraces).mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: '重新整理追蹤' }))
    await screen.findByText(/本頁沒有可讀取的追蹤/)
  })
  it('ignores late detail after return and aborts requests on loss of owner access', async () => {
    const repo = repository()
    let resolve!: (value: TraceDetail) => void
    vi.mocked(repo.getTrace).mockImplementation(() => new Promise(done => { resolve = done }))
    const view = render(<LogsPage repo={repo} role="owner" />)
    await screen.findByText('第 1 頁 · 本頁 25 筆'); openFirst()
    const signal = vi.mocked(repo.getTrace).mock.calls[0][1]
    fireEvent.click(screen.getByRole('button', { name: /返回追蹤列表/ }))
    expect(signal.aborted).toBe(true)
    await act(async () => resolve(first))
    expect(screen.queryByRole('region', { name: '節點明細' })).toBeNull()
    view.rerender(<LogsPage repo={repo} role="editor" />)
    expect(vi.mocked(repo.listTraces).mock.calls[0][1].aborted).toBe(true)
    expect(screen.queryByLabelText('歷史評測追蹤')).toBeNull()
    expect(repo.listTraces).toHaveBeenCalledTimes(1)
  })
  it('does not let an old repository response replace a new one', async () => {
    const oldRepo = repository(), newRepo = repository()
    let resolve!: (value: TraceDetail['trace'][]) => void
    vi.mocked(oldRepo.listTraces).mockImplementation(() => new Promise(done => { resolve = done }))
    vi.mocked(newRepo.listTraces).mockResolvedValue([])
    const view = render(<TraceHistory repo={oldRepo} />)
    view.rerender(<TraceHistory repo={newRepo} />)
    await screen.findByText(/本頁沒有可讀取的追蹤/)
    await act(async () => resolve([first.trace]))
    expect(screen.queryByRole('button', { name: /查看流程/ })).toBeNull()
  })
  it('renders policy refusal with no model call and escapes server text', async () => {
    const repo = repository()
    const policy = structuredClone(rows.find(row => row.charges.length === 0)!)
    policy.trace.question_key = '<img src=x onerror=alert(1)>'
    vi.mocked(repo.getTrace).mockResolvedValue(policy)
    render(<TraceHistory repo={repo} />)
    await screen.findByText('第 1 頁 · 本頁 25 筆'); openFirst()
    await screen.findByText(policy.trace.question_key)
    expect(document.querySelector('img')).toBeNull()
    expect(within(screen.getByLabelText('本次費用明細')).getAllByText('未知')).toHaveLength(3)
    expect(screen.getByText(/0 筆模型請求紀錄/)).toBeTruthy()
  })
  it.each(['viewer', 'editor'] as const)('never reads traces for %s', async role => {
    const repo = repository()
    render(<LogsPage repo={repo} role={role} />)
    await waitFor(() => expect(screen.getByText(/只有管理者可查看互動紀錄/)).toBeTruthy())
    expect(repo.listTraces).not.toHaveBeenCalled(); expect(repo.getTrace).not.toHaveBeenCalled()
  })
})
