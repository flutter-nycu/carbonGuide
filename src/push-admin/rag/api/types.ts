// Front-end view of the rag-backend-live contract. Field names follow the UI, not the database.

export type Role = 'owner' | 'editor' | 'viewer'

/** Processing state shown for every document and URL. */
export type ProcessStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'budget_paused'

export interface KnowledgeDocument {
  id: string
  title: string
  sourceType: 'pdf' | 'docx' | 'txt' | 'url'
  purpose: string
  domain: string
  citationScope: string
  versionNumber: number
  status: ProcessStatus
  failureReason: string | null
  pageCount: number | null
  chunkCount: number | null
  originalId: string | null
  createdAt: string
}

export interface DocumentChunk {
  id: string
  ordinal: number
  pageStart: number | null
  pageEnd: number | null
  sectionPath: string
  text: string
  excluded: boolean
}

/** The chunk set a detail was read from; corrections are checked against it so two editors cannot overwrite each other. */
export interface RevisionBasis { setId: string; hash: string }

export interface DocumentDetail { document: KnowledgeDocument; chunks: DocumentChunk[]; basis: RevisionBasis | null }

export interface ChunkEdit { ordinal: number; text?: string; exclude: boolean }

export interface UploadResult { outcome: 'uploaded' | 'already_exists' }

export interface UrlEntry {
  id: string
  url: string
  status: ProcessStatus
  failureReason: string | null
  documentId: string | null
  createdAt: string
}

export interface VersionGate {
  evaluated: boolean
  caseCount: number
  passedCount: number
  recallAt5: number | null
  citationValidity: number | null
  /** No answer had a number missing from its sources and none cited outside the version. */
  clean: boolean
}

export interface KnowledgeVersion {
  id: string
  name: string
  createdAt: string
  review: 'awaiting' | 'approved' | 'rejected'
  isActive: boolean
  wasPublished: boolean
  documentCount: number
  gate: VersionGate
}

export interface Budget { budgetUsd: number; reservedUsd: number; expiresAt: string; active: boolean }

export interface TestRound {
  id: string
  versionId: string
  requestLimit: number
  requestCount: number
  budgetUsd: number
  reservedUsd: number
  expiresAt: string
  state: 'active' | 'stopped'
}

/** QA answer, document answer, not enough data, or not completed. */
export type AnswerKind = 'qa' | 'document' | 'insufficient' | 'incomplete'
export type Origin = 'query' | 'evaluation'

export interface Citation { documentTitle: string; page: string | null; section: string; quote: string }
export interface FlowStep { node: string; state: string; durationMs: number; reason: string | null }
export interface ModelCall {
  id: string
  model: string
  purpose: string
  status: string
  reservedUsd: number
  estimatedUsd: number | null
  durationMs: number | null
}

export interface ConversationSummary {
  id: string
  createdAt: string
  origin: Origin
  userLabel: string
  questionPreview: string | null
  kind: AnswerKind
  state: string
  versionName: string
  reservedUsd: number
  estimatedUsd: number | null
}

export interface ConversationDetail extends ConversationSummary {
  question: string | null
  answer: string | null
  reason: string | null
  expired: boolean
  steps: FlowStep[]
  citations: Citation[]
  calls: ModelCall[]
  priceVersion: string
}

export interface ConversationUser {
  userId: string | null
  name: string | null
  email: string | null
  role: Role | null
  count: number
  lastAt: string
  reservedUsd: number
  estimatedUsd: number | null
}

export interface Page<T> { items: T[]; nextCursor: string | null }

export interface Persona { id: string; name: string; example: string; instruction: string; enabled: boolean; updatedAt: string }
export type PersonaInput = Omit<Persona, 'id' | 'updatedAt'>

export interface PromptVersion { id: string; name: string; content: string; updatedAt: string }
export type PromptInput = Omit<PromptVersion, 'id' | 'updatedAt'>

export interface QaCitation { chunkId: string; quote: string }
export interface QaEntry { id: string; question: string; answer: string; sourceNote: string; enabled: boolean; updatedAt: string; citations: QaCitation[] }
export type QaInput = Omit<QaEntry, 'id' | 'updatedAt' | 'citations'>

export interface RetrievalSettings { candidates: number; contextChunks: number; updatedAt: string }
export type SettingsInput = Omit<RetrievalSettings, 'updatedAt'>

export interface EvaluationDataset { id: string; name: string; split: 'development' | 'acceptance'; caseCount: number }
export interface EvaluationBatch { id: string; datasetId: string; versionId: string; completed: number; total: number; finished: boolean; reportId: string | null }
export interface EvaluationStep { complete: boolean; caseId?: string; state?: string }
export interface EvaluationReport {
  id: string
  versionId: string
  split: 'development' | 'acceptance'
  caseCount: number
  passedCount: number
  recallAt5: number | null
  citationValidity: number | null
}

/** Things every concurrent caller must agree on; the backend enforces the same rules. */
export const LIMITS = {
  maxFileBytes: 20 * 1024 * 1024,
  fileFormats: ['pdf', 'docx', 'txt'] as const,
  candidates: { min: 1, max: 50 },
  contextChunks: { min: 1, max: 12 },
  datasetBytes: 64 * 1024,
  qaCitations: 5,
  quoteChars: { min: 5, max: 800 },
  correctionBytes: 1800,
  round: { requestLimit: 20, dailyLimit: 20, budgetUsd: 0.5, days: 7 },
  retentionDays: 180,
} as const

export interface RagApi {
  readonly role: Role
  listDocuments(): Promise<KnowledgeDocument[]>
  getDocument(id: string): Promise<DocumentDetail>
  downloadOriginal(originalId: string): Promise<string>
  classifyDocument(id: string, input: { purpose: string; domain: string; citationScope: string }): Promise<void>
  reviseChunks(documentId: string, edits: ChunkEdit[], reason: string, basis: RevisionBasis | null): Promise<void>
  uploadFile(file: File, onProgress?: (message: string) => void): Promise<UploadResult>
  listUrls(): Promise<UrlEntry[]>
  registerUrl(url: string, requestKey: string): Promise<string>

  listVersions(): Promise<KnowledgeVersion[]>
  createVersion(name: string, requestKey: string): Promise<string>
  reviewVersion(id: string, verdict: 'approve' | 'reject', reason: string, confirmed: boolean, requestKey: string): Promise<void>
  publishVersion(id: string, requestKey: string): Promise<void>
  rollbackVersion(id: string, requestKey: string): Promise<void>
  disableVersion(requestKey: string): Promise<void>

  getBudget(): Promise<Budget>
  getActiveRound(versionId: string): Promise<TestRound | null>
  createRound(versionId: string, requestKey: string): Promise<TestRound>
  stopRound(id: string): Promise<void>
  ask(roundId: string, question: string, requestKey: string): Promise<ConversationDetail>

  listDatasets(): Promise<EvaluationDataset[]>
  registerDataset(dataset: unknown): Promise<string>
  listBatches(): Promise<EvaluationBatch[]>
  beginEvaluation(datasetId: string, versionId: string, requestKey: string): Promise<string>
  nextEvaluation(batchId: string): Promise<EvaluationStep>
  finishEvaluation(batchId: string): Promise<string>
  evaluationReport(id: string): Promise<EvaluationReport>

  listPersonas(): Promise<Persona[]>
  savePersona(input: PersonaInput, previous?: Pick<Persona, 'id' | 'updatedAt'>): Promise<void>
  listPrompts(): Promise<PromptVersion[]>
  savePrompt(input: PromptInput, previous?: Pick<PromptVersion, 'id' | 'updatedAt'>): Promise<void>
  listQa(): Promise<QaEntry[]>
  saveQa(input: QaInput, previous?: Pick<QaEntry, 'id' | 'updatedAt'>): Promise<void>
  saveQaCitations(id: string, updatedAt: string, citations: QaCitation[]): Promise<void>
  getSettings(): Promise<RetrievalSettings>
  saveSettings(input: SettingsInput, updatedAt: string): Promise<void>

  listInteractions(origin: Origin | 'all', cursor: string | null): Promise<Page<ConversationSummary>>
  listConversationUsers(search: string, cursor: string | null): Promise<Page<ConversationUser>>
  listUserConversations(userId: string | null, cursor: string | null): Promise<Page<ConversationSummary>>
  getConversation(id: string): Promise<ConversationDetail>
}

/** Returns a plain-language problem, or null when the settings fit the backend limits. */
export function validateSettings(input: SettingsInput): string | null {
  const { candidates, contextChunks } = LIMITS
  if (!Number.isInteger(input.candidates) || input.candidates < candidates.min || input.candidates > candidates.max) {
    return `先找的資料筆數要是 ${candidates.min} 到 ${candidates.max} 的整數。`
  }
  if (!Number.isInteger(input.contextChunks) || input.contextChunks < contextChunks.min || input.contextChunks > contextChunks.max) {
    return `回答時參考的段數要是 ${contextChunks.min} 到 ${contextChunks.max} 的整數。`
  }
  if (input.contextChunks > input.candidates) return '回答時參考的段數，不能比先找的資料筆數多。'
  return null
}

/** Bytes rag_private.v1_correct_chunks counts for a corrected chunk: the title and section are stored with the text. */
export function correctionBytes(title: string, section: string, text: string): number {
  return new TextEncoder().encode(`文件：${title}\n章節：${section || '未標示'}\n\n${text.trim()}`).length
}

/** Returns the error code for a file the backend would refuse, or null. */
export function fileProblem(file: Pick<File, 'name' | 'size'>): 'unsupported_format' | 'file_too_large' | 'file_empty' | 'file_name_invalid' | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!(LIMITS.fileFormats as readonly string[]).includes(extension) || !file.name.includes('.')) return 'unsupported_format'
  if (file.name.length > 500 || /[\x00-\x1f\x7f/\\]/.test(file.name)) return 'file_name_invalid'
  if (file.size <= 0) return 'file_empty'
  if (file.size > LIMITS.maxFileBytes) return 'file_too_large'
  return null
}

// The same pattern rag_private.v1_register_url checks: a host name with dots, no port, credentials or IP literal.
const URL_PATTERN = /^https:\/\/[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+(\/\S*)?$/

/** Returns an error code for an address the backend would refuse at registration, or null. */
export function urlProblem(raw: string): 'url_source_not_allowed' | null {
  const value = raw.trim()
  if (value.length > 2048 || /[\s\x00-\x1f\x7f#]/.test(value) || !URL_PATTERN.test(value)) return 'url_source_not_allowed'
  // A numeric last label is an IP address in disguise (127.1, 0x7f.0.0.1); real top-level domains are never numbers.
  if (/^https:\/\/[^/]*\.\d+(\/|$)/.test(value)) return 'url_source_not_allowed'
  return null
}
