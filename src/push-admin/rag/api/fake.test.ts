import { describe, expect, it } from 'vitest'
import { createFakeRagApi } from './fake'
import type { Role } from './types'

const NOW = new Date('2026-11-05T08:00:00Z')
const api = (role: Role = 'owner') => createFakeRagApi({ role, now: () => NOW })
const file = (name: string, size = 1024) => new File([new Uint8Array(size)], name)
const code = async (promise: Promise<unknown>) => promise.then(() => 'resolved', (error: { code?: string }) => error.code)

describe('fake RAG API: knowledge and ingestion', () => {
  it('lists documents in every processing status', async () => {
    const statuses = new Set((await api().listDocuments()).map(d => d.status))
    expect([...statuses].sort()).toEqual(['budget_paused', 'completed', 'failed', 'pending', 'processing'])
  })

  it('only lets editors and owners upload, and only PDF, DOCX or TXT up to 20 MB', async () => {
    expect(await code(api('viewer').uploadFile(file('a.pdf')))).toBe('editor_required')
    const editor = api('editor')
    expect(await code(editor.uploadFile(file('coefficients.json')))).toBe('unsupported_format')
    expect(await code(editor.uploadFile(file('big.pdf', 20 * 1024 * 1024 + 1)))).toBe('file_too_large')
    expect(await code(editor.uploadFile(file('empty.txt', 0)))).toBe('file_empty')
    expect((await editor.uploadFile(file('新手冊.docx'))).outcome).toBe('uploaded')
    expect((await editor.uploadFile(file('新手冊.docx'))).outcome).toBe('already_exists')
    const added = (await editor.listDocuments()).find(d => d.title === '新手冊.docx')!
    expect(added.status).toBe('pending')
    editor.advanceProcessing()
    editor.advanceProcessing()
    expect((await editor.listDocuments()).find(d => d.id === added.id)!.status).toBe('completed')
  })

  it('accepts any https PDF address and fails non-PDF downloads', async () => {
    const editor = api('editor')
    expect(await code(editor.registerUrl('http://example.org/a.pdf', 'k1'))).toBe('url_source_not_allowed')
    expect(await code(editor.registerUrl('https://192.168.0.1/a.pdf', 'k2'))).toBe('url_source_not_allowed')
    expect(await code(editor.registerUrl('https://user:pw@example.org/a.pdf', 'k3'))).toBe('url_source_not_allowed')
    const pdf = await editor.registerUrl('https://example.org/report.pdf', 'k4')
    expect(await editor.registerUrl('https://example.org/report.pdf', 'k4')).toBe(pdf)
    const page = await editor.registerUrl('https://example.org/news', 'k5')
    editor.advanceProcessing()
    editor.advanceProcessing()
    const urls = await editor.listUrls()
    expect(urls.find(u => u.id === pdf)!.status).toBe('completed')
    expect(urls.find(u => u.id === page)).toMatchObject({ status: 'failed', failureReason: 'url_not_pdf' })
  })

  it('shows chunks for a document and records exclusions', async () => {
    const editor = api('editor')
    const doc = (await editor.listDocuments()).find(d => d.status === 'completed')!
    const detail = await editor.getDocument(doc.id)
    expect(detail.chunks.length).toBeGreaterThan(0)
    await editor.reviseChunks(doc.id, [{ ordinal: detail.chunks[0].ordinal, exclude: true }], '內容過期', detail.basis)
    const after = await editor.getDocument(doc.id)
    expect(after.chunks.find(c => c.excluded)?.text).toBe(detail.chunks[0].text)
    expect(after.chunks.filter(c => !c.excluded).map(c => c.ordinal)).toEqual(detail.chunks.slice(1).map((_, i) => i + 1))
    expect(await code(editor.reviseChunks(doc.id, [{ ordinal: 1, exclude: true }], '晚一步', detail.basis))).toBe('source_version_changed')
    expect(await code(api('viewer').reviseChunks(doc.id, [{ ordinal: 1, exclude: true }], 'x', null))).toBe('editor_required')
  })
})

describe('fake RAG API: playground', () => {
  it('creates a test round with the default limits for owners only', async () => {
    const owner = api()
    const version = (await owner.listVersions()).find(v => v.isActive)!
    expect(await code(api('editor').createRound(version.id, 'r'))).toBe('owner_required')
    const round = await owner.createRound(version.id, 'round-key')
    expect(round).toMatchObject({ requestLimit: 20, requestCount: 0, budgetUsd: 0.5, state: 'active' })
    expect(new Date(round.expiresAt).getTime() - NOW.getTime()).toBe(7 * 24 * 3600 * 1000)
    expect((await owner.createRound(version.id, 'round-key')).id).toBe(round.id)
    expect((await owner.getActiveRound(version.id))!.id).toBe(round.id)
  })

  it('answers from QA, from documents with citations, or says there is not enough data', async () => {
    const owner = api()
    const version = (await owner.listVersions()).find(v => v.isActive)!
    const round = await owner.createRound(version.id, 'round')
    const qa = await owner.ask(round.id, '如何減少食物浪費？', 'q1')
    expect(qa.kind).toBe('qa')
    const doc = await owner.ask(round.id, '每月少用 20 度電，少多少碳排？', 'q2')
    expect(doc.kind).toBe('document')
    expect(doc.citations[0].documentTitle).toBe('綠生活指引.pdf')
    expect(doc.steps.map(s => s.node)).toContain('hybrid_retrieval')
    expect(doc.calls.length).toBeGreaterThan(0)
    expect(doc.priceVersion).toBe('google-standard-text-2026-10-26')
    const none = await owner.ask(round.id, '量子電池能減碳多少？', 'q3')
    expect(none.kind).toBe('insufficient')
    expect(none.citations).toEqual([])
  })

  it('charges once when the same request key is sent again', async () => {
    const owner = api()
    const version = (await owner.listVersions()).find(v => v.isActive)!
    const round = await owner.createRound(version.id, 'round')
    const before = (await owner.getBudget()).reservedUsd
    const first = await owner.ask(round.id, '每月少用 20 度電，少多少碳排？', 'same')
    expect(first.reservedUsd).toBeGreaterThan(0)
    const again = await owner.ask(round.id, '每月少用 20 度電，少多少碳排？', 'same')
    expect(again.id).toBe(first.id)
    expect((await owner.getActiveRound(version.id))!.requestCount).toBe(1)
    expect((await owner.getBudget()).reservedUsd).toBeCloseTo(before + first.reservedUsd, 6)
  })

  it('refuses to ask when the AI budget is used up', async () => {
    const owner = createFakeRagApi({ role: 'owner', now: () => NOW, budgetUsd: 3.66 })
    const version = (await owner.listVersions()).find(v => v.isActive)!
    const round = await owner.createRound(version.id, 'round')
    expect(await code(owner.ask(round.id, '如何減少食物浪費？', 'x'))).toBe('campaign_closed')
  })
})

describe('fake RAG API: conversations', () => {
  it('lists users who asked questions, newest first, for owners only', async () => {
    expect(await code(api('editor').listConversationUsers('', null))).toBe('owner_required')
    const page = await api().listConversationUsers('', null)
    const times = page.items.map(u => u.lastAt)
    expect([...times].sort().reverse()).toEqual(times)
    expect(page.items.some(u => u.userId === null)).toBe(true)
    for (const user of page.items) expect(user.count).toBeGreaterThan(0)
    expect(page.items.every(u => Object.keys(u).sort().join() === 'count,email,estimatedUsd,lastAt,name,reservedUsd,role,userId')).toBe(true)
    const found = await api().listConversationUsers('owner@', null)
    expect(found.items).toHaveLength(1)
  })

  it('shows a person’s conversations and marks expired details', async () => {
    const owner = api()
    const user = (await owner.listConversationUsers('owner@', null)).items[0]
    const list = await owner.listUserConversations(user.userId, null)
    expect(list.items.length).toBeGreaterThan(1)
    const expired = list.items.find(c => c.questionPreview === null)!
    const detail = await owner.getConversation(expired.id)
    expect(detail).toMatchObject({ expired: true, question: null, answer: null, steps: [], citations: [] })
    expect(detail.calls.length).toBeGreaterThan(0)
  })

  it('filters interaction history by origin', async () => {
    const owner = api()
    const all = await owner.listInteractions('all', null)
    const evaluation = await owner.listInteractions('evaluation', null)
    expect(evaluation.items.length).toBeGreaterThan(0)
    expect(evaluation.items.every(i => i.origin === 'evaluation')).toBe(true)
    expect(all.items.length).toBeGreaterThan(evaluation.items.length)
  })
})

describe('fake RAG API: versions, evaluation and editing', () => {
  it('blocks publishing until review and acceptance evaluation pass', async () => {
    const owner = api()
    const candidate = (await owner.listVersions()).find(v => !v.wasPublished)!
    expect(await code(owner.publishVersion(candidate.id, 'p'))).toBe('human_approval_required')
    await owner.reviewVersion(candidate.id, 'approve', '內容已核對', true, 'rv')
    expect(await code(owner.publishVersion(candidate.id, 'p2'))).toBe('evaluation_gate_required')
    expect(await code(owner.rollbackVersion(candidate.id, 'rb'))).toBe('rollback_target_unpublished')
  })

  it('accepts acceptance datasets without calculation cases and rejects short ones', async () => {
    const owner = api()
    const kinds = ['retrieval', 'retrieval', 'abstention', 'safety', 'qa', 'persona', 'retrieval', 'abstention', 'safety', 'retrieval']
    const cases = (n: number, pick = (i: number) => kinds[i % kinds.length]) => Array.from({ length: n }, (_, i) => ({
      id: `case-${i}`, category: pick(i), input: { question: `問題 ${i}`, persona_id: null, tool_requests: [] },
      expected: { state: ['abstention', 'safety'].includes(pick(i)) ? 'abstained' : 'answered' },
    }))
    const dataset = (split: string, list: unknown[]) => ({ schema: 'rag-v1-evaluation-1', name: '驗收', split, cases: list })
    expect(await owner.registerDataset(dataset('acceptance', cases(40)))).toMatch(/.+/)
    expect(await code(owner.registerDataset(dataset('acceptance', cases(38))))).toBe('invalid_dataset')
    expect(await code(owner.registerDataset({ name: '舊格式', data_split: 'acceptance', cases: cases(40) }))).toBe('invalid_dataset')
    const noPersona = cases(40, i => (kinds[i % kinds.length] === 'persona' ? 'retrieval' : kinds[i % kinds.length]))
    expect(await code(owner.registerDataset(dataset('acceptance', noPersona)))).toBe('dataset_coverage_required')
  })

  it('detects edit conflicts on personas', async () => {
    const editor = api('editor')
    const persona = (await editor.listPersonas())[0]
    await editor.savePersona({ name: persona.name, example: '新的範例', instruction: persona.instruction, enabled: true }, persona)
    expect(await code(editor.savePersona({ name: '舊', example: '舊', instruction: '舊', enabled: true }, persona))).toBe('draft_changed')
  })

  it('validates retrieval settings before saving', async () => {
    const owner = api()
    const settings = await owner.getSettings()
    expect(await code(owner.saveSettings({ candidates: 5, contextChunks: 6 }, settings.updatedAt))).toBe('settings_invalid')
    await owner.saveSettings({ candidates: 30, contextChunks: 8 }, settings.updatedAt)
    expect(await owner.getSettings()).toMatchObject({ candidates: 30, contextChunks: 8 })
  })
})
