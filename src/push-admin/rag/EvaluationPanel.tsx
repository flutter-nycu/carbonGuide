import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { EvaluationBatch, EvaluationDataset, RagV1Repository, TrialRound } from './v1'
import { dateLabel } from './ui'

export function EvaluationPanel({ api, active = true }: { api: RagV1Repository; active?: boolean }) {
  const evaluation = api.evaluation!
  const [datasets, setDatasets] = useState<EvaluationDataset[]>([]), [batches, setBatches] = useState<EvaluationBatch[]>([]), [rounds, setRounds] = useState<TrialRound[]>([])
  const [receipts, setReceipts] = useState<{ batch_id: string; evaluation_id: string }[]>([])
  const [datasetId, setDatasetId] = useState(''), [roundId, setRoundId] = useState(''), [batchId, setBatchId] = useState('')
  const [uploaded, setUploaded] = useState<Record<string, unknown> | null>(null), [report, setReport] = useState<Record<string, unknown> | null>(null)
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('')
  const stop = useRef(false), mounted = useRef(true), pending = useRef({ fingerprint: '', key: '' })
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true } }, [])
  const visible = useRef(active); visible.current = active
  useEffect(() => { if (!active) stop.current = true }, [active])
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([evaluation.list(controller.signal), api.trials!.list(controller.signal, 0)]).then(([data, trialData]) => {
      if (!controller.signal.aborted) { setDatasets(data.datasets); setBatches(data.batches); setReceipts(data.receipts); setRounds(trialData.rounds) }
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '讀取失敗。') })
    return () => controller.abort()
  }, [api, evaluation, revision])
  useEffect(() => {
    const controller = new AbortController(); setReport(null)
    const receipt = receipts.find(r => r.batch_id === batchId)
    if (receipt) evaluation.report(receipt.evaluation_id, controller.signal).then(value => { if (!controller.signal.aborted) setReport(value) }).catch(() => { if (!controller.signal.aborted) setError('無法讀取報告。') })
    return () => controller.abort()
  }, [evaluation, receipts, batchId])
  async function create(event: FormEvent) {
    event.preventDefault(); if (busy) return
    const fingerprint = JSON.stringify({ datasetId, roundId })
    if (pending.current.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() }
    setBusy(true); setError('')
    try { const id = await evaluation.begin(datasetId, roundId, pending.current.key); if (mounted.current) { setBatchId(id); pending.current = { fingerprint: '', key: '' }; setRevision(n => n + 1) } }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '建立結果未知，請用相同設定查詢。') }
    finally { if (mounted.current) setBusy(false) }
  }
  async function run(all: boolean) {
    if (!batchId || busy || !visible.current) return
    stop.current = false; setBusy(true); setError(''); setStatus('正在查詢下一個未完成題目…')
    try {
      for (let i = 0; i < 61 && !stop.current && visible.current; i++) {
        const result = await evaluation.next(batchId)
        if (!mounted.current || !visible.current || stop.current) break
        if (result.complete) { await evaluation.finish(batchId); setStatus('機械評測報告已保存，待人工核對。'); break }
        setStatus(`${result.case_id ?? '題目'}：${result.state ?? '處理中'}${result.reason ? `（${result.reason}）` : ''}`)
        if (!all || !['answered', 'abstained'].includes(result.state ?? '')) break
      }
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '處理結果未知。請重新讀取並續跑，沿用原識別碼。') }
    finally { if (mounted.current) { setBusy(false); setRevision(n => n + 1) } }
  }
  return <section className="rag-panel"><h2>固定題庫評測</h2><p>開發題用於調整，驗收題獨立保存。建立批次會一次保留整份題庫的輪次與今日題數，尚不呼叫模型；每題沿用同一識別碼與共用預算。不自動重跑已失敗或結果不明的模型呼叫。</p>
    {error && <p role="alert" className="rag-error">{error}</p>}{status && <p role="status" className="rag-notice">{status}</p>}
    <details><summary>匯入固定題庫 JSON</summary><p>最多 64 KiB。上傳前請移除個資；預期答案與來源仍須人工核對。相同內容不重複建立，開發與驗收題不可重疊。</p><input type="file" accept=".json,application/json" disabled={busy} aria-label="評測題庫 JSON" onChange={async e => {
      setUploaded(null); setError(''); const file = e.target.files?.[0]; if (!file) return
      try { if (file.size > 65536) throw new Error('題庫超過 64 KiB。'); const value: unknown = JSON.parse(await file.text()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('題庫格式不符。'); setUploaded(value as Record<string, unknown>) } catch (reason) { setError(reason instanceof Error ? reason.message : '無法讀取題庫。') }
    }} />{uploaded && <><p>{String(uploaded.name ?? '未命名')} · {String(uploaded.split ?? '')} · {Array.isArray(uploaded.cases) ? uploaded.cases.length : 0} 題</p><button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const id = await evaluation.register(uploaded); if (mounted.current) { setDatasetId(id); setUploaded(null); setRevision(n => n + 1) } } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '題庫未儲存。') } finally { if (mounted.current) setBusy(false) } }}>保存這份固定題庫</button></>}</details>
    <form onSubmit={create}><fieldset disabled={busy}><div className="rag-form-grid"><label>題庫<select required value={datasetId} onChange={e => setDatasetId(e.target.value)}><option value="">選擇題庫</option>{datasets.map(d => <option key={d.id} value={d.id}>{d.name} · {d.data_split === 'acceptance' ? '驗收' : '開發'} · {d.case_count} 題</option>)}</select></label><label>評測使用的試問輪次<select required value={roundId} onChange={e => setRoundId(e.target.value)}><option value="">選擇有限輪次</option>{rounds.filter(r => r.state === 'active' && Date.parse(r.expires_at) > Date.now()).map(r => <option key={r.id} value={r.id}>{r.name} · 剩 {r.request_limit - r.request_count} 題</option>)}</select></label></div><button disabled={!datasetId || !roundId}>建立評測批次（尚不呼叫模型）</button></fieldset></form>
    <label>繼續或查看批次<select disabled={busy} value={batchId} onChange={e => { setBatchId(e.target.value); setStatus('') }}><option value="">選擇評測批次</option>{batches.map(b => <option key={b.id} value={b.id}>{dateLabel(b.created_at)} · {datasets.find(d => d.id === b.dataset_id)?.name ?? b.dataset_id} · {receipts.some(r => r.batch_id === b.id) ? '已有報告' : '未產報告'}</option>)}</select></label>
    <div className="rag-actions"><button disabled={busy || !batchId || !!report} onClick={() => void run(false)}>執行下一題或產生報告</button><button disabled={busy || !batchId || !!report} onClick={() => void run(true)}>續跑剩餘題目</button><button disabled={!busy} onClick={() => { stop.current = true; setStatus('目前這題結束後停止；不撤回已開始的呼叫。') }}>本題後停止</button><button disabled={busy} onClick={() => setRevision(n => n + 1)}>重新讀取評測</button></div>
    <p className="rag-muted">處理中請先等候原請求。超過 5 分鐘的中斷題會封存為結果不明，保留費用與失敗證據；再續跑會前進下一題。</p>
    {report && <><h3>機械評測結果 · 待人工審閱</h3><p>通過 {String(report.passed_count)} / {String(report.case_count)}；Recall@5 {Number(report.recall_at_5).toFixed(3)}；引用有效率 {Number(report.citation_validity).toFixed(3)}；數值錯誤 {String(report.numerical_failures)}；版本外來源 {String(report.unpublished_leaks)}。</p><p>Recall 以必須覆蓋的來源內容計算；同一表格的不同檢索視角視為同一內容。機械通過不等於語意正確，也不會自動核准或發布。</p><details><summary>逐題證據與固定版本指紋</summary><pre>{JSON.stringify(report, null, 2)}</pre></details></>}
  </section>
}
