// Development-only visual harness, excluded from Vite's production HTML entries.
// Synthetic server metadata, in-memory repository, no authentication or API requests.
import React from 'react'
import { createRoot } from 'react-dom/client'
import RagWorkspace from '../src/push-admin/components/RagWorkspace'
import type { RagRepository } from '../src/push-admin/rag/repository'
import { parseTraceDetail, TRACE_PAGE_SIZE } from '../src/push-admin/rag/traces'
import recorded from './fixtures/rag-traces.synthetic.json'
import '../src/push-admin/index.css'

const details = recorded.map(value => parseTraceDetail(value)!).sort((a, b) => b.trace.started_at.localeCompare(a.trace.started_at) || b.trace.id.localeCompare(a.trace.id))
const repository: RagRepository = {
  list: async () => [],
  listTraces: async cursor => {
    const offset = cursor ? details.findIndex(row => row.trace.id === cursor.id) + 1 : 0
    return details.slice(offset, offset + TRACE_PAGE_SIZE).map(row => row.trace)
  },
  getTrace: async id => details.find(row => row.trace.id === id) ?? null,
  saveDraft: async () => { throw new Error('離線驗證不提供儲存。') },
  saveSettings: async () => { throw new Error('離線驗證不提供儲存。') },
}
createRoot(document.getElementById('root')!).render(<>
  <div role="status" style={{ padding: '14px 24px', background: '#fff1ce', color: '#674a0c' }}><strong>離線介面驗證</strong> · 重播 40 筆合成評測 metadata；登入與資料請求皆為 mock，不會呼叫 Supabase 或 Gemini。</div>
  <RagWorkspace role="owner" repository={repository} />
</>)
