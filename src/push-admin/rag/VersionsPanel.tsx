import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AdminRole } from '../auth'
import type { RagRepository } from './repository'
import type { Snapshot, SnapshotSelection, VersionData, VersionRepository } from './v1'
import { useResource } from './use-resource'
import { dateLabel } from './ui'
import { QualityNotice } from './QualityNotice'

const initialSelection: SnapshotSelection = { chunk_set_ids: [], qa_ids: [], persona_ids: [], calculation_ids: [], prompt_id: '', rewrite_enabled: false, tools_enabled: false }
function toggled(list: string[], id: string) { return list.includes(id) ? list.filter(value => value !== id) : [...list, id] }

function SnapshotContent({ snapshot, repository }: { snapshot: Snapshot; repository: VersionRepository }) {
  const [manifest, setManifest] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    repository.snapshotDetail(snapshot.id, controller.signal).then(value => { if (!controller.signal.aborted) setManifest(value) })
      .catch(() => { if (!controller.signal.aborted) setError('無法取得快照內容，請關閉後重新開啟。') })
    return () => controller.abort()
  }, [repository, snapshot.id])
  const documents = Array.isArray(manifest?.documents) ? manifest.documents as Record<string, unknown>[] : []
  return <section aria-label="固定版本內容"><p>SHA-256：<code>{snapshot.manifest_hash}</code></p>
    {error && <p role="alert">{error}</p>}{!manifest && !error && <p role="status">讀取快照…</p>}
    {manifest && <><details><summary>包含的來源（{documents.length} 份）與品質警示</summary><ul>{documents.map((doc, i) => <li key={i}><strong>{String(doc.title)}</strong> · {String(doc.chunk_count)} 段 · {String(doc.content_status)}<br /><small>內容指紋 {String(doc.content_hash)}</small>{doc.quality && typeof doc.quality === 'object' && !Array.isArray(doc.quality) ? <QualityNotice quality={doc.quality as Record<string, unknown>} /> : null}</li>)}</ul></details>
      <p>QA：{Array.isArray(manifest.qa) ? manifest.qa.length : 0} 則；人格：{Array.isArray(manifest.personas) ? manifest.personas.length : 0} 個；計算資料：{Array.isArray(manifest.calculations) ? manifest.calculations.length : 0} 組。</p>
      <details><summary>檢查完整內容、設定與計算來源</summary><pre>{JSON.stringify(manifest, null, 2)}</pre></details></>}
  </section>
}

export function VersionsPanel({ repo, role }: { repo: RagRepository; role: AdminRole }) {
  const repository = repo.v1!.versions!
  const [data, setData] = useState<VersionData | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [selection, setSelection] = useState<SnapshotSelection>(initialSelection)
  const [selectedId, setSelectedId] = useState('')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const pending = useRef<{ payload: string; key: string } | null>(null)
  const settings = useResource(repo, 'rag_service_state')
  const qa = useResource(repo, 'qa_entries'), personas = useResource(repo, 'personas'), prompts = useResource(repo, 'prompts')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    repository.versions(controller.signal).then(value => { if (!controller.signal.aborted) setData(value) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '版本資料讀取失敗。') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [repository, revision])
  function reload() { setRevision(n => n + 1); settings.reload() }
  async function perform(payload: unknown, operation: (key: string) => Promise<void>, success: string) {
    if (busy) return
    const encoded = JSON.stringify(payload)
    if (pending.current?.payload !== encoded) pending.current = { payload: encoded, key: crypto.randomUUID() }
    setBusy(true); setError(''); setMessage('')
    try { await operation(pending.current.key); pending.current = null; setMessage(success); reload() }
    catch (failure) { setError(failure instanceof Error ? failure.message : '操作失敗，輸入已保留。') }
    finally { setBusy(false) }
  }
  function create(event: FormEvent) {
    event.preventDefault()
    if (role === 'viewer' || !name.trim() || !selection.prompt_id || !selection.chunk_set_ids.length) return
    void perform({ name, selection }, async key => { setSelectedId(await repository.createSnapshot(name, selection, key)); setConfirmed(false) }, '版本快照已固定，接下來可執行評測；內容尚未核准。')
  }
  const selected = data?.snapshots.find(snapshot => snapshot.id === selectedId)
  const activeId = settings.data[0]?.active_release_id ?? null
  const latestReview = data?.reviews.find(review => review.release_id === selectedId)
  const evaluations = data?.evaluations.filter(evaluation => evaluation.release_id === selectedId) ?? []
  const passed = evaluations.some(e => e.manifest_hash === selected?.manifest_hash && e.data_split === 'acceptance' && e.case_count >= 40 && e.passed_count === e.case_count && e.recall_at_5 >= 0.9 && e.citation_validity >= 0.95 && e.numerical_failures === 0 && e.unpublished_leaks === 0)
  function review(verdict: 'approve' | 'reject') {
    if (!selected || role !== 'owner' || !confirmed || !reason.trim()) return
    void perform({ id: selected.id, hash: selected.manifest_hash, verdict, reason }, key => repository.reviewSnapshot(selected.id, selected.manifest_hash, verdict, reason, key), verdict === 'approve' ? '已記錄人工核准，發布仍須通過評測。' : '已記錄退回原因。')
  }
  function activate(operation: 'publish' | 'rollback' | 'disable') {
    if (role !== 'owner' || !reason.trim() || settings.loading || settings.error || !settings.data[0] || (operation !== 'disable' && !selected)) return
    const id = operation === 'disable' ? null : selected!.id
    void perform({ id, activeId, operation, reason }, key => repository.activateSnapshot(id, activeId, operation, reason, key), '版本切換已記錄；公開回答服務仍維持關閉。')
  }
  return <>
    <div className="rag-row"><p>使用中的版本：{settings.loading ? '讀取中' : settings.error ? '讀取失敗' : activeId ? data?.snapshots.find(s => s.id === activeId)?.name ?? activeId : '尚未發布'}</p><button disabled={busy || loading} onClick={reload}>重新整理版本</button></div>
    <p className="rag-notice">送審版本固定來源、QA、人格、提示詞、檢索設定與計算資料。驗收評測至少 40 題且全部通過；檢索命中率至少 90%、引用有效率至少 95%、數值錯誤與越權引用均為 0。引用是否支持主張仍須人工核對。</p>
    {error && <p role="alert" className="rag-error">{error}</p>}{message && <p role="status" className="rag-notice">{message}</p>}
    {loading && <p role="status">讀取版本資料…</p>}
    <details className="rag-panel"><summary>建立送審版本</summary><form onSubmit={create} aria-label="建立送審版本"><fieldset disabled={role === 'viewer' || busy || loading || !data}>
      <label>版本名稱<input value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
      <label>System Prompt<select value={selection.prompt_id} required onChange={event => setSelection({ ...selection, prompt_id: event.target.value })}><option value="">請選擇已儲存的提示詞</option>{prompts.data.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {(qa.error || personas.error || prompts.error) && <p role="alert">部分草稿讀取失敗，請重新進入頁面後再建立版本。</p>}
      <fieldset><legend>已完成 embedding 的段落集合（每份文件選一個）</legend>{data?.sets.filter(set => set.embedding_state === 'ready').map(set => <div key={set.chunk_set_id}><label className="rag-check"><input type="checkbox" checked={selection.chunk_set_ids.includes(set.chunk_set_id)} onChange={() => setSelection({ ...selection, chunk_set_ids: toggled(selection.chunk_set_ids, set.chunk_set_id) })} /><span>{data.originals.find(o => o.id === set.original_id)?.source_name ?? set.original_id}<small>{set.chunk_count} 段 · 集合 {set.chunk_set_id.slice(0, 8)} · profile {set.profile_id.slice(0, 8)}</small></span></label><QualityNotice quality={set.quality} /></div>)}</fieldset>
      <fieldset><legend>納入的 QA</legend>{qa.data.filter(q => q.enabled).map(q => <label className="rag-check" key={q.id}><input type="checkbox" checked={selection.qa_ids.includes(q.id)} onChange={() => setSelection({ ...selection, qa_ids: toggled(selection.qa_ids, q.id) })} />{q.question}</label>)}<small>每則 QA 都需要已核對、且屬於所選段落的引用。</small></fieldset>
      <fieldset><legend>納入的人格</legend>{personas.data.filter(p => p.enabled).map(p => <label className="rag-check" key={p.id}><input type="checkbox" checked={selection.persona_ids.includes(p.id)} onChange={() => setSelection({ ...selection, persona_ids: toggled(selection.persona_ids, p.id) })} />{p.name}</label>)}</fieldset>
      <fieldset><legend>納入的計算資料</legend>{data?.calculations.map(c => <label className="rag-check" key={c.id}><input type="checkbox" checked={selection.calculation_ids.includes(c.id)} onChange={() => setSelection({ ...selection, calculation_ids: toggled(selection.calculation_ids, c.id) })} />{String(c.definition.name)} · {c.kind === 'electricity' ? '電費級距' : '排碳係數'}</label>)}</fieldset>
      <label className="rag-check"><input type="checkbox" checked={selection.rewrite_enabled} onChange={event => setSelection({ ...selection, rewrite_enabled: event.target.checked })} />檢索不足時改寫重查（最多一次）</label>
      <label className="rag-check"><input type="checkbox" checked={selection.tools_enabled} onChange={event => setSelection({ ...selection, tools_enabled: event.target.checked })} />確定性計算工具（最多三次）</label>
      <button type="submit" className="rag-primary" disabled={!selection.chunk_set_ids.length || !selection.prompt_id || Boolean(qa.error || personas.error || prompts.error)}>固定快照，準備評測</button>
    </fieldset></form></details>
    <section className="rag-panel"><h2>內容與審核</h2><label>知識版本<select value={selectedId} onChange={event => { setSelectedId(event.target.value); setConfirmed(false); setReason('') }}><option value="">選擇要檢視的版本</option>{data?.snapshots.map(snapshot => <option key={snapshot.id} value={snapshot.id}>{snapshot.name} · {dateLabel(snapshot.created_at)}</option>)}</select></label>
      {selected && <><SnapshotContent key={selected.id} snapshot={selected} repository={repository} /><p>人工決策：{latestReview ? latestReview.verdict === 'approve' ? '已核准' : '已退回' : '尚未審核'}；驗收評測：{passed ? '通過機械檢查' : '尚未通過'}。</p>
        {latestReview && <p>{latestReview.reason}</p>}
        <h3>評測紀錄</h3>{evaluations.length ? evaluations.map(e => <p key={e.id}>{dateLabel(e.created_at)} · {e.data_split === 'acceptance' ? '驗收題' : '開發題'} · {e.passed_count}/{e.case_count} 題 · Recall@5 {(e.recall_at_5 * 100).toFixed(1)}% · 引用有效率 {(e.citation_validity * 100).toFixed(1)}%</p>) : <p>尚無此版本的評測。請先執行版本化評測。</p>}
        <fieldset disabled={role !== 'owner' || busy}><label>審核或切換原因<textarea value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} /></label>
          <label className="rag-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />我已核對這個版本及其評測，包括來源、數字、單位與適用範圍。</label>
          <div className="rag-actions"><button disabled={!confirmed || !reason.trim()} onClick={() => review('approve')}>記錄人工核准</button><button disabled={!confirmed || !reason.trim() || activeId === selected.id} onClick={() => review('reject')}>退回修改</button>
            <button disabled={!reason.trim() || !passed || latestReview?.verdict !== 'approve' || Boolean(settings.error) || settings.loading} onClick={() => activate('publish')}>發布此版本</button>
            <button disabled={!reason.trim() || !passed || latestReview?.verdict !== 'approve' || !data?.publications.some(p => p.release_id === selected.id && p.action !== 'disable') || Boolean(settings.error) || settings.loading} onClick={() => activate('rollback')}>回滾至此版本</button>
            <button disabled={!reason.trim() || !activeId || Boolean(settings.error) || settings.loading} onClick={() => activate('disable')}>停用目前版本</button></div>
        </fieldset></>}
      {!data?.snapshots.length && !loading && <p>尚無送審快照。</p>}
    </section>
    <details className="rag-panel"><summary>發布與回滾紀錄</summary>{data?.publications.map(p => <p key={p.id}>{dateLabel(p.created_at)} · {p.action} · {p.release_id ?? '停用'} · {p.reason}</p>)}</details>
  </>
}
