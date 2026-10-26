export interface PilotStatus { enabled:boolean; expires_at:string; max_requests:number; used_requests:number; budget_usd:number; reserved_usd:number }
export interface PilotRun { id:string; state:'running'|'answered'|'refused'|'failed'; reason:string|null; reserved_usd:number; created_at:string; finished_at:string|null; receipt_id:string; prompt_version:string }
export interface PilotStep { ordinal:number; node:string; state:'pending'|'running'|'succeeded'|'failed'|'skipped'; started_at:string|null; duration_ms:number|null; reason:string|null; model:string|null; reserved_usd:number|null; estimated_usd:number|null; input_tokens:number|null; output_tokens:number|null; total_tokens:number|null; reference_ids:string[] }
export interface PilotDetail { run:PilotRun; steps:PilotStep[]; billed_usd:null; price_version:string }
export interface PilotAnswer { answer:string; abstain:boolean; citations:{chunk_id:string;quote:string}[] }
export interface PilotEvidence { id:string;title:string;page_start:number;page_end:number;text:string;score:number }
export interface PilotResult { request_id:string; replayed?:boolean; state?:string; answer?:PilotAnswer; evidence?:PilotEvidence[] }
export interface PilotRepository {
  status(signal:AbortSignal):Promise<PilotStatus|null>
  history(signal:AbortSignal):Promise<PilotRun[]>
  detail(id:string,signal:AbortSignal):Promise<PilotDetail|null>
  ask(id:string,question:string,signal:AbortSignal):Promise<PilotResult>
}
export const pilotNodes:Record<string,string>={authorization:'管理員驗證',budget_reservation:'費用預留',service_policy:'服務範圍',query_embedding:'問題向量',hybrid_retrieval:'混合檢索',model_generation:'Gemini 回答',validate_answer:'引用檢查'}
export const pilotStates:Record<string,string>={pending:'尚未執行',running:'進行中',succeeded:'完成',failed:'失敗',skipped:'未執行',answered:'已回答',refused:'未回答'}
export const pilotErrors:Record<string,string>={
  pilot_disabled:'試問時段尚未啟用或已到期。',pilot_budget_exhausted:'本輪試問額度已用完。',request_conflict:'請求識別碼與內容不符。',owner_required:'只有 owner 可以試問。',unauthorized:'登入已失效，請重新登入。',
  pilot_not_configured:'模型服務尚未設定完成。',invalid_question:'請填寫 1–1600 UTF-8 bytes 的問題。',provider_access_denied:'Google 拒絕這次存取，請檢查模型專案設定。',provider_rate_limited:'Google 暫時限制請求次數，本次沒有自動重試。',
  invalid_citation:'回答的引用未通過檢查，已停止顯示答案。',invalid_answer:'模型回答格式未通過檢查。',incomplete_provider_response:'模型回傳不完整，未顯示答案。',corpus_unavailable:'固定的測試語料目前不可用。',
  provider_connection_unknown:'模型連線中斷，是否計費仍未知；本次不會自動重試。',journal_unavailable:'流程紀錄暫時無法寫入，已停止後續呼叫。',bill_not_supported:'目前不提供完整帳單計算。',insufficient_evidence:'提供的片段不足以回答。',validated:'回答格式與引用檢查通過，仍需人工確認語意。'
}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const number=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0
const id=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v)
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
function bad():never { throw new Error('試問服務回傳格式不符，請重新整理。') }
export function parsePilotStatus(v:unknown):PilotStatus|null {
  if(v===null)return null
  if(!obj(v)||typeof v.enabled!=='boolean'||!date(v.expires_at)||!['max_requests','used_requests','budget_usd','reserved_usd'].every(k=>number(v[k])))return bad()
  return v as unknown as PilotStatus
}
export function parsePilotRun(v:unknown):PilotRun {
  if(!obj(v)||!id(v.id)||!['running','answered','refused','failed'].includes(String(v.state))||!date(v.created_at)||!number(v.reserved_usd)||!id(v.receipt_id)||typeof v.prompt_version!=='string'||(v.reason!==null&&typeof v.reason!=='string')||(v.finished_at!==null&&!date(v.finished_at)))return bad()
  return v as unknown as PilotRun
}
export function parsePilotHistory(v:unknown):PilotRun[] { if(!Array.isArray(v)||v.length>20)return bad();return v.map(parsePilotRun) }
export function parsePilotDetail(v:unknown):PilotDetail|null {
  if(v===null)return null
  if(!obj(v)||!Array.isArray(v.steps)||v.steps.length!==7||v.billed_usd!==null||typeof v.price_version!=='string')return bad()
  const run=parsePilotRun(v.run)
  v.steps.forEach((s,i)=>{
    if(!obj(s)||s.ordinal!==i+1||s.node!==Object.keys(pilotNodes)[i]||!['pending','running','succeeded','failed','skipped'].includes(String(s.state))
      ||!['duration_ms','reserved_usd','estimated_usd','input_tokens','output_tokens','total_tokens'].every(k=>s[k]===null||number(s[k]))
      ||(s.started_at!==null&&!date(s.started_at))||(s.reason!==null&&typeof s.reason!=='string')||(s.model!==null&&typeof s.model!=='string')
      ||!Array.isArray(s.reference_ids)||s.reference_ids.length>5||!s.reference_ids.every(id))return bad()
  })
  return {...v,run} as unknown as PilotDetail
}
export function parsePilotResult(v:unknown,requestId:string):PilotResult {
  if(!obj(v)||v.request_id!==requestId)return bad()
  if(v.replayed===true)return {request_id:requestId,replayed:true,state:String(v.state)}
  if(!obj(v.answer)||typeof v.answer.answer!=='string'||v.answer.answer.length>2400||typeof v.answer.abstain!=='boolean'||!Array.isArray(v.answer.citations)||v.answer.citations.length>5||!Array.isArray(v.evidence)||v.evidence.length>5)return bad()
  for(const c of v.answer.citations)if(!obj(c)||!id(c.chunk_id)||typeof c.quote!=='string'||c.quote.length>800)return bad()
  for(const e of v.evidence)if(!obj(e)||!id(e.id)||typeof e.title!=='string'||typeof e.text!=='string'||!number(e.score)||!Number.isInteger(e.page_start)||!Number.isInteger(e.page_end))return bad()
  return v as unknown as PilotResult
}
