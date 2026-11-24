// The RAG workspace: a sidebar that folds down to icons, a page select on phones, and pages that stay mounted after
// the first visit. The admin's top tabs pick the view: the sidebar pages, or the users list or the guide on their own.
import { Fragment, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import type { RagApi, Role } from './api/types'
import { Icon, type IconName } from './icons'
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
import { readStored, writeStored } from './storage'
import Tutorial, { useTutorial } from './Tutorial'
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

export const SIDEBAR_KEY = 'rag-sidebar-collapsed'
/** Below this width the sidebar starts folded, unless the admin already chose on this browser. */
const FOLD_BELOW = 1100

function startFolded() {
  const stored = readStored(SIDEBAR_KEY)
  return stored === null ? window.innerWidth < FOLD_BELOW : stored === '1'
}

export default function Workspace({ api, role, active = true, view = 'workspace', onView, renderPage }: Props) {
  // The sidebar page stays chosen while another view is shown, so coming back lands where the admin left.
  const [page, setPage] = useState<PageId>('documents')
  const shown: PageId = view === 'workspace' ? page : view
  const [visited, setVisited] = useState<ReadonlySet<PageId>>(() => new Set<PageId>([shown]))
  if (!visited.has(shown)) setVisited(new Set(visited).add(shown))
  const [folded, setFolded] = useState(startFolded)
  const main = useRef<HTMLElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const tutorial = useTutorial()

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

  function fold() {
    writeStored(SIDEBAR_KEY, folded ? '0' : '1')
    setFolded(!folded)
  }

  function content(id: PageId, readers?: 'owner' | 'editor') {
    // The guide teaches even when the backend is off, and decides itself what each role may read.
    if (id === 'guide') return <ArchitecturePage api={api} role={role} />
    if (!api) return <Notice tone="warn">RAG 後端尚未啟用，這裡還沒有資料。</Notice>
    if (readers === 'owner' && role !== 'owner') return <Notice>這一頁只有管理者可以看。</Notice>
    if (readers === 'editor' && role === 'viewer') return <Notice>這一頁只有管理者和編輯者可以看。</Notice>
    const Page = PAGE_COMPONENTS[id]
    return renderPage?.(id) ?? <Page api={api} role={role} />
  }

  const shell = ['shell', view !== 'workspace' && 'single', folded && 'folded', active && (tutorial.state.open ? 'with-tutorial' : 'with-launcher')]
  return <ToastProvider><NavigateContext.Provider value={go}>
    <a className="skip" href="#main" onClick={event => { event.preventDefault(); main.current?.focus() }}>跳至主要內容</a>
    <div className={shell.filter(Boolean).join(' ')}>
      <aside ref={sidebar} className="sidebar" hidden={view !== 'workspace'}>
        <button type="button" className="side-toggle" aria-expanded={!folded} aria-controls="nav" onClick={fold}>
          <Icon name={folded ? 'expand' : 'collapse'} /><span className="nav-text">{folded ? '展開側欄' : '收合側欄'}</span>
        </button>
        <label className="mobile-nav">前往
          <select id="page-select" aria-label="切換頁面" value={page} onChange={event => go(event.target.value as PageId)}>
            {SIDEBAR_PAGES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <nav id="nav" aria-label="知識庫頁面">
          {SIDEBAR_PAGES.map(p => <Fragment key={p.id}>
            {p.group && <p className="nav-label">{p.group}</p>}
            {/* Folded, the name shows beside the icon on hover and focus; it stays the button's name either way.
                The tutorial's 下一步 mark comes from CSS, so the name stays the page's. */}
            <button type="button" className="nav-button" aria-current={page === p.id ? 'page' : undefined}
              data-tutorial={tutorial.markedPage === p.id ? 'next' : undefined} onClick={() => go(p.id)}>
              <Icon name={p.id as IconName} /><span className="nav-text">{p.label}</span>
            </button>
          </Fragment>)}
        </nav>
      </aside>
      <main id="main" ref={main} tabIndex={-1}>
        {PAGES.filter(p => visited.has(p.id)).map(p => (
          <PageActiveContext.Provider key={p.id} value={active && shown === p.id}>
            <section data-page={p.id} hidden={shown !== p.id}>
              <PageHeader title={p.label} subtitle={p.subtitle}>{content(p.id, p.readers)}</PageHeader>
            </section>
          </PageActiveContext.Provider>
        ))}
      </main>
      {active && <Tutorial tutorial={tutorial} role={role} shown={shown} />}
    </div>
  </NavigateContext.Provider></ToastProvider>
}
