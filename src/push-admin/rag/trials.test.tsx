// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrialFlow, TrialsPanel } from './TrialsPanel'
import type { RagV1Repository, TrialResult } from './v1'
afterEach(cleanup)

function api(): RagV1Repository {
  return {
    ingestion: vi.fn(), upload: vi.fn(), download: vi.fn(), stopCampaign: vi.fn(),
    campaigns: vi.fn().mockResolvedValue([{ id: 'campaign', name: 'Approved budget', budget_usd: 5, reserved_usd: 0.6, state: 'active', expires_at: '2099-01-01' }]),
    trials: {
      list: vi.fn().mockResolvedValue({ rounds: [{ id: 'round', name: 'Existing round', release_id: 'snapshot', campaign_id: 'campaign', budget_usd: 0.5, reserved_usd: 0,
        request_limit: 20, request_count: 0, per_user_daily_limit: 20, state: 'active', expires_at: '2099-01-01' }], requests: [] }),
      create: vi.fn(), stop: vi.fn(), ask: vi.fn().mockRejectedValue(new Error('連線結果未知。')),
      detail: vi.fn(),
    },
  }
}
describe('bounded version trials', () => {
  it('reuses the request identity after an unknown result and only changes it with the input', async () => {
    const repository = api(); render(<TrialsPanel api={repository} />)
    const question = screen.getByLabelText('問題')
    fireEvent.change(question, { target: { value: '如何減少食物浪費？' } })
    const send = screen.getByRole('button', { name: '送出或查詢相同試問' })
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(send); await screen.findByRole('alert')
    fireEvent.click(send); await waitFor(() => expect(repository.trials!.ask).toHaveBeenCalledTimes(2))
    const calls = vi.mocked(repository.trials!.ask).mock.calls
    expect(calls[0][1]).toBe(calls[1][1])
    fireEvent.change(question, { target: { value: '如何節約用電？' } })
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(send); await waitFor(() => expect(repository.trials!.ask).toHaveBeenCalledTimes(3))
    expect(calls[0][1]).not.toBe(calls[2][1])
  })
  it('shows missing usage as unknown and retains a failed attempt reservation', () => {
    render(<TrialFlow result={{ id: 'run', state: 'uncertain', calls: [{ id: 'call', model: 'gemini-embedding-001', purpose: 'query_embedding', status: 'uncertain', reserved_usd: 0.001, usage: {}, duration_ms: 100 }],
      trace: [{ node: 'query_embedding', state: 'failed', duration_ms: 100, reason: 'provider_outcome_uncertain' }] }} />)
    expect(screen.getByText(/模型預留 US\$ 0.001 · 用量估算 未知/)).toBeTruthy()
    expect(screen.getByText('問句向量化', { selector: 'strong' })).toBeTruthy()
  })
  it.each(['history', 'question'])('slow historical reads cannot replace a newer %s result', async action => {
    const repository = api(), trials = repository.trials!
    const data = await trials.list(new AbortController().signal, 0)
    vi.mocked(trials.list).mockResolvedValue({ ...data, requests: ['old', 'new'].map(id => ({ id, state: 'answered', created_at: '2026-10-26', round_id: 'round', origin: 'query', reason: 'validated' })) })
    let resolveOld!: (value: TrialResult) => void
    trials.detail = vi.fn((id: string): Promise<TrialResult> => id === 'old' ? new Promise<TrialResult>(resolve => { resolveOld = resolve }) : Promise.resolve({ id, state: 'answered', output: { answer: { answer: '最新結果' } } }))
    vi.mocked(trials.ask).mockResolvedValue({ id: 'asked', state: 'answered' })
    render(<TrialsPanel api={repository} />)
    fireEvent.click(await screen.findByRole('button', { name: '查看 old 流程' }))
    if (action === 'history') fireEvent.click(screen.getByRole('button', { name: '查看 new 流程' }))
    else { fireEvent.change(screen.getByLabelText('問題'), { target: { value: '新問題' } }); fireEvent.click(screen.getByRole('button', { name: '送出或查詢相同試問' })) }
    await screen.findByText('最新結果')
    await act(async () => resolveOld({ id: 'old', state: 'answered', output: { answer: { answer: '過期結果' } } }))
    expect(screen.getByText('最新結果')).toBeTruthy(); expect(screen.queryByText('過期結果')).toBeNull()
  })
})
