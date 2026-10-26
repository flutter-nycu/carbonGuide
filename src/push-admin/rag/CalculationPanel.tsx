import { useEffect, useState, type FormEvent } from 'react'
import type { AdminRole } from '../auth'
import type { CalculationDraft, CoefficientRow, EditorialRepository } from './v1'

type Citation = { chunk_id: string; quote: string } | { coefficient_id: string; raw_sha256: string }
type Tier = { up_to_kwh: number | null; rate: number }
const decimal = (value: string) => /^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value) && Number(value) <= 1000000

function CalculationEditor({ api, draft, seed, done }: { api: EditorialRepository; draft: CalculationDraft | null; seed: CoefficientRow | null; done: () => void }) {
  const d = draft?.definition ?? {}
  const [kind, setKind] = useState<'coefficient' | 'electricity'>(draft?.kind ?? 'coefficient')
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(['name', 'region', 'scope', 'notes', 'valid_from', 'valid_until', 'input_unit', 'value'].map(key => [key, String(d[key] ?? (key === 'name' ? seed?.name ?? '' : key === 'value' ? seed?.value ?? '' : ''))])))
  const [citations, setCitations] = useState<Citation[]>((d.citations as Citation[] | undefined) ?? (seed ? [{ coefficient_id: seed.id, raw_sha256: seed.raw_sha256 }] : [{ chunk_id: '', quote: '' }]))
  const [tiers, setTiers] = useState<Tier[]>((d.tiers as Tier[] | undefined) ?? [{ up_to_kwh: null, rate: 0 }])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const update = (key: string, value: string) => setFields(old => ({ ...old, [key]: value }))
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (kind === 'coefficient' && !decimal(fields.value)) { setError('係數須為 0 至 1,000,000，最多 8 位小數。'); return }
    const definition = { name: fields.name, region: fields.region, scope: fields.scope, notes: fields.notes,
      valid_from: fields.valid_from, valid_until: fields.valid_until, citations,
      ...(kind === 'coefficient' ? { value: Number(fields.value), input_unit: fields.input_unit, output_unit: 'kgCO2e' } : { currency: 'TWD', period: 'month', tiers }) }
    setBusy(true); setError('')
    try { await api.saveCalculation(draft?.id ?? null, draft?.updated_at ?? null, kind, definition); done() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '無法儲存。') }
    finally { setBusy(false) }
  }
  return <form onSubmit={save} aria-label="計算資料草稿"><fieldset disabled={busy}><h3>{draft ? '編輯' : '新增'}計算草稿</h3>
    <label>計算方式<select disabled={!!seed} value={kind} onChange={e => { setKind(e.target.value as typeof kind); setCitations([{ chunk_id: '', quote: '' }]) }}><option value="coefficient">活動量 × 排放係數</option><option value="electricity">非時間電價級距</option></select></label>
    <div className="rag-form-grid">{([['name', '名稱', 200], ['region', '適用地區', 100], ['scope', '適用活動與限制', 1000], ['notes', '來源年份、單位核對與假設', 2000]] as const).map(([key, label, max]) => <label key={key}>{label}<input required maxLength={max} value={fields[key]} onChange={e => update(key, e.target.value)} /></label>)}
      <label>有效起日<input type="date" required min="2000-01-01" max="2099-12-31" value={fields.valid_from} onChange={e => update('valid_from', e.target.value)} /></label><label>有效迄日<input type="date" required min={fields.valid_from || '2000-01-01'} max="2099-12-31" value={fields.valid_until} onChange={e => update('valid_until', e.target.value)} /></label>
    </div>
    {kind === 'coefficient' ? <div className="rag-form-grid"><label>係數（kgCO2e / 活動量單位）<input required inputMode="decimal" value={fields.value} onChange={e => update('value', e.target.value)} /></label><label>活動量單位<select required value={fields.input_unit} onChange={e => update('input_unit', e.target.value)}><option value="">請核對原始單位</option>{['kWh', 'km', 'kg', 'L', 'm3', 'item'].map(u => <option key={u}>{u}</option>)}</select></label></div> : <>
      <p>每月累進級距，費率為 TWD/kWh；最後一級無上限。僅支援完整 1 或 2 個曆月的流動電費差額。</p>
      {tiers.map((tier, i) => <div className="rag-form-grid" key={i}><label>第 {i + 1} 級每月累計上限（kWh）<input type="number" min="0.00000001" max="1000000" step="0.00000001" required={i < tiers.length - 1} disabled={i === tiers.length - 1} placeholder="無上限" value={tier.up_to_kwh ?? ''} onChange={e => setTiers(tiers.map((t, n) => n === i ? { ...t, up_to_kwh: e.target.valueAsNumber } : t))} /></label><label>第 {i + 1} 級費率<input type="number" required min="0" max="100" step="0.00000001" value={Number.isFinite(tier.rate) ? tier.rate : ''} onChange={e => setTiers(tiers.map((t, n) => n === i ? { ...t, rate: e.target.valueAsNumber } : t))} /></label></div>)}
      <div className="rag-actions"><button type="button" disabled={tiers.length >= 12} onClick={() => setTiers([...tiers.map((t, i) => i === tiers.length - 1 ? { ...t, up_to_kwh: 0 } : t), { up_to_kwh: null, rate: 0 }])}>增加級距</button><button type="button" disabled={tiers.length <= 1} onClick={() => setTiers(tiers.slice(0, -1).map((t, i) => i === tiers.length - 2 ? { ...t, up_to_kwh: null } : t))}>移除最後級距</button></div>
    </>}
    <h4>可核對的來源</h4>{citations.map((c, i) => 'coefficient_id' in c ? <p key={i}>原始係數列 {c.coefficient_id}<br /><small>原始內容 SHA-256：{c.raw_sha256}</small></p> : <div key={i}><label>來源段落 ID<input required value={c.chunk_id} onChange={e => setCitations(citations.map((x, n) => n === i ? { ...c, chunk_id: e.target.value } : x))} /></label><label>逐字摘錄（包含數值與單位）<textarea required minLength={5} maxLength={800} value={c.quote} onChange={e => setCitations(citations.map((x, n) => n === i ? { ...c, quote: e.target.value } : x))} /></label></div>)}
    <div className="rag-actions"><button type="button" disabled={citations.length >= 6} onClick={() => setCitations([...citations, { chunk_id: '', quote: '' }])}>增加來源</button><button type="button" disabled={citations.length <= 1} onClick={() => setCitations(citations.slice(0, -1))}>移除最後來源</button></div>
    {seed && <p className="rag-notice">原始單位：{seed.unit ?? '未知'}。請自行核對是否確實為 kgCO2e／所選單位；系統不會自動換算或核准。</p>}
    {error && <p role="alert" className="rag-error">{error}</p>}<button className="rag-primary">儲存待審草稿</button> <button type="button" onClick={done}>取消</button>
  </fieldset></form>
}

export function CalculationPanel({ api, role }: { api: EditorialRepository; role: AdminRole }) {
  const [drafts, setDrafts] = useState<CalculationDraft[]>([]), [rows, setRows] = useState<CoefficientRow[]>([])
  const [offset, setOffset] = useState(0), [draftOffset, setDraftOffset] = useState(0), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<{ draft: CalculationDraft | null; seed: CoefficientRow | null } | null>(null)
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [showRows, setShowRows] = useState(false)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('')
    Promise.all([api.calculations(draftOffset, controller.signal), showRows ? api.coefficients(offset, query) : Promise.resolve([])]).then(([values, coefficients]) => {
      if (!controller.signal.aborted) { setDrafts(values); setRows(coefficients) }
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '讀取失敗。') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [api, offset, draftOffset, query, revision, showRows])
  const writable = role !== 'viewer'
  useEffect(() => { if (!writable) setEditing(null) }, [writable])
  return <section className="rag-panel"><h2>排放係數與電價草稿</h2><p>建立有來源、有效期間和單位的候選計算資料，再於知識版本中選取。儲存不代表核准或發布。</p>
    {error && <p role="alert" className="rag-error">{error}</p>}
    <div className="rag-actions"><button disabled={!writable || !!editing} onClick={() => setEditing({ draft: null, seed: null })}>新增計算資料</button><button disabled={loading} onClick={() => setRevision(n => n + 1)}>重新讀取計算資料</button></div>
    {writable && editing && <CalculationEditor key={editing.draft?.id ?? editing.seed?.id ?? 'new'} api={api} {...editing} done={() => { setEditing(null); setRevision(n => n + 1) }} />}
    {drafts.map(d => <article className="rag-subsection" key={d.id}><h3>{String(d.definition.name)}</h3><p>{d.kind === 'electricity' ? '電價級距' : '排放係數'} · {String(d.definition.region)} · {String(d.definition.valid_from)} 至 {String(d.definition.valid_until)}</p><p>{String(d.definition.scope)}</p><button disabled={!writable || !!editing} onClick={() => setEditing({ draft: d, seed: null })}>編輯 {String(d.definition.name)}</button><details><summary>查看計算資料與來源</summary><pre>{JSON.stringify(d.definition, null, 2)}</pre></details></article>)}
    {!loading && !drafts.length && <p>尚無計算草稿。</p>}<div className="rag-actions"><button disabled={loading || draftOffset === 0} onClick={() => setDraftOffset(n => Math.max(0, n - 50))}>上一頁計算草稿</button><button disabled={loading || drafts.length < 50} onClick={() => setDraftOffset(n => n + 50)}>下一頁計算草稿</button></div>
    <details onToggle={e => setShowRows(e.currentTarget.open)}><summary>瀏覽匯入的原始係數（尚未核准）</summary>
      <form onSubmit={e => { e.preventDefault(); setOffset(0); setQuery(search.trim()) }}><label>搜尋係數名稱<input maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /></label><button disabled={loading}>搜尋係數</button></form>
      {rows.map(row => <article className="rag-subsection" key={row.id}><h4>{row.name ?? `第 ${row.ordinal} 列`}</h4><p>{row.value ?? '未能解析數值'} {row.unit ?? '單位未明'}</p><details><summary>原始欄位與問題</summary><pre>{JSON.stringify({ raw: row.raw, issues: row.issues }, null, 2)}</pre></details><button disabled={!writable || !!editing || row.value === null} onClick={() => setEditing({ draft: null, seed: row })}>以這筆原始資料建立草稿</button></article>)}
      <div className="rag-actions"><button disabled={loading || offset === 0} onClick={() => setOffset(n => Math.max(0, n - 50))}>上一頁係數</button><button disabled={loading || rows.length < 50} onClick={() => setOffset(n => n + 50)}>下一頁係數</button></div>
    </details>
  </section>
}
