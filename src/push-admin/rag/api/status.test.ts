import { describe, expect, it } from 'vitest'
import { answerKind, documentStatus, versionView } from './status'

describe('processing status', () => {
  const version = (processing_status: string, failure_reason: string | null = null) => ({ processing_status, failure_reason })
  const job = (stage: 'parse' | 'embed', status: string, failure_reason: string | null = null, attempt = 1) => ({ stage, status, failure_reason, attempt })

  it('maps the backend pipeline to five plain states', () => {
    expect(documentStatus(version('pending'), 'pending', [])).toEqual({ status: 'pending', reason: null })
    expect(documentStatus(version('pending'), 'verified', [job('parse', 'pending', null, 0)])).toEqual({ status: 'pending', reason: null })
    expect(documentStatus(version('parsing'), 'verified', [job('parse', 'running')])).toEqual({ status: 'processing', reason: null })
    expect(documentStatus(version('parsed'), 'verified', [job('parse', 'completed'), job('embed', 'pending')])).toEqual({ status: 'processing', reason: null })
    expect(documentStatus(version('parsed'), 'verified', [job('parse', 'completed'), job('embed', 'pending', 'campaign_unavailable')]))
      .toEqual({ status: 'budget_paused', reason: 'campaign_unavailable' })
    expect(documentStatus(version('ready'), 'verified', [job('parse', 'completed'), job('embed', 'completed', 'campaign_unavailable')])).toEqual({ status: 'completed', reason: null })
    expect(documentStatus(version('failed', 'parse_failed'), 'verified', [job('parse', 'failed', 'parse_failed')])).toEqual({ status: 'failed', reason: 'parse_failed' })
  })

  it('shows a transient failure as pending until the third attempt', () => {
    expect(documentStatus(version('failed', 'parse_timeout'), 'verified', [job('parse', 'failed', 'parse_timeout', 2)])).toEqual({ status: 'pending', reason: null })
    expect(documentStatus(version('failed', 'parse_timeout'), 'verified', [job('parse', 'failed', 'parse_timeout', 3)])).toEqual({ status: 'failed', reason: 'attempts_exhausted' })
  })

  it('treats an upload that never verified as failed', () => {
    expect(documentStatus(version('pending'), 'failed', [])).toEqual({ status: 'failed', reason: 'original_not_uploaded' })
  })
})

describe('answer kinds', () => {
  it('shows an embedding that failed three times as failed instead of processing forever', () => {
    const parsed = { processing_status: 'parsed', failure_reason: null }
    expect(documentStatus(parsed, 'verified', [{ stage: 'embed', status: 'failed', failure_reason: 'embedding_failed', attempt: 3 },
      { stage: 'parse', status: 'completed', failure_reason: null, attempt: 1 }])).toEqual({ status: 'failed', reason: 'embedding_failed' })
  })

  it('maps request states and reasons to the four result kinds', () => {
    expect(answerKind('answered', 'verified_qa')).toBe('qa')
    expect(answerKind('answered', 'validated')).toBe('document')
    expect(answerKind('abstained', 'insufficient_evidence')).toBe('insufficient')
    expect(answerKind('failed', 'operation_unavailable')).toBe('incomplete')
    expect(answerKind('uncertain', null)).toBe('incomplete')
    expect(answerKind('running', null)).toBe('incomplete')
  })
})

describe('knowledge versions', () => {
  const release = { id: 'r2', name: '候選版', created_at: '2026-11-04T00:00:00Z', chunk_set_ids: ['a', 'b'] }
  it('combines reviews, activations and acceptance evaluations', () => {
    const view = versionView(release, {
      reviews: [{ release_id: 'r2', verdict: 'approve', sequence: 3 }, { release_id: 'r2', verdict: 'reject', sequence: 1 }],
      activations: [{ release_id: 'r1', action: 'publish', sequence: 2 }, { release_id: 'r2', action: 'publish', sequence: 4 }],
      evaluations: [{ release_id: 'r2', data_split: 'development', case_count: 20, passed_count: 19, recall_at_5: 0.9, citation_validity: 0.95, numerical_failures: 0, unpublished_leaks: 0, created_at: '2026-11-04T02:00:00Z' },
        { release_id: 'r2', data_split: 'acceptance', case_count: 40, passed_count: 40, recall_at_5: 0.95, citation_validity: 0.97, numerical_failures: 0, unpublished_leaks: 0, created_at: '2026-11-04T01:00:00Z' }],
    })
    expect(view).toMatchObject({ id: 'r2', review: 'approved', isActive: true, wasPublished: true, documentCount: 2,
      gate: { evaluated: true, caseCount: 40, passedCount: 40, recallAt5: 0.95, citationValidity: 0.97, clean: true } })
  })

  it('uses any acceptance run that passed, like the backend, and counts number or source problems', () => {
    const run = (created_at: string, extra: object) => ({ release_id: 'r2', data_split: 'acceptance', case_count: 40, passed_count: 40, recall_at_5: 0.95, citation_validity: 0.97, numerical_failures: 0, unpublished_leaks: 0, created_at, ...extra })
    const passedEarlier = versionView(release, { reviews: [], activations: [], evaluations: [run('2026-11-04T01:00:00Z', {}), run('2026-11-04T05:00:00Z', { passed_count: 30 })] })
    expect(passedEarlier.gate).toMatchObject({ passedCount: 40, clean: true })
    const leaked = versionView(release, { reviews: [], activations: [], evaluations: [run('2026-11-04T01:00:00Z', { unpublished_leaks: 1 })] })
    expect(leaked.gate).toMatchObject({ evaluated: true, clean: false })
  })

  it('counts a rollback as having been published', () => {
    expect(versionView(release, { reviews: [], activations: [{ release_id: 'r2', action: 'rollback', sequence: 1 }], evaluations: [] }).wasPublished).toBe(true)
  })

  it('knows when nothing is active and when a version was never published', () => {
    const view = versionView(release, { reviews: [], activations: [{ release_id: 'r2', action: 'publish', sequence: 1 }, { release_id: null, action: 'disable', sequence: 2 }], evaluations: [] })
    expect(view).toMatchObject({ review: 'awaiting', isActive: false, wasPublished: true, gate: { evaluated: false } })
    expect(versionView({ ...release, id: 'r9' }, { reviews: [], activations: [], evaluations: [] }).wasPublished).toBe(false)
  })
})
