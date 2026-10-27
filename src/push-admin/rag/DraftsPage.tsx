import { useState, type FormEvent } from 'react'
import type { AdminRole } from '../auth'
import type { DraftInput, DraftKind, EntityMap, RagRepository } from './repository'
import { useResource } from './use-resource'
import { dateLabel, PageHeading, ResourceState } from './ui'
import { QaCitationsForm } from './EditorialForms'
import { DetailDialog } from './DetailDialog'

const definitions = {
  qa_entries: { title: '通用 QA', fields: [['question', '問題', 500], ['answer', '標準回答', 10000], ['source_note', '來源說明（尚待核定）', 2000]] },
  personas: { title: '人格與提示詞', fields: [['name', '人格名稱', 100], ['instruction', '人格指令', 10000], ['example', '語氣示例', 2000]] },
  prompts: { title: 'System Prompt', fields: [['name', '提示詞名稱', 100], ['content', '提示詞內容', 20000]] },
} as const
type DraftRow = EntityMap[DraftKind]
function DraftEditor({ kind, row, repo, saved, cancel, onBusy }: { kind: DraftKind; row: DraftRow | null; repo: RagRepository; saved: () => void; cancel: () => void; onBusy: (busy: boolean) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(definitions[kind].fields.map(([key]) => [key, row ? String((row as unknown as Record<string, unknown>)[key] ?? '') : ''])))
  const [enabled, setEnabled] = useState(row && 'enabled' in row ? row.enabled : false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    const input = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))
    if (definitions[kind].fields.some(([key, , max]) => !input[key] || input[key].length > max)) { setError('請完整填寫各欄位，且勿超過字數限制。'); return }
    setBusy(true); onBusy(true)
    try {
      await repo.saveDraft(kind, { ...input, ...(kind !== 'prompts' ? { enabled } : {}) } as DraftInput, row ?? undefined)
      saved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '儲存失敗，請重試。') }
    finally { setBusy(false); onBusy(false) }
  }
  return <form className="rag-panel rag-editor" onSubmit={submit} aria-label={`${definitions[kind].title}草稿編輯`}>
    <h3>{row ? '編輯草稿' : '新增草稿'}</h3>
    <fieldset disabled={busy}>{definitions[kind].fields.map(([key, label, max]) => <label key={key}>{label}{max <= 500 ? <input required maxLength={max} value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} /> : <textarea required maxLength={max} rows={5} value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} />}</label>)}
      {kind !== 'prompts' && <label className="rag-check"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />納入候選草稿（儲存不會發布）</label>}
      {error && <p role="alert" className="rag-error">{error}</p>}
      <div className="rag-actions"><button className="rag-primary" type="submit">{busy ? '儲存中…' : '儲存草稿'}</button><button type="button" onClick={cancel}>取消</button></div>
    </fieldset>
  </form>
}
export function DraftsPage({ repo, role, kind, secondary = false }: { repo: RagRepository | null; role: AdminRole; kind: DraftKind; secondary?: boolean }) {
  const resource = useResource(repo, kind)
  const [editing, setEditing] = useState<{ row: DraftRow | null } | null>(null)
  const [message, setMessage] = useState('')
  const [editorBusy, setEditorBusy] = useState(false)
  const write = role !== 'viewer' && Boolean(repo)
  return <div className={secondary ? 'rag-subsection' : undefined}>
    <PageHeading title={definitions[kind].title} secondary={secondary} description="編輯內容先保存為草稿，後續須經評測與版本發布才會用於回答。" />
    <div className="rag-actions"><button disabled={!write} onClick={() => { setEditing({ row: null }); setMessage('') }}>新增{kind === 'qa_entries' ? ' QA' : kind === 'personas' ? '人格' : '提示詞'}</button><button disabled={!repo || resource.loading} onClick={resource.reload}>重新整理</button></div>
    {message && <p role="status" className="rag-notice">{message}</p>}
    {editing && repo && write && <DetailDialog title={`${definitions[kind].title} · ${editing.row ? '編輯' : '新增'}草稿`} closeDisabled={editorBusy} onClose={() => setEditing(null)}><p className="rag-muted">關閉會捨棄尚未儲存的修改。</p><DraftEditor key={editing.row?.id ?? 'new'} kind={kind} row={editing.row} repo={repo} onBusy={setEditorBusy} cancel={() => setEditing(null)} saved={() => { setEditing(null); setMessage('草稿已儲存，尚未發布。'); resource.reload() }} /></DetailDialog>}
    <ResourceState resource={resource} empty="尚無內容，可從新增草稿開始。">{resource.data.map(row => <article key={row.id} className="rag-panel">
      <div className="rag-row"><h3>{'question' in row ? row.question : row.name}</h3><span className="rag-tag">{'enabled' in row ? row.enabled ? '候選草稿' : '停用草稿' : '草稿'}</span></div>
      <p className="rag-preserve">{'answer' in row ? row.answer : 'instruction' in row ? row.instruction : row.content}</p>
      {'source_note' in row && <p className="rag-muted">來源：{row.source_note}</p>}
      {'question' in row && repo?.v1?.editorial && <QaCitationsForm api={repo.v1.editorial} qa={row} writable={write} saved={resource.reload} />}
      {'example' in row && <blockquote>{row.example}</blockquote>}
      <div className="rag-row"><small>{dateLabel(row.updated_at)}</small><button disabled={!write} onClick={() => { setEditing({ row }); setMessage('') }}>編輯 {'question' in row ? row.question : row.name}</button></div>
    </article>)}</ResourceState>
  </div>
}
