import { supabase } from '../lib/supabase'
import { createPilotRepository } from './supabase-pilot'
import { ragConfiguration } from './config'
import { parseTraceDetail, parseTraceList, TRACE_PAGE_SIZE } from './traces'
import { validateSettings, type EntityMap, type RagRepository } from './repository'

const columns: Record<keyof EntityMap, string> = {
  documents: 'id,title,source_type,purpose,domain,created_at',
  document_versions: 'id,document_id,version,processing_status,content_status,failure_reason,created_at',
  chunks: 'id,document_version_id,ordinal,page_start,page_end,section_path,original_text',
  chunk_sets: 'id,document_version_id,content_hash,chunker_version,sealed,created_at',
  qa_entries: 'id,question,answer,source_note,enabled,updated_at', personas: 'id,name,instruction,example,enabled,updated_at',
  prompts: 'id,name,content,updated_at', knowledge_releases: 'id,name,status,manifest,created_at',
  evaluation_runs: 'id,release_id,status,report,created_at', rag_runs: 'id,question,answer,release_id,status,duration_ms,created_at',
  embedding_profiles: 'id,model,dimensions,distance_metric,chunker_version',
  rag_service_state: 'id,service_enabled,active_release_id,answer_style,daily_question_limit,retrieval_candidates,context_chunks,similarity_threshold,qa_threshold,fallback_reply,rewrite_enabled,tools_enabled,updated_at',
  usage_daily: 'day,question_count',
}
const order: Partial<Record<keyof EntityMap, string>> = { chunks: 'ordinal', usage_daily: 'day', qa_entries: 'updated_at', personas: 'updated_at', prompts: 'updated_at', rag_service_state: 'updated_at' }
function fail(error: { code?: string } | null) {
  if (!error) return
  if (['42501', 'PGRST301'].includes(error.code ?? '')) throw new Error('目前帳號沒有這項操作的權限，請重新登入或聯絡管理者。')
  if (['42P01', 'PGRST205'].includes(error.code ?? '')) throw new Error('測試資料表尚未建立，請先完成 Supabase migration。')
  throw new Error('資料操作失敗。請檢查連線與測試環境後重試；你的輸入仍保留在畫面。')
}
export function createRagRepository(): RagRepository {
  if (!ragConfiguration(import.meta.env).enabled) throw new Error('RAG 測試環境尚未啟用。')
  return {
    pilot: createPilotRepository(),
    async listTraces(cursor, signal) {
      const { data, error } = await supabase.rpc('rag_list_traces', {
        p_before: cursor?.started_at ?? null, p_before_id: cursor?.id ?? null, p_limit: TRACE_PAGE_SIZE,
      }).abortSignal(signal)
      failTrace(error)
      return parseTraceList(data)
    },
    async getTrace(id, signal) {
      const { data, error } = await supabase.rpc('rag_get_trace', { p_trace_id: id }).abortSignal(signal)
      failTrace(error)
      const detail = parseTraceDetail(data)
      if (detail && detail.trace.id !== id) throw new Error('追蹤識別碼不符，請重新載入。')
      return detail
    },
    async list<K extends keyof EntityMap>(kind: K, filter?: { column: string; value: string }): Promise<EntityMap[K][]> {
      if (kind === 'usage_daily') {
        const { data, error } = await supabase.rpc('rag_usage_today')
        fail(error)
        return (data ?? []) as EntityMap[K][]
      }
      let query = supabase.from(kind).select(columns[kind]).order(order[kind] ?? 'created_at', { ascending: kind === 'chunks' }).limit(200)
      if (filter) query = query.eq(filter.column, filter.value)
      // Imported evaluation parents are displayed by the trace reader, not as empty conversations.
      if (kind === 'rag_runs') query = query.is('diagnostic_expires_at', null)
      const { data, error } = await query
      fail(error)
      return (data ?? []) as unknown as EntityMap[K][]
    },
    async saveDraft(kind, input, previous) {
      const query = previous
        ? supabase.from(kind).update(input).eq('id', previous.id).eq('updated_at', previous.updated_at)
        : supabase.from(kind).insert(input as Record<string, unknown>)
      const { data, error } = await query.select('id').single()
      if (error?.code === 'PGRST116') throw new Error('內容已變更或權限已更新。請保留輸入並重新載入資料後再試。')
      fail(error)
      if (!data) throw new Error('未儲存任何資料。請重新載入後再試。')
    },
    async saveSettings(input, updatedAt) {
      const message = validateSettings(input)
      if (message) throw new Error(message)
      const { data, error } = await supabase.from('rag_service_state').update(input).eq('id', true).eq('updated_at', updatedAt).select('id').single()
      if (error?.code === 'PGRST116') throw new Error('設定已被更新。請重新載入後再試。')
      fail(error)
      if (!data) throw new Error('設定未儲存。請確認 migration 與權限。')
    },
  }
}

function failTrace(error: { code?: string } | null) {
  if (!error) return
  if (['42501', 'PGRST301'].includes(error.code ?? '')) throw new Error('無法讀取追蹤：請確認登入狀態與管理者權限。')
  if (['42883', 'PGRST202', '42P01', 'PGRST205'].includes(error.code ?? '')) throw new Error('追蹤服務尚未就緒，請確認 Supabase migration 已套用。')
  throw new Error('無法讀取追蹤，請檢查連線後重試。')
}
