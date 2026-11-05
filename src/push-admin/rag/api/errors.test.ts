import { describe, expect, it } from 'vitest'
import { RagError, failureText, messageFor, reasonText, toRagError } from './errors'

describe('RAG error messages', () => {
  it('turns known codes into plain Chinese', () => {
    expect(messageFor('budget_exhausted')).toBe('這期的 AI 預算已經用完，暫時不能試問。')
    expect(messageFor('owner_required')).toBe('這項操作只有 owner 可以使用。')
    expect(messageFor('unsupported_format')).toContain('PDF、DOCX、TXT')
  })

  it('covers the conversation query errors', () => {
    for (const known of ['request_not_found', 'invalid_cursor', 'invalid_scope', 'invalid_query']) expect(messageFor(known)).not.toContain('錯誤碼')
  })

  it('keeps the code visible for unknown errors', () => {
    expect(messageFor('brand_new_code')).toBe('操作沒有完成，請稍後再試。（錯誤碼：brand_new_code）')
  })

  it('never mentions calculations or the old four-domain allowlist', () => {
    for (const code of ['url_source_not_allowed', 'evaluation_gate_required', 'dataset_coverage_required', 'snapshot_citation_missing']) {
      expect(messageFor(code)).not.toMatch(/計算|IPCC|國發會|能源署|自來水/)
    }
  })

  it('explains processing failures and answer reasons', () => {
    expect(failureText('url_not_pdf')).toBe('這個網址下載到的不是 PDF。')
    expect(failureText('campaign_unavailable')).toBe('AI 預算不足，等補上預算後會自動接續。')
    expect(failureText('mystery')).toBe('處理沒有完成（原因碼：mystery）。')
    expect(reasonText('verified_qa')).toContain('QA')
    expect(reasonText('deterministic_calculation')).not.toContain('計算')
  })

  it('wraps anything thrown into a RagError with a message', () => {
    const known = toRagError(new RagError('round_limit'))
    expect(known.code).toBe('round_limit')
    expect(known.message).toBe(messageFor('round_limit'))
    const unknown = toRagError(new TypeError('Failed to fetch'))
    expect(unknown.code).toBe('network_error')
    expect(unknown.message).toContain('連不上伺服器')
  })
})
