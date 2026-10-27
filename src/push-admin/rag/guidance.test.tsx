// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { QaCitationsForm } from './EditorialForms'
import { TrialFlow } from './TrialFlow'
import { DraftsPage } from './DraftsPage'
import type { EditorialRepository } from './v1'
import type { QaEntry, RagRepository } from './repository'
afterEach(cleanup)

it('keeps citation removal local and explains an empty saved list', async () => {
  const api = { qaCitations: vi.fn(async () => [{ chunk_id: 'source', quote: '逐字來源摘錄文字' }]), saveQaCitations: vi.fn(async () => {}) } as unknown as EditorialRepository
  render(<QaCitationsForm api={api} qa={{ id: 'qa', updated_at: 'stamp' } as QaEntry} writable saved={() => {}} />)
  const details = document.querySelector('details')!
  details.open = true; fireEvent(details, new Event('toggle'))
  await screen.findByDisplayValue('source')
  fireEvent.click(screen.getByRole('button', { name: '移除引用 1' }))
  expect(api.saveQaCitations).not.toHaveBeenCalled()
  expect(screen.getByText(/尚未儲存/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '儲存並核對引用' }))
  await waitFor(() => expect(api.saveQaCitations).toHaveBeenCalledWith('qa', 'stamp', []))
  expect(await screen.findByText(/引用已清空.*至少補上一筆/)).toBeTruthy()
})

it('labels the stored refusal and keeps the administrator explanation separate', () => {
  render(<TrialFlow result={{ id: 'saved', state: 'abstained', reason: 'full_bill_unsupported', output: { answer: { answer: '這是當時保存的拒答。', citations: [] } } }} />)
  expect(screen.getByRole('heading', { name: '本次實際回覆（拒答）' })).toBeTruthy()
  expect(screen.getByText('這是當時保存的拒答。')).toBeTruthy()
  expect(screen.getByText(/目前不提供完整帳單計算/)).toBeTruthy()
})

it('keeps the saved empty-citation feedback after the real list reload', async () => {
  const editorial = { qaCitations: vi.fn(async () => [{ chunk_id: 'source', quote: '逐字來源摘錄文字' }]), saveQaCitations: vi.fn(async () => {}) }
  const repo = { list: vi.fn(async () => [{ id: 'qa', question: '測試問題', answer: '回答', updated_at: 'stamp', enabled: true }]), v1: { editorial } } as unknown as RagRepository
  render(<DraftsPage repo={repo} role="owner" kind="qa_entries" />)
  await screen.findByText('測試問題')
  const details = [...document.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent?.startsWith('核對 QA 引用'))!
  details.open = true; fireEvent(details, new Event('toggle'))
  await screen.findByDisplayValue('source')
  fireEvent.click(screen.getByRole('button', { name: '移除引用 1' }))
  fireEvent.click(screen.getByRole('button', { name: '儲存並核對引用' }))
  await waitFor(() => expect(repo.list).toHaveBeenCalledTimes(2))
  expect(await screen.findByText(/「測試問題」：引用已清空/)).toBeTruthy()
})

it.each([['uncertain', /無法確認.*最終回覆/], ['failed', /未產生可確認的最終回覆/], ['running', /尚在處理中/]])('explains %s without inventing a refusal', (state, expected) => {
  render(<TrialFlow result={{ id: 'missing', state, output: {} }} />)
  expect(screen.getByText(expected)).toBeTruthy()
  expect(screen.queryByText('目前這個知識版本沒有足夠且可核對的資料回答，請補充問題或交由管理員確認。')).toBeNull()
})

it('does not present expired traces as still processing', () => {
  render(<TrialFlow result={{ id: 'expired', state: 'answered', details_expired: true, output: { answer: { answer: '不可顯示' } } }} />)
  expect(screen.queryByText('不可顯示')).toBeNull()
  expect(screen.queryByText(/尚未取得完成的流程/)).toBeNull()
})
