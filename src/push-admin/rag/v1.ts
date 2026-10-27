export interface Original {
  id: string; document_version_id: string; sha256: string; byte_size: number; source_name: string;
  upload_state: 'pending' | 'verified' | 'failed'; created_at: string;
}
export interface IngestionJob {
  id: string; original_id: string; stage: 'parse' | 'embed'; status: string; attempt: number;
  output_set_id: string | null; failure_reason: string | null; quality: Record<string, unknown>; updated_at: string;
}
export interface Campaign {
  id: string; name: string; budget_usd: number; reserved_usd: number; call_limit: number; call_count: number;
  state: 'active' | 'stopped'; expires_at: string;
}
export interface Snapshot { id: string; name: string; manifest_hash: string; created_at: string }
export interface SnapshotSelection { chunk_set_ids: string[]; qa_ids: string[]; persona_ids: string[]; calculation_ids: string[]; prompt_id: string; rewrite_enabled: boolean; tools_enabled: boolean }
export interface CandidateSet { chunk_set_id: string; original_id: string; profile_id: string; chunk_count: number; embedding_state: string; quality: Record<string, unknown> }
export interface CalculationDraft { id: string; kind: 'coefficient' | 'electricity'; definition: Record<string, unknown>; updated_at: string }
export interface Review { id: string; release_id: string; verdict: 'approve' | 'reject'; reason: string; sequence: number; created_at: string }
export interface Publication { id: string; release_id: string | null; previous_id: string | null; action: string; reason: string; sequence: number; created_at: string }
export interface EvaluationReceipt { id: string; release_id: string; manifest_hash: string; data_split: string; case_count: number; passed_count: number; recall_at_5: number; citation_validity: number; numerical_failures: number; unpublished_leaks: number; created_at: string }
export interface VersionData { snapshots: Snapshot[]; sets: CandidateSet[]; originals: Pick<Original, 'id' | 'source_name'>[]; calculations: CalculationDraft[]; reviews: Review[]; publications: Publication[]; evaluations: EvaluationReceipt[] }
export interface VersionRepository {
  versions(signal: AbortSignal): Promise<VersionData>
  snapshotDetail(id: string, signal: AbortSignal): Promise<Record<string, unknown>>
  createSnapshot(name: string, selection: SnapshotSelection, requestKey: string): Promise<string>
  reviewSnapshot(id: string, hash: string, verdict: 'approve' | 'reject', reason: string, requestKey: string): Promise<void>
  activateSnapshot(id: string | null, expectedId: string | null, operation: 'publish' | 'rollback' | 'disable', reason: string, requestKey: string): Promise<void>
}
export interface RagV1Repository {
  urls?: {
    list(signal: AbortSignal): Promise<UrlSnapshot[]>
    register(url: string, requestKey: string): Promise<string>
  }
  evaluation?: EvaluationRepository
  operations?: {
    summary(campaignId: string): Promise<OperationSummary>
    recordBill(campaignId: string, bill: import('./billing').BillInput, evidenceSha256: string): Promise<void>
  }
  versions?: VersionRepository
  trials?: TrialRepository
  editorial?: EditorialRepository
  ingestion(signal: AbortSignal): Promise<{ originals: Original[]; jobs: IngestionJob[] }>
  upload(file: File, progress: (message: string) => void): Promise<void>
  download(originalId: string): Promise<string>
  campaigns(signal: AbortSignal): Promise<Campaign[]>
  stopCampaign(id: string): Promise<void>
}
export interface UrlSnapshot { id: string; source_url: string; state: string; attempt: number; original_id: string | null; failure_reason: string | null; created_at: string; metadata: Record<string, unknown> }
export interface CostGroup { origin: string; model: string; purpose: string; calls: number; reserved_usd: number; known_estimated_usd: number | null; unknown_cost_calls: number; failed_or_uncertain: number; pending_calls: number }
export interface OperationSummary { groups: CostGroup[]; bills: { id: string; provider_reference: string; amount_usd: number; period_start: string; period_end: string }[]; health: Record<string, unknown>; pricing_version: string }
export interface SourceCitation { chunk_id: string; quote: string }
export interface EditorialRepository {
  calculations(offset: number, signal: AbortSignal): Promise<CalculationDraft[]>
  coefficients(offset: number, search: string): Promise<CoefficientRow[]>
  classify(documentId: string, purpose: string, domain: string, scope: string): Promise<void>
  correct(parentId: string, hash: string, edits: { ordinal: number; text: string; exclude: boolean }[], reason: string): Promise<string>
  qaCitations(id: string, signal: AbortSignal): Promise<SourceCitation[]>
  saveQaCitations(qaId: string, updatedAt: string, citations: SourceCitation[]): Promise<void>
  saveCalculation(id: string | null, updatedAt: string | null, kind: 'coefficient' | 'electricity', definition: Record<string, unknown>): Promise<string>
}
export interface CoefficientRow { id: string; original_id: string; ordinal: number; name: string | null; value: number | null; unit: string | null; raw: Record<string, unknown>; raw_sha256: string; issues: unknown[] }
export interface TrialRound { id: string; name: string; release_id: string; campaign_id: string; budget_usd: number; reserved_usd: number;
  request_limit: number; request_count: number; per_user_daily_limit: number; state: string; expires_at: string }
export interface TrialRequest { id: string; round_id: string; state: string; reason: string | null; created_at: string }
export interface InteractionRecord extends TrialRequest { origin: 'query' | 'evaluation'; question: string | null; answer: string | null; details_expired: boolean }
export interface TrialEvent { node: string; state: string; duration_ms: number; [key: string]: unknown }
export interface TrialCall { id: string; model: string; purpose: string; status: string; reserved_usd: number; usage: Record<string, number>; duration_ms: number | null }
export interface TrialResult { id: string; state: string; reason?: string; input?: { question: string } | null; output?: Record<string, unknown> | null; trace?: TrialEvent[]; calls?: TrialCall[]; replayed?: boolean; details_expired?: boolean }
export interface TrialRepository {
  history?(signal: AbortSignal, offset: number, origin: 'query' | 'evaluation' | 'all'): Promise<InteractionRecord[]>
  abandon?(id: string): Promise<TrialResult>
  list(signal: AbortSignal, offset: number): Promise<{ rounds: TrialRound[]; requests: TrialRequest[] }>
  create(input: { requestKey: string; name: string; releaseId: string; campaignId: string; budgetUsd: number; requestLimit: number; dailyLimit: number; expiresAt: string }): Promise<string>
  stop(id: string): Promise<void>
  ask(roundId: string, requestKey: string, input: { question: string; persona_id: string | null; tool_requests: unknown[] }): Promise<TrialResult>
  detail(id: string, signal: AbortSignal): Promise<TrialResult>
}
export interface EvaluationDataset { id: string; name: string; data_split: string; case_count: number; dataset_hash: string }
export interface EvaluationBatch { id: string; dataset_id: string; round_id: string; created_at: string }
export interface EvaluationRepository {
  list(signal: AbortSignal): Promise<{ datasets: EvaluationDataset[]; batches: EvaluationBatch[]; receipts: { batch_id: string; evaluation_id: string }[] }>
  register(dataset: Record<string, unknown>): Promise<string>
  begin(datasetId: string, roundId: string, requestKey: string): Promise<string>
  next(batchId: string): Promise<{ complete: boolean; case_id?: string; request_id?: string; state?: string; reason?: string }>
  finish(batchId: string): Promise<string>
  report(id: string, signal: AbortSignal): Promise<Record<string, unknown>>
}
export function validateFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (!/\.(pdf|docx|txt|json)$/i.test(file.name)) return '請選擇 PDF、DOCX、TXT 或 JSON。'
  if (file.size <= 0 || file.size > 20 * 1024 * 1024) return '單一檔案須大於 0 且不超過 20 MiB。'
  if (file.name.length > 500 || /[\x00-\x1f\x7f/\\]/.test(file.name)) return '檔名格式不符，請先重新命名。'
  return null
}
