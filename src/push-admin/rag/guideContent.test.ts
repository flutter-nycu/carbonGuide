import { describe, expect, it } from 'vitest'
import { LIMITS } from './api/types'
import { GUIDE_GLOSSARY, GUIDE_MODELS, GUIDE_NODES, GUIDE_ROUTES, GUIDE_SAFEGUARDS } from './guideContent'
import { PAGES } from './pageList'

describe('architecture guide content', () => {
  it('draws the five blocks in the order data flows through them', () => {
    expect(GUIDE_NODES.map(n => n.id)).toEqual(['web', 'edge', 'database', 'worker', 'gemini'])
    for (const node of GUIDE_NODES) {
      expect(node.name.length).toBeGreaterThan(1)
      expect(node.role.length).toBeGreaterThan(8)
      expect(node.tech.length).toBeGreaterThan(3)
    }
  })

  it('walks the two routes with seven and eight steps', () => {
    expect(GUIDE_ROUTES.map(r => [r.id, r.label, r.steps.length])).toEqual([
      ['ingest', '文件怎麼變成知識', 7],
      ['answer', '一個問題怎麼被回答', 8],
    ])
    expect(GUIDE_ROUTES[0].steps.map(s => s.title)).toEqual([
      '上傳或登記網址', '自動開始處理', '讀出內容並切成段落', '轉成可搜尋的格式', '建立知識版本', '評測與人工審核', '發布',
    ])
    expect(GUIDE_ROUTES[1].steps.map(s => s.title)).toEqual([
      '確認身分與範圍', '先比對 QA', '把問題轉成可搜尋的格式', '找資料', '挑出要參考的段落', '產生回答', '核對引用與數字', '記下流程與費用',
    ])
  })

  it('gives every step an explanation, the technology behind it, a block and a real page to open', () => {
    const nodes = new Set(GUIDE_NODES.map(n => n.id))
    const pages = new Set(PAGES.map(p => p.id))
    for (const step of GUIDE_ROUTES.flatMap(r => r.steps)) {
      expect(step.plain.length, step.title).toBeGreaterThan(30)
      expect(step.tech.length, step.title).toBeGreaterThan(3)
      expect(nodes.has(step.node), step.title).toBe(true)
      if (step.page) expect(pages.has(step.page), step.title).toBe(true)
    }
    // Every block appears in at least one step, so clicking it always leads somewhere.
    expect(new Set(GUIDE_ROUTES.flatMap(r => r.steps.map(s => s.node)))).toEqual(nodes)
  })

  it('states the facts the backend documents', () => {
    const all = JSON.stringify({ GUIDE_NODES, GUIDE_ROUTES, GUIDE_SAFEGUARDS, GUIDE_MODELS })
    for (const fact of ['gemini-embedding-001', '768', 'gemini-3.1-flash-lite', 'pgvector', 'PGroonga', 'RRF', 'Docling', 'Cloud Run',
      '20 MB', '12 頁', '150 題', '180 天', '40 題', '90%', '95%']) expect(all, fact).toContain(fact)
  })

  it('takes its limits from the same constants the workspace checks against', () => {
    const all = JSON.stringify({ GUIDE_ROUTES, GUIDE_SAFEGUARDS })
    const { round } = LIMITS
    for (const fact of [`${LIMITS.maxFileBytes / 1024 / 1024} MB`, `上限 ${LIMITS.contextChunks.max} 段`, `${round.dailyLimit} 題`,
      `最多 ${round.requestLimit} 題、US$${round.budgetUsd.toFixed(2)}、${round.days} 天`, `${LIMITS.retentionDays} 天`]) expect(all, fact).toContain(fact)
  })

  it('has six safeguards and a glossary of the words the page uses', () => {
    expect(GUIDE_SAFEGUARDS).toHaveLength(6)
    expect(GUIDE_GLOSSARY.map(g => g.term)).toEqual(['RAG', '段落', '向量', '混合檢索', 'RRF', '知識版本', '驗收評測', '引用核對'])
    for (const entry of [...GUIDE_SAFEGUARDS.map(s => s.text), ...GUIDE_GLOSSARY.map(g => g.meaning)]) expect(entry.length).toBeGreaterThan(10)
  })
})
