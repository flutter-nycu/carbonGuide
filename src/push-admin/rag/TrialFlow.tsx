import { useState } from 'react'
import type { TrialCall, TrialResult } from './v1'
import { duration, usd } from './traces'

export const states: Record<string, string> = { reserved: '已受理', running: '處理中', answered: '已回答', abstained: '資料不足或驗證未通過', failed: '未完成', uncertain: '結果待確認', stopped: '已停止', active: '開放中', succeeded: '完成', skipped: '略過', received: '已收到回應', started: '已開始', http_error: '模型服務拒絕' }
const nodes: Record<string, string> = { snapshot_and_access: '版本與權限', scope_guard: '服務範圍', verified_qa: '通用 QA', query_embedding: '問句向量化', hybrid_retrieval: '混合檢索', rewrite: '問句改寫', rewritten_embedding: '改寫後向量化', rewritten_retrieval: '再次檢索', context_selection: '引用內容選擇', answer: '模型回答', citation_and_number_validation: '引用與數值驗證', deterministic_tools: '確定性計算' }
function estimate(call: TrialCall): number | null {
  if (call.status !== 'received') return null
  const u = call.usage
  if (call.model === 'gemini-embedding-001') return Number.isFinite(u.totalTokenCount) ? u.totalTokenCount * 0.15 / 1e6 : null
  if (!Number.isFinite(u.promptTokenCount) || !Number.isFinite(u.candidatesTokenCount)) return null
  return (u.promptTokenCount * 0.25 + (u.candidatesTokenCount + (u.thoughtsTokenCount ?? 0)) * 1.5) / 1e6
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export function TrialFlow({ result }: { result: TrialResult }) {
  const [selected, setSelected] = useState(0)
  const events = result.details_expired ? [] : result.trace ?? [], event = events[selected], calls = result.calls
  const values = calls?.map(estimate), estimated = values?.every(v => v !== null) ? values.reduce<number>((a, n) => a + (n ?? 0), 0) : null
  const output = result.details_expired ? {} : result.output ?? {}, answer = record(output.answer), qa = record(output.qa)
  const evidence = Array.isArray(output.evidence) ? output.evidence.map(record) : []
  const citations = Array.isArray(answer.citations) ? answer.citations : Array.isArray(qa.citations) ? qa.citations : []
  return <section className="rag-panel" aria-label="版本試問結果">
    <div className="rag-row"><h2>{states[result.state] ?? result.state}</h2><small>{result.id}</small></div>
    <p className="rag-muted">這是歷史測試結果，內容仍待人工審閱；不代表目前可發布或來源仍啟用。</p>
    {result.details_expired && <p>問題與回答已超過保留期限；題數與費用帳仍保留。</p>}
    {!result.details_expired && <section className="rag-question-block" aria-label="原始問題"><h3>問題</h3><p className="rag-preserve">{result.input?.question || '這筆紀錄未提供問題正文。'}</p></section>}
    {!result.details_expired && <h3>回答</h3>}
    {typeof answer.answer === 'string' && <p className="rag-pilot-answer">{answer.answer}</p>}
    {typeof qa.answer === 'string' && <p className="rag-pilot-answer">{qa.answer}</p>}
    {!result.details_expired && typeof answer.answer !== 'string' && typeof qa.answer !== 'string' && !Array.isArray(output.calculations) && <p className="rag-muted">{['running', 'reserved'].includes(result.state) ? '尚在處理中，還沒有回答。' : '本次沒有可顯示的回答，請參考下方處理原因與流程。'}</p>}
    {citations.map((value, i) => { const c = record(value), source = evidence.find(item => item.id === c.chunk_id); return <details key={i}><summary>引用 {i + 1} · {String(source?.title ?? c.chunk_id ?? c.coefficient_id ?? '')}{source?.page_start != null ? ` · 第 ${String(source.page_start)}${source.page_end != null && source.page_end !== source.page_start ? `–${String(source.page_end)}` : ''} 頁` : ''}</summary><blockquote>{String(c.quote ?? '')}</blockquote><small>來源識別碼：{String(c.chunk_id ?? c.coefficient_id ?? '')}</small></details> })}
    {Array.isArray(output.calculations) && output.calculations.map((value, i) => <details open key={i}><summary>計算 {i + 1} · {String(record(value).name ?? '')}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>)}
    {result.reason && <small>處理原因：{result.reason}</small>}
    <p>模型預留 {usd(calls ? calls.reduce((sum, c) => sum + Number(c.reserved_usd), 0) : null)} · 用量估算 {usd(estimated)} · 帳單金額 未知</p>
    <p className="rag-muted">預留是控制上限，不是扣款。缺少用量或結果不明時顯示未知；此處不把文件前置處理成本重複計入每題。單價版本：2026-10-26，<a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer">Google 標準文字計價</a>。</p>
    {events.length ? <><ol className="rag-pilot-flow">{events.map((e, i) => <li key={`${i}-${e.node}`}><button aria-pressed={selected === i} className={`is-${e.state}`} onClick={() => setSelected(i)}><small>{i + 1} · {states[e.state] ?? e.state}</small><strong>{nodes[e.node] ?? e.node}</strong><span>{duration(e.duration_ms)}</span></button></li>)}</ol>
      {event && <div className="rag-pilot-node"><h3>{nodes[event.node] ?? event.node}</h3><pre>{JSON.stringify(event, null, 2)}</pre></div>}</> : <p>尚未取得完成的流程。處理中或中斷的模型呼叫可由下方持久費用帳確認。</p>}
    {!!calls?.length && <details><summary>模型呼叫與費用帳（{calls.length} 筆）</summary>{calls.map(c => <p key={c.id}>{nodes[c.purpose] ?? c.purpose} · {c.model} · {states[c.status] ?? c.status} · 預留 {usd(Number(c.reserved_usd))} · 估算 {usd(estimate(c))}</p>)}</details>}
  </section>
}

