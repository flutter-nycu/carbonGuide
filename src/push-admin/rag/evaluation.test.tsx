// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EvaluationPanel } from './EvaluationPanel'
import type { RagV1Repository } from './v1'
import type { RagRepository } from './repository'
import RagWorkspace from '../components/RagWorkspace'
afterEach(cleanup)
function fixture() {
  const evaluation = { list: vi.fn(async () => ({ datasets: [{ id: 'dataset', name: '獨立驗收題庫', case_count: 40, data_split: 'acceptance', dataset_hash: 'hash' }], batches: [{ id: 'batch', dataset_id: 'dataset', round_id: 'round', created_at: '2026-10-26T00:00:00Z' }], receipts: [] })),
    register: vi.fn(), begin: vi.fn(), next: vi.fn(), finish: vi.fn(async () => 'receipt'), report: vi.fn() }
  const api = { evaluation, trials: { list: vi.fn(async () => ({ rounds: [], requests: [] })) } } as unknown as RagV1Repository
  return { api, evaluation }
}
describe('bounded evaluation execution', () => {
  it('stops after an uncertain result and never automatically pays to retry it', async () => {
    const { api, evaluation } = fixture(); evaluation.next.mockResolvedValue({ complete: false, case_id: 'case-1', state: 'uncertain', reason: 'provider_outcome_uncertain' })
    render(<EvaluationPanel api={api} />)
    await screen.findByRole('option', { name: /獨立驗收題庫.*未產報告/ })
    fireEvent.change(screen.getByLabelText('繼續或查看批次'), { target: { value: 'batch' } })
    fireEvent.click(screen.getByRole('button', { name: '續跑剩餘題目' }))
    await screen.findByText(/case-1：uncertain/)
    expect(evaluation.next).toHaveBeenCalledTimes(1); expect(evaluation.finish).not.toHaveBeenCalled()
  })
  it('leaving the page stops the loop after the in-flight case and preserves its database result', async () => {
    const { api, evaluation } = fixture(); let complete: (value: unknown) => void = () => {}
    evaluation.next.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const view = render(<EvaluationPanel api={api} />)
    await screen.findByRole('option', { name: /獨立驗收題庫.*未產報告/ })
    fireEvent.change(screen.getByLabelText('繼續或查看批次'), { target: { value: 'batch' } })
    fireEvent.click(screen.getByRole('button', { name: '續跑剩餘題目' }))
    await waitFor(() => expect(evaluation.next).toHaveBeenCalledTimes(1)); view.unmount()
    complete({ complete: false, case_id: 'case-1', state: 'answered' }); await Promise.resolve(); await Promise.resolve()
    expect(evaluation.next).toHaveBeenCalledTimes(1); expect(evaluation.finish).not.toHaveBeenCalled()
  })
  it.each(['documents', 'push'])('real hidden navigation to %s stops subsequent paid cases', async destination => {
    const { api, evaluation } = fixture(); let complete: (value: unknown) => void = () => {}
    evaluation.next.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    api.ingestion = vi.fn(async () => ({ originals: [], jobs: [] })); api.campaigns = vi.fn(async () => [])
    const repository = { v1: api, list: vi.fn(async () => []), listTraces: vi.fn(async () => []) } as unknown as RagRepository
    const view = render(<RagWorkspace role="owner" repository={repository} active />)
    fireEvent.click(screen.getByRole('button', { name: '試問' }))
    await screen.findByRole('option', { name: /獨立驗收題庫.*未產報告/ })
    fireEvent.change(screen.getByLabelText('繼續或查看批次'), { target: { value: 'batch' } })
    fireEvent.click(screen.getByRole('button', { name: '續跑剩餘題目' }))
    await waitFor(() => expect(evaluation.next).toHaveBeenCalledTimes(1))
    if (destination === 'documents') fireEvent.click(screen.getByRole('button', { name: '文件與段落' }))
    else view.rerender(<RagWorkspace role="owner" repository={repository} active={false} />)
    await act(async () => { complete({ complete: false, case_id: 'case-1', state: 'answered' }) })
    expect(evaluation.next).toHaveBeenCalledTimes(1); expect(evaluation.finish).not.toHaveBeenCalled()
  })
})
