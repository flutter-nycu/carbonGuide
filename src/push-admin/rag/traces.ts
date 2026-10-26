export const nodeLabels = {
  document_embedding: '文件向量', query_embedding: '問題向量', hybrid_retrieval: '混合檢索',
  service_policy: '服務規則', model_generation: '模型生成', decode_response: '回覆解析',
  validate_answer: '回答檢查', fixture_regression: '題庫檢查',
} as const
export const statusLabels = { succeeded: '完成', failed: '失敗', skipped: '略過', reused: '重用', interrupted: '中斷' } as const
export const outcomeLabels = { answered: '已回答', refused: '拒答', failed: '失敗', interrupted: '中斷' } as const
export const reasonLabels: Record<string, string> = {
  historical_result: '沿用先前保存的結果，本次未重新執行。', not_applicable: '此步驟不適用，未執行。',
  bill_calculation_not_supported: '目前不提供帳單試算，依服務規則拒答。',
  citation_reference_invalid: '引用指向無效的來源。', quote_not_in_evidence: '引文未能在來源中核對。',
  fixture_wording_check_failed: '未通過題庫的文字檢查，仍需人工判讀。',
}
export interface TraceCursor { started_at: string; id: string }
export interface Trace extends TraceCursor {
  run_id: string; request_id: string; attempt: number; origin: 'local_evaluation'; question_key: string;
  outcome: keyof typeof outcomeLabels; measurement_scope: 'generation_only' | 'generation_and_fixture_validation_only';
  scope_source: 'observed' | 'legacy_v2_contract'; prompt_version: string; prompt_sha256: string;
  artifact_sha256: string; payload_sha256: string; duration_ms: number | null; imported_at: string; expires_at: string;
}
export interface TraceSpan {
  id: string; trace_id: string; parent_span_id: string | null; ordinal: number; node_type: keyof typeof nodeLabels;
  status: keyof typeof statusLabels; started_at: string | null; duration_ms: number | null;
  reason_code: string | null; reference_sha256: string | null;
}
export interface TraceCharge {
  id: string; trace_id: string; span_id: string; client_request_key: string; provider: 'google'; model: string;
  request_state: 'reserved' | 'received' | 'failed' | 'unknown'; input_tokens: number | null;
  output_tokens: number | null; total_tokens: number | null; currency: 'USD'; reserved_usd: number | null;
  estimated_usd: number | null; billed_usd: number | null; reservation_basis: 'preflight_byte_reservation';
  price_version: string | null; billing_reference: string | null;
}
export interface TraceDetail {
  trace: Trace; spans: TraceSpan[]; charges: TraceCharge[];
  cost: { currency: 'USD'; charge_count: number; reserved_usd: number | null; estimated_usd: number | null; billed_usd: number | null; unknown_usage_count: number };
}
export const TRACE_PAGE_SIZE = 25
const invalid = () => { throw new Error('追蹤資料格式不符，請更新頁面或請管理者檢查服務版本。') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, max = 128): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max }
function uuid(value: unknown): boolean { return typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) }
function hash(value: unknown): boolean { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) }
function date(value: unknown): boolean { return text(value, 40) && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)) }
function number(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 }
function nullable(value: unknown, check: (value: unknown) => boolean): boolean { return value === null || check(value) }
function oneOf(value: unknown, choices: readonly string[]): boolean { return typeof value === 'string' && choices.includes(value) }
function array(value: unknown, max: number): unknown[] { if (!Array.isArray(value) || value.length > max) return invalid(); return value }
function integer(value: unknown): value is number { return number(value) && Number.isSafeInteger(value) }

export function parseTrace(value: unknown): Trace {
  const row = record(value)
  if (!['id', 'run_id', 'request_id'].every(key => uuid(row[key])) || !['prompt_sha256', 'artifact_sha256', 'payload_sha256'].every(key => hash(row[key])) ||
    !['started_at', 'imported_at', 'expires_at'].every(key => date(row[key])) || !integer(row.attempt) || row.attempt < 1 || row.attempt > 10 ||
    row.origin !== 'local_evaluation' || !text(row.question_key, 64) || !text(row.prompt_version) || !nullable(row.duration_ms, number) ||
    !oneOf(row.outcome, Object.keys(outcomeLabels)) || !oneOf(row.scope_source, ['observed', 'legacy_v2_contract']) ||
    !oneOf(row.measurement_scope, ['generation_only', 'generation_and_fixture_validation_only'])) return invalid()
  return row as unknown as Trace
}
export function parseTraceList(value: unknown): Trace[] {
  const rows = array(value, TRACE_PAGE_SIZE).map(parseTrace)
  if (new Set(rows.map(row => row.id)).size !== rows.length) return invalid()
  return rows
}
export function parseTraceDetail(value: unknown): TraceDetail | null {
  if (value === null) return null
  const row = record(value), trace = parseTrace(row.trace)
  const spans = array(row.spans, 64).map(value => {
    const span = record(value)
    if (!uuid(span.id) || span.trace_id !== trace.id || !nullable(span.parent_span_id, uuid) ||
      !integer(span.ordinal) || span.ordinal < 1 || span.ordinal > 64 || !oneOf(span.node_type, Object.keys(nodeLabels)) ||
      !oneOf(span.status, Object.keys(statusLabels)) || !nullable(span.started_at, date) || !nullable(span.duration_ms, number) ||
      !nullable(span.reason_code, text) || !nullable(span.reference_sha256, hash)) return invalid()
    if (['reused', 'skipped'].includes(String(span.status)) && (span.started_at !== null || span.duration_ms !== null)) return invalid()
    if (span.status === 'reused' && !hash(span.reference_sha256)) return invalid()
    return span as unknown as TraceSpan
  }).sort((a, b) => a.ordinal - b.ordinal)
  if (!spans.length || new Set(spans.map(span => span.id)).size !== spans.length || new Set(spans.map(span => span.ordinal)).size !== spans.length ||
    spans.some(span => span.parent_span_id !== null && !spans.some(parent => parent.id === span.parent_span_id && parent.ordinal < span.ordinal))) return invalid()
  const charges = array(row.charges, 1).map(value => {
    const charge = record(value)
    const span = spans.find(span => span.id === charge.span_id)
    if (!uuid(charge.id) || !uuid(charge.client_request_key) || charge.trace_id !== trace.id || !span || span.node_type !== 'model_generation' ||
      ['reused', 'skipped'].includes(span.status) || charge.provider !== 'google' || !text(charge.model) || charge.currency !== 'USD' ||
      !oneOf(charge.request_state, ['reserved', 'received', 'failed', 'unknown']) || charge.reservation_basis !== 'preflight_byte_reservation' ||
      !['input_tokens', 'output_tokens', 'total_tokens'].every(key => nullable(charge[key], integer)) ||
      !['reserved_usd', 'estimated_usd', 'billed_usd'].every(key => nullable(charge[key], number)) ||
      !nullable(charge.price_version, text) || !nullable(charge.billing_reference, text)) return invalid()
    return charge as unknown as TraceCharge
  })
  const cost = record(row.cost)
  if (cost.currency !== 'USD' || cost.charge_count !== charges.length || !integer(cost.unknown_usage_count) || cost.unknown_usage_count > charges.length ||
    !['reserved_usd', 'estimated_usd', 'billed_usd'].every(key => nullable(cost[key], number))) return invalid()
  // The current contract has at most one charge. A summary cannot invent zero or hide an unknown amount.
  if (['reserved_usd', 'estimated_usd', 'billed_usd'].some(key => cost[key] !== (charges[0]?.[key as keyof TraceCharge] ?? null))) return invalid()
  return { trace, spans, charges, cost: cost as unknown as TraceDetail['cost'] }
}
export function usd(value: number | null): string { return value === null ? '未知' : `US$ ${value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '.00')}` }
export function duration(value: number | null): string { return value === null ? '未記錄' : value < 1000 ? `${value.toLocaleString('zh-TW', { maximumFractionDigits: 3 })} ms` : `${(value / 1000).toLocaleString('zh-TW', { maximumFractionDigits: 3 })} 秒` }
