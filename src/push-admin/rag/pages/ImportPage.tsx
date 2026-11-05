import { useState, type ChangeEvent, type FormEvent } from 'react'
import { failureText, messageFor, toRagError } from '../api/errors'
import { requestKeyFor, settleRequestKey } from '../api/requestKeys'
import { fileProblem, urlProblem } from '../api/types'
import { useLoader, usePolling } from '../hooks'
import { STATUS_LABEL, STATUS_TONE, canEdit, formatDate } from '../labels'
import { Notice, useNavigate, type PageProps } from '../ui'

interface UploadRow { key: string; name: string; state: 'waiting' | 'uploading' | 'done' | 'skipped' | 'error'; message: string }
const TONE: Record<UploadRow['state'], string> = { waiting: 'quiet', uploading: 'warn', done: '', skipped: 'quiet', error: 'error' }

export default function ImportPage({ api, role }: PageProps) {
  const navigate = useNavigate()
  const editable = canEdit(role)
  const urls = useLoader(() => api.listUrls())
  const [uploads, setUploads] = useState<UploadRow[]>([])
  const [busy, setBusy] = useState(false)
  const [address, setAddress] = useState('')
  const [urlMessage, setUrlMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)
  const [registering, setRegistering] = useState(false)
  usePolling(() => void urls.reload(), (urls.data ?? []).some(u => u.status === 'pending' || u.status === 'processing'))

  const update = (key: string, patch: Partial<UploadRow>) => setUploads(rows => rows.map(r => (r.key === key ? { ...r, ...patch } : r)))

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (!files.length) return
    const batch = files.map((file, index): UploadRow & { file: File } => {
      const problem = fileProblem(file)
      return { key: `${Date.now()}-${index}-${file.name}`, name: file.name, file,
        state: problem ? 'error' : 'waiting', message: problem ? messageFor(problem) : '等待上傳' }
    })
    setUploads(rows => [...batch.map(({ file: _file, ...row }) => row), ...rows])
    setBusy(true)
    // One at a time, so a large batch never floods the upload limits or the processing queue.
    for (const row of batch.filter(r => r.state === 'waiting')) {
      update(row.key, { state: 'uploading', message: '上傳中…' })
      try {
        const result = await api.uploadFile(row.file, message => update(row.key, { message }))
        update(row.key, result.outcome === 'uploaded'
          ? { state: 'done', message: '上傳完成' }
          : { state: 'skipped', message: '這個檔案已經在知識庫裡，不用再上傳。' })
      } catch (caught) {
        update(row.key, { state: 'error', message: toRagError(caught).message })
      }
    }
    setBusy(false)
  }

  async function register(event: FormEvent) {
    event.preventDefault()
    const value = address.trim()
    if (urlProblem(value)) { setUrlMessage({ tone: 'error', text: messageFor('url_source_not_allowed') }); return }
    setRegistering(true)
    setUrlMessage(null)
    try {
      await api.registerUrl(value, requestKeyFor('url', { url: value }))
      settleRequestKey('url', { url: value })
      setAddress('')
      setUrlMessage({ tone: 'ok', text: '已登記，系統會自動下載。不是 PDF 的網址會顯示失敗。' })
      await urls.reload()
    } catch (caught) {
      setUrlMessage({ tone: 'error', text: toRagError(caught).message })
    } finally {
      setRegistering(false)
    }
  }

  return <>
    <div className="steps">
      <div className="step active"><strong>01</strong>選擇檔案或網址</div>
      <div className="step active"><strong>02</strong>上傳並核對檔案</div>
      <div className="step"><strong>03</strong>系統自動整理</div>
      <div className="step"><strong>04</strong>放進知識版本審核</div>
    </div>
    {!editable && <Notice>唯讀權限不能上傳檔案或登記網址。</Notice>}
    <div className="grid">
      <section className="panel">
        <h2>上傳檔案</h2>
        <div className="drop-area">
          <h3>選擇要加入知識庫的檔案</h3>
          <p>PDF、DOCX、TXT，每個檔案 20 MB 以內，可以一次選多個。上傳後系統會自動整理，不用另外操作。</p>
          <label className="field">選擇檔案<input type="file" accept=".pdf,.docx,.txt" multiple disabled={!editable || busy} onChange={event => void choose(event)} /></label>
        </div>
        {uploads.length > 0 && <ul className="release-manifest" aria-label="上傳結果">
          {uploads.map(row => <li key={row.key}><strong>{row.name}</strong> <span className={`tag ${TONE[row.state]}`.trim()}>{row.message}</span></li>)}
        </ul>}
        <button type="button" className="text-button" onClick={() => navigate('documents')}>到「知識庫與文件」看處理進度 →</button>
      </section>
      <section className="panel">
        <h2>登記 PDF 網址</h2>
        <p className="muted">網址要以 https 開頭，而且下載下來是 PDF。網頁不會被收進知識庫。</p>
        <form onSubmit={event => void register(event)}>
          <label className="field">PDF 網址<input type="url" value={address} maxLength={2048} placeholder="https://…/報告.pdf" disabled={!editable}
            onChange={event => setAddress(event.target.value)} /></label>
          <div className="actions"><button type="submit" className="secondary" disabled={!editable || registering}>登記網址</button></div>
        </form>
        {urlMessage && <p className={urlMessage.tone === 'error' ? 'form-error' : 'caption'} role={urlMessage.tone === 'error' ? 'alert' : 'status'}>{urlMessage.text}</p>}
      </section>
    </div>
    <section className="panel">
      <h2>已登記的網址</h2>
      {urls.error && <Notice tone="error">{urls.error}</Notice>}
      {!urls.data && urls.loading && <p className="empty" role="status">正在讀取網址…</p>}
      {urls.data && (urls.data.length ? <ul className="release-manifest" aria-label="已登記的網址">
        {urls.data.map(u => <li key={u.id}>
          <span className={`tag ${STATUS_TONE[u.status]}`.trim()}>{STATUS_LABEL[u.status]}</span> {u.url}
          <small> · {formatDate(u.createdAt)}{u.failureReason ? ` · ${failureText(u.failureReason)}` : ''}</small>
        </li>)}
      </ul> : <p className="empty">還沒有登記任何網址。</p>)}
    </section>
  </>
}
