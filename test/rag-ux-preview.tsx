// Development-only synthetic UI harness; no Supabase, auth or model calls.
import { createRoot } from 'react-dom/client'
import RagWorkspace from '../src/push-admin/components/RagWorkspace'
import type { RagRepository } from '../src/push-admin/rag/repository'
import type { InteractionRecord, TrialResult } from '../src/push-admin/rag/v1'
import fixture from './fixtures/rag-v1.synthetic.json'
import '../src/push-admin/index.css'
import '../src/push-admin/rag/pilot.css'

const stamp = '2026-10-27T00:00:00Z'
const refusal = '目前這個知識版本沒有足夠且可核對的資料回答，請補充問題或交由管理員確認。'
const documents = Array.from({ length: 60 }, (_, n) => ({ id: `doc-${n}`, title: `測試文件 ${n + 1}：氣候與生活指南`, source_type: 'pdf', purpose: '生活指引', domain: '居家', created_at: stamp }))
const questions: InteractionRecord[] = Array.from({ length: 45 }, (_, n) => ({ id: `request-${n}`, round_id: 'round', origin: n < 25 ? 'query' : 'evaluation', state: n === 2 ? 'abstained' : n === 3 ? 'uncertain' : 'answered', reason: n === 2 ? 'insufficient_evidence' : n === 3 ? 'provider_outcome_uncertain' : 'validated', created_at: stamp, question: n === 1 ? null : `測試問題 ${n + 1}：如何減少生活碳排放？`, answer: n === 2 ? refusal : n === 1 || n === 3 ? null : '先規劃需要的份量，並依照來源資料核對適用條件。', details_expired: n === 1 }))
const unsupported = async () => { throw new Error('離線驗證不提供寫入或模型呼叫。') }
const repository: RagRepository = {
  list: (async (kind: string, filter?: { value: string }, page?: { offset: number; limit: number }) => {
    if (kind === 'documents') return documents
    if (kind === 'document_versions') return documents.filter(d => !filter || d.id === filter.value).map(d => ({ id: `v-${d.id}`, document_id: d.id, version: 1, processing_status: 'ready', content_status: 'in_review', failure_reason: null, created_at: stamp }))
    if (kind === 'chunk_sets') return [{ id: 'chunks', document_version_id: filter?.value, content_hash: 'a'.repeat(64), chunker_version: 'v4', sealed: true, created_at: stamp }]
    if (kind === 'chunks') return Array.from({ length: 80 }, (_, n) => ({ id: `chunk-${n}`, document_version_id: 'v-doc-0', ordinal: n + 1, page_start: n + 1, page_end: n + 1, section_path: '生活指南', original_text: `段落內容 ${n + 1}。` + '透過來源資料核對生活建議與適用條件。'.repeat(20) })).slice(page?.offset ?? 0, (page?.offset ?? 0) + (page?.limit ?? 25))
    if (kind === 'qa_entries') return Array.from({ length: 15 }, (_, n) => ({ id: `qa-${n}`, question: `生活問題 ${n + 1}`, answer: '先核對資料來源。', source_note: '測試資料', enabled: false, updated_at: stamp }))
    return []
  }) as RagRepository['list'],
  listTraces: async () => [], getTrace: async () => null, saveDraft: unsupported, saveSettings: unsupported,
  v1: { ingestion: async () => ({ originals: [], jobs: [] }), upload: unsupported, download: unsupported, campaigns: async () => [], stopCampaign: unsupported,
    editorial: { calculations: async () => [], coefficients: async () => [], classify: unsupported, correct: unsupported, saveCalculation: unsupported, saveQaCitations: unsupported, qaCitations: async () => [{ chunk_id: 'chunk-0', quote: '透過來源資料核對生活建議與適用條件。' }] },
    trials: { create: unsupported, stop: unsupported, ask: unsupported, list: async () => ({ rounds: [], requests: questions }),
      history: async (_signal, offset, origin) => questions.filter(row => origin === 'all' || row.origin === origin).slice(offset, offset + 21),
      detail: async id => { const row = questions.find(row => row.id === id)!; return { ...fixture.result, id, state: row.state, reason: row.reason, input: { question: row.question! }, details_expired: row.details_expired, output: row.state === 'answered' ? { ...fixture.result.output, answer: { answer: row.answer, citations: [{ chunk_id: 'chunk', quote: '先規劃需要的份量。' }] }, evidence: [{ id: 'chunk', title: '生活指南', page_start: 7, page_end: 7 }] } : row.state === 'abstained' ? { answer: { answer: refusal, citations: [] } } : {} } as TrialResult },
    },
  },
}
createRoot(document.getElementById('root')!).render(<><div role="status" className="rag-notice">離線 UX 驗證：全部為合成資料，不會呼叫模型或儲存資料。</div><RagWorkspace role="owner" repository={repository} /></>)
