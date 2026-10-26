import { useEffect, useRef, useState } from 'react'
import type { AdminRole } from '../auth'
import type { RagV1Repository, Original, IngestionJob } from './v1'
import { validateFile } from './v1'
import { dateLabel } from './ui'
import { UrlPanel } from './UrlPanel'
import { QualityNotice } from './QualityNotice'

const statuses: Record<string, string> = { pending: '待批次處理', running: '處理中', completed: '完成', failed: '失敗', uncertain: '結果待確認' }
export function IngestionPanel({ repository, role, changed }: { repository: RagV1Repository; role: AdminRole; changed: () => void }) {
  const [data, setData] = useState<{ originals: Original[]; jobs: IngestionJob[] }>({ originals: [], jobs: [] })
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [progress, setProgress] = useState('')
  const [download, setDownload] = useState<{ id: string; url: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    repository.ingestion(controller.signal).then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '讀取失敗。') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [repository, refresh])
  useEffect(() => {
    if (!download) return
    const timer = setTimeout(() => setDownload(null), 50_000)
    return () => clearTimeout(timer)
  }, [download])
  async function upload() {
    if (!file || busy) return
    setBusy(true); setError(''); setProgress('')
    try {
      await repository.upload(file, setProgress)
      setFile(null); if (fileInput.current) fileInput.current.value = ''
      setRefresh(value => value + 1); changed()
    } catch (error) { setError(error instanceof Error ? error.message : '上傳失敗。') }
    finally { setBusy(false) }
  }
  async function prepareDownload(originalId: string) {
    setError(''); setDownload(null)
    try { setDownload({ id: originalId, url: await repository.download(originalId) }) }
    catch (error) { setError(error instanceof Error ? error.message : '無法產生下載授權。') }
  }
  return <section className="rag-panel" aria-label="私有文件匯入">
    <div className="rag-row"><h2>私有文件匯入</h2><button disabled={loading} onClick={() => setRefresh(value => value + 1)}>更新處理狀態</button></div>
    <p>單檔上限 20 MiB。上傳後由本機批次解析，完成解析與向量化後仍須人工審核。</p>
    {role !== 'viewer' && <div className="rag-row"><label>選擇原始檔<input ref={fileInput} type="file" accept=".pdf,.docx,.txt,.json" disabled={busy} onChange={event => {
      const selected = event.target.files?.[0] ?? null
      setError(selected ? validateFile(selected) ?? '' : ''); setFile(selected); setProgress('')
    }} /></label><button disabled={!file || !!validateFile(file) || busy} onClick={upload}>{busy ? '處理上傳中…' : '上傳並核對'}</button></div>}
    {progress && <p role="status">{progress}</p>}{error && <p className="rag-error" role="alert">{error}</p>}
    <p>{loading ? '正在讀取…' : `原始檔 ${data.originals.length} 份 · 已核對 ${data.originals.filter(o => o.upload_state === 'verified').length} 份`}</p>
    <details><summary>查看逐檔處理進度與下載原檔</summary><div className="rag-table"><table><thead><tr><th>檔案</th><th>原檔</th><th>解析 / 向量</th><th>操作</th></tr></thead><tbody>{data.originals.map(original => {
      const jobs = data.jobs.filter(job => job.original_id === original.id)
      return <tr key={original.id}><td data-label="檔案">{original.source_name}<small>{(original.byte_size / 1024 / 1024).toFixed(2)} MiB · {dateLabel(original.created_at)}</small></td>
        <td data-label="原檔">{original.upload_state === 'verified' ? '雜湊核對完成' : '待上傳核對'}</td>
        <td data-label="解析 / 向量">{jobs.length ? jobs.map(job => <div key={job.id}>{job.stage === 'parse' ? '解析' : '向量'}：{statuses[job.status] ?? job.status}{job.failure_reason && <small>{job.failure_reason}</small>}{job.quality.human_approved === false && <small>內容待人工審核</small>}<QualityNotice quality={job.quality} /></div>) : '核對後建立工作'}</td>
        <td data-label="操作">{download?.id === original.id ? <a href={download.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">下載原檔（短效授權）</a> : <button onClick={() => prepareDownload(original.id)}>取得下載授權</button>}</td></tr>
    })}</tbody></table></div></details>
    {repository.urls && <UrlPanel repository={repository.urls} role={role} />}
  </section>
}
