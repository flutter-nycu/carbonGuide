import { useState, type FormEvent } from 'react'
import { messageFor, toRagError } from '../api/errors'
import { requestKeyFor, settleRequestKey } from '../api/requestKeys'
import type { KnowledgeVersion, RagApi, Role } from '../api/types'
import { useLoader } from '../hooks'
import { formatDate } from '../labels'
import { Dialog, LoadError, Notice, useToast, type PageProps } from '../ui'

const REVIEW_LABEL: Record<KnowledgeVersion['review'], string> = { awaiting: '待審核', approved: '已核准', rejected: '已退回' }
const REVIEW_TONE: Record<KnowledgeVersion['review'], string> = { awaiting: 'warn', approved: '', rejected: 'error' }
const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)

/** The publishing conditions the backend checks, in plain words. */
export function publishChecks(version: KnowledgeVersion): { label: string; met: boolean }[] {
  const { gate, review } = version
  const reviewed = { met: review === 'approved', label: review === 'approved' ? '人工審核已核准' : review === 'rejected' ? '人工審核已退回' : '還沒通過人工審核' }
  if (!gate.evaluated) return [reviewed, { met: false, label: '還沒跑自動測驗' }]
  return [
    reviewed,
    { met: gate.caseCount >= 40, label: `驗收題組至少 40 題，這次 ${gate.caseCount} 題` },
    { met: gate.caseCount > 0 && gate.passedCount === gate.caseCount, label: `每一題都通過，這次 ${gate.passedCount}／${gate.caseCount}` },
    { met: (gate.recallAt5 ?? 0) >= 0.9, label: `找到正確來源 90% 以上，這次 ${percent(gate.recallAt5)}` },
    { met: (gate.citationValidity ?? 0) >= 0.95, label: `引用能支持回答 95% 以上，這次 ${percent(gate.citationValidity)}` },
  ]
}

export default function ReleasesPage({ api, role }: PageProps) {
  const owner = role === 'owner'
  const toast = useToast()
  const versions = useLoader(() => api.listVersions())
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const list = versions.data ?? []

  async function create(event: FormEvent) {
    event.preventDefault()
    const value = name.trim()
    if (!value || value.length > 100) { setProblem(messageFor('invalid_snapshot')); return }
    setBusy(true)
    setProblem(null)
    try {
      await api.createVersion(value, requestKeyFor('version', { name: value }))
      settleRequestKey('version', { name: value })
      setName('')
      toast(`已建立「${value}」。通過自動測驗和審核後就能發布。`)
      await versions.reload()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  return <>
    {versions.error && <LoadError message={versions.error} onRetry={() => void versions.reload()} />}
    {!owner && <Notice>只有管理者可以建立、審核和發布版本。</Notice>}
    <div className="grid">
      <section className="panel">
        <h2>建立版本</h2>
        <p className="muted">把下面這些內容打包成一個版本：</p>
        <ul className="release-manifest">
          <li>整理好的文件</li>
          <li>啟用中的人格、人工標準答案，以及引用核對過的文件型問答</li>
          <li>目前的回答規則和搜尋設定</li>
        </ul>
        <form onSubmit={event => void create(event)}>
          <label className="field">版本名稱<input value={name} maxLength={100} disabled={!owner} placeholder="例如：2026-12 冬季版" onChange={event => setName(event.target.value)} /></label>
          <button type="submit" className="primary" disabled={!owner || busy}>建立版本</button>
        </form>
        {problem && <p className="form-error" role="alert">{problem}</p>}
        <p className="caption">建立後內容就固定了。之後再改文件、人格、問答或設定，要再建立新版本。</p>
      </section>
      <section className="panel">
        <h2>版本紀錄</h2>
        <div className="table-wrap compact"><table aria-label="版本列表">
          <thead><tr><th>版本</th><th>審核</th><th>自動測驗</th><th><span className="sr-only">操作</span></th></tr></thead>
          <tbody>
            {list.map(v => <tr key={v.id}>
              <td><strong>{v.name}</strong>{v.isActive && <> <span className="tag">使用中</span></>}<small>{formatDate(v.createdAt)} · {v.documentCount} 份文件</small></td>
              <td><span className={`tag ${REVIEW_TONE[v.review]}`.trim()}>{REVIEW_LABEL[v.review]}</span></td>
              <td>{v.gate.evaluated ? `${v.gate.passedCount}／${v.gate.caseCount} 題通過` : '還沒測驗'}</td>
              <td><button type="button" className="text-button" aria-label={`檢視 ${v.name}`} onClick={() => setOpenId(v.id)}>檢視</button></td>
            </tr>)}
            {versions.data && !list.length && <tr><td colSpan={4}><div className="empty">還沒有版本。</div></td></tr>}
          </tbody>
        </table></div>
        <p className="scroll-hint">表格可以左右滑動</p>
      </section>
    </div>
    <Dialog open={openId !== null} title="版本詳情" onClose={() => setOpenId(null)}>
      {openId && <VersionDetail key={openId} api={api} role={role} id={openId} onChanged={() => void versions.reload()} />}
    </Dialog>
  </>
}

function VersionDetail({ api, role, id, onChanged }: { api: RagApi; role: Role; id: string; onChanged: () => void }) {
  const owner = role === 'owner'
  const toast = useToast()
  // Read again on open, so the conditions reflect reviews and evaluations made since the list loaded.
  const versions = useLoader(() => api.listVersions())
  const qa = useLoader(() => api.getVersionQa(id))
  const [verdict, setVerdict] = useState<'approve' | 'reject' | ''>('')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const version = versions.data?.find(v => v.id === id)
  if (!version) {
    if (versions.error) return <Notice tone="error">{versions.error}</Notice>
    return versions.data ? <Notice tone="error">{messageFor('not_found')}</Notice> : <p className="empty" role="status">正在讀取版本…</p>
  }
  const checks = publishChecks(version)
  const ready = checks.every(c => c.met)

  async function act(kind: string, work: (key: string) => Promise<void>, done: string, payload: object) {
    setBusy(true)
    setProblem(null)
    try {
      await work(requestKeyFor(kind, payload))
      settleRequestKey(kind, payload)
      toast(done)
      setConfirmDisable(false)
      await versions.reload()
      onChanged()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  function review(event: FormEvent) {
    event.preventDefault()
    const text = reason.trim()
    if (!verdict) { setProblem('請選擇核准或退回。'); return }
    if (!text || text.length > 2000) { setProblem(messageFor('invalid_review')); return }
    if (!confirmed) { setProblem(messageFor('review_confirmation_required')); return }
    void act('review', key => api.reviewVersion(id, verdict, text, true, key), verdict === 'approve' ? '已核准這個版本。' : '已退回這個版本。', { id, verdict, reason: text })
  }

  return <>
    <div className="section-head"><h3>{version.name}</h3>
      <span className={`tag ${REVIEW_TONE[version.review]}`.trim()}>{REVIEW_LABEL[version.review]}</span></div>
    <dl className="metadata">
      <dt>建立時間</dt><dd>{formatDate(version.createdAt)}</dd>
      <dt>文件數</dt><dd>{version.documentCount} 份</dd>
      <dt>目前狀態</dt><dd>{version.isActive ? 'App 的教練正在用這個版本' : version.wasPublished ? '發布過，現在沒有使用' : '還沒發布'}</dd>
    </dl>
    <h3>已收錄常見問答</h3>
    {qa.error && <LoadError message={qa.error} onRetry={() => void qa.reload()} />}
    {!qa.data && qa.loading && <p role="status">正在讀取版本問答…</p>}
    {qa.data && (qa.data.length ? <ul className="release-manifest" aria-label="已收錄常見問答">
      {qa.data.map(entry => <li key={entry.id}><strong>{entry.question}</strong><p>{entry.answer}</p>
        <small>來源：{entry.manualAnswer ? '管理者提供' : '文件引用'}</small></li>)}
    </ul> : <p className="small-note">這個版本沒有收錄常見問答。</p>)}
    <h3>發布條件</h3>
    <ul className="checklist" aria-label="發布條件">
      {checks.map(c => <li key={c.label}>{c.label}<span className={c.met ? 'tag' : 'tag warn'}>{c.met ? '已符合' : '還沒符合'}</span></li>)}
    </ul>
    {problem && <p className="form-error" role="alert">{problem}</p>}
    <div className="actions">
      <button type="button" className="primary" disabled={!owner || busy || !ready || version.isActive}
        onClick={() => void act('publish', key => api.publishVersion(id, key), `已發布「${version.name}」。`, { id })}>發布這個版本</button>
      {owner && version.wasPublished && !version.isActive && <button type="button" className="secondary" disabled={busy}
        onClick={() => void act('rollback', key => api.rollbackVersion(id, key), `已改回「${version.name}」。`, { id })}>改回這個版本</button>}
      {owner && version.isActive && !confirmDisable && <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmDisable(true)}>停用這個版本</button>}
    </div>
    {!ready && <p className="caption">條件都符合才能發布。</p>}
    {confirmDisable && <Notice tone="warn">
      停用後，App 的教練會暫時沒有版本可用，直到發布或改回另一個版本。
      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void act('disable', key => api.disableVersion(key), '已停用目前的版本。', { id })}>確定停用</button>
        <button type="button" className="secondary" onClick={() => setConfirmDisable(false)}>取消</button>
      </div>
    </Notice>}
    {owner && <form className="panel stack" onSubmit={review}>
      <h3>審核</h3>
      <fieldset className="choice-row">
        <legend className="sr-only">審核結果</legend>
        <label className="check-label"><input type="radio" name="verdict" checked={verdict === 'approve'} onChange={() => setVerdict('approve')} />核准</label>
        <label className="check-label"><input type="radio" name="verdict" checked={verdict === 'reject'} onChange={() => setVerdict('reject')} />退回</label>
      </fieldset>
      <label className="field">審核意見<textarea value={reason} maxLength={2000} placeholder="寫下看過哪些內容、為什麼核准或退回" onChange={event => setReason(event.target.value)} /></label>
      <label className="check-label"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />已核對版本內容和測驗結果</label>
      <button type="submit" className="secondary" disabled={busy}>送出審核</button>
    </form>}
  </>
}
