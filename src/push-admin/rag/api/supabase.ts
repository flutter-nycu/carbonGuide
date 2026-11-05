// RagApi over Supabase: table reads under RLS, writes and paid operations through the rag-v1 Edge Function.
import type { SupabaseClient } from '@supabase/supabase-js'
import { RagError } from './errors'
import { requestKeyFor } from './requestKeys'
import { answerKind, documentStatus, versionView } from './status'
import {
  LIMITS, fileProblem, urlProblem, validateSettings,
  type Budget, type ChunkEdit, type ConversationDetail, type ConversationSummary, type ConversationUser, type DocumentChunk,
  type EvaluationBatch, type EvaluationDataset, type EvaluationReport, type KnowledgeDocument, type KnowledgeVersion, type Page,
  type Persona, type PromptVersion, type QaEntry, type RagApi, type Role, type TestRound, type UrlEntry,
} from './types'

export type RagClient = Pick<SupabaseClient, 'from' | 'functions' | 'storage'>
export interface SupabaseApiOptions { role: Role; supabaseUrl: string; now?: () => Date }

type Row = Record<string, unknown>
interface Result { data: unknown; error: { code?: string } | null }
const DAY = 24 * 3600 * 1000
const REVIEW_CONFIRMATION = '我已核對這個版本及其評測'
const UPLOAD_PATH = /^originals\/[a-f0-9]{64}\.(pdf|docx|txt)$/
const SOURCE_TYPES = new Set(['pdf', 'docx', 'txt'])

type Missing = 'not_found' | 'draft_changed'

/** `missing` says what a missing row means: gone, or changed by someone else under an optimistic lock. */
function tableError(error: { code?: string }, missing: Missing = 'not_found'): RagError {
  if (error.code === 'PGRST116') return new RagError(missing)
  if (error.code === '42501' || error.code === 'PGRST301') return new RagError('admin_required')
  if (error.code === '42P01' || error.code === 'PGRST205') return new RagError('backend_not_ready')
  return new RagError('unknown_error', '資料讀寫沒有完成，請稍後再試。')
}

async function rows<T = Row>(query: PromiseLike<Result>): Promise<T[]> {
  const { data, error } = await query
  if (error) throw tableError(error)
  return (Array.isArray(data) ? data : data ? [data] : []) as T[]
}

async function one<T = Row>(query: PromiseLike<Result>, missing: Missing = 'not_found'): Promise<T> {
  const { data, error } = await query
  if (error) throw tableError(error, missing)
  if (!data) throw new RagError(missing)
  return data as T
}

const num = (value: unknown) => Number(value ?? 0)
const nullableNum = (value: unknown) => (value === null || value === undefined ? null : Number(value))
const str = (value: unknown) => (typeof value === 'string' ? value : '')

function summaryFrom(row: Row): ConversationSummary {
  const user = row.user as { name?: string | null; email?: string | null } | null
  return {
    id: str(row.id), createdAt: str(row.created_at), origin: row.origin === 'evaluation' ? 'evaluation' : 'query',
    userLabel: user?.name || user?.email || '已刪除帳號',
    questionPreview: typeof row.question_preview === 'string' ? row.question_preview : typeof row.question === 'string' ? row.question.slice(0, 60) : null,
    kind: answerKind(str(row.state), typeof row.reason === 'string' ? row.reason : null), state: str(row.state),
    versionName: str(row.release_name), reservedUsd: num(row.reserved_usd), estimatedUsd: nullableNum(row.estimated_usd),
  }
}

function detailFrom(row: Row): ConversationDetail {
  const list = (value: unknown) => (Array.isArray(value) ? value as Row[] : [])
  return {
    ...summaryFrom(row),
    question: typeof row.question === 'string' ? row.question : null,
    answer: typeof row.answer === 'string' ? row.answer : null,
    reason: typeof row.reason === 'string' ? row.reason : null,
    expired: row.expired === true,
    steps: list(row.steps).map(s => ({ node: str(s.node), state: str(s.state), durationMs: num(s.duration_ms), reason: typeof s.reason === 'string' ? s.reason : null })),
    citations: list(row.citations).map(c => ({ documentTitle: str(c.document_title), page: c.page == null ? null : String(c.page), section: str(c.section), quote: str(c.quote) })),
    calls: list(row.calls).map(c => ({ id: str(c.id), model: str(c.model), purpose: str(c.purpose), status: str(c.status),
      reservedUsd: num(c.reserved_usd), estimatedUsd: nullableNum(c.estimated_usd), durationMs: nullableNum(c.duration_ms) })),
    priceVersion: str(row.price_version),
  }
}

function pageFrom<T>(result: Row, map: (row: Row) => T): Page<T> {
  const items = Array.isArray(result.items) ? (result.items as Row[]).map(map) : []
  return { items, nextCursor: typeof result.next_cursor === 'string' ? result.next_cursor : null }
}

/**
 * Which chunks of `parent` a correction left out of `child`. Corrections renumber the kept chunks, but copy unchanged
 * ones as they were and keep the page and section of edited ones, so the two lists can be walked side by side.
 */
export function excludedBetween(parent: DocumentChunk[], child: DocumentChunk[], changed: Set<number>): DocumentChunk[] {
  let dropped = parent.length - child.length
  const out: DocumentChunk[] = []
  let j = 0
  for (let i = 0; i < parent.length; i++) {
    const p = parent[i]
    if (!changed.has(p.ordinal)) { j++; continue }
    const left = parent.slice(i).filter(c => changed.has(c.ordinal)).length
    const next = child[j]
    const anchor = parent.slice(i + 1).find(c => !changed.has(c.ordinal))
    const edited = dropped === 0 || (dropped < left && next !== undefined && next.text !== anchor?.text
      && next.pageStart === p.pageStart && next.pageEnd === p.pageEnd && next.sectionPath === p.sectionPath)
    if (edited) j++
    else { out.push(p); dropped-- }
  }
  return out
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('')
}

export function createSupabaseRagApi(client: RagClient, options: SupabaseApiOptions): RagApi {
  const now = options.now ?? (() => new Date())
  const origin = new URL(options.supabaseUrl).origin

  async function action(body: Row): Promise<Row> {
    let response: { data: unknown; error: unknown }
    try {
      response = await client.functions.invoke('rag-v1', { body })
    } catch (error) {
      throw error instanceof TypeError ? new RagError('network_error') : new RagError('unknown_error', '操作沒有完成，請稍後再試。')
    }
    const { data, error } = response
    if (error) {
      const context = (error as { context?: unknown }).context
      if (context instanceof Response) {
        let codeName = ''
        try { const detail = await context.clone().json(); codeName = typeof detail?.error === 'string' ? detail.error : '' } catch { /* generic below */ }
        throw codeName ? new RagError(codeName) : new RagError('unknown_error', '操作沒有完成，請稍後再試。')
      }
      if (error instanceof TypeError || (error as { name?: string }).name === 'FunctionsFetchError') throw new RagError('network_error')
      throw new RagError('unknown_error', '操作沒有完成，請稍後再試。')
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RagError('invalid_response')
    return data as Row
  }
  const idFrom = (result: Row) => {
    if (typeof result.id !== 'string') throw new RagError('invalid_response')
    return result.id
  }

  async function openCampaign(): Promise<Row | null> {
    const campaigns = await rows(client.from('rag_v1_campaigns').select('id,budget_usd,reserved_usd,call_limit,call_count,state,expires_at')
      .eq('state', 'active').gt('expires_at', now().toISOString()).order('created_at', { ascending: false }).limit(5))
    return campaigns.find(c => num(c.reserved_usd) < num(c.budget_usd) && num(c.call_count) < num(c.call_limit)) ?? null
  }

  // The backend replays a round key only with identical contents, so a retry resends the first body unchanged.
  const roundByKey = new Map<string, Row>()
  async function createRoundRow(versionId: string, requestKey: string, name: string, budgetUsd: number, requestLimit: number, dailyLimit: number): Promise<string> {
    let body = roundByKey.get(requestKey)
    if (!body) {
      const campaign = await openCampaign()
      if (!campaign) throw new RagError('campaign_closed')
      // At most 7 days from the backend's clock; the margin keeps a browser clock that runs ahead from being refused.
      const expires = Math.min(now().getTime() + LIMITS.round.days * DAY - 10 * 60 * 1000, new Date(str(campaign.expires_at)).getTime())
      body = { action: 'round_create', requestKey, name, releaseId: versionId, campaignId: campaign.id, budgetUsd, requestLimit, dailyLimit, expiresAt: new Date(expires).toISOString() }
      roundByKey.set(requestKey, body)
    }
    const id = idFrom(await action(body))
    roundByKey.delete(requestKey)
    return id
  }

  const roundFrom = (row: Row): TestRound => ({
    id: str(row.id), versionId: str(row.release_id), requestLimit: num(row.request_limit), requestCount: num(row.request_count),
    budgetUsd: num(row.budget_usd), reservedUsd: num(row.reserved_usd), expiresAt: str(row.expires_at), state: row.state === 'active' ? 'active' : 'stopped',
  })

  async function saveRow(table: string, payload: Row, previous?: { id: string; updatedAt: string }) {
    const query = previous
      ? client.from(table).update(payload).eq('id', previous.id).eq('updated_at', previous.updatedAt).select('id').single()
      : client.from(table).insert(payload).select('id').single()
    await one(query, previous ? 'draft_changed' : 'not_found')
  }

  async function currentSets(): Promise<Map<string, Row>> {
    // Latest embedded set per document; one version per document in a snapshot.
    const [sets, originals, versions] = await Promise.all([
      rows(client.from('rag_v1_sets').select('chunk_set_id,original_id,embedding_state,created_at').order('created_at', { ascending: false }).limit(4000)),
      rows(client.from('rag_v1_originals').select('id,document_version_id').limit(4000)),
      rows(client.from('document_versions').select('id,document_id').limit(4000)),
    ])
    const versionOf = new Map(originals.map(o => [str(o.id), str(o.document_version_id)]))
    const documentOf = new Map(versions.map(v => [str(v.id), str(v.document_id)]))
    const chosen = new Map<string, Row>()
    const preparing = new Set<string>()
    for (const set of sets) {
      const document = documentOf.get(versionOf.get(str(set.original_id)) ?? '')
      if (!document || chosen.has(document)) continue
      if (set.embedding_state === 'ready') chosen.set(document, set)
      else preparing.add(document)
    }
    // An older ready set would silently bring back text that was corrected or replaced since.
    if ([...preparing].some(document => chosen.has(document))) throw new RagError('snapshot_not_ready')
    return chosen
  }

  async function activeReleaseId(): Promise<string | null> {
    const latest = await rows(client.from('rag_v1_activations').select('release_id,sequence').order('sequence', { ascending: false }).limit(1))
    return latest.length ? (latest[0].release_id as string | null) : null
  }

  /** What a new knowledge version would contain right now. */
  async function currentSelection() {
    const [sets, qa, citations, personas, prompts] = await Promise.all([
      currentSets(),
      rows(client.from('qa_entries').select('id').eq('enabled', true).limit(1000)),
      rows(client.from('rag_v1_qa_citations').select('qa_id,chunk_id').limit(5000)),
      rows(client.from('personas').select('id').eq('enabled', true).limit(100)),
      rows(client.from('prompts').select('id').order('updated_at', { ascending: false }).limit(1)),
    ])
    if (!prompts.length) throw new RagError('snapshot_draft_missing')
    const setIds = [...sets.values()].map(s => str(s.chunk_set_id))
    const chunkSets = new Map<string, string>()
    const cited = [...new Set(citations.map(c => str(c.chunk_id)))]
    for (let i = 0; i < cited.length; i += 200) {
      for (const chunk of await rows(client.from('chunks').select('id,chunk_set_id').in('id', cited.slice(i, i + 200)))) chunkSets.set(str(chunk.id), str(chunk.chunk_set_id))
    }
    // A QA joins the version only when every citation points into a chosen set.
    const qaIds = qa.map(q => str(q.id)).filter(id => {
      const own = citations.filter(c => c.qa_id === id)
      return own.length > 0 && own.every(c => setIds.includes(chunkSets.get(str(c.chunk_id)) ?? ''))
    })
    return { chunk_set_ids: setIds, qa_ids: qaIds, persona_ids: personas.map(p => str(p.id)), calculation_ids: [],
      prompt_id: str(prompts[0].id), rewrite_enabled: false, tools_enabled: false }
  }
  // A retry must send the contents chosen the first time; the backend refuses a key with different contents.
  const selectionByKey = new Map<string, Awaited<ReturnType<typeof currentSelection>>>()

  // The backend replays a request key only with the same expected version, so a retry must not read it again:
  // if the first try went through, the version in use has already changed.
  const expectedByKey = new Map<string, string | null>()
  async function activate(requestKey: string, releaseId: string | null, operation: 'publish' | 'rollback' | 'disable', reason: string) {
    if (!expectedByKey.has(requestKey)) expectedByKey.set(requestKey, await activeReleaseId())
    await action({ action: 'snapshot_activate', requestKey, releaseId, expectedId: expectedByKey.get(requestKey) ?? null, operation, reason })
    expectedByKey.delete(requestKey)
  }

  async function documentSet(documentId: string): Promise<{ setId: string; hash: string } | null> {
    const versions = await rows(client.from('document_versions').select('id').eq('document_id', documentId).order('version', { ascending: false }).limit(1))
    if (!versions.length) return null
    const originals = await rows(client.from('rag_v1_originals').select('id').eq('document_version_id', str(versions[0].id)).limit(1))
    if (!originals.length) return null
    const sets = await rows(client.from('rag_v1_sets').select('chunk_set_id,created_at').eq('original_id', str(originals[0].id)).order('created_at', { ascending: false }).limit(1))
    if (!sets.length) return null
    const chunkSet = await one(client.from('chunk_sets').select('id,content_hash').eq('id', str(sets[0].chunk_set_id)).single())
    return { setId: str(chunkSet.id), hash: str(chunkSet.content_hash) }
  }

  async function chunksOf(setId: string): Promise<DocumentChunk[]> {
    const list = await rows(client.from('chunks').select('id,ordinal,page_start,page_end,section_path,original_text').eq('chunk_set_id', setId).order('ordinal').limit(2000))
    return list.map(c => ({ id: str(c.id), ordinal: num(c.ordinal), pageStart: nullableNum(c.page_start), pageEnd: nullableNum(c.page_end),
      sectionPath: str(c.section_path), text: str(c.original_text), excluded: false }))
  }

  const api: RagApi = {
    role: options.role,

    async listDocuments() {
      const [documents, versions, originals, jobs, sets] = await Promise.all([
        rows(client.from('documents').select('id,title,source_type,purpose,domain,citation_scope,created_at').order('created_at', { ascending: false }).limit(1000)),
        rows(client.from('document_versions').select('id,document_id,version,processing_status,failure_reason,created_at').order('version', { ascending: false }).limit(4000)),
        rows(client.from('rag_v1_originals').select('id,document_version_id,upload_state').limit(4000)),
        rows(client.from('rag_v1_jobs').select('original_id,stage,status,failure_reason,attempt,generation,output_set_id').order('generation', { ascending: false }).limit(8000)),
        rows(client.from('rag_v1_sets').select('chunk_set_id,chunk_count').limit(8000)),
      ])
      const chunkCount = new Map(sets.map(s => [str(s.chunk_set_id), num(s.chunk_count)]))
      return documents.filter(d => SOURCE_TYPES.has(str(d.source_type))).map((d): KnowledgeDocument => {
        const version = versions.find(v => v.document_id === d.id)
        const original = version && originals.find(o => o.document_version_id === version.id)
        const own = original ? jobs.filter(j => j.original_id === original.id) : []
        const parse = own.find(j => j.stage === 'parse')
        const embed = own.find(j => j.stage === 'embed')
        const { status, reason } = version
          ? documentStatus({ processing_status: str(version.processing_status), failure_reason: (version.failure_reason as string | null) ?? null },
            str(original?.upload_state) || 'pending',
            [parse, embed].filter(Boolean).map(j => ({ stage: j!.stage as 'parse' | 'embed', status: str(j!.status), failure_reason: (j!.failure_reason as string | null) ?? null, attempt: num(j!.attempt) })))
          : { status: 'pending' as const, reason: null }
        return {
          id: str(d.id), title: str(d.title), sourceType: str(d.source_type) as 'pdf' | 'docx' | 'txt', purpose: str(d.purpose), domain: str(d.domain),
          citationScope: str(d.citation_scope), versionNumber: num(version?.version ?? 1), status, failureReason: reason,
          pageCount: null, chunkCount: parse?.output_set_id ? chunkCount.get(str(parse.output_set_id)) ?? null : null,
          originalId: original ? str(original.id) : null, createdAt: str(d.created_at),
        }
      })
    },
    async getDocument(id) {
      const document = (await api.listDocuments()).find(d => d.id === id)
      if (!document) throw new RagError('not_found')
      const set = await documentSet(id)
      if (!set) return { document, chunks: [], basis: null }
      const current = await chunksOf(set.setId)
      const excluded: DocumentChunk[] = []
      let child = set.setId
      let childChunks = current
      for (let depth = 0; depth < 20; depth++) {
        const revision = await rows(client.from('rag_v1_revisions').select('parent_set_id,changed_ordinals').eq('chunk_set_id', child).limit(1))
        if (!revision.length) break
        const parentChunks = await chunksOf(str(revision[0].parent_set_id))
        const changed = new Set((Array.isArray(revision[0].changed_ordinals) ? revision[0].changed_ordinals : []).map(Number))
        excluded.push(...excludedBetween(parentChunks, childChunks, changed).map(c => ({ ...c, excluded: true })))
        child = str(revision[0].parent_set_id)
        childChunks = parentChunks
      }
      return { document, chunks: [...current, ...excluded], basis: { setId: set.setId, hash: set.hash } }
    },
    async downloadOriginal(originalId) {
      const result = await action({ action: 'download_original', originalId })
      let url: URL
      try { url = new URL(str(result.url)) } catch { throw new RagError('invalid_response') }
      if (url.origin !== origin || !url.pathname.startsWith('/storage/v1/object/sign/rag-originals/')) throw new RagError('invalid_response')
      return url.href
    },
    async classifyDocument(id, input) {
      await action({ action: 'classify', documentId: id, purpose: input.purpose, domain: input.domain, scope: input.citationScope })
    },
    async reviseChunks(documentId, edits: ChunkEdit[], reason, basis) {
      // The set the editor was looking at; the backend refuses it if someone corrected the document since.
      const set = basis ?? await documentSet(documentId)
      if (!set) throw new RagError('not_found')
      const current = await chunksOf(set.setId)
      const payload = edits.map(edit => {
        const chunk = current.find(c => c.ordinal === edit.ordinal)
        if (!chunk) throw new RagError('not_found')
        return { ordinal: edit.ordinal, text: edit.text ?? chunk.text, exclude: edit.exclude }
      })
      await action({ action: 'correct_chunks', parentId: set.setId, hash: set.hash, edits: payload, reason })
    },
    async uploadFile(file, onProgress) {
      const problem = fileProblem(file)
      if (problem) throw new RagError(problem)
      onProgress?.('核對檔案內容…')
      const result = await action({ action: 'upload_begin', name: file.name, format: file.name.split('.').pop()!.toLowerCase(), sha256: await sha256(file), bytes: file.size })
      idFrom(result)
      if (result.verified === true) return { outcome: 'already_exists' }
      if (typeof result.path !== 'string' || !UPLOAD_PATH.test(result.path) || typeof result.token !== 'string') throw new RagError('invalid_response')
      onProgress?.('上傳到私人儲存空間…')
      const { error } = await client.storage.from('rag-originals').uploadToSignedUrl(result.path, result.token, file, { upsert: false })
      // A lost response may hide a finished upload; verification checks the stored bytes either way.
      onProgress?.(error ? '確認伺服器是否已經收到檔案…' : '伺服器正在核對檔案…')
      await action({ action: 'upload_verify', originalId: result.id })
      return { outcome: 'uploaded' }
    },
    async listUrls() {
      const list = await rows(client.from('rag_v1_urls').select('id,source_url,state,attempt,original_id,failure_reason,created_at').order('created_at', { ascending: false }).limit(500))
      return list.map((u): UrlEntry => ({
        id: str(u.id), url: str(u.source_url), documentId: null, createdAt: str(u.created_at),
        status: u.state === 'running' ? 'processing' : u.state === 'downloaded' ? 'completed' : u.state === 'failed' ? 'failed' : 'pending',
        failureReason: (u.failure_reason as string | null) ?? null,
      }))
    },
    async registerUrl(url, requestKey) {
      if (urlProblem(url)) throw new RagError('url_source_not_allowed')
      return idFrom(await action({ action: 'url_register', url: url.trim(), requestKey }))
    },

    async listVersions() {
      const [snapshots, releases, reviews, activations, evaluations] = await Promise.all([
        rows(client.from('rag_v1_snapshots').select('release_id').limit(500)),
        rows(client.from('knowledge_releases').select('id,name,created_at,chunk_set_ids:manifest->chunk_set_ids').order('created_at', { ascending: false }).limit(200)),
        rows(client.from('rag_v1_reviews').select('release_id,verdict,sequence').order('sequence', { ascending: false }).limit(2000)),
        rows(client.from('rag_v1_activations').select('release_id,action,sequence').order('sequence', { ascending: false }).limit(2000)),
        rows(client.from('rag_v1_evaluations').select('release_id,data_split,case_count,passed_count,recall_at_5,citation_validity,numerical_failures,unpublished_leaks,created_at').order('created_at', { ascending: false }).limit(2000)),
      ])
      const v1 = new Set(snapshots.map(s => str(s.release_id)))
      const history = { reviews: reviews as never[], activations: activations as never[], evaluations: evaluations as never[] }
      return releases.filter(r => v1.has(str(r.id))).map((r): KnowledgeVersion => versionView(r as never, history))
    },
    async createVersion(name, requestKey) {
      const selection = selectionByKey.get(requestKey) ?? await currentSelection()
      selectionByKey.set(requestKey, selection)
      const id = idFrom(await action({ action: 'snapshot_create', requestKey, name: name.trim(), selection }))
      selectionByKey.delete(requestKey)
      return id
    },
    async reviewVersion(id, verdict, reason, confirmed, requestKey) {
      if (!confirmed) throw new RagError('review_confirmation_required')
      const release = await one(client.from('knowledge_releases').select('manifest_hash').eq('id', id).single())
      await action({ action: 'snapshot_review', requestKey, releaseId: id, hash: release.manifest_hash, verdict, reason, confirmation: REVIEW_CONFIRMATION })
    },
    async publishVersion(id, requestKey) { await activate(requestKey, id, 'publish', '在管理後台發布') },
    async rollbackVersion(id, requestKey) { await activate(requestKey, id, 'rollback', '在管理後台改回這個版本') },
    async disableVersion(requestKey) { await activate(requestKey, null, 'disable', '在管理後台停用') },

    async getBudget(): Promise<Budget> {
      const list = await rows(client.from('rag_v1_campaigns').select('budget_usd,reserved_usd,expires_at,state').eq('state', 'active').order('created_at', { ascending: false }).limit(1))
      if (!list.length) return { budgetUsd: 0, reservedUsd: 0, expiresAt: '', active: false }
      const c = list[0]
      return { budgetUsd: num(c.budget_usd), reservedUsd: num(c.reserved_usd), expiresAt: str(c.expires_at), active: new Date(str(c.expires_at)) > now() }
    },
    async getActiveRound(versionId) {
      const list = await rows(client.from('rag_v1_rounds').select('id,release_id,request_limit,request_count,budget_usd,reserved_usd,expires_at,state')
        .eq('release_id', versionId).eq('state', 'active').gt('expires_at', now().toISOString()).order('created_at', { ascending: false }).limit(1))
      return list.length ? roundFrom(list[0]) : null
    },
    async createRound(versionId, requestKey) {
      const { requestLimit, dailyLimit, budgetUsd } = LIMITS.round
      const id = await createRoundRow(versionId, requestKey, `試問台 ${now().toISOString().slice(0, 10)}`, budgetUsd, requestLimit, dailyLimit)
      const list = await rows(client.from('rag_v1_rounds').select('id,release_id,request_limit,request_count,budget_usd,reserved_usd,expires_at,state').eq('id', id).limit(1))
      if (!list.length) throw new RagError('invalid_response')
      return roundFrom(list[0])
    },
    async stopRound(id) { await action({ action: 'round_stop', roundId: id }) },
    async ask(roundId, question, requestKey) {
      const result = await action({ action: 'question', roundId, requestKey, origin: 'query', input: { question, persona_id: null, tool_requests: [] } })
      return api.getConversation(idFrom(result))
    },

    async listDatasets() {
      const list = await rows(client.from('rag_v1_datasets').select('id,name,data_split,case_count').order('created_at', { ascending: false }).limit(100))
      return list.map((d): EvaluationDataset => ({ id: str(d.id), name: str(d.name), split: d.data_split === 'acceptance' ? 'acceptance' : 'development', caseCount: num(d.case_count) }))
    },
    async registerDataset(dataset) {
      if (JSON.stringify(dataset ?? null).length > LIMITS.datasetBytes) throw new RagError('dataset_too_large')
      return idFrom(await action({ action: 'dataset_register', dataset }))
    },
    async listBatches() {
      const [batches, rounds, datasets, receipts] = await Promise.all([
        rows(client.from('rag_v1_evaluation_batches').select('id,dataset_id,round_id').order('created_at', { ascending: false }).limit(100)),
        rows(client.from('rag_v1_rounds').select('id,release_id,request_count').limit(500)),
        rows(client.from('rag_v1_datasets').select('id,case_count').limit(200)),
        rows(client.from('rag_v1_evaluation_receipts').select('batch_id,evaluation_id').limit(1000)),
      ])
      const reportOf = new Map(receipts.map(r => [str(r.batch_id), str(r.evaluation_id)]))
      return batches.map((b): EvaluationBatch => {
        const round = rounds.find(r => r.id === b.round_id)
        return { id: str(b.id), datasetId: str(b.dataset_id), versionId: str(round?.release_id), completed: num(round?.request_count),
          total: num(datasets.find(d => d.id === b.dataset_id)?.case_count), finished: reportOf.has(str(b.id)), reportId: reportOf.get(str(b.id)) ?? null }
      })
    },
    async beginEvaluation(datasetId, versionId, requestKey) {
      const dataset = await one(client.from('rag_v1_datasets').select('case_count').eq('id', datasetId).single())
      const cases = num(dataset.case_count)
      const roundId = await createRoundRow(versionId, requestKeyFor('evaluation-round', { requestKey }), `評測 ${now().toISOString().slice(0, 10)}`,
        Math.round(cases * 0.03 * 100) / 100, cases, Math.min(200, cases))
      return idFrom(await action({ action: 'evaluation_begin', datasetId, roundId, requestKey }))
    },
    async nextEvaluation(batchId) {
      const result = await action({ action: 'evaluation_next', batchId })
      return { complete: result.complete === true, caseId: typeof result.case_id === 'string' ? result.case_id : undefined, state: typeof result.state === 'string' ? result.state : undefined }
    },
    async finishEvaluation(batchId) { return idFrom(await action({ action: 'evaluation_finish', batchId })) },
    async evaluationReport(id) {
      const r = await one(client.from('rag_v1_evaluations').select('id,release_id,data_split,case_count,passed_count,recall_at_5,citation_validity').eq('id', id).single())
      return { id: str(r.id), versionId: str(r.release_id), split: r.data_split === 'acceptance' ? 'acceptance' : 'development', caseCount: num(r.case_count),
        passedCount: num(r.passed_count), recallAt5: nullableNum(r.recall_at_5), citationValidity: nullableNum(r.citation_validity) } satisfies EvaluationReport
    },

    async listPersonas() {
      const list = await rows(client.from('personas').select('id,name,instruction,example,enabled,updated_at').order('updated_at').limit(100))
      return list.map((p): Persona => ({ id: str(p.id), name: str(p.name), instruction: str(p.instruction), example: str(p.example), enabled: p.enabled === true, updatedAt: str(p.updated_at) }))
    },
    async savePersona(input, previous) {
      if (!input.enabled) {
        const enabled = await rows(client.from('personas').select('id').eq('enabled', true).limit(100))
        if (!enabled.some(p => p.id !== previous?.id)) throw new RagError('persona_minimum')
      }
      await saveRow('personas', { name: input.name, example: input.example, instruction: input.instruction, enabled: input.enabled }, previous)
    },
    async listPrompts() {
      const list = await rows(client.from('prompts').select('id,name,content,updated_at').order('updated_at', { ascending: false }).limit(100))
      return list.map((p): PromptVersion => ({ id: str(p.id), name: str(p.name), content: str(p.content), updatedAt: str(p.updated_at) }))
    },
    async savePrompt(input, previous) { await saveRow('prompts', { name: input.name, content: input.content }, previous) },
    async listQa() {
      const [entries, citations] = await Promise.all([
        rows(client.from('qa_entries').select('id,question,answer,source_note,enabled,updated_at').order('updated_at').limit(1000)),
        rows(client.from('rag_v1_qa_citations').select('qa_id,chunk_id,quote').limit(5000)),
      ])
      return entries.map((q): QaEntry => ({ id: str(q.id), question: str(q.question), answer: str(q.answer), sourceNote: str(q.source_note), enabled: q.enabled === true,
        updatedAt: str(q.updated_at), citations: citations.filter(c => c.qa_id === q.id).map(c => ({ chunkId: str(c.chunk_id), quote: str(c.quote) })) }))
    },
    async saveQa(input, previous) { await saveRow('qa_entries', { question: input.question, answer: input.answer, source_note: input.sourceNote, enabled: input.enabled }, previous) },
    async saveQaCitations(id, updatedAt, citations) {
      if (citations.length > LIMITS.qaCitations) throw new RagError('unverified_citation')
      await action({ action: 'qa_citations', qaId: id, updatedAt, citations: citations.map(c => ({ chunk_id: c.chunkId, quote: c.quote })) })
    },
    async getSettings() {
      const s = await one(client.from('rag_service_state').select('retrieval_candidates,context_chunks,updated_at').eq('id', true).single())
      return { candidates: num(s.retrieval_candidates), contextChunks: num(s.context_chunks), updatedAt: str(s.updated_at) }
    },
    async saveSettings(input, updatedAt) {
      if (validateSettings(input)) throw new RagError('settings_invalid')
      await one(client.from('rag_service_state').update({ retrieval_candidates: input.candidates, context_chunks: input.contextChunks })
        .eq('id', true).eq('updated_at', updatedAt).select('id').single(), 'draft_changed')
    },

    async listInteractions(originFilter, cursor) {
      return pageFrom(await action({ action: 'conversations', scope: 'all', origin: originFilter, cursor }), summaryFrom)
    },
    async listConversationUsers(search, cursor) {
      return pageFrom(await action({ action: 'conversation_users', search, cursor }), (row): ConversationUser => ({
        userId: (row.user_id as string | null) ?? null, name: (row.name as string | null) ?? null, email: (row.email as string | null) ?? null,
        role: (row.role as Role | null) ?? null, count: num(row.count), lastAt: str(row.last_at), reservedUsd: num(row.reserved_usd), estimatedUsd: nullableNum(row.estimated_usd),
      }))
    },
    async listUserConversations(userId, cursor) {
      return pageFrom(await action({ action: 'conversations', scope: userId ?? 'deleted', origin: 'query', cursor }), summaryFrom)
    },
    async getConversation(id) {
      return detailFrom(await action({ action: 'conversation_detail', requestId: id }))
    },
  }
  return api
}
