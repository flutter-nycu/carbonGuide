// The RAG workspace: sidebar, mobile page select, and pages that stay mounted after the first visit.
import { Fragment, useRef, useState, type ComponentType, type ReactNode } from 'react'
import type { RagApi, Role } from './api/types'
import { ROLE_LABEL } from './labels'
import { PAGES, type PageId } from './pageList'
import ConversationsPage from './pages/ConversationsPage'
import DocumentsPage from './pages/DocumentsPage'
import EvaluationPage from './pages/EvaluationPage'
import ImportPage from './pages/ImportPage'
import LogsPage from './pages/LogsPage'
import PersonasPage from './pages/PersonasPage'
import PlaygroundPage from './pages/PlaygroundPage'
import PromptPage from './pages/PromptPage'
import QaPage from './pages/QaPage'
import ReleasesPage from './pages/ReleasesPage'
import SettingsPage from './pages/SettingsPage'
import { NavigateContext, Notice, PageActiveContext, PageHeader, ToastProvider, type PageProps } from './ui'

interface Props {
  api: RagApi | null
  role: Role
  /** False while the push workspace is shown; pages pause polling and close dialogs. */
  active?: boolean
  /** Replaces a page's content in tests; returning null keeps the built-in page. */
  renderPage?: (id: PageId) => ReactNode
}

const PAGE_COMPONENTS: Record<PageId, ComponentType<PageProps>> = {
  documents: DocumentsPage, import: ImportPage, playground: PlaygroundPage, evaluation: EvaluationPage, releases: ReleasesPage,
  personas: PersonasPage, prompt: PromptPage, qa: QaPage, settings: SettingsPage, logs: LogsPage, conversations: ConversationsPage,
}

export default function Workspace({ api, role, active = true, renderPage }: Props) {
  const [page, setPage] = useState<PageId>('documents')
  const [visited, setVisited] = useState<ReadonlySet<PageId>>(() => new Set<PageId>(['documents']))
  const main = useRef<HTMLElement>(null)

  function go(id: PageId) {
    setPage(id)
    setVisited(previous => (previous.has(id) ? previous : new Set(previous).add(id)))
    main.current?.focus()
  }

  function content(id: PageId, readers?: 'owner' | 'editor') {
    if (!api) return <Notice tone="warn">RAG 後端尚未啟用。開啟之後，這裡會顯示正式知識庫的資料。</Notice>
    if (readers === 'owner' && role !== 'owner') return <Notice>這一頁只有 owner 可以查看。</Notice>
    if (readers === 'editor' && role === 'viewer') return <Notice>這一頁只有 owner 和編輯者可以查看。</Notice>
    const Page = PAGE_COMPONENTS[id]
    return renderPage?.(id) ?? <Page api={api} role={role} />
  }

  return <ToastProvider><NavigateContext.Provider value={go}>
    <a className="skip" href="#main" onClick={event => { event.preventDefault(); main.current?.focus() }}>跳至主要內容</a>
    <div className="shell">
      <aside className="sidebar">
        <div className="workspace"><span className="workspace-mark">TW</span><div><strong>臺灣日常減碳</strong><small>RAG 知識工作台</small></div></div>
        <label className="mobile-nav">前往功能
          <select id="page-select" aria-label="切換管理功能" value={page} onChange={event => go(event.target.value as PageId)}>
            {PAGES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <nav id="nav" aria-label="RAG 工作台頁面">
          {PAGES.map(p => <Fragment key={p.id}>
            {p.group && <p className="nav-label">{p.group}</p>}
            <button type="button" className="nav-button" aria-current={page === p.id ? 'page' : undefined} onClick={() => go(p.id)}>
              <span>{p.number}</span>{p.label}
            </button>
          </Fragment>)}
        </nav>
        <div className="side-note"><strong>{ROLE_LABEL[role]}</strong><p>{api ? '畫面上是正式知識庫的資料。' : 'RAG 後端尚未啟用。'}</p></div>
      </aside>
      <main id="main" ref={main} tabIndex={-1}>
        {PAGES.filter(p => visited.has(p.id)).map(p => (
          <PageActiveContext.Provider key={p.id} value={active && page === p.id}>
            <section data-page={p.id} hidden={page !== p.id}>
              <PageHeader title={p.title} subtitle={p.subtitle} breadcrumb={p.label} />
              {content(p.id, p.readers)}
            </section>
          </PageActiveContext.Provider>
        ))}
        <p className="footnote">CarbonGuide · RAG 知識工作台</p>
      </main>
    </div>
  </NavigateContext.Provider></ToastProvider>
}
