import { useCallback, useEffect, useRef, useState } from 'react'
import type { RagRepository } from './repository'
import { duration, nodeLabels, outcomeLabels, reasonLabels, statusLabels, TRACE_PAGE_SIZE, usd, type Trace, type TraceCursor, type TraceDetail } from './traces'
import { dateLabel } from './ui'
import './traces.css'
import { DetailDialog } from './DetailDialog'

// Drop both aborted and late results, including a repository change during a request.
function useTraceRead<T>(repo: RagRepository, read: (repo: RagRepository, signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ repo: RagRepository; read: typeof read; revision: number; data?: T; error?: string }>()
  useEffect(() => {
    const controller = new AbortController()
    read(repo, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ repo, read, revision, data })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ repo, read, revision, error: '無法讀取追蹤。請檢查連線、登入權限與追蹤服務版本後重試。' })
    })
    return () => controller.abort()
  }, [repo, read, revision])
  const current = state?.repo === repo && state.read === read && state.revision === revision ? state : undefined
  return { data: current?.data, error: current?.error, loading: !current, reload: () => setRevision(value => value + 1) }
}
function ReadStatus({ loading, error, reload }: { loading: boolean; error?: string; reload: () => void }) {
  if (loading) return <p role="status" className="rag-notice">正在讀取追蹤…</p>
  if (error) return <div role="alert" className="rag-error"><p>{error}</p><button onClick={reload}>重試讀取追蹤</button></div>
  return null
}
export function TraceHistory({ repo }: { repo: RagRepository | null }) {
  return <section aria-label="歷史評測追蹤">
    <h2>歷史評測追蹤</h2>
    <p className="rag-muted">本機評測匯入紀錄，保留 30 天。題目以識別碼呈現；本頁不保存問題與回答正文，也不會呼叫模型。</p>
    {repo ? <ConnectedHistory repo={repo} /> : <p className="rag-notice">連接 RAG 測試環境後可讀取追蹤。</p>}
  </section>
}
function ConnectedHistory({ repo }: { repo: RagRepository }) {
  const [selected, setSelected] = useState<string | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  function open(trace: Trace, button: HTMLButtonElement) { opener.current = button; setSelected(trace.id) }
  function close() { setSelected(null) }
  useEffect(() => { if (!selected) opener.current?.focus() }, [selected])
  return <>
    <TraceList repo={repo} open={open} />
    {selected && <DetailDialog title="歷史評測流程詳情" onClose={close}><TraceView key={selected} repo={repo} id={selected} close={close} /></DetailDialog>}
  </>
}
function TraceList({ repo, open }: { repo: RagRepository; open: (trace: Trace, button: HTMLButtonElement) => void }) {
  const [cursors, setCursors] = useState<(TraceCursor | null)[]>([null])
  const cursor = cursors[cursors.length - 1]
  const read = useCallback((repo: RagRepository, signal: AbortSignal) => repo.listTraces(cursor, signal), [cursor])
  const result = useTraceRead(repo, read)
  const rows = result.data ?? []
  return <>
    <div className="rag-row"><p>第 {cursors.length} 頁 · 本頁 {result.loading || result.error ? '—' : rows.length} 筆</p>
      <button disabled={result.loading} onClick={() => { setCursors([null]); result.reload() }}>重新整理追蹤</button></div>
    <ReadStatus {...result} />
    {!result.loading && !result.error && (rows.length ? <div className="rag-table"><table>
      <caption className="sr-only">歷史評測追蹤，依執行時間由新到舊</caption>
      <thead><tr><th>測試題 / 提示詞版本</th><th>執行時間</th><th>結果</th><th>記錄耗時</th><th>流程</th></tr></thead>
      <tbody>{rows.map(trace => <tr key={trace.id}>
        <td data-label="測試題 / 提示詞版本"><strong className="rag-code">{trace.question_key}</strong><small>{trace.prompt_version} · 第 {trace.attempt} 次嘗試</small></td>
        <td data-label="執行時間">{dateLabel(trace.started_at)}</td>
        <td data-label="結果"><span className={`rag-trace-status is-${trace.outcome}`}>{outcomeLabels[trace.outcome]}</span></td>
        <td data-label="記錄耗時">{duration(trace.duration_ms)}<small>生成{trace.measurement_scope === 'generation_and_fixture_validation_only' ? '與本機檢查' : '階段'}</small></td>
        <td><button aria-label={`查看流程 ${trace.question_key} ${trace.prompt_version}`} onClick={event => open(trace, event.currentTarget)}>查看流程 →</button></td>
      </tr>)}</tbody>
    </table></div> : <p className="rag-empty">本頁沒有可讀取的追蹤。可能尚未匯入、已過保留期限，或帳號權限已變更。</p>)}
    <div className="rag-actions" aria-label="追蹤分頁">
      <button disabled={result.loading || cursors.length === 1} onClick={() => setCursors(value => value.slice(0, -1))}>上一頁追蹤</button>
      <button disabled={result.loading || !!result.error || rows.length < TRACE_PAGE_SIZE} onClick={() => {
        const last = rows[rows.length - 1]
        if (last) setCursors(value => [...value, { started_at: last.started_at, id: last.id }])
      }}>下一頁追蹤</button>
    </div>
  </>
}
function TraceView({ repo, id, close }: { repo: RagRepository; id: string; close: () => void }) {
  const read = useCallback((repo: RagRepository, signal: AbortSignal) => repo.getTrace(id, signal), [id])
  const result = useTraceRead(repo, read)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return <div className="rag-trace-detail">
    <button onClick={close}>← 返回追蹤列表</button>
    <h2 tabIndex={-1} ref={heading} className="rag-trace-title">流程詳情</h2>
    <ReadStatus {...result} />
    {!result.loading && !result.error && (result.data ? <TraceInspector key={result.data.trace.id} detail={result.data} /> :
      <p className="rag-notice" role="status">這筆追蹤已過期、已清除或目前無權讀取。請返回列表重新整理。</p>)}
  </div>
}
function TraceInspector({ detail }: { detail: TraceDetail }) {
  const { trace, spans, charges, cost } = detail
  const [selected, setSelected] = useState(() => spans.find(span => ['failed', 'interrupted'].includes(span.status))?.id ?? spans.find(span => span.node_type === 'model_generation')?.id ?? spans[0].id)
  const span = spans.find(span => span.id === selected) ?? spans[0]
  const charge = charges.find(charge => charge.span_id === span.id)
  const unexecuted = ['reused', 'skipped'].includes(span.status)
  return <>
    <div className="rag-trace-context"><div><span className="rag-muted">測試題識別碼</span><h3 className="rag-code">{trace.question_key}</h3></div>
      <span className={`rag-trace-status is-${trace.outcome}`}>{outcomeLabels[trace.outcome]}</span>
      <p>{dateLabel(trace.started_at)} · {trace.prompt_version} · 第 {trace.attempt} 次嘗試</p>
    </div>
    <p className="rag-notice">記錄耗時 <strong>{duration(trace.duration_ms)}</strong>，僅涵蓋生成{trace.measurement_scope === 'generation_and_fixture_validation_only' ? '與本機檢查' : '階段'}，不包含先前的向量與檢索作業。
      {trace.scope_source === 'legacy_v2_contract' && <><br />這筆舊版紀錄的計時範圍由 v2 格式推定。</>}
      <br />「已回答」表示流程完成，回答品質仍需人工審核。</p>
    <div className="rag-row"><h3>處理流程</h3><span className="rag-muted">{spans.length} 個節點 · 點選查看明細</span></div>
    <p className="rag-muted">連線表示記錄順序。重用與略過的步驟不計入本次執行耗時。</p>
    <ol className="rag-trace-flow" aria-label="處理流程節點">{spans.map(item => <li key={item.id}>
      <button className={`rag-trace-node is-${item.status}`} aria-pressed={item.id === span.id} aria-controls="rag-trace-inspector" onClick={() => setSelected(item.id)}>
        <span className="rag-node-order">{String(item.ordinal).padStart(2, '0')}<span>{statusLabels[item.status]}</span></span>
        <strong>{nodeLabels[item.node_type]}</strong>
        <small>{['reused', 'skipped'].includes(item.status) ? '本次未執行' : duration(item.duration_ms)}</small>
      </button>
    </li>)}</ol>
    <section id="rag-trace-inspector" className="rag-panel rag-trace-inspector" aria-label="節點明細" aria-live="polite">
      <div className="rag-row"><h3>{span.ordinal}. {nodeLabels[span.node_type]}</h3><span className={`rag-trace-status is-${span.status}`}>{statusLabels[span.status]}</span></div>
      <p>{span.reason_code ? reasonLabels[span.reason_code] ?? `服務記錄原因：${span.reason_code}` : '未記錄額外原因。'}</p>
      <dl className="rag-trace-facts"><dt>開始時間</dt><dd>{span.started_at ? dateLabel(span.started_at) : unexecuted ? '本次未執行' : '未記錄'}</dd>
        <dt>耗時</dt><dd>{unexecuted ? '本次未執行' : duration(span.duration_ms)}</dd>
        <dt>本次模型請求</dt><dd>{unexecuted ? '無新增請求，不重複計費' : charge ? '1 筆，見下方用量' : '無請求紀錄'}</dd>
        {span.parent_span_id && <><dt>父節點</dt><dd>{nodeLabels[spans.find(item => item.id === span.parent_span_id)!.node_type]}</dd></>}
      </dl>
      {charge && <><h3>Google · {charge.model}</h3><dl className="rag-trace-facts">
        <dt>請求狀態</dt><dd>{{ reserved: '已預留', received: '已收到回應', failed: '請求失敗', unknown: '未知' }[charge.request_state]}</dd>
        <dt>輸入 / 輸出 token</dt><dd>{charge.input_tokens?.toLocaleString('zh-TW') ?? '未知'} / {charge.output_tokens?.toLocaleString('zh-TW') ?? '未知'}</dd>
        <dt>供應商總 token</dt><dd>{charge.total_tokens?.toLocaleString('zh-TW') ?? '未知'}</dd>
        <dt>請求前預留額</dt><dd>{usd(charge.reserved_usd)}</dd><dt>依用量估算</dt><dd>{usd(charge.estimated_usd)}</dd>
        <dt>帳單金額</dt><dd>{usd(charge.billed_usd)}</dd><dt>價格版本</dt><dd>{charge.price_version ?? '未記錄'}</dd>
        <dt>帳單依據</dt><dd>{charge.billing_reference ?? '尚未取得'}</dd>
      </dl><p className="rag-muted">預留額依請求前的位元組估算，用於費用上限控管，不是 Google 帳單。</p></>}
      <details><summary>核對節點來源</summary><dl className="rag-trace-facts"><dt>節點 ID</dt><dd className="rag-code">{span.id}</dd>
        <dt>原因代碼</dt><dd className="rag-code">{span.reason_code ?? '未記錄'}</dd>
        <dt>重用來源 SHA-256</dt><dd className="rag-code">{span.reference_sha256 ?? '不適用'}</dd>
        {charge && <><dt>請求識別碼</dt><dd className="rag-code">{charge.client_request_key}</dd></>}
      </dl></details>
    </section>
    <h3>本次費用 · USD</h3>
    <div className="rag-summary rag-trace-cost" aria-label="本次費用明細">
      <section><small>請求前預留額</small><strong>{usd(cost.reserved_usd)}</strong><p>費用上限控管用</p></section>
      <section><small>依用量估算</small><strong>{usd(cost.estimated_usd)}</strong><p>須有用量與對應價格版本</p></section>
      <section><small>帳單金額</small><strong>{usd(cost.billed_usd)}</strong><p>以供應商實際帳單為準</p></section>
    </div>
    <p className="rag-muted">{cost.charge_count} 筆模型請求紀錄 · {cost.unknown_usage_count} 筆用量未知。僅統計本次記錄的請求；歷史向量與檢索成本未納入。未知不代表免費。</p>
    <details><summary>追蹤版本與保留期限</summary><dl className="rag-trace-facts">
      <dt>追蹤 ID</dt><dd className="rag-code">{trace.id}</dd><dt>請求 ID</dt><dd className="rag-code">{trace.request_id}</dd>
      <dt>來源</dt><dd>本機評測匯入</dd><dt>匯入時間</dt><dd>{dateLabel(trace.imported_at)}</dd><dt>到期時間</dt><dd>{dateLabel(trace.expires_at)}</dd>
      <dt>提示詞 SHA-256</dt><dd className="rag-code">{trace.prompt_sha256}</dd><dt>來源檔案 SHA-256</dt><dd className="rag-code">{trace.artifact_sha256}</dd>
    </dl></details>
  </>
}
