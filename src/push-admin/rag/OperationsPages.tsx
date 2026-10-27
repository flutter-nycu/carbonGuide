import { useState, type FormEvent } from 'react'
import type { AdminRole } from '../auth'
import { validateSettings, type RagRepository, type Settings, type SettingsInput } from './repository'
import { useResource } from './use-resource'
import { contentLabels, dateLabel, PageHeading, ResourceState } from './ui'
import { TraceHistory } from './TraceHistory'
import { VersionsPanel } from './VersionsPanel'
import { CalculationPanel } from './CalculationPanel'
import { CostPanel } from './CostPanel'
import { InteractionHistory } from './InteractionHistory'

export function ReleasesPage({ repo, role = 'viewer' }: { repo: RagRepository | null; role?: AdminRole }) {
  if (repo?.v1?.versions) return <><PageHeading title="知識版本" description="固定內容、執行評測，再由管理者核准並發布。" /><VersionsPanel repo={repo} role={role} /></>
  return <LegacyReleases repo={repo} />
}
function LegacyReleases({ repo }: { repo: RagRepository | null }) {
  const releases = useResource(repo, 'knowledge_releases')
  const evaluations = useResource(repo, 'evaluation_runs')
  const state = useResource(repo, 'rag_service_state')
  return <><PageHeading title="知識版本" description="檢查固定版本的內容與評測結果；發布後的快照不可修改。" />
    <p className="rag-notice">目前使用版本：{state.loading ? '讀取中' : state.error ? '讀取失敗' : !state.connected ? '尚未連線' : state.data[0]?.active_release_id ?? '尚未發布'}。發布與回滾將在版本服務完成後開放。</p>
    <div className="rag-actions"><button disabled>發布（待接通）</button><button disabled>回滾（待接通）</button><button disabled={!repo} onClick={() => { releases.reload(); evaluations.reload(); state.reload() }}>重新整理</button></div>
    <ResourceState resource={releases} empty="尚無知識版本。">{releases.data.map(release => <article key={release.id} className="rag-panel"><div className="rag-row"><h2>{release.name}</h2><span className="rag-tag">{contentLabels[release.status] ?? release.status}</span></div><small>{dateLabel(release.created_at)}</small><details><summary>查看內容快照</summary><pre>{JSON.stringify(release.manifest, null, 2)}</pre></details></article>)}</ResourceState>
    <section className="rag-panel"><h2>CLI 評測結果</h2><ResourceState resource={evaluations} empty="尚無評測報表。這不代表評測已通過。">{evaluations.data.map(run => <details key={run.id}><summary>{dateLabel(run.created_at)} · {contentLabels[run.status] ?? run.status}</summary><pre>{JSON.stringify(run.report, null, 2)}</pre></details>)}</ResourceState></section>
  </>
}
export function LogsPage({ repo, role, active = true }: { repo: RagRepository | null; role: AdminRole; active?: boolean }) {
  const runs = useResource(role === 'owner' ? repo : null, 'rag_runs')
  return <><PageHeading title="互動紀錄" description="查看試問的版本、處理結果與耗時。" />{role !== 'owner' ? <p className="rag-notice">只有管理者可查看互動紀錄。這項限制也由資料庫權限執行。</p> : <>
    {repo?.v1?.trials && <InteractionHistory api={repo.v1.trials} active={active} />}
    {repo?.v1?.trials ? <details className="rag-subsection"><summary>舊版評測追蹤（只有代碼與流程）</summary><TraceHistory repo={repo} /></details> : <TraceHistory repo={repo} />}
    <details className="rag-subsection"><summary>一般互動紀錄（不含歷史評測）</summary>
    <button onClick={runs.reload} disabled={!repo || runs.loading}>重新整理</button>
    <ResourceState resource={runs} empty="目前沒有互動紀錄。">{runs.data.map(run => <article className="rag-panel" key={run.id}><h2>{run.question}</h2><p className="rag-preserve">{run.answer ?? '沒有回答內容'}</p><small>{dateLabel(run.created_at)} · {contentLabels[run.status] ?? run.status} · {run.duration_ms === null ? '耗時未記錄' : `${run.duration_ms} ms`}</small><p className="rag-muted">知識版本：{run.release_id ?? '未指定'}</p></article>)}</ResourceState></details></>}</>
}

function SettingsForm({ value, repo, role, reload }: { value: Settings; repo: RagRepository | null; role: AdminRole; reload: () => void }) {
  const [draft, setDraft] = useState<SettingsInput>(() => ({ answer_style: value.answer_style, daily_question_limit: value.daily_question_limit, retrieval_candidates: value.retrieval_candidates, context_chunks: value.context_chunks, similarity_threshold: value.similarity_threshold, qa_threshold: value.qa_threshold, fallback_reply: value.fallback_reply }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!repo || role !== 'owner' || busy) return
    const problem = validateSettings(draft)
    if (problem) { setError(problem); return }
    setBusy(true); setError('')
    try { await repo.saveSettings(draft, value.updated_at); reload() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '儲存失敗，請重試。') }
    finally { setBusy(false) }
  }
  return <form className="rag-panel" onSubmit={save} aria-label="RAG 設定草稿">
    <h2>回答與檢索設定</h2><p className="rag-muted">這些值先保存為草稿。門檻尚未校準，需經真實題庫評測後才可發布。</p>
    <p className="rag-explanation">目前 v1 試問使用固定版本的檢索候選數、引用段落數與相似度門檻（快照上限 50 個候選、12 個脈絡）。QA 採問題完全命中；下方「QA 命中門檻」及「資料不足時的回覆」是保留草稿欄位，不會改變目前 v1 的命中方式或固定拒答。試問題數以輪次與共用預算為準。</p>
    <fieldset disabled={!repo || role !== 'owner' || busy}>
      <div className="rag-form-grid"><label>回答風格<select value={draft.answer_style} onChange={event => setDraft({ ...draft, answer_style: event.target.value as SettingsInput['answer_style'] })}><option value="concise">精簡</option><option value="standard">標準</option><option value="detailed">詳細</option></select></label>
        {([['daily_question_limit', '每人每日題數', 1, 1000, 1], ['retrieval_candidates', '檢索候選數', 1, 100, 1], ['context_chunks', '引用段落數', 1, 100, 1], ['similarity_threshold', '向量相似度門檻', 0, 1, 0.01], ['qa_threshold', 'QA 命中門檻', 0, 1, 0.01]] as const).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={step} value={Number.isNaN(draft[key]) ? '' : draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.valueAsNumber })} /></label>)}
      </div><label>資料不足時的回覆<textarea value={draft.fallback_reply} required maxLength={2000} onChange={event => setDraft({ ...draft, fallback_reply: event.target.value })} /></label>
      {error && <p role="alert" className="rag-error">{error}</p>}
      <button className="rag-primary" type="submit">{busy ? '儲存中…' : '儲存設定草稿'}</button>
    </fieldset>
    {role !== 'owner' && <p className="rag-muted">只有管理者可修改設定。</p>}
  </form>
}
export function SettingsPage({ repo, role }: { repo: RagRepository | null; role: AdminRole }) {
  const settings = useResource(repo, 'rag_service_state')
  const profiles = useResource(repo, 'embedding_profiles')
  const usage = useResource(role === 'owner' ? repo : null, 'usage_daily')
  const [saved, setSaved] = useState(false)
  return <><PageHeading title="RAG 設定" description="管理回答草稿與每日上限，查看索引設定及服務狀態。" />
    <div className="rag-summary"><section><small>公開回答服務</small><strong>{settings.loading ? '讀取中' : settings.error ? '讀取失敗' : settings.data[0]?.service_enabled ? '開啟' : settings.connected && settings.data.length ? '關閉' : '尚未取得'}</strong><p>本階段不開放啟用</p></section><section><small>今日題數（UTC）</small><strong>{role !== 'owner' ? '僅管理者可見' : usage.loading ? '讀取中' : usage.error ? '讀取失敗' : !repo ? '尚未連線' : usage.data.reduce((sum, row) => sum + row.question_count, 0)}</strong><p>一般互動用量，不含管理員小量試問</p></section><section><small>管理員 Gemini 試問</small><strong>獨立小量額度</strong><p>可用時段與剩餘題數請至「試問」查看</p></section></div>
    <button disabled={!repo || settings.loading} onClick={() => { settings.reload(); profiles.reload(); usage.reload(); setSaved(false) }}>重新讀取設定</button>
    {saved && <p role="status" className="rag-notice">設定草稿已儲存，尚未發布。</p>}
    <ResourceState resource={settings} empty="尚無服務設定，請確認基礎 migration 已完成。">{settings.data[0] && <SettingsForm key={settings.data[0].updated_at} value={settings.data[0]} repo={repo} role={role} reload={() => { setSaved(true); settings.reload() }} />}</ResourceState>
    {repo?.v1?.editorial && <CalculationPanel api={repo.v1.editorial} role={role} />}
    {role === 'owner' && repo?.v1?.operations && <CostPanel api={repo.v1} />}
    <section className="rag-panel"><h2>索引設定（唯讀）</h2><ResourceState resource={profiles} empty="尚無 embedding profile。">{profiles.data.map(profile => <p key={profile.id}>{profile.model} · {profile.dimensions.toLocaleString()} 維 · {profile.distance_metric} · {profile.chunker_version}</p>)}</ResourceState><p className="rag-muted">更換 profile 須建立新版本、重算向量並重新評測。v1 回答契約使用 gemini-3.1-flash-lite；模型與契約以所選快照為準。</p></section>
    <section className="rag-panel"><h2>進階回答能力</h2><label className="rag-check"><input type="checkbox" disabled checked={settings.data[0]?.rewrite_enabled ?? false} readOnly />檢索不足時改寫重查（最多一次）</label><label className="rag-check"><input type="checkbox" disabled checked={settings.data[0]?.tools_enabled ?? false} readOnly />工具呼叫（每題最多 3 次）</label><p className="rag-muted">兩項預設關閉，須通過比較評測後才可開啟。</p></section>
  </>
}
