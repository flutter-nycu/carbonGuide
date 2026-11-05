import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { messageFor, toRagError } from '../api/errors'
import { requestKeyFor, settleRequestKey } from '../api/requestKeys'
import { LIMITS, type EvaluationBatch, type EvaluationReport } from '../api/types'
import { useLoader } from '../hooks'
import { Notice, usePageActive, type PageProps } from '../ui'

const SPLIT_LABEL = { acceptance: '驗收題組', development: '練習題組' } as const
const UNFINISHED_LABEL: Record<string, string> = { failed: '失敗', uncertain: '結果不確定' }
const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)

interface Preview { value: unknown; name: string; split: string; count: number }

function readDataset(text: string): Preview | null {
  try {
    const value = JSON.parse(text) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const { name, split, cases } = value as Record<string, unknown>
    return {
      value, name: typeof name === 'string' && name.trim() ? name.trim() : '未命名',
      split: split === 'acceptance' || split === 'development' ? SPLIT_LABEL[split] : '類型不明', count: Array.isArray(cases) ? cases.length : 0,
    }
  } catch {
    return null
  }
}

export default function EvaluationPage({ api, role }: PageProps) {
  const owner = role === 'owner'
  const active = usePageActive()
  const activeRef = useRef(active)
  activeRef.current = active
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const datasets = useLoader(() => api.listDatasets())
  const versions = useLoader(() => api.listVersions())
  const batches = useLoader(() => api.listBatches())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [datasetId, setDatasetId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [report, setReport] = useState<EvaluationReport | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setPreview(null)
    setProblem(null)
    if (!file) return
    if (file.size > LIMITS.datasetBytes) { setProblem(messageFor('dataset_too_large')); return }
    const read = readDataset(await file.text())
    if (read) setPreview(read)
    else setProblem(messageFor('invalid_dataset'))
  }

  async function register() {
    if (!preview) return
    setBusy(true)
    setProblem(null)
    try {
      const id = await api.registerDataset(preview.value)
      setPreview(null)
      setDatasetId(id)
      await datasets.reload()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  /** Runs one case at a time. Stops when the page is hidden or a case did not finish, so nothing is charged twice. */
  async function run(batch: Pick<EvaluationBatch, 'id' | 'completed' | 'total'>) {
    if (!activeRef.current) {
      // Left the page before the first case: keep the batch for 接續 instead of running it in the background.
      setBusy(false)
      void batches.reload()
      return
    }
    setBusy(true)
    setProblem(null)
    setReport(null)
    let done = batch.completed
    setProgress({ done, total: batch.total })
    // One call per remaining case plus the one that reports completion; anything more means the backend is behind.
    let calls = batch.total - batch.completed + 1
    try {
      while (mounted.current && activeRef.current) {
        if (calls-- <= 0) {
          setProblem('題目都跑完了，但系統還沒回報完成，請稍等一下再按「接續」。')
          break
        }
        const step = await api.nextEvaluation(batch.id)
        if (step.caseId) done += 1
        if (step.complete) {
          const result = await api.evaluationReport(await api.finishEvaluation(batch.id))
          if (mounted.current) setReport(result)
          break
        }
        if (mounted.current) setProgress({ done, total: batch.total })
        if (step.state && step.state !== 'answered' && step.state !== 'abstained') {
          setProblem(`題目 ${step.caseId ?? ''} 沒有順利完成（${UNFINISHED_LABEL[step.state] ?? step.state}），已經先暫停。到「互動紀錄」確認之後，可以按「接續」繼續跑。`)
          break
        }
      }
    } catch (caught) {
      if (mounted.current) setProblem(toRagError(caught).message)
    } finally {
      if (mounted.current) {
        setBusy(false)
        setProgress(null)
        void batches.reload()
      }
    }
  }

  async function openReport(reportId: string) {
    setProblem(null)
    try {
      setReport(await api.evaluationReport(reportId))
    } catch (caught) {
      setProblem(toRagError(caught).message)
    }
  }

  async function start(event: FormEvent) {
    event.preventDefault()
    if (!datasetId || !versionId) return
    const payload = { datasetId, versionId }
    setBusy(true)
    setProblem(null)
    try {
      // The key stays until the backend answers, so pressing 開始評測 again cannot open a second batch.
      const batchId = await api.beginEvaluation(datasetId, versionId, requestKeyFor('evaluation', payload))
      settleRequestKey('evaluation', payload)
      const batch = (await api.listBatches()).find(b => b.id === batchId)
      await run({ id: batchId, completed: batch?.completed ?? 0, total: batch?.total ?? datasets.data?.find(d => d.id === datasetId)?.caseCount ?? 0 })
    } catch (caught) {
      setProblem(toRagError(caught).message)
      setBusy(false)
    }
  }

  const datasetName = (id: string) => datasets.data?.find(d => d.id === id)?.name ?? '已移除的題組'
  const versionName = (id: string) => versions.data?.find(v => v.id === id)?.name ?? '—'
  const error = datasets.error ?? versions.error ?? batches.error

  return <>
    {error && <Notice tone="error">{error}</Notice>}
    {!owner && <Notice>只有 owner 可以登記題組和執行評測，評測會使用 AI 預算。</Notice>}
    <div className="grid">
      <section className="panel">
        <h2>題組</h2>
        <div className="table-wrap compact"><table aria-label="已登記的題組">
          <thead><tr><th>名稱</th><th>類型</th><th>題數</th></tr></thead>
          <tbody>
            {(datasets.data ?? []).map(d => <tr key={d.id}><td>{d.name}</td><td>{SPLIT_LABEL[d.split]}</td><td>{d.caseCount} 題</td></tr>)}
            {datasets.data && !datasets.data.length && <tr><td colSpan={3}><div className="empty">還沒有題組。</div></td></tr>}
          </tbody>
        </table></div>
        <label className="field">題組檔案<input type="file" accept=".json,application/json" disabled={!owner || busy} onChange={event => void choose(event)} /></label>
        <p className="form-tip">JSON 檔，64 KB 以內。驗收題組至少 40 題，要包含檢索、資料不足、安全、QA、人格這幾類。</p>
        {preview && <div className="actions">
          <span>{preview.name} · {preview.split} · {preview.count} 題</span>
          <button type="button" className="primary" disabled={busy} onClick={() => void register()}>登記題組</button>
        </div>}
      </section>
      <section className="panel">
        <h2>開始評測</h2>
        <form onSubmit={event => void start(event)}>
          <label className="field">題組<select value={datasetId} required onChange={event => setDatasetId(event.target.value)}>
            <option value="">選擇題組</option>
            {(datasets.data ?? []).map(d => <option key={d.id} value={d.id}>{d.name} · {SPLIT_LABEL[d.split]} · {d.caseCount} 題</option>)}
          </select></label>
          <label className="field">知識版本<select value={versionId} required onChange={event => setVersionId(event.target.value)}>
            <option value="">選擇知識版本</option>
            {(versions.data ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select></label>
          <button type="submit" className="primary" disabled={!owner || busy || !datasetId || !versionId}>開始評測</button>
        </form>
        <p className="caption">一次跑一題。離開這一頁時評測會暫停，回來後按「接續」從下一題開始，跑過的題目不會重跑。</p>
        {progress && <p className="prompt-status" role="status">正在評測：已完成 {progress.done}／{progress.total} 題</p>}
        {problem && <p className="form-error" role="alert">{problem}</p>}
      </section>
    </div>

    {report && <section className="panel" aria-label="評測報告">
      <h2>評測報告</h2>
      <dl className="metadata">
        <dt>知識版本</dt><dd>{versionName(report.versionId)}</dd>
        <dt>題組類型</dt><dd>{SPLIT_LABEL[report.split]}</dd>
        <dt>通過題數</dt><dd>{report.passedCount}／{report.caseCount}</dd>
        <dt>找到正確來源</dt><dd>{percent(report.recallAt5)}</dd>
        <dt>引用支持回答</dt><dd>{percent(report.citationValidity)}</dd>
      </dl>
      <p className="caption">這些數字由系統自動比對，通過不代表回答一定正確，發布前還要人工審核。{report.split === 'acceptance' ? '驗收題組的結果會列入知識版本的發布條件。' : '練習題組的結果只供調整參考，不算發布條件。'}</p>
    </section>}

    <section className="panel">
      <h2>評測紀錄</h2>
      <div className="table-wrap"><table aria-label="評測紀錄">
        <thead><tr><th>題組</th><th>知識版本</th><th>進度</th><th>操作</th></tr></thead>
        <tbody>
          {(batches.data ?? []).map(b => <tr key={b.id}>
            <td>{datasetName(b.datasetId)}</td>
            <td>{versionName(b.versionId)}</td>
            <td>{b.finished ? '已產生報告' : `已完成 ${b.completed}／${b.total} 題`}</td>
            <td>{b.finished
              ? b.reportId && <button type="button" className="text-button" disabled={busy} onClick={() => void openReport(b.reportId!)}>查看報告</button>
              : owner && <button type="button" className="text-button" disabled={busy} onClick={() => void run(b)}>接續</button>}</td>
          </tr>)}
          {batches.data && !batches.data.length && <tr><td colSpan={4}><div className="empty">還沒有評測紀錄。</div></td></tr>}
        </tbody>
      </table></div>
    </section>
  </>
}
