import { supabase } from '../lib/supabase'
import type { TrialCall, TrialRepository, TrialResult } from './v1'
export function createTrialRepository(action: (body: Record<string, unknown>) => Promise<Record<string, unknown>>): TrialRepository {
  return {
    async abandon(requestId) { return await action({ action: 'request_abandon', requestId }) as unknown as TrialResult },
    async list(signal, offset) {
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('紀錄頁碼無效。')
      const [rounds, requests] = await Promise.all([
        supabase.from('rag_v1_rounds').select('id,name,release_id,campaign_id,budget_usd,reserved_usd,request_limit,request_count,per_user_daily_limit,state,expires_at').order('created_at', { ascending: false }).limit(100).abortSignal(signal),
        supabase.from('rag_v1_requests').select('id,round_id,state,reason,created_at').order('created_at', { ascending: false }).order('id').range(offset, offset + 49).abortSignal(signal),
      ])
      if (rounds.error || requests.error) throw new Error('無法讀取受控試問輪次或紀錄。')
      return { rounds: rounds.data ?? [], requests: requests.data ?? [] }
    },
    async create(input) {
      const result = await action({ action: 'round_create', ...input })
      if (typeof result.id !== 'string') throw new Error('尚未取得輪次識別碼，請使用相同設定重試查詢。')
      return result.id
    },
    async stop(roundId) { await action({ action: 'round_stop', roundId }) },
    async ask(roundId, requestKey, input) { return await action({ action: 'question', roundId, requestKey, input, origin: 'query' }) as unknown as TrialResult },
    async detail(requestId, signal) {
      const [result, links] = await Promise.all([
        action({ action: 'request_read', requestId }),
        supabase.from('rag_v1_run_calls').select('rag_v1_model_calls(id,model,purpose,status,reserved_usd,usage,duration_ms)').eq('request_id', requestId).limit(4).abortSignal(signal),
      ])
      if (links.error) throw new Error('無法取得本次模型費用紀錄。')
      const calls = (links.data ?? []).flatMap(row => Array.isArray(row.rag_v1_model_calls) ? row.rag_v1_model_calls : [row.rag_v1_model_calls]).filter(Boolean) as TrialCall[]
      return { ...result, calls } as unknown as TrialResult
    },
  }
}
