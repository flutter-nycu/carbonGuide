// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RagWorkspace from '../components/RagWorkspace'
import { ragConfiguration } from './config'
import { validateSettings, type EntityMap, type RagRepository, type Settings } from './repository'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })
const settings: Settings = { id: true, service_enabled: false, active_release_id: null, answer_style: 'standard', daily_question_limit: 20, retrieval_candidates: 20, context_chunks: 6, similarity_threshold: .72, qa_threshold: .9, fallback_reply: '資料不足', rewrite_enabled: false, tools_enabled: false, updated_at: '2026-10-25T01:00:00Z' }
function repository(seed: Partial<{ [K in keyof EntityMap]: EntityMap[K][] }> = {}): RagRepository {
  return { listTraces: vi.fn(async () => []), getTrace: vi.fn(async () => null), list: vi.fn(async (kind: keyof EntityMap) => seed[kind] ?? []) as RagRepository['list'], saveDraft: vi.fn(async () => {}), saveSettings: vi.fn(async () => {}) }
}
function nav(name: string) { fireEvent.click(screen.getByRole('button', { name })) }

describe('React RAG foundation', () => {
  it('renders seven real React screens without making data requests when disabled', () => {
    vi.stubEnv('VITE_RAG_ENABLED', 'false')
    const { container } = render(<RagWorkspace role="owner" />)
    expect(container.querySelector('.rag-workspace')?.shadowRoot).toBeNull()
    expect(screen.getByText('RAG 資料尚未連線')).toBeTruthy()
    for (const title of ['通用 QA', '人格與提示詞', '試問', '知識版本', '互動紀錄', 'RAG 設定', '文件與段落']) {
      nav(title)
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    }
    nav('試問')
    expect(screen.getByText('試問服務尚未連線。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '送出一次試問' })).toBeNull()
  })
  it('persists a draft, escapes markup, and preserves failed input for retry', async () => {
    const repo = repository()
    vi.mocked(repo.saveDraft).mockRejectedValueOnce(new Error('權限拒絕')).mockResolvedValueOnce()
    render(<RagWorkspace role="editor" repository={repo} />)
    nav('通用 QA')
    fireEvent.click(screen.getByRole('button', { name: '新增 QA' }))
    fireEvent.change(screen.getByLabelText('問題'), { target: { value: '<img src=x onerror=alert(1)>' } })
    fireEvent.change(screen.getByLabelText('標準回答'), { target: { value: '先減少剩食' } })
    fireEvent.change(screen.getByLabelText('來源說明（尚待核定）'), { target: { value: '指南第 2 頁' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存草稿' }))
    await screen.findByText('權限拒絕')
    expect((screen.getByLabelText('問題') as HTMLInputElement).value).toContain('<img')
    expect(document.querySelector('.rag-workspace img')).toBeNull()
    nav('試問'); nav('通用 QA')
    expect((screen.getByLabelText('標準回答') as HTMLTextAreaElement).value).toBe('先減少剩食')
    fireEvent.click(screen.getByRole('button', { name: '儲存草稿' }))
    await screen.findByText('草稿已儲存，尚未發布。')
    expect(repo.saveDraft).toHaveBeenLastCalledWith('qa_entries', { question: '<img src=x onerror=alert(1)>', answer: '先減少剩食', source_note: '指南第 2 頁', enabled: false }, undefined)
  })
  it('keeps viewer read-only and never requests private logs or usage', async () => {
    const repo = repository({ rag_service_state: [settings] })
    render(<RagWorkspace role="viewer" repository={repo} />)
    nav('通用 QA')
    expect((screen.getByRole('button', { name: '新增 QA' }) as HTMLButtonElement).disabled).toBe(true)
    nav('互動紀錄')
    expect(screen.getByText(/只有管理者可查看互動紀錄/)).toBeTruthy()
    nav('RAG 設定')
    await screen.findByRole('button', { name: '儲存設定草稿' })
    expect((screen.getByLabelText('每人每日題數') as HTMLInputElement).closest('fieldset')?.disabled).toBe(true)
    expect(vi.mocked(repo.list).mock.calls.some(([kind]) => ['rag_runs', 'usage_daily'].includes(kind))).toBe(false)
  })
  it('shows loading, failed load and successful empty retry', async () => {
    const repo = repository()
    let reject!: (reason: Error) => void
    vi.mocked(repo.list).mockImplementationOnce(() => new Promise((_, rejectPromise) => { reject = rejectPromise }))
    render(<RagWorkspace role="owner" repository={repo} />)
    expect(screen.getByText('正在讀取…')).toBeTruthy()
    await act(async () => reject(new Error('連線中斷')))
    fireEvent.click(screen.getByRole('button', { name: '重新讀取' }))
    await screen.findByText('知識庫尚無文件。使用批次工具匯入後，文件會出現在這裡。')
  })
  it('loads version-specific chunks and separates processing from content status', async () => {
    const repo = repository({ documents: [{ id: 'doc', title: '節電指南', source_type: 'pdf', purpose: '生活指引', domain: '居家', created_at: '' }], document_versions: [{ id: 'version', document_id: 'doc', version: 1, processing_status: 'ready', content_status: 'draft', failure_reason: null, created_at: '2026-10-25' }], chunks: [{ id: 'chunk', document_version_id: 'version', ordinal: 1, page_start: 2, page_end: 3, section_path: '居家', original_text: '<script>bad()</script>' }] })
    const list = repo.list
    repo.list = vi.fn(async (kind, filter) => kind === 'chunk_sets'
      ? [{ id: 'set', document_version_id: 'version', content_hash: 'abc', chunker_version: 'v1', sealed: true, created_at: '2026-10-25' }]
      : list(kind, filter)) as RagRepository['list']
    render(<RagWorkspace role="owner" repository={repo} />)
    fireEvent.click(await screen.findByRole('button', { name: '檢視 節電指南' }))
    await screen.findByText('<script>bad()</script>')
    expect(repo.list).toHaveBeenCalledWith('chunks', { column: 'chunk_set_id', value: 'set' })
    expect(document.querySelector('.rag-workspace script')).toBeNull()
    expect(screen.getAllByText('可用').length).toBeGreaterThan(0)
    expect(screen.getAllByText('草稿').length).toBeGreaterThan(0)
  })
  it('saves owner settings and keeps future capabilities disabled', async () => {
    const repo = repository({ rag_service_state: [settings] })
    render(<RagWorkspace role="owner" repository={repo} />)
    nav('RAG 設定')
    fireEvent.change(await screen.findByLabelText('每人每日題數'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存設定草稿' }))
    await waitFor(() => expect(repo.saveSettings).toHaveBeenCalled())
    expect(vi.mocked(repo.saveSettings).mock.calls[0][0].daily_question_limit).toBe(30)
    expect((screen.getByLabelText('工具呼叫（每題最多 3 次）') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('configuration and settings boundaries', () => {
  const configured = { VITE_RAG_ENABLED: 'true', VITE_SUPABASE_URL: 'https://hxsrineeirmxpoovcrba.supabase.co', VITE_RAG_PROJECT_REF: 'hxsrineeirmxpoovcrba' }
  it('requires opt-in and a matching project; permits the user-confirmed target', () => {
    expect(ragConfiguration({}).enabled).toBe(false)
    expect(ragConfiguration(configured).enabled).toBe(true)
    expect(ragConfiguration({ ...configured, VITE_RAG_PROJECT_REF: 'different' }).enabled).toBe(false)
    expect(ragConfiguration({ ...configured, VITE_SUPABASE_URL: 'http://hxsrineeirmxpoovcrba.supabase.co' }).enabled).toBe(false)
    expect(ragConfiguration({ ...configured, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_RAG_PROJECT_REF: 'local' }).enabled).toBe(true)
  })
  it('rejects invalid numerical settings', () => {
    expect(validateSettings(settings)).toBeNull()
    for (const delta of [{ context_chunks: 21 }, { context_chunks: 1.5 }, { daily_question_limit: 0 }, { similarity_threshold: NaN }, { qa_threshold: 1.1 }, { fallback_reply: '  ' }]) expect(validateSettings({ ...settings, ...delta })).not.toBeNull()
  })
})
