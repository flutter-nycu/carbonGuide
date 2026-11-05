// Pure derivations from backend rows to what the workspace shows. Kept separate so they are tested without a client.
import type { AnswerKind, KnowledgeVersion, ProcessStatus } from './types'

const TRANSIENT = new Set(['parse_timeout', 'download_failed', 'worker_error'])
const MAX_ATTEMPTS = 3

interface VersionRow { processing_status: string; failure_reason: string | null }
interface JobRow { stage: 'parse' | 'embed'; status: string; failure_reason: string | null; attempt: number }

/** Latest parse and embed jobs of a document's newest version → one of five states. */
export function documentStatus(version: VersionRow, uploadState: string, jobs: JobRow[]): { status: ProcessStatus; reason: string | null } {
  if (uploadState === 'failed') return { status: 'failed', reason: 'original_not_uploaded' }
  if (version.processing_status === 'ready') return { status: 'completed', reason: null }
  const parse = jobs.find(j => j.stage === 'parse')
  const embed = jobs.find(j => j.stage === 'embed')
  if (version.processing_status === 'failed' || parse?.status === 'failed') {
    const reason = parse?.failure_reason ?? version.failure_reason ?? 'parse_failed'
    if (TRANSIENT.has(reason)) return parse && parse.attempt >= MAX_ATTEMPTS ? { status: 'failed', reason: 'attempts_exhausted' } : { status: 'pending', reason: null }
    return { status: 'failed', reason }
  }
  if (embed?.status === 'pending' && embed.failure_reason === 'campaign_unavailable') return { status: 'budget_paused', reason: 'campaign_unavailable' }
  if (embed?.status === 'failed') return { status: 'failed', reason: embed.failure_reason ?? 'embedding_failed' }
  if (version.processing_status === 'parsing' || version.processing_status === 'parsed' || parse?.status === 'running') return { status: 'processing', reason: null }
  return { status: 'pending', reason: null }
}

export function answerKind(state: string, reason: string | null): AnswerKind {
  if (state === 'answered') return reason === 'verified_qa' ? 'qa' : 'document'
  if (state === 'abstained') return 'insufficient'
  return 'incomplete'
}

interface ReleaseRow { id: string; name: string; created_at: string; chunk_set_ids: unknown }
interface ReviewRow { release_id: string; verdict: string; sequence: number }
interface ActivationRow { release_id: string | null; action: string; sequence: number }
interface EvaluationRow {
  release_id: string; data_split: string; case_count: number; passed_count: number; recall_at_5: number | null; citation_validity: number | null
  numerical_failures: number; unpublished_leaks: number; created_at: string
}

// rag_private.v1_activate publishes when any acceptance run of the version met all of these.
const passes = (e: EvaluationRow) => e.case_count >= 40 && e.passed_count === e.case_count && Number(e.recall_at_5) >= 0.9
  && Number(e.citation_validity) >= 0.95 && Number(e.numerical_failures) === 0 && Number(e.unpublished_leaks) === 0

export function versionView(release: ReleaseRow, history: { reviews: ReviewRow[]; activations: ActivationRow[]; evaluations: EvaluationRow[] }): KnowledgeVersion {
  const latestReview = history.reviews.filter(r => r.release_id === release.id).sort((a, b) => b.sequence - a.sequence)[0]
  const latestActivation = [...history.activations].sort((a, b) => b.sequence - a.sequence)[0]
  const runs = history.evaluations.filter(e => e.release_id === release.id && e.data_split === 'acceptance')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const acceptance = runs.find(passes) ?? runs[0]
  const rate = (value: number | null) => (value === null ? null : Number(value))
  return {
    id: release.id,
    name: release.name,
    createdAt: release.created_at,
    review: !latestReview ? 'awaiting' : latestReview.verdict === 'approve' ? 'approved' : 'rejected',
    isActive: latestActivation?.release_id === release.id,
    wasPublished: history.activations.some(a => a.release_id === release.id && (a.action === 'publish' || a.action === 'rollback')),
    documentCount: Array.isArray(release.chunk_set_ids) ? release.chunk_set_ids.length : 0,
    gate: acceptance
      ? { evaluated: true, caseCount: acceptance.case_count, passedCount: acceptance.passed_count, recallAt5: rate(acceptance.recall_at_5),
        citationValidity: rate(acceptance.citation_validity), clean: Number(acceptance.numerical_failures) === 0 && Number(acceptance.unpublished_leaks) === 0 }
      : { evaluated: false, caseCount: 0, passedCount: 0, recallAt5: null, citationValidity: null, clean: false },
  }
}
