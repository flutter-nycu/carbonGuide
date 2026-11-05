// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ConversationDetail } from './api/types'
import ConversationView from './ConversationView'

afterEach(() => cleanup())

const detail = (overrides: Partial<ConversationDetail> = {}): ConversationDetail => ({
  id: 'req-1', createdAt: '2026-11-05T08:00:00Z', origin: 'query', userLabel: '張俊隆', questionPreview: '每月少用 20 度電？',
  kind: 'document', state: 'answered', versionName: '2026-10 第一版', reservedUsd: 0.00236, estimatedUsd: 0.00061,
  question: '每月少用 20 度電，少多少碳排？', answer: '大約可以少排 10 公斤。[1]', reason: 'validated', expired: false,
  steps: [{ node: 'hybrid_retrieval', state: 'succeeded', durationMs: 260, reason: null }, { node: 'answer', state: 'succeeded', durationMs: 840, reason: null }],
  citations: [{ documentTitle: '綠生活指引.pdf', page: '3', section: '第一章 家庭用電', quote: '每用 1 度電，大約排放 0.5 公斤二氧化碳。' }],
  calls: [{ id: 'c1', model: 'gemini-3.1-flash-lite', purpose: 'answer', status: 'received', reservedUsd: 0.0021, estimatedUsd: 0.00061, durationMs: 840 }],
  priceVersion: 'google-standard-text-2026-10-26', ...overrides,
})

describe('conversation detail', () => {
  it('shows the answer, citations, plain step names and costs', () => {
    const { container } = render(<ConversationView detail={detail()} />)
    const text = container.textContent!
    expect(text).toContain('文件回答')
    expect(text).toContain('大約可以少排 10 公斤。[1]')
    expect(text).toContain('綠生活指引.pdf')
    expect(text).toContain('第 3 頁')
    expect(text).toContain('第一章 家庭用電')
    expect(text).toContain('搜尋相關段落')
    expect(text).toContain('產生回答')
    expect(text).not.toContain('hybrid_retrieval')
    expect(text).toContain('0.84 秒')
    expect(text).toContain('US$0.0021')
    expect(text).toContain('google-standard-text-2026-10-26')
  })

  it('explains each of the four result kinds', () => {
    for (const [kind, label] of [['qa', 'QA 回答'], ['insufficient', '資料不足'], ['incomplete', '沒有完成']] as const) {
      const { container, unmount } = render(<ConversationView detail={detail({ kind, citations: [], reason: kind === 'qa' ? 'verified_qa' : null })} />)
      expect(container.textContent).toContain(label)
      unmount()
    }
  })

  it('hides expired content but keeps time, state, version and cost', () => {
    const { container } = render(<ConversationView detail={detail({ expired: true, question: null, answer: null, questionPreview: null, steps: [], citations: [] })} />)
    const text = container.textContent!
    expect(text).toContain('已經超過 180 天的保存期限')
    expect(text).toContain('2026-10 第一版')
    expect(text).toContain('US$0.0021')
    expect(text).not.toContain('每月少用 20 度電')
  })
})
