import { useEffect, useRef, useState } from 'react'
import type { AdminRole } from '../auth'
import { ragConfiguration } from '../rag/config'
import type { RagRepository } from '../rag/repository'
import { DocumentsPage, DraftsPage, LogsPage, PlaygroundPage, ReleasesPage, SettingsPage } from '../rag/pages'
import '../rag/workspace.css'

const pages = [
  ['documents', '文件與段落', '知識內容'], ['qa', '通用 QA', '知識內容'],
  ['personas', '人格與提示詞', '教練'], ['playground', '試問', '驗證與發布'],
  ['releases', '知識版本', '驗證與發布'], ['logs', '互動紀錄', '紀錄與設定'],
  ['settings', 'RAG 設定', '紀錄與設定'],
] as const
type Page = typeof pages[number][0]

export default function RagWorkspace({ role, repository, active = true }: { role: AdminRole; repository?: RagRepository; active?: boolean }) {
  const [page, setPage] = useState<Page>('documents')
  const [visited, setVisited] = useState<Set<Page>>(new Set(['documents']))
  const [repo, setRepo] = useState<RagRepository | null>(repository ?? null)
  const [connectionError, setConnectionError] = useState('')
  const main = useRef<HTMLElement>(null)
  const configuration = ragConfiguration(import.meta.env)

  useEffect(() => {
    if (repository || !configuration.enabled) return
    let current = true
    import('../rag/supabase-repository').then(({ createRagRepository }) => {
      if (current) setRepo(createRagRepository())
    }).catch(() => { if (current) setConnectionError('無法初始化資料連線，請重新載入頁面。') })
    return () => { current = false }
  }, [repository, configuration.enabled])

  function navigate(next: Page) {
    setPage(next)
    setVisited(previous => new Set([...previous, next]))
    main.current?.focus()
  }
  return <div className="rag-workspace rag-v1" aria-label="RAG 知識工作台">
    <aside className="rag-sidebar">
      <div className="rag-identity"><span>RAG / 01</span><strong>氣候教練知識庫</strong><small>內容準備與版本管理</small></div>
      <nav aria-label="RAG 功能">{pages.map(([key, label, group], index) => <div key={key}>
        {(index === 0 || pages[index - 1][2] !== group) && <p className="rag-nav-group">{group}</p>}
        <button aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>
      </div>)}</nav>
        <p className="rag-side-note">文件準備、版本試問與評測<br />內容待人工審閱，公開服務尚未啟用。</p>
    </aside>
    <main ref={main} tabIndex={-1} className="rag-main">
      {!repo && <div className="rag-notice" role="status"><strong>{connectionError || (configuration.enabled ? '正在建立資料連線…' : 'RAG 資料尚未連線')}</strong><p>{configuration.message}</p></div>}
      {role === 'viewer' && <p className="rag-notice">目前為唯讀權限。可檢視知識內容，無法儲存草稿。</p>}
      {visited.has('documents') && <section hidden={page !== 'documents'}><DocumentsPage repo={repo} role={role} /></section>}
      {visited.has('qa') && <section hidden={page !== 'qa'}><DraftsPage repo={repo} role={role} kind="qa_entries" /></section>}
      {visited.has('personas') && <section hidden={page !== 'personas'}><DraftsPage repo={repo} role={role} kind="personas" /><DraftsPage repo={repo} role={role} kind="prompts" secondary /></section>}
      {visited.has('playground') && <section hidden={page !== 'playground'}><PlaygroundPage repo={repo} role={role} active={active && page === 'playground'} /></section>}
      {visited.has('releases') && <section hidden={page !== 'releases'}><ReleasesPage repo={repo} role={role} /></section>}
      {visited.has('logs') && <section hidden={page !== 'logs'}><LogsPage repo={repo} role={role} /></section>}
      {visited.has('settings') && <section hidden={page !== 'settings'}><SettingsPage repo={repo} role={role} /></section>}
    </main>
  </div>
}
