import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CalculationDraft, Campaign, RagV1Repository, Snapshot, TrialCall, TrialResult, TrialRound, TrialRequest } from './v1'
import { dateLabel } from './ui'
import { duration, usd } from './traces'
import { EvaluationPanel } from './EvaluationPanel'

const states: Record<string, string> = { reserved: '已受理', running: '處理中', answered: '已回答', abstained: '資料不足或驗證未通過', failed: '未完成', uncertain: '結果待確認', stopped: '已停止', active: '開放中', succeeded: '完成', skipped: '略過', received: '已收到回應', started: '已開始', http_error: '模型服務拒絕' }
const nodes: Record<string, string> = { snapshot_and_access: '版本與權限', scope_guard: '服務範圍', verified_qa: '通用 QA', query_embedding: '問句向量化', hybrid_retrieval: '混合檢索', rewrite: '問句改寫', rewritten_embedding: '改寫後向量化', rewritten_retrieval: '再次檢索', context_selection: '引用內容選擇', answer: '模型回答', citation_and_number_validation: '引用與數值驗證', deterministic_tools: '確定性計算' }
function estimate(call: TrialCall): number | null {
  if (call.status !== 'received') return null
  const u = call.usage
  if (call.model === 'gemini-embedding-001') return Number.isFinite(u.totalTokenCount) ? u.totalTokenCount * 0.15 / 1e6 : null
  if (!Number.isFinite(u.promptTokenCount) || !Number.isFinite(u.candidatesTokenCount)) return null
  return (u.promptTokenCount * 0.25 + (u.candidatesTokenCount + (u.thoughtsTokenCount ?? 0)) * 1.5) / 1e6
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export function TrialFlow({ result }: { result: TrialResult }) {
  const [selected, setSelected] = useState(0)
  const events = result.trace ?? [], event = events[selected], calls = result.calls
  const values = calls?.map(estimate), estimated = values?.every(v => v !== null) ? values.reduce<number>((a, n) => a + (n ?? 0), 0) : null
  const output = result.output ?? {}, answer = record(output.answer), qa = record(output.qa)
  const citations = Array.isArray(answer.citations) ? answer.citations : Array.isArray(qa.citations) ? qa.citations : []
  return <section className="rag-panel" aria-label="版本試問結果">
    <div className="rag-row"><h2>{states[result.state] ?? result.state}</h2><small>{result.id}</small></div>
    <p className="rag-muted">這是歷史測試結果，內容仍待人工審閱；不代表目前可發布或來源仍啟用。</p>
    {result.details_expired && <p>問題與回答已超過保留期限；題數與費用帳仍保留。</p>}
    {typeof answer.answer === 'string' && <p className="rag-pilot-answer">{answer.answer}</p>}
    {typeof qa.answer === 'string' && <p className="rag-pilot-answer">{qa.answer}</p>}
    {citations.map((value, i) => { const c = record(value); return <details key={i}><summary>引用 {i + 1} · {String(c.chunk_id ?? c.coefficient_id ?? '')}</summary><blockquote>{String(c.quote ?? '')}</blockquote></details> })}
    {Array.isArray(output.calculations) && output.calculations.map((value, i) => <details open key={i}><summary>計算 {i + 1} · {String(record(value).name ?? '')}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>)}
    {result.reason && <small>處理原因：{result.reason}</small>}
    <p>模型預留 {usd(calls ? calls.reduce((sum, c) => sum + Number(c.reserved_usd), 0) : null)} · 用量估算 {usd(estimated)} · 帳單金額 未知</p>
    <p className="rag-muted">預留是控制上限，不是扣款。缺少用量或結果不明時顯示未知；此處不把文件前置處理成本重複計入每題。單價版本：2026-10-26，<a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noreferrer">Google 標準文字計價</a>。</p>
    {events.length ? <><ol className="rag-pilot-flow">{events.map((e, i) => <li key={`${i}-${e.node}`}><button aria-pressed={selected === i} className={`is-${e.state}`} onClick={() => setSelected(i)}><small>{i + 1} · {states[e.state] ?? e.state}</small><strong>{nodes[e.node] ?? e.node}</strong><span>{duration(e.duration_ms)}</span></button></li>)}</ol>
      {event && <div className="rag-pilot-node"><h3>{nodes[event.node] ?? event.node}</h3><pre>{JSON.stringify(event, null, 2)}</pre></div>}</> : <p>尚未取得完成的流程。處理中或中斷的模型呼叫可由下方持久費用帳確認。</p>}
    {!!calls?.length && <details><summary>模型呼叫與費用帳（{calls.length} 筆）</summary>{calls.map(c => <p key={c.id}>{nodes[c.purpose] ?? c.purpose} · {c.model} · {states[c.status] ?? c.status} · 預留 {usd(Number(c.reserved_usd))} · 估算 {usd(estimate(c))}</p>)}</details>}
  </section>
}

export function TrialsPanel({ api, active = true }: { api: RagV1Repository; active?: boolean }) {
  const trials = api.trials!
  const [rounds, setRounds] = useState<TrialRound[]>([]), [history, setHistory] = useState<TrialRequest[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]), [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [roundId, setRoundId] = useState(''), [releaseId, setReleaseId] = useState(''), [question, setQuestion] = useState('')
  const [personaId, setPersonaId] = useState(''), [personas, setPersonas] = useState<{ id: string; name: string }[]>([])
  const [calculations, setCalculations] = useState<CalculationDraft[]>([]), [calculationId, setCalculationId] = useState('')
  const [toolInput, setToolInput] = useState<Record<string, string>>({ quantity: '', before_kwh: '', after_kwh: '', months: '1', as_of: '', period_start: '' })
  const [name, setName] = useState('管理員內容審閱'), [budget, setBudget] = useState(0.5), [limit, setLimit] = useState(20)
  const [dailyLimit, setDailyLimit] = useState(20)
  const [result, setResult] = useState<TrialResult | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false)
  const [error, setError] = useState(''), [revision, setRevision] = useState(0), [offset, setOffset] = useState(0)
  const questionKey = useRef({ value: '', key: '' }), roundKey = useRef({ value: '', key: '', expiresAt: '' })
  const mounted = useRef(true)
  const selection = useRef(0), detailController = useRef<AbortController | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selection.current++; detailController.current?.abort() } }, [])
  useEffect(() => {
    const controller = new AbortController(); setLoading(true)
    Promise.all([trials.list(controller.signal, offset), api.campaigns(controller.signal), api.versions?.versions(controller.signal)]).then(([data, budgetData, versions]) => {
      if (controller.signal.aborted) return
      setRounds(data.rounds); setHistory(data.requests); setCampaigns(budgetData); setSnapshots(versions?.snapshots ?? [])
      setRoundId(old => old || data.rounds.find(r => r.state === 'active' && Date.parse(r.expires_at) > Date.now())?.id || '')
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '讀取失敗。') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [api, trials, revision, offset])
  const round = rounds.find(r => r.id === roundId), campaign = campaigns.find(c => c.state === 'active' && Date.parse(c.expires_at) > Date.now())
  useEffect(() => {
    const controller = new AbortController(); setPersonas([]); setPersonaId(''); setCalculations([]); setCalculationId('')
    if (round && api.versions) api.versions.snapshotDetail(round.release_id, controller.signal).then(manifest => {
      if (!controller.signal.aborted && Array.isArray(manifest.personas)) setPersonas(manifest.personas.map(value => ({ id: String(record(value).id), name: String(record(value).name) })))
      if (!controller.signal.aborted && record(manifest.settings).tools_enabled === true && Array.isArray(manifest.calculations)) setCalculations(manifest.calculations as CalculationDraft[])
    }).catch(() => { if (!controller.signal.aborted) setError('無法讀取所選輪次的人格設定。') })
    return () => controller.abort()
  }, [api, round?.release_id])
  async function create(event: FormEvent) {
    event.preventDefault(); if (!campaign || busy) return
    setBusy(true); setError('')
    const fingerprint = JSON.stringify({ name, releaseId, campaignId: campaign.id, budget, limit, dailyLimit })
    if (roundKey.current.value !== fingerprint) roundKey.current = { value: fingerprint, key: crypto.randomUUID(), expiresAt: new Date(Math.min(Date.now() + 24 * 3600000, Date.parse(campaign.expires_at))).toISOString() }
    try {
      const id = await trials.create({ requestKey: roundKey.current.key, name, releaseId, campaignId: campaign.id, budgetUsd: budget, requestLimit: limit, dailyLimit, expiresAt: roundKey.current.expiresAt })
      if (mounted.current) { setRoundId(id); roundKey.current = { value: '', key: '', expiresAt: '' }; setRevision(n => n + 1) }
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '建立結果未知，請用相同設定重試查詢。') }
    finally { if (mounted.current) setBusy(false) }
  }
  async function ask(event: FormEvent) {
    event.preventDefault(); if (!round || busy) return
    const epoch = ++selection.current; detailController.current?.abort()
    const controller = new AbortController(); detailController.current = controller
    const calculation = calculations.find(c => c.id === calculationId)
    const tool_requests = calculation ? [{ calculation_id: calculation.id, input: { region: calculation.definition.region, as_of: toolInput.as_of,
      ...(calculation.kind === 'coefficient' ? { quantity: toolInput.quantity, unit: calculation.definition.input_unit } : {
        before_kwh: toolInput.before_kwh, after_kwh: toolInput.after_kwh, months: Number(toolInput.months), period_start: toolInput.period_start }) } }] : []
    const input = { question: question.trim(), persona_id: personaId || null, tool_requests }, fingerprint = JSON.stringify({ roundId, input })
    if (questionKey.current.value !== fingerprint) questionKey.current = { value: fingerprint, key: crypto.randomUUID() }
    setBusy(true); setError(''); setResult(null)
    try {
      const value = await trials.ask(roundId, questionKey.current.key, input)
      if (!mounted.current || selection.current !== epoch) return
      setResult(value)
      const detail = await trials.detail(value.id, controller.signal)
      if (mounted.current && selection.current === epoch) setResult(detail)
    } catch (reason) { if (mounted.current && selection.current === epoch) setError(`${reason instanceof Error ? reason.message : '連線結果未知。'} 相同問題再次送出會沿用同一識別碼，不會自動再扣題數。`) }
    finally { if (mounted.current) { setBusy(false); setRevision(n => n + 1) } }
  }
  async function inspect(id: string) {
    const epoch = ++selection.current; detailController.current?.abort()
    const controller = new AbortController(); detailController.current = controller
    setError(''); try { const value = await trials.detail(id, controller.signal); if (mounted.current && selection.current === epoch) setResult(value) }
    catch (reason) { if (mounted.current && selection.current === epoch) setError(reason instanceof Error ? reason.message : '無法取得紀錄。') }
  }
  const available = !!round && round.state === 'active' && Date.parse(round.expires_at) > Date.now() && round.request_count < round.request_limit && Number(round.reserved_usd) < Number(round.budget_usd)
  return <>
    <div className="rag-notice"><strong>版本試問 · 私有候選內容</strong><p>輪次綁定固定知識快照，與文件向量化、評測共用已核准預算。問題、回答與診斷保留 30 天；請勿輸入個資或秘密。離開頁面不會撤回已開始的模型呼叫。</p></div>
    {error && <p className="rag-error" role="alert">{error}</p>}
    <div className="rag-row"><p>共用預算：{campaign ? `${usd(Number(campaign.reserved_usd))} / ${usd(Number(campaign.budget_usd))} 已預留` : '目前沒有可用的共用預算'}</p><button disabled={busy || loading} onClick={() => setRevision(n => n + 1)}>重新整理輪次</button></div>
    <details className="rag-panel"><summary>建立有限試問輪次</summary><form onSubmit={create}><fieldset disabled={busy || !campaign || !snapshots.length}>
      <label>輪次名稱<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>知識版本<select required value={releaseId} onChange={e => setReleaseId(e.target.value)}><option value="">選擇已凍結快照</option>{snapshots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <div className="rag-form-grid"><label>本輪上限（USD）<input type="number" min="0.01" max={campaign ? Math.max(0, Number(campaign.budget_usd) - Number(campaign.reserved_usd)) : 0} step="0.01" required value={budget} onChange={e => setBudget(e.target.valueAsNumber)} /></label><label>本輪題數上限<input type="number" min="1" max="100" required value={limit} onChange={e => setLimit(e.target.valueAsNumber)} /></label><label>個人每日總題數上限（UTC，含其他輪次）<input type="number" min="1" max="200" required value={dailyLimit} onChange={e => setDailyLimit(e.target.valueAsNumber)} /></label></div>
      <p className="rag-muted">僅開放給目前登入的管理員，最長 24 小時。每日總數包含今天所有輪次與評測已占用的題數；若已用數超過設定，本輪也不能送出。新輪次不會清空已用題數或增加共用預算。</p><button>建立本輪試問</button>
    </fieldset></form>{!snapshots.length && <p>請先至「知識版本」凍結一個可測試的快照。</p>}</details>
    <form className="rag-panel" onSubmit={ask}><label>試問輪次<select value={roundId} disabled={busy} onChange={e => setRoundId(e.target.value)}><option value="">選擇輪次</option>{rounds.map(r => <option key={r.id} value={r.id}>{r.name} · {states[r.state] ?? r.state}</option>)}</select></label>
      {round && <p>{round.request_count} / {round.request_limit} 題 · 預留 {usd(Number(round.reserved_usd))} / {usd(Number(round.budget_usd))} · 截止 {dateLabel(round.expires_at)}</p>}
      <label>人格<select disabled={busy} value={personaId} onChange={e => setPersonaId(e.target.value)}><option value="">標準資料助理</option>{personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>問題<textarea required maxLength={2000} value={question} disabled={busy} onChange={e => setQuestion(e.target.value)} /></label>
      {!!calculations.length && <fieldset disabled={busy}><legend>以固定版本資料計算（不呼叫模型）</legend><label>計算資料<select value={calculationId} onChange={e => setCalculationId(e.target.value)}><option value="">一般知識問答</option>{calculations.map(c => <option key={c.id} value={c.id}>{String(c.definition.name)}</option>)}</select></label>
        {calculationId && (() => { const c = calculations.find(c => c.id === calculationId)!; return <><p>{String(c.definition.scope)} · {String(c.definition.region)} · {String(c.definition.valid_from)} 至 {String(c.definition.valid_until)}</p>
          <div className="rag-form-grid">{(c.kind === 'coefficient' ? [['quantity', `活動量（${String(c.definition.input_unit)}）`]] : [['before_kwh', '調整前用電量（kWh）'], ['after_kwh', '調整後用電量（kWh）']]).map(([key, label]) => <label key={key}>{label}<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,8})?" maxLength={20} value={toolInput[key]} onChange={e => setToolInput({ ...toolInput, [key]: e.target.value })} /></label>)}
            {c.kind === 'electricity' && <><label>完整曆月數<select value={toolInput.months} onChange={e => setToolInput({ ...toolInput, months: e.target.value })}><option value="1">1 個月</option><option value="2">2 個月</option></select></label><label>起算日（每月 1 日）<input type="date" required value={toolInput.period_start} onChange={e => setToolInput({ ...toolInput, period_start: e.target.value })} /></label></>}
            <label>{c.kind === 'electricity' ? '結算日（該月最後一天）' : '活動日期'}<input type="date" required min={String(c.definition.valid_from)} max={String(c.definition.valid_until)} value={toolInput.as_of} onChange={e => setToolInput({ ...toolInput, as_of: e.target.value })} /></label>
          </div></> })()}
      </fieldset>}
      <div className="rag-actions"><button className="rag-primary" disabled={busy || !available || !question.trim()}>{busy ? '正在處理，請勿重送…' : '送出或查詢相同試問'}</button>
        {round && <button type="button" disabled={busy || round.state !== 'active'} onClick={async () => { setBusy(true); try { await trials.stop(round.id); if (mounted.current) setRevision(n => n + 1) } catch { if (mounted.current) setError('未能停止輪次，請重新整理確認。') } finally { if (mounted.current) setBusy(false) } }}>停止此輪次</button>}</div>
    </form>
    {result && <><TrialFlow key={result.id} result={result} />{['reserved', 'running'].includes(result.state) && trials.abandon && <button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await trials.abandon!(result.id); await inspect(result.id) } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '尚未封存。') } finally { if (mounted.current) { setBusy(false); setRevision(n => n + 1) } } }}>封存超過 5 分鐘的中斷請求（不退款、不重跑）</button>}{!['reserved', 'running', 'uncertain'].includes(result.state) && <button disabled={busy} onClick={() => { questionKey.current = { value: '', key: '' }; setResult(null) }}>另建同題測試（下次送出會另占題數與預算）</button>}</>}
    <section className="rag-panel"><h2>版本試問與評測紀錄</h2><ul className="rag-pilot-history">{history.map(r => <li key={r.id}><span>{dateLabel(r.created_at)} · {states[r.state] ?? r.state}</span><button disabled={busy} onClick={() => void inspect(r.id)}>查看 {r.id.slice(0, 8)} 流程</button></li>)}</ul>
      <div className="rag-actions"><button disabled={loading || offset === 0} onClick={() => setOffset(n => Math.max(0, n - 50))}>上一頁</button><button disabled={loading || history.length < 50} onClick={() => setOffset(n => n + 50)}>下一頁</button></div>
    </section>
    {api.evaluation && <EvaluationPanel api={api} active={active} />}
  </>
}
