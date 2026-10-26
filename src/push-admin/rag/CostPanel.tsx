import { useEffect, useState } from 'react'
import type { Campaign, OperationSummary, RagV1Repository } from './v1'
import { parseBills, type BillInput } from './billing'
import { usd } from './traces'
import { dateLabel } from './ui'

export function CostPanel({ api }: { api: RagV1Repository }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]), [id, setId] = useState(''), [summary, setSummary] = useState<OperationSummary | null>(null)
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [imported, setImported] = useState<{ rows: BillInput[]; hash: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    api.campaigns(controller.signal).then(rows => { if (!controller.signal.aborted) { setCampaigns(rows); setId(old => old || rows[0]?.id || '') } }).catch(() => { if (!controller.signal.aborted) setError('無法讀取共用預算。') })
    return () => controller.abort()
  }, [api, revision])
  useEffect(() => {
    let active = true; setSummary(null)
    if (id) api.operations!.summary(id).then(data => { if (active) setSummary(data) }).catch(() => { if (active) setError('無法讀取費用與健康狀態。') })
    return () => { active = false }
  }, [api, id, revision])
  const campaign = campaigns.find(c => c.id === id), totals = summary?.groups.reduce((a, g) => ({ known: a.known + Number(g.known_estimated_usd ?? 0), unknown: a.unknown + Number(g.unknown_cost_calls) }), { known: 0, unknown: 0 })
  async function fileSelected(file?: File) {
    setImported(null); setError(''); if (!file) return
    try {
      if (file.size > 65536) throw new Error('帳單檔案上限為 64 KiB。')
      const bytes = await file.arrayBuffer(), rows = parseBills(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
      setImported({ rows, hash })
    } catch (reason) { setError(reason instanceof Error ? reason.message : '帳單格式不符。') }
  }
  return <section className="rag-panel"><h2>共用預算、費用與維護</h2><label>預算活動<select value={id} onChange={e => { setId(e.target.value); setImported(null) }}>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {error && <p role="alert" className="rag-error">{error}</p>}
    {campaign && <><p>安全預留 {usd(Number(campaign.reserved_usd))} / 上限 {usd(Number(campaign.budget_usd))} · {campaign.call_count} / {campaign.call_limit} 次模型呼叫 · 截止 {dateLabel(campaign.expires_at)}</p>
      {Number(campaign.reserved_usd) >= Number(campaign.budget_usd) * .8 && <p className="rag-notice">已預留超過 80% 的額度。請檢查剩餘工作；建立新輪次不會增加共用預算。</p>}
      <button disabled={busy || campaign.state !== 'active'} onClick={async () => { setBusy(true); setError(''); try { await api.stopCampaign(id); setRevision(n => n + 1) } catch { setError('停止結果尚未確認，請重新整理。') } finally { setBusy(false) } }}>停止這個共用預算的後續呼叫</button>
    </>}
    <button disabled={busy} onClick={() => { setError(''); setRevision(n => n + 1) }}>重新整理費用與狀態</button>
    {summary && <><p>已知用量估算 {usd(totals?.known ?? null)}；{totals?.unknown} 次費用未知。已匯入帳單 {summary.bills.length ? usd(summary.bills.reduce((a, b) => a + Number(b.amount_usd), 0)) : '未知'}。</p>
      <p className="rag-muted">文件準備費用獨立列出。用量估算依 {summary.pricing_version}；未知用量不當作零。帳單只反映已匯入期間，不按問題攤提；預付儲值金額不能當作模型花費。</p>
      <div className="rag-table-scroll"><table><thead><tr><th>用途／模型</th><th>呼叫數</th><th>預留</th><th>已知估算</th><th>未知／失敗或不明／處理中</th></tr></thead><tbody>{summary.groups.map(g => <tr key={`${g.origin}-${g.model}-${g.purpose}`}><td>{({ preparation: '文件準備', query: '管理員試問', evaluation: '自動評測' } as Record<string, string>)[g.origin] ?? g.origin} · {g.purpose}<br />{g.model}</td><td>{g.calls}</td><td>{usd(Number(g.reserved_usd))}</td><td>{usd(g.known_estimated_usd === null ? null : Number(g.known_estimated_usd))}</td><td>{g.unknown_cost_calls}／{g.failed_or_uncertain}／{g.pending_calls}</td></tr>)}</tbody></table></div>
      <details><summary>維護狀態與待處理項目</summary><p>過期處理租約 {Number(summary.health.expired_worker_leases)}；失敗或不明工作 {Number(summary.health.unresolved_jobs)}；超過 5 分鐘未結束的試問 {Number(summary.health.stale_requests)}；待清理過期細節 {Number(summary.health.expired_details)}。</p><p>結果不明時先查原請求，勿自動重送。診斷每小時限量清理，題數與費用帳持續保留。</p><pre>{JSON.stringify(summary.health.retention, null, 2)}</pre></details>
      <details><summary>匯入與核對 Google 實際帳單</summary><p>先將帳單篩選為這個活動的模型費用、轉為 USD，再匯出以下欄位。期間使用 UTC，結束時間不含在內。每列單獨確認，資料不可覆寫。</p><pre>reference,period_start,period_end,amount_usd</pre><label>帳單 CSV<input type="file" accept=".csv,text/csv" disabled={busy || !id} onChange={e => void fileSelected(e.target.files?.[0])} /></label>
        {imported?.rows.map(row => <article className="rag-subsection" key={row.reference}><p>{row.reference} · {dateLabel(row.periodStart)} 至 {dateLabel(row.periodEnd)} · {usd(row.amountUsd)}</p><button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api.operations!.recordBill(id, row, imported.hash); setImported(old => old ? { ...old, rows: old.rows.filter(r => r.reference !== row.reference) } : null); setRevision(n => n + 1) } catch (reason) { setError(reason instanceof Error ? reason.message : '帳單未記錄。') } finally { setBusy(false) } }}>確認這筆活動費用</button></article>)}
        {summary.bills.map(b => <p key={b.id}>{b.provider_reference} · {dateLabel(b.period_start)} 至 {dateLabel(b.period_end)} · {usd(Number(b.amount_usd))}</p>)}
      </details>
    </>}
  </section>
}
