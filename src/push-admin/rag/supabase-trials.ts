import { supabase } from '../lib/supabase'
import type { TrialCall, TrialRepository, TrialResult } from './v1'
export function createTrialRepository(action: (body: Record<string, unknown>) => Promise<Record<string, unknown>>): TrialRepository {
  return {
    async history(signal, offset, origin) {
      if (!Number.isSafeInteger(offset) || offset < 0 || !['query', 'evaluation', 'all'].includes(origin)) throw new Error('紀錄查詢條件無效。')
      // The embedded detail keeps the existing owner-only RLS and 30-day expiry.
      let query = supabase.from('rag_v1_requests').select('id,round_id,origin,state,reason,created_at,rag_v1_request_details(question:input->>question,answer:output->answer->>answer,qa_answer:output->qa->>answer,expires_at)')
        .order('created_at', { ascending: false }).order('id').range(offset, offset + 20)
      if (origin !== 'all') query = query.eq('origin', origin)
      const { data, error } = await query.abortSignal(signal)
      if (error) throw new Error('無法讀取問答紀錄，請確認登入權限後重試。')
      return (data ?? []).map(row => {
        const detail = Array.isArray(row.rag_v1_request_details) ? row.rag_v1_request_details[0] : row.rag_v1_request_details
        const retained = detail && Date.parse(detail.expires_at) > Date.now() ? detail : null
        return { id: row.id, round_id: row.round_id, origin: row.origin as 'query' | 'evaluation', state: row.state, reason: row.reason, created_at: row.created_at,
          question: typeof retained?.question === 'string' ? retained.question : null,
          answer: typeof retained?.answer === 'string' ? retained.answer : typeof retained?.qa_answer === 'string' ? retained.qa_answer : null,
          details_expired: !retained }
      })
    },
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
      const [result, links, question] = await Promise.all([
        action({ action: 'request_read', requestId }),
        supabase.from('rag_v1_run_calls').select('rag_v1_model_calls(id,model,purpose,status,reserved_usd,usage,duration_ms)').eq('request_id', requestId).limit(4).abortSignal(signal),
        supabase.from('rag_v1_request_details').select('question:input->>question,expires_at').eq('request_id', requestId).gt('expires_at', new Date().toISOString()).abortSignal(signal).maybeSingle(),
      ])
      if (links.error) throw new Error('無法取得本次模型費用紀錄。')
      if (question.error) throw new Error('無法取得本次問題內容，請重新讀取。')
      if (result.id !== requestId) throw new Error('問答紀錄識別碼不符，請重新讀取。')
      const calls = (links.data ?? []).flatMap(row => Array.isArray(row.rag_v1_model_calls) ? row.rag_v1_model_calls : [row.rag_v1_model_calls]).filter(Boolean) as TrialCall[]
      const retainedQuestion = !result.details_expired && question.data && Date.parse(question.data.expires_at) > Date.now() && typeof question.data.question === 'string' ? question.data.question : null
      return { ...result, input: retainedQuestion === null ? null : { question: retainedQuestion }, calls } as unknown as TrialResult
    },
  }
}
