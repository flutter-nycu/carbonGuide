// The RAG workspace: sidebar, mobile page select, and pages that stay mounted after the first visit.
// The admin's top tabs pick the view: the sidebar pages, or conversation users or the guide on their own.
import { Fragment, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import type { RagApi, Role } from './api/types'
import { ROLE_LABEL } from './labels'
import { PAGES, SIDEBAR_PAGES, viewOf, type PageId, type RagView } from './pageList'
import ArchitecturePage from './pages/ArchitecturePage'
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
  /** Set by the admin's top tabs. */
  view?: RagView
  /** Asks the top tabs to switch, e.g. when a page links to the guide. */
  onView?: (view: RagView) => void
  /** Replaces a page's content in tests; returning null keeps the built-in page. The guide always renders itself. */
  renderPage?: (id: PageId) => ReactNode
}

const PAGE_COMPONENTS: Record<Exclude<PageId, 'guide'>, ComponentType<PageProps>> = {
  documents: DocumentsPage, import: ImportPage, playground: PlaygroundPage, evaluation: EvaluationPage, releases: ReleasesPage,
  personas: PersonasPage, prompt: PromptPage, qa: QaPage, settings: SettingsPage, logs: LogsPage, conversations: ConversationsPage,
}

export default function Workspace({ api, role, active = true, view = 'workspace', onView, renderPage }: Props) {
  // The sidebar page stays chosen while another view is shown, so coming back lands where the admin left.
  const [page, setPage] = useState<PageId>('documents')
  const shown: PageId = view === 'workspace' ? page : view
  const [visited, setVisited] = useState<ReadonlySet<PageId>>(() => new Set<PageId>([shown]))
  if (!visited.has(shown)) setVisited(new Set(visited).add(shown))
  const main = useRef<HTMLElement>(null)
  const sidebar = useRef<HTMLElement>(null)

  // A top tab hides the sidebar; focus inside it (e.g. after the browser's back button) would fall to the page.
  useEffect(() => {
    if (view === 'workspace') return
    const root = sidebar.current?.getRootNode() as Document | ShadowRoot | undefined
    if (root?.activeElement && sidebar.current?.contains(root.activeElement)) main.current?.focus()
  }, [view])

  function go(id: PageId) {
    const target = viewOf(id)
    if (target === 'workspace') setPage(id)
    if (target !== view) onView?.(target)
    main.current?.focus()
  }

  function content(id: PageId, readers?: 'owner' | 'editor') {
    // The guide teaches even when the backend is off, and decides itself what each role may read.
    if (id === 'guide') return <ArchitecturePage api={api} role={role} />
    if (!api) return <Notice tone="warn">RAG 後端尚未啟用。開啟之後，這裡會顯示正式知識庫的資料。</Notice>
    if (readers === 'owner' && role !== 'owner') return <Notice>這一頁只有 owner 可以查看。</Notice>
    if (readers === 'editor' && role === 'viewer') return <Notice>這一頁只有 owner 和編輯者可以查看。</Notice>
    const Page = PAGE_COMPONENTS[id]
    return renderPage?.(id) ?? <Page api={api} role={role} />
  }

  return <ToastProvider><NavigateContext.Provider value={go}>
    <a className="skip" href="#main" onClick={event => { event.preventDefault(); main.current?.focus() }}>跳至主要內容</a>
    <div className={view === 'workspace' ? 'shell' : 'shell single'}>
      <aside ref={sidebar} className="sidebar" hidden={view !== 'workspace'}>
        <div className="workspace"><span className="workspace-mark">TW</span><div><strong>臺灣日常減碳</strong><small>RAG 知識工作台</small></div></div>
        <label className="mobile-nav">前往功能
          <select id="page-select" aria-label="切換管理功能" value={page} onChange={event => go(event.target.value as PageId)}>
            {SIDEBAR_PAGES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <nav id="nav" aria-label="RAG 工作台頁面">
          {SIDEBAR_PAGES.map(p => <Fragment key={p.id}>
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
          <PageActiveContext.Provider key={p.id} value={active && shown === p.id}>
            <section data-page={p.id} hidden={shown !== p.id}>
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
