export interface DocumentRecord { id: string; title: string; source_type: string; purpose: string; domain: string; created_at: string }
export interface DocumentVersion { id: string; document_id: string; version: number; processing_status: string; content_status: string; failure_reason: string | null; created_at: string }
export interface Chunk { id: string; document_version_id: string; ordinal: number; page_start: number | null; page_end: number | null; section_path: string; original_text: string }
export interface ChunkSet { id: string; document_version_id: string; content_hash: string; chunker_version: string; sealed: boolean; created_at: string }
export interface QaEntry { id: string; question: string; answer: string; source_note: string; enabled: boolean; updated_at: string }
export interface Persona { id: string; name: string; instruction: string; example: string; enabled: boolean; updated_at: string }
export interface Prompt { id: string; name: string; content: string; updated_at: string }
export interface Release { id: string; name: string; status: string; manifest: Record<string, unknown>; created_at: string }
export interface Evaluation { id: string; release_id: string | null; status: string; report: Record<string, unknown>; created_at: string }
export interface RagRun { id: string; question: string; answer: string | null; release_id: string | null; status: string; duration_ms: number | null; created_at: string }
export interface Profile { id: string; model: string; dimensions: number; distance_metric: string; chunker_version: string }
export interface Settings { id: boolean; service_enabled: boolean; active_release_id: string | null; answer_style: 'concise' | 'standard' | 'detailed'; daily_question_limit: number; retrieval_candidates: number; context_chunks: number; similarity_threshold: number; qa_threshold: number; fallback_reply: string; rewrite_enabled: boolean; tools_enabled: boolean; updated_at: string }
export interface Usage { day: string; question_count: number }
export interface EntityMap {
  documents: DocumentRecord; document_versions: DocumentVersion; chunks: Chunk; chunk_sets: ChunkSet;
  qa_entries: QaEntry; personas: Persona; prompts: Prompt; knowledge_releases: Release;
  evaluation_runs: Evaluation; rag_runs: RagRun; embedding_profiles: Profile; rag_service_state: Settings; usage_daily: Usage;
}
export type DraftKind = 'qa_entries' | 'personas' | 'prompts'
export type DraftInput = { question: string; answer: string; source_note: string; enabled: boolean } |
  { name: string; instruction: string; example: string; enabled: boolean } | { name: string; content: string }
export type SettingsInput = Pick<Settings, 'answer_style' | 'daily_question_limit' | 'retrieval_candidates' | 'context_chunks' | 'similarity_threshold' | 'qa_threshold' | 'fallback_reply'>
export interface RagRepository {
  pilot?: import('./pilot').PilotRepository
  listTraces(cursor: import('./traces').TraceCursor | null, signal: AbortSignal): Promise<import('./traces').Trace[]>
  getTrace(id: string, signal: AbortSignal): Promise<import('./traces').TraceDetail | null>
  list<K extends keyof EntityMap>(kind: K, filter?: { column: string; value: string }): Promise<EntityMap[K][]>
  saveDraft(kind: DraftKind, input: DraftInput, previous?: { id: string; updated_at: string }): Promise<void>
  saveSettings(input: SettingsInput, updatedAt: string): Promise<void>
}

export function validateSettings(value: SettingsInput): string | null {
  if (!['concise', 'standard', 'detailed'].includes(value.answer_style)) return '請選擇回答風格。'
  if (!Number.isInteger(value.daily_question_limit) || value.daily_question_limit < 1 || value.daily_question_limit > 1000) return '每日題數須為 1–1000 的整數。'
  if (!Number.isInteger(value.retrieval_candidates) || value.retrieval_candidates < 1 || value.retrieval_candidates > 100) return '候選數須為 1–100 的整數。'
  if (!Number.isInteger(value.context_chunks) || value.context_chunks < 1 || value.context_chunks > value.retrieval_candidates) return '引用段落數須為正整數，且不可超過候選數。'
  if (![value.similarity_threshold, value.qa_threshold].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return '門檻須介於 0 與 1。'
  if (!value.fallback_reply.trim() || value.fallback_reply.length > 2000) return '請填寫 1–2000 字的資料不足回覆。'
  return null
}
