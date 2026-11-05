import { useEffect, useState, type FormEvent } from 'react'
import { toRagError } from '../api/errors'
import { LIMITS, type DocumentChunk, type QaCitation, type QaEntry, type QaInput, type RagApi } from '../api/types'
import { useLoader } from '../hooks'
import { canEdit, formatDate } from '../labels'
import { Dialog, Notice, useToast, type PageProps } from '../ui'

export default function QaPage({ api, role }: PageProps) {
  const editable = canEdit(role)
  const toast = useToast()
  const entries = useLoader(() => api.listQa())
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const list = entries.data ?? []
  const current = editing && editing !== 'new' ? list.find(q => q.id === editing) ?? null : null

  return <>
    <div className="section-head">
      <p className="muted">使用者的問題對到這裡的 QA 時，教練會直接用 QA 的答案。</p>
      {editable && <button type="button" className="primary" onClick={() => setEditing('new')}>＋ 新增 QA</button>}
    </div>
    {entries.error && <Notice tone="error">{entries.error}</Notice>}
    {!entries.data && entries.loading && <p className="empty" role="status">正在讀取 QA…</p>}
    {entries.data && <section className="panel">
      {list.map(q => <article key={q.id} className="qa-row">
        <div className="section-head"><h3>{q.question}</h3><span className={q.enabled ? 'tag' : 'tag quiet'}>{q.enabled ? '啟用中' : '已停用'}</span></div>
        <p>{q.answer}</p>
        <div className="actions">
          <span className={q.citations.length ? 'tag quiet' : 'tag warn'}>{q.citations.length ? `${q.citations.length} 筆引用` : '還沒有引用'}</span>
          <small className="muted">來源：{q.sourceNote} · {formatDate(q.updatedAt)} 更新</small>
          {editable && <button type="button" className="text-button" aria-label={`編輯 ${q.question}`} onClick={() => setEditing(q.id)}>編輯</button>}
        </div>
      </article>)}
      {!list.length && <p className="empty">還沒有 QA。</p>}
    </section>}
    <p className="caption">QA 要有核對過的引用，才會放進知識版本。修改之後，下次建立知識版本才會生效。{editable ? '' : '唯讀權限只能檢視。'}</p>
    <Dialog open={editing !== null} title={editing === 'new' ? '新增 QA' : '編輯 QA'} onClose={() => setEditing(null)}>
      {editing === 'new' && <QaForm key="new" api={api} entry={null} onSaved={() => { setEditing(null); toast('已新增 QA，接著可以加上引用。'); void entries.reload() }} />}
      {current && <>
        <QaForm key={current.id} api={api} entry={current} onSaved={() => { setEditing(null); toast('QA 已儲存。'); void entries.reload() }} />
        <CitationEditor key={`${current.id}-citations`} api={api} entry={current} onSaved={() => { toast('引用已儲存。'); void entries.reload() }} />
      </>}
    </Dialog>
  </>
}

function QaForm({ api, entry, onSaved }: { api: RagApi; entry: QaEntry | null; onSaved: () => void }) {
  const [values, setValues] = useState<QaInput>(entry
    ? { question: entry.question, answer: entry.answer, sourceNote: entry.sourceNote, enabled: entry.enabled }
    : { question: '', answer: '', sourceNote: '', enabled: true })
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const input = { ...values, question: values.question.trim(), answer: values.answer.trim(), sourceNote: values.sourceNote.trim() }
    if (!input.question || !input.answer || !input.sourceNote) { setProblem('問題、答案和來源說明都要填。'); return }
    setBusy(true)
    setProblem(null)
    try {
      await api.saveQa(input, entry ?? undefined)
      onSaved()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={event => void submit(event)}>
    <label className="field">問題<input value={values.question} maxLength={500} onChange={e => setValues({ ...values, question: e.target.value })} /></label>
    <label className="field">答案<textarea value={values.answer} maxLength={10000} onChange={e => setValues({ ...values, answer: e.target.value })} /></label>
    <label className="field">來源說明<input value={values.sourceNote} maxLength={2000} placeholder="例如：餐飲減碳指南第 6 頁" onChange={e => setValues({ ...values, sourceNote: e.target.value })} /></label>
    <label className="check-label"><input type="checkbox" checked={values.enabled} onChange={e => setValues({ ...values, enabled: e.target.checked })} />啟用</label>
    {problem && <p className="form-error" role="alert">{problem}</p>}
    <button type="submit" className="primary" disabled={busy}>儲存</button>
    {!entry && <p className="caption">先儲存 QA，再打開它加上引用。</p>}
  </form>
}

function CitationEditor({ api, entry, onSaved }: { api: RagApi; entry: QaEntry; onSaved: () => void }) {
  const documents = useLoader(() => api.listDocuments())
  const [draft, setDraft] = useState<QaCitation[]>(entry.citations)
  const [documentId, setDocumentId] = useState('')
  const [chunks, setChunks] = useState<DocumentChunk[]>([])
  const [chunkId, setChunkId] = useState('')
  const [quote, setQuote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const full = draft.length >= LIMITS.qaCitations

  useEffect(() => {
    setChunks([])
    setChunkId('')
    setQuote('')
    if (!documentId) return
    let alive = true
    api.getDocument(documentId).then(
      detail => { if (alive) setChunks(detail.chunks.filter(c => !c.excluded)) },
      caught => { if (alive) setProblem(toRagError(caught).message) },
    )
    return () => { alive = false }
  }, [api, documentId])

  function pickChunk(id: string) {
    setChunkId(id)
    setQuote(chunks.find(c => c.id === id)?.text ?? '')
  }

  function add() {
    const text = quote.trim()
    const { min, max } = LIMITS.quoteChars
    if (!chunkId || !text) { setProblem('請選一個段落，並貼上要引用的原文。'); return }
    if ([...text].length < min || [...text].length > max) { setProblem(`引用原文要 ${min} 到 ${max} 個字。`); return }
    if (draft.some(c => c.chunkId === chunkId)) { setProblem('這一段已經引用過了，同一段只能引用一次。'); return }
    setProblem(null)
    setDraft([...draft, { chunkId, quote: text }])
  }

  async function save() {
    setBusy(true)
    setProblem(null)
    try {
      await api.saveQaCitations(entry.id, entry.updatedAt, draft)
      onSaved()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  const ready = (documents.data ?? []).filter(d => d.status === 'completed')
  return <section className="panel stack" aria-label="引用">
    <h3>引用</h3>
    {draft.length ? <ol className="release-manifest" aria-label="這筆 QA 的引用">
      {draft.map((c, index) => <li key={`${c.chunkId}-${index}`}>
        {c.quote} <button type="button" className="text-button" aria-label={`移除第 ${index + 1} 筆引用`} onClick={() => setDraft(draft.filter((_, i) => i !== index))}>移除</button>
      </li>)}
    </ol> : <p className="small-note">還沒有引用。</p>}
    <label className="field">來源文件<select value={documentId} onChange={e => setDocumentId(e.target.value)}>
      <option value="">選擇文件</option>
      {ready.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
    </select></label>
    <label className="field">段落<select value={chunkId} disabled={!chunks.length} onChange={e => pickChunk(e.target.value)}>
      <option value="">選擇段落</option>
      {chunks.map(c => <option key={c.id} value={c.id}>第 {c.ordinal} 段{c.pageStart !== null ? ` · 第 ${c.pageStart} 頁` : ''}{c.sectionPath ? ` · ${c.sectionPath}` : ''}</option>)}
    </select></label>
    <label className="field">引用原文<textarea value={quote} onChange={e => setQuote(e.target.value)} /></label>
    <p className="form-tip">最多 {LIMITS.qaCitations} 筆，同一段只能引用一次。引用原文要和段落裡的文字一字不差，可以只取其中幾句，長度 {LIMITS.quoteChars.min} 到 {LIMITS.quoteChars.max} 個字。</p>
    {problem && <p className="form-error" role="alert">{problem}</p>}
    <div className="actions">
      <button type="button" className="secondary" disabled={full || busy} onClick={add}>加入引用</button>
      <button type="button" className="primary" disabled={busy} onClick={() => void save()}>儲存引用</button>
    </div>
  </section>
}
