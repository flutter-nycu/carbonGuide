import { useMemo, useState } from 'react'
import { failureText, messageFor, toRagError } from '../api/errors'
import { LIMITS, correctionBytes, type DocumentChunk, type KnowledgeDocument, type RagApi, type Role } from '../api/types'
import { useLoader, usePolling } from '../hooks'
import { DOMAINS, PURPOSES, STATUS_LABEL, STATUS_TONE, canEdit, formatDate } from '../labels'
import { Dialog, Notice, useNavigate, useToast, type PageProps } from '../ui'

const ALL = '全部'
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant'))
const pageRange = (c: DocumentChunk) => (c.pageStart === null ? null : c.pageEnd && c.pageEnd !== c.pageStart ? `${c.pageStart}–${c.pageEnd}` : String(c.pageStart))

function StatusCell({ doc }: { doc: KnowledgeDocument }) {
  return <>
    <span className={`tag ${STATUS_TONE[doc.status]}`.trim()}>{STATUS_LABEL[doc.status]}</span>
    {doc.failureReason && <small>{failureText(doc.failureReason)}</small>}
  </>
}

export default function DocumentsPage({ api, role }: PageProps) {
  const navigate = useNavigate()
  const documents = useLoader(() => api.listDocuments())
  const [query, setQuery] = useState('')
  const [purpose, setPurpose] = useState(ALL)
  const [domain, setDomain] = useState(ALL)
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useMemo(() => documents.data ?? [], [documents.data])
  usePolling(() => void documents.reload(), list.some(d => d.status === 'pending' || d.status === 'processing'))

  const shown = list.filter(d => d.title.toLowerCase().includes(query.trim().toLowerCase())
    && (purpose === ALL || d.purpose === purpose) && (domain === ALL || d.domain === domain))
  const count = (...statuses: KnowledgeDocument['status'][]) => list.filter(d => statuses.includes(d.status)).length

  return <>
    <div className="section-head">
      <p className="muted">完成處理的文件，才能放進知識版本給教練引用。</p>
      {canEdit(role) && <button type="button" className="primary" onClick={() => navigate('import')}>＋ 匯入來源</button>}
    </div>
    {documents.error && <Notice tone="error">{documents.error}<div className="actions"><button type="button" className="secondary" onClick={() => void documents.reload()}>重新讀取</button></div></Notice>}
    {documents.data && <div className="summary">
      <div className="metric"><small>文件總數</small><b>{list.length}</b><p>上傳的檔案和 PDF 網址</p></div>
      <div className="metric"><small>處理完成</small><b>{count('completed')}</b><p>可以放進知識版本</p></div>
      <div className="metric"><small>還在處理</small><b>{count('pending', 'processing')}</b><p>系統會自動處理</p></div>
      <div className="metric"><small>需要留意</small><b>{count('failed', 'budget_paused')}</b><p>處理失敗或預算不足</p></div>
    </div>}
    <div className="toolbar">
      <label className="field">搜尋文件<input value={query} placeholder="輸入文件名稱" onChange={event => setQuery(event.target.value)} /></label>
      <label className="field">資料用途<select value={purpose} onChange={event => setPurpose(event.target.value)}>
        {[ALL, ...unique(list.map(d => d.purpose))].map(v => <option key={v}>{v}</option>)}
      </select></label>
      <label className="field">生活領域<select value={domain} onChange={event => setDomain(event.target.value)}>
        {[ALL, ...unique(list.map(d => d.domain))].map(v => <option key={v}>{v}</option>)}
      </select></label>
    </div>
    {!documents.data && documents.loading && <p className="empty" role="status">正在讀取文件…</p>}
    {documents.data && <>
      <div className="table-wrap"><table>
        <thead><tr><th>文件</th><th>用途 / 領域</th><th>處理狀態</th><th>加入時間</th><th>操作</th></tr></thead>
        <tbody>
          {shown.map(d => <tr key={d.id}>
            <td><div className="file-title"><span className="file-type">{d.sourceType.toUpperCase()}</span><div><strong>{d.title}</strong>
              <small>第 {d.versionNumber} 版{d.chunkCount !== null ? ` · ${d.chunkCount} 段` : ''}</small></div></div></td>
            <td>{d.purpose}<small>{d.domain}</small></td>
            <td><StatusCell doc={d} /></td>
            <td>{formatDate(d.createdAt)}</td>
            <td><button type="button" className="text-button" aria-label={`檢視 ${d.title}`} onClick={() => setOpenId(d.id)}>檢視 →</button></td>
          </tr>)}
          {!shown.length && <tr><td colSpan={5}><div className="empty">{list.length ? '沒有符合條件的文件，換個條件試試。' : '知識庫裡還沒有文件。'}</div></td></tr>}
        </tbody>
      </table></div>
      <p className="scroll-hint">表格可以左右滑動</p>
    </>}
    <Dialog open={openId !== null} title="文件詳情" onClose={() => setOpenId(null)}>
      {openId && <DocumentDetail key={openId} api={api} role={role} id={openId} onChanged={() => void documents.reload()} />}
    </Dialog>
  </>
}

type Editing = { ordinal: number; mode: 'exclude' | 'edit'; text: string; reason: string }

function DocumentDetail({ api, role, id, onChanged }: { api: RagApi; role: Role; id: string; onChanged: () => void }) {
  const toast = useToast()
  const detail = useLoader(() => api.getDocument(id))
  const [form, setForm] = useState<{ purpose: string; domain: string; scope: string } | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const editable = canEdit(role)

  if (!detail.data) {
    return detail.error ? <Notice tone="error">{detail.error}</Notice> : <p className="empty" role="status">正在讀取文件…</p>
  }
  const { document: doc, chunks, basis } = detail.data
  const values = form ?? { purpose: doc.purpose, domain: doc.domain, scope: doc.citationScope }
  const keptChunks = chunks.filter(c => !c.excluded).sort((a, b) => a.ordinal - b.ordinal)
  const excludedChunks = chunks.filter(c => c.excluded)
  const kept = keptChunks.length

  async function run(work: () => Promise<void>, done: string) {
    setBusy(true)
    setProblem(null)
    try {
      await work()
      toast(done)
      setEditing(null)
      await detail.reload()
      onChanged()
    } catch (caught) {
      const error = toRagError(caught)
      setProblem(error.message)
      if (error.code === 'source_version_changed') {
        // Someone corrected the document first: show their version; the passage numbers may have moved.
        setEditing(null)
        await detail.reload()
      }
    } finally {
      setBusy(false)
    }
  }

  function saveClassification() {
    const purpose = values.purpose.trim(), domain = values.domain.trim()
    if (!purpose || !domain || purpose.length > 200 || domain.length > 200 || values.scope.length > 2000) {
      setProblem('用途和領域都要填，最多 200 個字；適用對象最多 2000 個字。')
      return
    }
    void run(() => api.classifyDocument(id, { purpose, domain, citationScope: values.scope.trim() }), '分類已儲存。')
  }

  function submitEdit(edit: Editing) {
    if (!edit.reason.trim()) { setProblem('請寫下原因，之後才查得到為什麼修改。'); return }
    if (edit.mode === 'exclude' && kept <= 1) { setProblem('至少要留一段，不能全部排除。'); return }
    const section = keptChunks.find(c => c.ordinal === edit.ordinal)?.sectionPath ?? ''
    if (edit.mode === 'edit' && (!edit.text.trim() || correctionBytes(doc.title, section, edit.text) > LIMITS.correctionBytes)) { setProblem(messageFor('correction_too_long')); return }
    const change = edit.mode === 'exclude' ? { ordinal: edit.ordinal, exclude: true } : { ordinal: edit.ordinal, exclude: false, text: edit.text }
    void run(() => api.reviseChunks(id, [change], edit.reason.trim(), basis), edit.mode === 'exclude' ? `已排除第 ${edit.ordinal} 段。` : `已修改第 ${edit.ordinal} 段。`)
  }

  async function download() {
    if (!doc.originalId) return
    try { window.open(await api.downloadOriginal(doc.originalId), '_blank', 'noopener,noreferrer') } catch (caught) { toast(toRagError(caught).message) }
  }

  return <>
    <div className="section-head"><h3>{doc.title}</h3>
      <span className={`tag ${STATUS_TONE[doc.status]}`.trim()}>{STATUS_LABEL[doc.status]}</span></div>
    {doc.failureReason && <Notice tone="warn">{failureText(doc.failureReason)}</Notice>}
    <dl className="metadata">
      <dt>檔案類型</dt><dd>{doc.sourceType.toUpperCase()}</dd>
      <dt>文件版本</dt><dd>第 {doc.versionNumber} 版</dd>
      <dt>加入時間</dt><dd>{formatDate(doc.createdAt)}</dd>
      <dt>段落數</dt><dd>{kept} 段{chunks.length > kept ? `（另有 ${chunks.length - kept} 段已排除）` : ''}</dd>
    </dl>
    {doc.originalId && <div className="actions"><button type="button" className="secondary" onClick={() => void download()}>下載原檔</button></div>}
    {problem && <p className="form-error" role="alert">{problem}</p>}
    {editable ? <section className="panel">
      <h3>分類</h3>
      <label className="field">資料用途<input list="rag-purposes" value={values.purpose} maxLength={200} onChange={e => setForm({ ...values, purpose: e.target.value })} /></label>
      <label className="field">生活領域<input list="rag-domains" value={values.domain} maxLength={200} onChange={e => setForm({ ...values, domain: e.target.value })} /></label>
      <label className="field">適用對象<input value={values.scope} maxLength={2000} placeholder="例如：一般家庭" onChange={e => setForm({ ...values, scope: e.target.value })} /></label>
      <datalist id="rag-purposes">{PURPOSES.map(v => <option key={v} value={v} />)}</datalist>
      <datalist id="rag-domains">{DOMAINS.map(v => <option key={v} value={v} />)}</datalist>
      <button type="button" className="primary" disabled={busy} onClick={saveClassification}>儲存分類</button>
    </section> : <p className="caption">唯讀權限只能檢視，不能修改分類或段落。</p>}
    <h3>段落</h3>
    {!keptChunks.length && <p className="empty">還沒有段落，處理完成後就會出現。</p>}
    {keptChunks.map(chunk => <div key={chunk.id} className="chunk">
      <strong>第 {chunk.ordinal} 段{pageRange(chunk) ? ` · 第 ${pageRange(chunk)} 頁` : ''}{chunk.sectionPath ? ` · ${chunk.sectionPath}` : ''}</strong>
      <p>{chunk.text}</p>
      {editable && editing?.ordinal !== chunk.ordinal && <div className="actions">
        <button type="button" className="text-button" onClick={() => { setProblem(null); setEditing({ ordinal: chunk.ordinal, mode: 'edit', text: chunk.text, reason: '' }) }}>修改文字</button>
        <button type="button" className="text-button" onClick={() => { setProblem(null); setEditing({ ordinal: chunk.ordinal, mode: 'exclude', text: chunk.text, reason: '' }) }}>排除這一段</button>
      </div>}
      {editing?.ordinal === chunk.ordinal && <div>
        {editing.mode === 'edit' && <label className="field">段落內容<textarea value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} /></label>}
        <label className="field">{editing.mode === 'exclude' ? '排除原因' : '修改原因'}<input value={editing.reason} maxLength={1000} onChange={e => setEditing({ ...editing, reason: e.target.value })} /></label>
        <div className="actions">
          <button type="button" className="primary" disabled={busy} onClick={() => submitEdit(editing)}>{editing.mode === 'exclude' ? '確認排除' : '儲存修改'}</button>
          <button type="button" className="secondary" onClick={() => setEditing(null)}>取消</button>
        </div>
      </div>}
    </div>)}
    {excludedChunks.length > 0 && <section aria-label="已排除的段落">
      <h3>已排除的段落</h3>
      {excludedChunks.map(chunk => <div key={chunk.id} className="chunk">
        <strong>{pageRange(chunk) ? `第 ${pageRange(chunk)} 頁` : '沒有頁碼'}{chunk.sectionPath ? ` · ${chunk.sectionPath}` : ''}</strong>
        <span className="tag quiet">已排除</span>
        <p>{chunk.text}</p>
      </div>)}
    </section>}
    <p className="caption">這裡不用逐份核准，審核知識版本時會一起確認。修改或排除段落後，要建立新的知識版本才會用到。</p>
  </>
}
