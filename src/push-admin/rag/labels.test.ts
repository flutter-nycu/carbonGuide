import { describe, expect, it } from 'vitest'
import { formatEstimate } from './labels'

describe('partial usage estimates', () => {
  it('does not present known costs as a complete total', () => {
    expect(formatEstimate(0.002, 2)).toBe('已知 US$0.0020（2 筆尚未取得用量）')
    expect(formatEstimate(null, 2)).toBe('尚無費用資料（2 筆尚未取得用量）')
    expect(formatEstimate(0.002, 0)).toBe('US$0.0020')
  })
})
