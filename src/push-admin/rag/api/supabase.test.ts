import { describe, expect, it, vi } from 'vitest'
import { createSupabaseRagApi, type RagClient } from './supabase'

type Result = { data: unknown; error: { code?: string; message?: string } | null; count?: number | null }
interface Query { table: string; ops: [string, unknown[]][]; payload?: unknown }

const SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co'
const NOW = new Date('2026-11-05T08:00:00Z')

function mockClient(options: {
  tables?: (query: Query) => Result
  actions?: (body: Record<string, unknown>) => unknown
  upload?: () => { error: unknown }
} = {}) {
  const queries: Query[] = []
  const actions: Record<string, unknown>[] = []
  const uploads: unknown[][] = []
  const builder = (table: string) => {
    const query: Query = { table, ops: [] }
    queries.push(query)
    const chain: Record<string, unknown> = {}
    for (const name of ['select', 'order', 'limit', 'range', 'eq', 'gt', 'in', 'is', 'abortSignal', 'single', 'maybeSingle', 'not', 'gte', 'lt']) {
      chain[name] = (...args: unknown[]) => { query.ops.push([name, args]); return chain }
    }
    for (const name of ['update', 'insert']) {
      chain[name] = (payload: unknown) => { query.ops.push([name, [payload]]); query.payload = payload; return chain }
    }
    chain.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(options.tables?.(query) ?? { data: [], error: null }).then(resolve, reject)
    return chain
  }
  const client = {
    from: (table: string) => builder(table),
    auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } }, error: null }) },
    functions: {
      invoke: async (_name: string, { body }: { body: Record<string, unknown> }) => {
        actions.push(body)
        const result = options.actions?.(body)
        if (result instanceof Response) return { data: null, error: { context: result } }
        if (result instanceof Error) return { data: null, error: result }
        return { data: result ?? {}, error: null }
      },
    },
    storage: { from: () => ({ uploadToSignedUrl: async (...args: unknown[]) => { uploads.push(args); return options.upload?.() ?? { error: null } } }) },
  } as unknown as RagClient
  return { client, queries, actions, uploads }
}

const api = (mock: ReturnType<typeof mockClient>, role: 'owner' | 'editor' | 'viewer' = 'owner') =>
  createSupabaseRagApi(mock.client, { role, supabaseUrl: SUPABASE_URL, now: () => NOW })
const failure = (code: string) => new Response(JSON.stringify({ error: code }), { status: 409 })
const code = async (promise: Promise<unknown>) => promise.then(() => 'resolved', (error: { code?: string }) => error.code)

describe('supabase RAG API: rag-v1 actions', () => {
  it('turns the backend error code into a RagError', async () => {
    const mock = mockClient({ actions: () => failure('round_limit') })
    expect(await code(api(mock).stopRound('11111111-1111-4111-8111-111111111111'))).toBe('round_limit')
  })

  it('reports transport failures as network errors', async () => {
    const mock = mockClient({ actions: () => new TypeError('Failed to fetch') })
    expect(await code(api(mock).stopRound('r'))).toBe('network_error')
  })

  it('asks with the request key and returns the server-side detail', async () => {
    const mock = mockClient({
      actions: body => body.action === 'question' ? { id: 'req-1', state: 'answered', reason: 'validated' } : {
        id: 'req-1', created_at: NOW.toISOString(), origin: 'query', user: { id: 'u1', name: '張俊隆', email: 'owner@x.test' },
        state: 'answered', reason: 'validated', release_name: '第一版', question: '每月少用 20 度電？', answer: '大約少排 10 公斤。[1]', expired: false,
        steps: [{ node: 'hybrid_retrieval', state: 'succeeded', duration_ms: 260, reason: null }],
        citations: [{ document_title: '綠生活指引.pdf', page: '3', section: '第一章', quote: '示範數字' }],
        calls: [{ id: 'c1', model: 'gemini-embedding-001', purpose: 'query_embedding', status: 'received', reserved_usd: 0.00026, estimated_usd: 0.000002, duration_ms: 180 }],
        reserved_usd: 0.00026, estimated_usd: 0.000002, price_version: '2026-10-26',
      },
    })
    const detail = await api(mock).ask('round-1', '每月少用 20 度電？', 'key-1')
    expect(mock.actions[0]).toEqual({ action: 'question', roundId: 'round-1', requestKey: 'key-1', origin: 'query',
      input: { question: '每月少用 20 度電？', persona_id: null, tool_requests: [] } })
    expect(mock.actions[1]).toEqual({ action: 'conversation_detail', requestId: 'req-1' })
    expect(detail).toMatchObject({ id: 'req-1', kind: 'document', userLabel: '張俊隆', versionName: '第一版', priceVersion: '2026-10-26',
      citations: [{ documentTitle: '綠生活指引.pdf', page: '3', section: '第一章', quote: '示範數字' }] })
    expect(detail.steps[0]).toEqual({ node: 'hybrid_retrieval', state: 'succeeded', durationMs: 260, reason: null })
    expect(detail.calls[0].reservedUsd).toBe(0.00026)
  })

  it('sends the version it first saw in use when publishing again with the same key', async () => {
    let active = 'v-old'
    const mock = mockClient({
      tables: query => (query.table === 'rag_v1_activations' ? { data: [{ release_id: active, sequence: 1 }], error: null } : { data: [], error: null }),
      actions: () => new TypeError('Failed to fetch'),
    })
    const rag = api(mock)
    expect(await code(rag.publishVersion('v-new', 'key-1'))).toBe('network_error')
    active = 'v-new' // the first try went through before the connection dropped
    await code(rag.publishVersion('v-new', 'key-1'))
    await code(rag.disableVersion('key-2'))
    expect(mock.actions.map(a => a.expectedId)).toEqual(['v-old', 'v-old', 'v-new'])
  })

  it('sends the same version contents when creating again with the same key', async () => {
    let prompt = 'prompt-1'
    const mock = mockClient({
      tables: query => (query.table === 'prompts' ? { data: [{ id: prompt }], error: null } : { data: [], error: null }),
      actions: () => new TypeError('Failed to fetch'),
    })
    const rag = api(mock)
    expect(await code(rag.createVersion('冬季版', 'key-1'))).toBe('network_error')
    prompt = 'prompt-2' // someone saved a new prompt before the retry
    await code(rag.createVersion('冬季版', 'key-1'))
    await code(rag.createVersion('冬季版', 'key-2'))
    expect(mock.actions.map(a => (a.selection as { prompt_id: string }).prompt_id)).toEqual(['prompt-1', 'prompt-1', 'prompt-2'])
  })

  it('excludes disabled document versions and their QA references from a new snapshot', async () => {
    const tables: Record<string, unknown[]> = {
      rag_v1_sets: [
        { chunk_set_id: 'disabled-set', original_id: 'disabled-original', embedding_state: 'ready' },
        { chunk_set_id: 'ready-set', original_id: 'ready-original', embedding_state: 'ready' },
      ],
      rag_v1_originals: [{ id: 'disabled-original', document_version_id: 'disabled-version' }, { id: 'ready-original', document_version_id: 'ready-version' }],
      document_versions: [{ id: 'disabled-version', document_id: 'disabled-doc', content_status: 'disabled' }, { id: 'ready-version', document_id: 'ready-doc', content_status: 'in_review' }],
      qa_entries: [{ id: 'disabled-qa' }, { id: 'ready-qa' }],
      rag_v1_qa_citations: [{ qa_id: 'disabled-qa', chunk_id: 'disabled-chunk' }, { qa_id: 'ready-qa', chunk_id: 'ready-chunk' }],
      chunks: [{ id: 'disabled-chunk', chunk_set_id: 'disabled-set' }, { id: 'ready-chunk', chunk_set_id: 'ready-set' }],
      prompts: [{ id: 'prompt-1' }],
    }
    const mock = mockClient({ tables: query => ({ data: tables[query.table] ?? [], error: null }), actions: () => ({ id: 'new-version' }) })
    await api(mock).createVersion('排除停用文件', 'disabled-source-key')
    expect(mock.actions[0].selection).toMatchObject({ chunk_set_ids: ['ready-set'], qa_ids: ['ready-qa'] })
    expect(mock.queries.find(q => q.table === 'document_versions')?.ops).toContainEqual(['select', ['id,document_id,content_status']])
  })

  it('sends exactly the fields rag-v1 accepts for each write', async () => {
    const mock = mockClient({
      tables: query => ({ data: query.table === 'knowledge_releases' ? { manifest_hash: 'mh' } : query.table === 'rag_v1_datasets' ? { case_count: 2 } : [], error: null }),
      actions: body => (body.action === 'evaluation_next' ? { complete: false, case_id: 'c1', state: 'answered' } : { id: 'x-1' }),
    })
    const rag = api(mock)
    await rag.registerUrl(' https://example.org/a.pdf ', 'uk')
    await rag.classifyDocument('d1', { purpose: '生活指引', domain: '居家', citationScope: '一般家庭' })
    await rag.saveQaCitations('q1', 't1', [{ chunkId: 'c1', quote: '剩菜收好' }])
    await rag.reviewVersion('v1', 'approve', '核對過了', true, 'rk')
    expect(await rag.nextEvaluation('b1')).toEqual({ complete: false, caseId: 'c1', state: 'answered' })
    await rag.finishEvaluation('b1')
    const keys = (action: string) => Object.keys(mock.actions.find(a => a.action === action)!).sort()
    expect(keys('url_register')).toEqual(['action', 'requestKey', 'url'])
    expect(mock.actions.find(a => a.action === 'url_register')!.url).toBe('https://example.org/a.pdf')
    expect(keys('classify')).toEqual(['action', 'documentId', 'domain', 'purpose', 'scope'])
    expect(mock.actions.find(a => a.action === 'qa_citations')).toEqual({ action: 'qa_citations', qaId: 'q1', updatedAt: 't1', citations: [{ chunk_id: 'c1', quote: '剩菜收好' }] })
    expect(mock.actions.find(a => a.action === 'snapshot_review')).toMatchObject({ requestKey: 'rk', releaseId: 'v1', hash: 'mh', verdict: 'approve', reason: '核對過了' })
    expect(keys('snapshot_review')).toEqual(['action', 'confirmation', 'hash', 'reason', 'releaseId', 'requestKey', 'verdict'])
    expect(keys('evaluation_next')).toEqual(['action', 'batchId'])
    expect(keys('evaluation_finish')).toEqual(['action', 'batchId'])
  })

  it('begins an evaluation on its own round with a key derived from the request key', async () => {
    const campaign = { id: 'camp-1', budget_usd: 5, reserved_usd: 1, call_limit: 1000, call_count: 0, state: 'active', expires_at: '2027-01-31T00:00:00Z' }
    const mock = mockClient({
      tables: query => ({ data: query.table === 'rag_v1_datasets' ? { case_count: 40 } : query.table === 'rag_v1_campaigns' ? [campaign] : [], count: 1, error: null }),
      actions: body => ({ id: body.action === 'round_create' ? 'round-9' : 'batch-9' }),
    })
    expect(await api(mock).beginEvaluation('ds1', 'v2', 'ek')).toBe('batch-9')
    const [round, begin] = mock.actions
    expect(round).toMatchObject({ action: 'round_create', releaseId: 'v2', requestLimit: 40, dailyLimit: 150, budgetUsd: 1.2 })
    expect(round.requestKey).not.toBe('ek')
    expect(begin).toEqual({ action: 'evaluation_begin', datasetId: 'ds1', roundId: 'round-9', requestKey: 'ek' })
  })

  it('refuses a whole evaluation when it would exceed the global 150 request day limit', async () => {
    const mock = mockClient({ tables: query => ({ data: query.table === 'rag_v1_datasets' ? { case_count: 40 } : null, count: 111, error: null }) })
    expect(await code(api(mock).beginEvaluation('ds1', 'v2', 'over-day-limit'))).toBe('daily_limit')
    expect(mock.actions).toEqual([])
    const query = mock.queries.find(q => q.table === 'rag_v1_requests')!
    expect(query.ops).toContainEqual(['eq', ['actor_id', 'owner-1']])
    expect(query.ops).toContainEqual(['gte', ['created_at', '2026-11-05T00:00:00.000Z']])
    expect(query.ops).toContainEqual(['lt', ['created_at', '2026-11-06T00:00:00.000Z']])
  })

  it('counts finished evaluation requests instead of all reserved admissions', async () => {
    const mock = mockClient({ tables: query => ({ error: null, count: 2, data: {
      rag_v1_evaluation_batches: [{ id: 'b1', dataset_id: 'ds1', round_id: 'r1' }],
      rag_v1_rounds: [{ id: 'r1', release_id: 'v1', request_count: 40 }],
      rag_v1_datasets: [{ id: 'ds1', case_count: 40 }],
      rag_v1_evaluation_receipts: [],
    }[query.table] ?? null }) })
    expect(await api(mock).listBatches()).toEqual([{ id: 'b1', datasetId: 'ds1', versionId: 'v1', completed: 2, total: 40, finished: false, reportId: null }])
    const query = mock.queries.find(q => q.table === 'rag_v1_requests')!
    expect(query.ops).toContainEqual(['eq', ['round_id', 'r1']])
    expect(query.ops).toContainEqual(['in', ['state', ['answered', 'abstained', 'failed', 'uncertain']]])
  })

  it('reuses the evaluation round after a lost begin response, even on another day', async () => {
    let clock = NOW.getTime()
    let begins = 0
    const campaign = { id: 'camp-1', budget_usd: 5, reserved_usd: 1, call_limit: 1000, call_count: 0, expires_at: '2027-01-31T00:00:00Z' }
    const mock = mockClient({
      tables: query => ({ error: null, count: 1, data: query.table === 'rag_v1_datasets' ? { case_count: 40 } : [campaign] }),
      actions: body => body.action === 'round_create' ? { id: 'round-9' } : ++begins === 1 ? new TypeError('Lost response') : { id: 'batch-9' },
    })
    const rag = createSupabaseRagApi(mock.client, { role: 'owner', supabaseUrl: SUPABASE_URL, now: () => new Date(clock) })
    expect(await code(rag.beginEvaluation('ds1', 'v2', 'lost-begin'))).toBe('network_error')
    clock += 24 * 3600 * 1000
    expect(await rag.beginEvaluation('ds1', 'v2', 'lost-begin')).toBe('batch-9')
    expect(mock.actions.filter(a => a.action === 'round_create')).toHaveLength(1)
    expect(mock.actions[2]).toEqual(mock.actions[1])
  })

  it('maps conversation users and keeps the cursor', async () => {
    const mock = mockClient({ actions: () => ({ items: [
      { user_id: null, name: null, email: null, role: null, count: 2, last_at: NOW.toISOString(), reserved_usd: 0.01, estimated_usd: null, unknown_cost_calls: 2 },
      { user_id: 'u-quiet', name: null, email: 'quiet@x.test', role: null, count: 0, last_at: null, reserved_usd: 0, estimated_usd: null, unknown_cost_calls: 0 },
    ], next_cursor: 'c2' }) })
    const page = await api(mock).listConversationUsers('owner@', 'c1')
    expect(mock.actions[0]).toEqual({ action: 'conversation_users', search: 'owner@', cursor: 'c1' })
    // A backend without the status migration leaves the status unknown rather than inventing one.
    expect(page).toEqual({ items: [
      { userId: null, name: null, email: null, role: null, count: 2, lastAt: NOW.toISOString(), reservedUsd: 0.01, estimatedUsd: null, unknownCostCalls: 2, status: null },
      // An account that never asked has no latest conversation.
      { userId: 'u-quiet', name: null, email: 'quiet@x.test', role: null, count: 0, lastAt: null, reservedUsd: 0, estimatedUsd: null, unknownCostCalls: 0, status: null },
    ], nextCursor: 'c2' })
  })

  it('maps each conversation user’s current status', async () => {
    const status = {
      account: 'disabled', joined_at: '2026-10-01T00:00:00Z', last_sign_in_at: null, today_requests: 7,
      outcomes: { qa: 1, document: 2, insufficient: 1, incomplete: 2 },
      active_rounds: [{ release_name: '2026-10 第一版', request_count: 3, request_limit: 20, reserved_usd: '0.12000000', budget_usd: 0.5, expires_at: '2026-11-07T00:00:00Z' }],
    }
    const mock = mockClient({ actions: () => ({ items: [
      { user_id: 'u1', name: 'A', email: 'a@x.test', role: null, count: 6, last_at: NOW.toISOString(), reserved_usd: 0, estimated_usd: 0, unknown_cost_calls: 0, status },
      { user_id: 'u2', name: 'B', email: 'b@x.test', role: 'owner', count: 1, last_at: NOW.toISOString(), reserved_usd: 0, estimated_usd: 0, unknown_cost_calls: 0, status: { account: 'someday' } },
    ], next_cursor: null }) })
    const [person, unknown] = (await api(mock).listConversationUsers('', null)).items
    expect(person.status).toEqual({
      account: 'disabled', joinedAt: '2026-10-01T00:00:00Z', lastSignInAt: null, todayRequests: 7,
      outcomes: { qa: 1, document: 2, insufficient: 1, incomplete: 2 },
      activeRounds: [{ versionName: '2026-10 第一版', requestCount: 3, requestLimit: 20, reservedUsd: 0.12, budgetUsd: 0.5, expiresAt: '2026-11-07T00:00:00Z' }],
    })
    expect(unknown.status).toBeNull()
  })

  it('leaves a malformed status unknown instead of filling in zeros', async () => {
    const good = { account: 'active', joined_at: null, last_sign_in_at: null, today_requests: 0, outcomes: { qa: 0, document: 1, insufficient: 0, incomplete: 0 }, active_rounds: [] }
    const broken = [
      { ...good, outcomes: { qa: 0, document: 1, insufficient: 0 } },
      { ...good, outcomes: null },
      { ...good, today_requests: 'many' },
      { ...good, today_requests: undefined },
      { ...good, active_rounds: [{ release_name: '2026-10 第一版', request_count: 1, request_limit: 20, reserved_usd: 0, budget_usd: 0.5 }] },
      { ...good, active_rounds: 'none' },
    ]
    const row = (status: unknown, n: number) => ({ user_id: `u${n}`, name: null, email: null, role: null, count: 1, last_at: NOW.toISOString(), reserved_usd: 0, estimated_usd: 0, unknown_cost_calls: 0, status })
    const mock = mockClient({ actions: () => ({ items: [good, ...broken].map(row), next_cursor: null }) })
    const [first, ...rest] = (await api(mock).listConversationUsers('', null)).items
    expect(first.status).not.toBeNull()
    expect(rest.map(u => u.status)).toEqual(broken.map(() => null))
  })

  it('asks the same conversation query for everyone, one person or deleted accounts', async () => {
    const mock = mockClient({ actions: () => ({ items: [], next_cursor: null }) })
    await api(mock).listInteractions('evaluation', null)
    await api(mock).listUserConversations('u1', 'c1')
    await api(mock).listUserConversations(null, null)
    expect(mock.actions).toEqual([
      { action: 'conversations', scope: 'all', origin: 'evaluation', cursor: null },
      { action: 'conversations', scope: 'u1', origin: 'query', cursor: 'c1' },
      { action: 'conversations', scope: 'deleted', origin: 'query', cursor: null },
    ])
  })
})

describe('supabase RAG API: uploads and downloads', () => {
  it('refuses JSON before calling the backend', async () => {
    const mock = mockClient()
    expect(await code(api(mock, 'editor').uploadFile(new File(['{}'], 'a.json')))).toBe('unsupported_format')
    expect(mock.actions).toEqual([])
  })

  it('begins, uploads to the signed path, then verifies', async () => {
    const path = 'originals/' + 'a'.repeat(64) + '.pdf'
    const mock = mockClient({ actions: body => body.action === 'upload_begin' ? { id: 'o-1', verified: false, path, token: 'signed' } : { verified: true } })
    const progress = vi.fn()
    const result = await api(mock, 'editor').uploadFile(new File(['%PDF-1.7'], '報告.pdf'), progress)
    expect(result.outcome).toBe('uploaded')
    expect(mock.actions[0]).toMatchObject({ action: 'upload_begin', name: '報告.pdf', format: 'pdf', bytes: 8 })
    expect(mock.actions[0].sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(mock.uploads[0].slice(0, 2)).toEqual([path, 'signed'])
    expect(mock.actions[1]).toEqual({ action: 'upload_verify', originalId: 'o-1' })
    expect(progress).toHaveBeenCalled()
  })

  it('skips the upload when the same file is already stored', async () => {
    const mock = mockClient({ actions: () => ({ id: 'o-1', verified: true }) })
    expect((await api(mock, 'editor').uploadFile(new File(['x'], 'a.txt'))).outcome).toBe('already_exists')
    expect(mock.uploads).toEqual([])
  })

  it('rejects a signed path that is not a PDF, DOCX or TXT original', async () => {
    const mock = mockClient({ actions: () => ({ id: 'o-1', verified: false, path: 'originals/' + 'a'.repeat(64) + '.json', token: 't' }) })
    expect(await code(api(mock, 'editor').uploadFile(new File(['x'], 'a.txt')))).toBe('invalid_response')
  })

  it('only returns download links on this Supabase project', async () => {
    const good = mockClient({ actions: () => ({ url: SUPABASE_URL + '/storage/v1/object/sign/rag-originals/originals/a.pdf?token=t' }) })
    expect(await api(good).downloadOriginal('o-1')).toContain('/storage/v1/object/sign/rag-originals/')
    const bad = mockClient({ actions: () => ({ url: 'https://evil.example/file.pdf' }) })
    expect(await code(api(bad).downloadOriginal('o-1'))).toBe('invalid_response')
  })
})

describe('supabase RAG API: tables', () => {
  it('derives document status from versions, originals and jobs', async () => {
    const mock = mockClient({ tables: query => ({ error: null, data: {
      documents: [{ id: 'd1', title: '指引.pdf', source_type: 'pdf', purpose: '生活指引', domain: '居家', citation_scope: '一般家庭', created_at: '2026-11-01T00:00:00Z' }],
      document_versions: [{ id: 'v1', document_id: 'd1', version: 1, processing_status: 'parsed', failure_reason: null, created_at: '2026-11-01T00:00:00Z' }],
      rag_v1_originals: [{ id: 'o1', document_version_id: 'v1', upload_state: 'verified' }],
      rag_v1_jobs: [{ original_id: 'o1', stage: 'embed', status: 'pending', failure_reason: 'campaign_unavailable', attempt: 0, generation: 1, output_set_id: 's1' },
        { original_id: 'o1', stage: 'parse', status: 'completed', failure_reason: null, attempt: 1, generation: 1, output_set_id: 's1' }],
      rag_v1_sets: [{ chunk_set_id: 's1', chunk_count: 18 }],
    }[query.table] ?? [] }) })
    const [doc] = await api(mock).listDocuments()
    expect(doc).toMatchObject({ id: 'd1', title: '指引.pdf', sourceType: 'pdf', citationScope: '一般家庭', status: 'budget_paused', failureReason: 'campaign_unavailable', chunkCount: 18, originalId: 'o1' })
  })

  it('shows chunks excluded along the revision chain even though corrections renumber the kept ones', async () => {
    const chunk = (id: string, ordinal: number, text: string) => ({ id, ordinal, page_start: ordinal, page_end: ordinal, section_path: '第一章', original_text: text })
    const data: Record<string, unknown[]> = {
      documents: [{ id: 'd1', title: '指引.pdf', source_type: 'pdf', purpose: 'p', domain: 'd', citation_scope: '', created_at: 't' }],
      document_versions: [{ id: 'v1', document_id: 'd1', version: 1, processing_status: 'ready', failure_reason: null, created_at: 't' }],
      rag_v1_originals: [{ id: 'o1', document_version_id: 'v1', upload_state: 'verified' }],
      rag_v1_jobs: [], rag_v1_sets: [{ chunk_set_id: 's2', chunk_count: 1, created_at: 't2' }],
    }
    // s0: A B C D → exclude B (s1: A C D) → edit C and exclude D (s2: A C')
    const chunks: Record<string, unknown[]> = {
      s0: [chunk('a0', 1, 'A'), chunk('b0', 2, 'B'), chunk('c0', 3, 'C'), chunk('d0', 4, 'D')],
      s1: [chunk('a1', 1, 'A'), chunk('c1', 2, 'C'), chunk('d1', 3, 'D')],
      s2: [chunk('a2', 1, 'A'), chunk('c2', 2, 'C2')],
    }
    const revisions: Record<string, object> = { s2: { parent_set_id: 's1', changed_ordinals: [2, 3] }, s1: { parent_set_id: 's0', changed_ordinals: [2] } }
    const mock = mockClient({ tables: query => {
      const eq = (column: string) => (query.ops.find(([name, args]) => name === 'eq' && args[0] === column)?.[1][1]) as string
      if (query.table === 'chunks') return { data: chunks[eq('chunk_set_id')] ?? [], error: null }
      if (query.table === 'rag_v1_revisions') { const r = revisions[eq('chunk_set_id')]; return { data: r ? [r] : [], error: null } }
      if (query.table === 'chunk_sets') return { data: { id: 's2', content_hash: 'h2' }, error: null }
      return { data: data[query.table] ?? [], error: null }
    } })
    const detail = await api(mock).getDocument('d1')
    expect(detail.chunks.filter(c => !c.excluded).map(c => [c.ordinal, c.text])).toEqual([[1, 'A'], [2, 'C2']])
    expect(detail.chunks.filter(c => c.excluded).map(c => c.text).sort()).toEqual(['B', 'D'])
    expect(detail.basis).toEqual({ setId: 's2', hash: 'h2' })
  })

  it('revises the chunks the editor was looking at, not whatever is newest', async () => {
    const mock = mockClient({ tables: query => ({ data: query.table === 'chunks' ? [{ id: 'c1', ordinal: 1, page_start: 1, page_end: 1, section_path: '', original_text: '舊的第一段' }] : [], error: null }) })
    await api(mock, 'editor').reviseChunks('d1', [{ ordinal: 1, exclude: true }], '重複', { setId: 'seen-set', hash: 'seen-hash' })
    expect(mock.actions[0]).toEqual({ action: 'correct_chunks', parentId: 'seen-set', hash: 'seen-hash', edits: [{ ordinal: 1, text: '舊的第一段', exclude: true }], reason: '重複' })
    expect(mock.queries.map(q => q.table)).toEqual(['chunks'])
  })

  it('refuses to build a version while a newer set of a document is still being prepared', async () => {
    const mock = mockClient({ tables: query => ({ error: null, data: {
      rag_v1_sets: [{ chunk_set_id: 'new', original_id: 'o1', embedding_state: 'pending', created_at: '2026-11-05T02:00:00Z' },
        { chunk_set_id: 'old', original_id: 'o1', embedding_state: 'ready', created_at: '2026-11-01T00:00:00Z' }],
      rag_v1_originals: [{ id: 'o1', document_version_id: 'v1' }],
      document_versions: [{ id: 'v1', document_id: 'd1' }],
      prompts: [{ id: 'p1' }],
    }[query.table] ?? [] }) })
    expect(await code(api(mock).createVersion('冬季版', 'k'))).toBe('snapshot_not_ready')
    expect(mock.actions).toEqual([])
  })

  it('tells a missing row from a lost optimistic lock', async () => {
    const missing = mockClient({ tables: () => ({ data: null, error: { code: 'PGRST116' } }) })
    expect(await code(api(missing).getSettings())).toBe('not_found')
    expect(await code(api(missing).saveSettings({ candidates: 20, contextChunks: 6 }, 't0'))).toBe('draft_changed')
  })

  it('links finished evaluation batches to their report', async () => {
    const mock = mockClient({ tables: query => ({ error: null, count: 3, data: {
      rag_v1_evaluation_batches: [{ id: 'b1', dataset_id: 'ds1', round_id: 'r1' }, { id: 'b2', dataset_id: 'ds1', round_id: 'r2' }],
      rag_v1_rounds: [{ id: 'r1', release_id: 'v1', request_count: 40 }, { id: 'r2', release_id: 'v1', request_count: 3 }],
      rag_v1_datasets: [{ id: 'ds1', case_count: 40 }],
      rag_v1_evaluation_receipts: [{ batch_id: 'b1', evaluation_id: 'e1' }],
    }[query.table] ?? [] }) })
    const batches = await api(mock).listBatches()
    expect(batches.map(b => [b.id, b.finished, b.reportId])).toEqual([['b1', true, 'e1'], ['b2', false, null]])
  })

  it('saves personas with an optimistic lock and reports conflicts', async () => {
    const mock = mockClient({ tables: () => ({ data: null, error: { code: 'PGRST116' } }) })
    expect(await code(api(mock, 'editor').savePersona({ name: '理性型', example: 'e', instruction: 'i', enabled: true }, { id: 'p1', updatedAt: 't1' }))).toBe('draft_changed')
    const update = mock.queries[0]
    expect(update.table).toBe('personas')
    expect(update.payload).toEqual({ name: '理性型', example: 'e', instruction: 'i', enabled: true })
    expect(update.ops).toContainEqual(['eq', ['id', 'p1']])
    expect(update.ops).toContainEqual(['eq', ['updated_at', 't1']])
  })

  it('maps retrieval settings and validates before writing', async () => {
    const mock = mockClient({ tables: () => ({ data: { retrieval_candidates: 20, context_chunks: 6, updated_at: 't1' }, error: null }) })
    expect(await api(mock).getSettings()).toEqual({ candidates: 20, contextChunks: 6, updatedAt: 't1' })
    const before = mock.queries.length
    expect(await code(api(mock).saveSettings({ candidates: 4, contextChunks: 6 }, 't1'))).toBe('settings_invalid')
    expect(mock.queries.length).toBe(before)
    await api(mock).saveSettings({ candidates: 30, contextChunks: 8 }, 't1')
    expect(mock.queries[mock.queries.length - 1].payload).toEqual({ retrieval_candidates: 30, context_chunks: 8 })
  })

  it('keeps a non-expiring campaign available while preserving its consumed budget', async () => {
    const campaign = { budget_usd: 5, reserved_usd: 4.61841375, call_limit: 2000, call_count: 776, state: 'active', expires_at: 'infinity' }
    const mock = mockClient({ tables: () => ({ data: [campaign], error: null }) })
    expect(await api(mock).getBudget()).toMatchObject({ active: true, budgetUsd: 5, reservedUsd: 4.61841375, expiresAt: 'infinity' })
  })

  it('opens a finite round from the remaining non-expiring campaign balance below USD 0.50', async () => {
    const campaign = { id: 'camp-1', budget_usd: 5, reserved_usd: 4.61841375, call_limit: 2000, call_count: 776, expires_at: 'infinity' }
    const round = { id: 'round-1', release_id: 'v1', request_limit: 20, request_count: 0, budget_usd: 0.38158625, reserved_usd: 0, expires_at: '2026-11-12T07:50:00.000Z', state: 'active' }
    const mock = mockClient({ tables: q => ({ data: q.table === 'rag_v1_campaigns' ? [campaign] : [round], error: null }), actions: () => ({ id: 'round-1' }) })
    await api(mock).createRound('v1', 'remaining-key')
    expect(mock.actions[0]).toMatchObject({ budgetUsd: 0.38158625, requestLimit: 20, dailyLimit: 150, expiresAt: '2026-11-12T07:50:00.000Z' })
  })

  it('refreshes the balance after explicit round rejection without changing an uncertain request', async () => {
    let reserved = 4.6
    let attempt = 0
    const mock = mockClient({
      tables: query => ({ data: query.table === 'rag_v1_campaigns' ? [{ id: 'camp-1', budget_usd: 5, reserved_usd: reserved, call_limit: 2000, call_count: 776, expires_at: 'infinity' }] : { id: 'round-1' }, error: null }),
      actions: () => ++attempt === 1 ? failure('budget_exhausted') : attempt === 2 ? new TypeError('Failed to fetch') : { id: 'round-1' },
    })
    const rag = api(mock)
    expect(await code(rag.createRound('v1', 'balance-race'))).toBe('budget_exhausted')
    reserved = 4.7
    expect(await code(rag.createRound('v1', 'balance-race'))).toBe('network_error')
    reserved = 4.8
    await rag.createRound('v1', 'balance-race')
    expect(mock.actions.map(body => body.budgetUsd)).toEqual([0.4, 0.3, 0.3])
    expect(mock.actions[2]).toEqual(mock.actions[1])
  })

  it('rejects a new round when the remaining balance is below the database minimum', async () => {
    const campaign = { id: 'camp-1', budget_usd: 5, reserved_usd: 4.995, call_limit: 2000, call_count: 776, expires_at: 'infinity' }
    const mock = mockClient({ tables: () => ({ data: [campaign], error: null }) })
    expect(await code(api(mock).createRound('v1', 'tiny-balance'))).toBe('budget_exhausted')
    expect(mock.actions).toEqual([])
  })

  it('admits an evaluation ending exactly at the persistent daily limit of 150', async () => {
    const campaign = { id: 'camp-1', budget_usd: 5, reserved_usd: 1, call_limit: 2000, call_count: 776, expires_at: 'infinity' }
    const mock = mockClient({ tables: q => ({ data: q.table === 'rag_v1_datasets' ? { case_count: 40 } : [campaign], count: 110, error: null }), actions: b => ({ id: b.action === 'round_create' ? 'round-150' : 'batch-150' }) })
    expect(await api(mock).beginEvaluation('ds1', 'v1', 'boundary-150')).toBe('batch-150')
    expect(mock.actions[0]).toMatchObject({ requestLimit: 40, dailyLimit: 150 })
  })

  it('creates a test round from the active campaign with the default limits', async () => {
    const campaign = { id: 'camp-1', budget_usd: 5, reserved_usd: 3.66, call_limit: 1000, call_count: 571, state: 'active', expires_at: '2026-12-31T00:00:00Z' }
    const round = { id: 'round-1', release_id: 'v1', request_limit: 20, request_count: 0, budget_usd: 0.5, reserved_usd: 0, expires_at: '2026-11-12T08:00:00.000Z', state: 'active' }
    const mock = mockClient({ tables: query => ({ data: query.table === 'rag_v1_campaigns' ? [campaign] : [round], error: null }), actions: () => ({ id: 'round-1' }) })
    const created = await api(mock).createRound('v1', 'rk')
    expect(mock.actions[0]).toEqual({ action: 'round_create', requestKey: 'rk', name: '試問台 2026-11-05', releaseId: 'v1', campaignId: 'camp-1',
      budgetUsd: 0.5, requestLimit: 20, dailyLimit: 150, expiresAt: '2026-11-12T07:50:00.000Z' })
    expect(created).toMatchObject({ id: 'round-1', versionId: 'v1', requestLimit: 20, budgetUsd: 0.5 })
  })

  it('sends the same round on a retry and stays inside the 7-day limit even if this clock runs ahead', async () => {
    const campaign = { id: 'camp-1', budget_usd: 5, reserved_usd: 1, call_limit: 1000, call_count: 0, state: 'active', expires_at: '2027-01-31T00:00:00Z' }
    let clock = NOW.getTime()
    const mock = mockClient({ tables: () => ({ data: [campaign], error: null }), actions: () => new TypeError('Failed to fetch') })
    const rag = createSupabaseRagApi(mock.client, { role: 'owner', supabaseUrl: SUPABASE_URL, now: () => new Date(clock) })
    await code(rag.createRound('v1', 'rk'))
    clock += 26 * 3600 * 1000 // the retry happens the next day
    await code(rag.createRound('v1', 'rk'))
    expect(mock.actions[1]).toEqual(mock.actions[0])
    const expires = new Date(mock.actions[0].expiresAt as string).getTime()
    expect(expires).toBeLessThanOrEqual(NOW.getTime() + 7 * 24 * 3600 * 1000 - 10 * 60 * 1000)
  })

  it('refuses to create a round without an open campaign', async () => {
    const mock = mockClient({ tables: () => ({ data: [], error: null }) })
    expect(await code(api(mock).createRound('v1', 'rk'))).toBe('campaign_closed')
    expect(mock.actions).toEqual([])
  })
})
