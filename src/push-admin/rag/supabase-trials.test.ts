import { beforeEach, expect, it, vi } from 'vitest'
import { createTrialRepository } from './supabase-trials'

const from = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from } }))
beforeEach(() => vi.clearAllMocks())
function query(data: unknown, error: unknown = null) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const key of ['select', 'order', 'range', 'eq', 'gt', 'limit', 'abortSignal', 'maybeSingle']) q[key] = vi.fn(() => q)
  q.then = vi.fn((done: (value: unknown) => unknown) => Promise.resolve(done({ data, error })))
  return q
}
it('reads bounded owner history with projected text, source filter and stable ordering', async () => {
  const q = query([{ id: 'id', origin: 'query', state: 'answered', rag_v1_request_details: { question: '已存問題', answer: '已存答案', expires_at: '2099-01-01' } }])
  from.mockReturnValue(q)
  const action = vi.fn(), api = createTrialRepository(action), signal = new AbortController().signal
  const rows = await api.history!(signal, 20, 'query')
  expect(rows[0]).toMatchObject({ question: '已存問題', answer: '已存答案', details_expired: false })
  expect(q.range).toHaveBeenCalledWith(20, 40)
  expect(q.eq).toHaveBeenCalledWith('origin', 'query')
  expect(q.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id']])
  expect(q.select.mock.calls[0][0]).not.toMatch(/execution_token|start_token|\*/)
  expect(q.abortSignal).toHaveBeenCalledWith(signal)
  expect(action).not.toHaveBeenCalled()
})
it('keeps metadata but omits expired bodies, including array-shaped embeds', async () => {
  const q = query([{ id: 'old', rag_v1_request_details: [{ question: '過期問題', answer: '過期回答', expires_at: '2020-01-01' }] }, { id: 'cleared', rag_v1_request_details: null }])
  from.mockReturnValue(q)
  const rows = await createTrialRepository(vi.fn()).history!(new AbortController().signal, 0, 'all')
  expect(rows.every(row => row.details_expired && row.question === null && row.answer === null)).toBe(true)
  expect(q.eq).not.toHaveBeenCalled()
})
it('rejects invalid pagination before reading and hides provider error details', async () => {
  const api = createTrialRepository(vi.fn()), signal = new AbortController().signal
  await expect(api.history!(signal, -1, 'all')).rejects.toThrow('查詢條件')
  expect(from).not.toHaveBeenCalled()
  from.mockReturnValue(query(null, { message: 'private database details' }))
  await expect(api.history!(signal, 0, 'query')).rejects.toThrow('登入權限')
})
it('loads saved question and costs without issuing a paid action and checks identity', async () => {
  const question = query({ question: '原始問題', expires_at: '2099-01-01' }), calls = query([])
  from.mockImplementation(name => name === 'rag_v1_request_details' ? question : calls)
  const action = vi.fn(async () => ({ id: 'saved', state: 'answered' })), api = createTrialRepository(action)
  expect((await api.detail('saved', new AbortController().signal)).input?.question).toBe('原始問題')
  expect(action).toHaveBeenCalledExactlyOnceWith({ action: 'request_read', requestId: 'saved' })
  expect(question.select).toHaveBeenCalledWith('question:input->>question,expires_at')
  await expect(api.detail('wrong', new AbortController().signal)).rejects.toThrow('識別碼不符')
})
