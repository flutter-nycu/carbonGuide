import { describe, expect, it } from 'vitest'
import { parseBills } from './billing'
const header = 'reference,period_start,period_end,amount_usd\n'
describe('campaign billing import', () => {
  it('reads quoted references and UTC periods without treating prepaid credit as a cost', () => {
    expect(parseBills(header + '"model,oct",2026-10-01T00:00:00Z,2026-11-01T00:00:00Z,0.12345678')).toEqual([{ reference: 'model,oct', periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-11-01T00:00:00Z', amountUsd: .12345678 }])
  })
  it('rejects duplicate, overlapping, malformed or imprecise rows', () => {
    const row = 'a,2026-10-01T00:00:00Z,2026-11-01T00:00:00Z,1'
    for (const text of [header + row + '\n' + row, header + row + '\nb,2026-10-20T00:00:00Z,2026-11-20T00:00:00Z,1', header + row + 'e5', header + 'a,2026-02-30T00:00:00Z,2026-03-31T00:00:00Z,1', header + row + '\n"unterminated']) expect(() => parseBills(text)).toThrow()
  })
})
