import { useContext, useEffect, useRef, useState } from 'react'
import { DetailDialog, DetailVisibility } from './DetailDialog'
import { TrialFlow } from './TrialFlow'
import { dateLabel } from './ui'
import type { InteractionRecord, TrialRepository, TrialResult } from './v1'

const statusLabels: Record<string, string> = { answered: '已回答', abstained: '資料不足或驗證未通過', failed: '未完成', uncertain: '結果待確認', running: '處理中', reserved: '已受理' }
const pageSize = 20

export function TrialDetailDialog({ api, id, close }: { api: TrialRepository; id: string; close: () => void }) {
  const active = useContext(DetailVisibility)
  const [result, setResult] = useState<TrialResult | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setResult(null); setError('')
    api.detail(id, controller.signal).then(value => {
      if (controller.signal.aborted) return
      if (value.id !== id) throw new Error('問答紀錄識別碼不符。')
      setResult(value)
    }).catch(() => { if (!controller.signal.aborted) setError('無法讀取這筆問答，請確認連線與權限後重試。') })
    return () => controller.abort()
  }, [api, id, active, revision])
  return <DetailDialog title="問答詳情" onClose={close}>
    {!result && !error && <p role="status">正在讀取問題、回答與流程…</p>}
    {error && <div className="rag-error" role="alert"><p>{error}</p><button onClick={() => setRevision(n => n + 1)}>重新讀取問答</button></div>}
    {result && <TrialFlow key={result.id} result={result} />}
  </DetailDialog>
}

export function InteractionHistory({ api, active = true }: { api: TrialRepository; active?: boolean }) {
  const [rows, setRows] = useState<InteractionRecord[]>([])
  const [origin, setOrigin] = useState<'query' | 'evaluation' | 'all'>('query')
  const [page, setPage] = useState(0), [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const start = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setLoading(true); setError(''); setRows([])
    const request = api.history ? api.history(controller.signal, page * pageSize, origin) : Promise.reject(new Error('問答紀錄服務尚未連線。'))
    request.then(data => { if (!controller.signal.aborted) setRows(data) })
      .catch(() => { if (!controller.signal.aborted) setError('無法讀取問答紀錄，請確認連線與權限後重試。') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [api, active, page, origin, revision])
  function changePage(next: number) { setPage(next); start.current?.scrollIntoView?.({ block: 'start' }) }
  return <section aria-label="版本問答紀錄">
    <div ref={start} className="rag-row"><div><h2>試問與評測問答</h2><p className="rag-muted">問題、回答與流程保留 30 天。查看紀錄不會重新詢問模型，也不會占用試問額度。</p></div><button disabled={loading} onClick={() => setRevision(n => n + 1)}>重新整理問答</button></div>
    <div className="rag-pagination"><label>紀錄來源<select value={origin} onChange={event => { setOrigin(event.target.value as typeof origin); setPage(0) }}><option value="query">人工試問</option><option value="evaluation">自動評測</option><option value="all">全部新版紀錄</option></select></label><div className="rag-actions"><span>第 {page + 1} 頁</span><button disabled={loading || page === 0} onClick={() => changePage(page - 1)}>上一頁問答</button><button disabled={loading || !!error || rows.length <= pageSize} onClick={() => changePage(page + 1)}>下一頁問答</button></div></div>
    {loading && <p role="status">正在讀取問答紀錄…</p>}
    {error && <p className="rag-error" role="alert">{error}</p>}
    {!loading && !error && (rows.length ? <div className="rag-interaction-list">{rows.slice(0, pageSize).map(row => <article key={row.id} className="rag-panel rag-interaction-card">
      <div className="rag-row"><small>{dateLabel(row.created_at)} · {row.origin === 'evaluation' ? '自動評測' : '人工試問'}</small><span className="rag-tag">{statusLabels[row.state] ?? row.state}</span></div>
      <h3 className="rag-text-preview">{row.question || (row.details_expired ? '問題內容已過保留期限或無法讀取' : '未取得問題正文')}</h3>
      <p className="rag-text-preview rag-preserve">{row.answer || (row.details_expired ? '正文已無法讀取；仍可查看保留的結果與費用。' : row.state === 'answered' ? '請開啟詳情查看回答或計算結果。' : row.state === 'running' || row.state === 'reserved' ? '這筆問題尚未完成。' : '沒有可顯示的回答；開啟詳情查看處理原因。')}</p>
      <button aria-label={`查看問答 ${row.id.slice(0, 8)}`} onClick={() => setSelected(row.id)}>查看完整問答與流程</button>
    </article>)}</div> : <p className="rag-empty">目前沒有這類問答紀錄。可切換紀錄來源或前往「試問」。</p>)}
    {selected && <TrialDetailDialog key={selected} api={api} id={selected} close={() => setSelected(null)} />}
  </section>
}
