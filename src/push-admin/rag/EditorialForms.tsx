import { useEffect, useState, type FormEvent } from 'react'
import type { Chunk, DocumentRecord, QaEntry } from './repository'
import type { EditorialRepository, SourceCitation } from './v1'

export function ClassificationForm({ api, document, saved }: { api: EditorialRepository; document: DocumentRecord; saved: () => void }) {
  const [purpose, setPurpose] = useState(document.purpose), [domain, setDomain] = useState(document.domain), [scope, setScope] = useState(document.citation_scope ?? '')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    try { await api.classify(document.id, purpose.trim(), domain.trim(), scope.trim()); setMessage('分類草稿已儲存，既有快照不受影響。'); saved() }
    catch (error) { setMessage(error instanceof Error ? error.message : '分類儲存失敗。') } finally { setBusy(false) }
  }
  return <details><summary>編輯用途、領域與引用範圍</summary><form onSubmit={submit}><fieldset disabled={busy}><label>文件用途<input required maxLength={200} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="例如：科學證據、計算依據、教學背景" /></label><label>生活領域<input required maxLength={200} value={domain} onChange={e => setDomain(e.target.value)} /></label><label>引用適用範圍<textarea maxLength={2000} value={scope} onChange={e => setScope(e.target.value)} placeholder="地區、年代、研究對象與不適用情境" /></label><button>儲存分類草稿</button></fieldset><p role="status">{message}</p></form></details>
}

export function ChunkCorrection({ api, chunk, parentId, hash, saved }: { api: EditorialRepository; chunk: Chunk; parentId: string; hash: string; saved: (id: string) => void }) {
  const [text, setText] = useState(chunk.original_text), [reason, setReason] = useState(''), [exclude, setExclude] = useState(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    try { const id = await api.correct(parentId, hash, [{ ordinal: chunk.ordinal, text, exclude }], reason.trim()); setMessage('已建立新的待審集合；未修改的向量可沿用。新集合的段落識別碼已更新，選入新快照前請重新綁定 QA 與計算引用。'); saved(id) }
    catch (error) { setMessage(error instanceof Error ? error.message : '修訂未完成。') } finally { setBusy(false) }
  }
  return <details><summary>修訂或排除此段</summary><form onSubmit={submit}><fieldset disabled={busy}>
    <p className="rag-muted">此操作建立新集合，保留原文與舊版本。修改文字後須重新向量化；長表格需由批次工具重新解析。</p>
    <label className="rag-check"><input type="checkbox" checked={exclude} onChange={e => setExclude(e.target.checked)} />從新集合排除此段</label>
    <p className="rag-explanation">{exclude ? `將在新版本中不收錄第 ${chunk.ordinal} 段。` : '將以修訂文字建立新候選版本。'} 按下「建立待審修訂版」才會儲存；不會刪除原始檔、舊段落或舊回答。新集合內所有段落都會取得新識別碼，QA 與計算引用需要重新核對。</p>
    <label>修訂文字<textarea aria-label="修訂文字" required={!exclude} disabled={exclude} maxLength={16000} rows={6} value={text} onChange={e => setText(e.target.value)} /></label>
    {!exclude && <p className="rag-muted">短段落修正限定「文件標題＋章節＋正文」合計 1,800 UTF-8 bytes；中文通常每字占 3 bytes。超過時請維護者重新分段解析，此按鈕不會自動執行 embedding。</p>}
    <label>修訂依據與原因<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><button>建立待審修訂版</button></fieldset><p role="status">{message}</p>
  </form></details>
}

export function QaCitationsForm({ api, qa, writable, saved }: { api: EditorialRepository; qa: QaEntry; writable: boolean; saved: (message: string) => void }) {
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [citations, setCitations] = useState<SourceCitation[]>([]), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [message, setMessage] = useState('')
  useEffect(() => { if (!open) return; const controller = new AbortController(); setLoaded(false)
    api.qaCitations(qa.id, controller.signal).then(value => { if (!controller.signal.aborted) { setCitations(value); setLoaded(true); setDirty(false); setMessage('') } }).catch(() => { if (!controller.signal.aborted) setMessage('無法讀取引用，請重新整理後再編輯。') })
    return () => controller.abort()
  }, [api, qa.id, qa.updated_at, open])
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('')
    try { await api.saveQaCitations(qa.id, qa.updated_at, citations); setDirty(false); const result = citations.length ? '引用逐字核對通過，QA 仍待版本審核。' : '引用已清空；加入知識版本前至少補上一筆有效引用。'; setMessage(result); saved(result) }
    catch (error) { setMessage(error instanceof Error ? error.message : '引用核對未完成。') } finally { setBusy(false) }
  }
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary>核對 QA 引用（{loaded ? `${citations.length} / 5` : '展開讀取'}）</summary><form onSubmit={submit}>
    <p className="rag-muted">從「文件與段落」取得段落識別碼，貼上原文摘錄。伺服器會核對逐字引用，建立快照時還會核對所選文件版本。</p>
    <p className="rag-explanation">「移除引用」只移除這則 QA 的一筆來源。按「儲存並核對引用」才生效，不刪除文件、段落或 QA 答案。收合後重開會捨棄未存修改；加入版本至少需要 1 筆有效引用。</p>
    {dirty && <p className="rag-draft-notice" role="status">引用清單尚未儲存。</p>}
    <fieldset onChange={() => setDirty(true)} disabled={!writable || busy || !loaded}>{citations.map((c, i) => <div className="rag-citation-editor" key={i}>
      <h3>引用 {i + 1} · 這則 QA 的來源</h3>
      <label>段落識別碼<input required value={c.chunk_id} onChange={e => setCitations(values => values.map((v, j) => j === i ? { ...v, chunk_id: e.target.value.trim() } : v))} /></label>
      <label>逐字摘錄<textarea required minLength={5} maxLength={800} value={c.quote} onChange={e => setCitations(values => values.map((v, j) => j === i ? { ...v, quote: e.target.value } : v))} /></label>
      <button type="button" onClick={() => { setCitations(values => values.filter((_, j) => j !== i)); setDirty(true); setMessage('') }}>移除引用 {i + 1}</button>
    </div>)}{loaded && !citations.length && <p>目前沒有引用；可先保存空草稿，補齊來源後才能加入版本。</p>}<div className="rag-actions"><button type="button" disabled={citations.length >= 5} onClick={() => { setCitations(values => [...values, { chunk_id: '', quote: '' }]); setDirty(true) }}>新增引用</button><button className="rag-primary">儲存並核對引用</button></div></fieldset><p role="status">{message}</p>
  </form></details>
}
