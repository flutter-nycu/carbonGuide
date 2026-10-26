import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRagRepository } from './supabase-repository'
import type { TraceDetail } from './traces'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc, from } }))
const detail = JSON.parse(readFileSync('test/fixtures/rag-traces.synthetic.json', 'utf8'))[0] as TraceDetail
beforeEach(() => {
  vi.stubEnv('VITE_RAG_ENABLED', 'true')
  vi.stubEnv('VITE_RAG_PROJECT_REF', 'abcdefghijklmnopqrst')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefghijklmnopqrst.supabase.co')
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllEnvs())
function response(data: unknown, error: { code: string } | null = null) {
  const abortSignal = vi.fn(async () => ({ data, error }))
  rpc.mockReturnValue({ abortSignal })
  return abortSignal
}
it('uses bounded RPC pagination and passes cancellation to the Supabase request', async () => {
  const abort = response([detail.trace])
  const signal = new AbortController().signal
  const cursor = { id: detail.trace.id, started_at: detail.trace.started_at }
  expect(await createRagRepository().listTraces(cursor, signal)).toEqual([detail.trace])
  expect(rpc).toHaveBeenCalledWith('rag_list_traces', { p_before: cursor.started_at, p_before_id: cursor.id, p_limit: 25 })
  expect(abort).toHaveBeenCalledWith(signal)
})
it('verifies detail identity and distinguishes missing detail from server failure', async () => {
  const repo = createRagRepository(), signal = new AbortController().signal
  response(detail)
  expect(await repo.getTrace(detail.trace.id, signal)).toEqual(detail)
  await expect(repo.getTrace('another-id', signal)).rejects.toThrow('追蹤識別碼不符')
  response(null)
  expect(await repo.getTrace(detail.trace.id, signal)).toBeNull()
  response(null, { code: '42501' })
  await expect(repo.getTrace(detail.trace.id, signal)).rejects.toThrow('管理者權限')
  response(null, { code: 'PGRST202' })
  await expect(repo.listTraces(null, signal)).rejects.toThrow('migration')
})
it('keeps imported trace parents out of the ordinary conversation list', async () => {
  const query = { select: vi.fn(), order: vi.fn(), range: vi.fn(), is: vi.fn(async () => ({ data: [], error: null })) }
  query.select.mockReturnValue(query); query.order.mockReturnValue(query); query.range.mockReturnValue(query)
  from.mockReturnValue(query)
  await createRagRepository().list('rag_runs')
  expect(from).toHaveBeenCalledWith('rag_runs')
  expect(query.is).toHaveBeenCalledWith('diagnostic_expires_at', null)
  expect(query.range).toHaveBeenCalledWith(0, 199)
})
it('does not create a client when the target project guard is disabled', () => {
  vi.stubEnv('VITE_RAG_ENABLED', 'false')
  expect(() => createRagRepository()).toThrow('尚未啟用')
  expect(rpc).not.toHaveBeenCalled()
})
