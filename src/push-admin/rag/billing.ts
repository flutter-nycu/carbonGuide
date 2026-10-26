export interface BillInput { reference: string; periodStart: string; periodEnd: string; amountUsd: number }
/** Small normalized import format; provider exports must be filtered to this campaign first. */
export function parseBills(text: string): BillInput[] {
  if (new TextEncoder().encode(text).length > 65536) throw new Error('帳單檔案上限為 64 KiB。')
  const rows: string[][] = [], row: string[] = []; let field = '', quoted = false, closed = false
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  for (let i = 0; i <= text.length; i++) {
    const c = i === text.length ? '\n' : text[i]
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true } } else field += c; continue }
    if (c === '"' && !field && !closed) { quoted = true; continue }
    if (c === ',' || c === '\n') {
      row.push(field); field = ''; closed = false
      if (c === '\n') { if (row.some(v => v !== '')) rows.push([...row]); row.length = 0 }
    } else { if (closed || c === '"' || c === '\r') throw new Error('CSV 格式不符。'); field += c }
  }
  if (quoted || rows.length < 2 || rows.length > 21 || rows[0].join(',') !== 'reference,period_start,period_end,amount_usd') throw new Error('請使用指定的 CSV 欄位，且每次匯入 1 至 20 筆。')
  const seen = new Set<string>()
  const result = rows.slice(1).map(values => {
    const [reference, periodStart, periodEnd, amount] = values
    const iso = (value: string) => /^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z')
    if (values.length !== 4 || !reference?.trim() || reference.length > 160 || /[\x00-\x1f\x7f]/.test(reference) || seen.has(reference)
      || !iso(periodStart) || !iso(periodEnd) || Date.parse(periodEnd) <= Date.parse(periodStart)
      || !/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(amount) || Number(amount) > 10000) throw new Error('帳單參考編號、UTC 期間或 USD 金額不符，請勿填入預付儲值金額。')
    seen.add(reference); return { reference, periodStart, periodEnd, amountUsd: Number(amount) }
  })
  const ordered = [...result].sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  if (ordered.some((r, i) => i > 0 && r.periodStart < ordered[i - 1].periodEnd)) throw new Error('帳單期間重疊，可能造成重複計費。')
  return result
}
