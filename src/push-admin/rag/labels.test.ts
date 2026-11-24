import { describe, expect, it } from 'vitest'
import { formatEstimate, formatOutcomes } from './labels'

describe('partial usage estimates', () => {
  it('does not present known costs as a complete total', () => {
    expect(formatEstimate(0.002, 2)).toBe('已知 US$0.0020，另有 2 筆還沒有用量資料')
    expect(formatEstimate(null, 2)).toBe('還沒有費用資料，另有 2 筆還沒有用量資料')
    expect(formatEstimate(0.002, 0)).toBe('US$0.0020')
  })
})

describe('conversation outcomes', () => {
  it('lists only the results that happened, in a fixed order', () => {
    expect(formatOutcomes({ qa: 0, document: 2, insufficient: 1, incomplete: 0 })).toBe('用文件回答 2、資料不足 1')
    expect(formatOutcomes({ qa: 1, document: 0, insufficient: 0, incomplete: 3 })).toBe('用常見問答回答 1、沒有完成 3')
    expect(formatOutcomes({ qa: 0, document: 0, insufficient: 0, incomplete: 0 })).toBe('—')
  })
})
