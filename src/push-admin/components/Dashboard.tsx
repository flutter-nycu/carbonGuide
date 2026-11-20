import { lazy, Suspense, useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import type { AdminRole, AdminTab } from '../auth'
import { visibleAdminTabs } from '../auth'
import SystemPushTab from './SystemPushTab'
import RulesTab from './RulesTab'
import HistoryTab from './HistoryTab'
import UsageTab from './UsageTab'
import logo from '../rag/logo.png'
import type { RagView } from '../rag/pageList'

const RagWorkspace = lazy(() => import('./RagWorkspace'))

const TABS: readonly { key: AdminTab; label: string; description: string; help: string }[] = [
  { key: 'system', label: '系統推播', description: '準備一則清楚、適時的通知，傳遞給使用者。', help: '填寫內容後先預覽受眾；勾選乾跑可檢查發送流程，不會真的傳送通知。' },
  { key: 'rules', label: '個人化規則', description: '依使用者的減碳行動與進度，設定適合的提醒。', help: '先選規則、核對條件與受眾，再儲存或執行。這裡的設定會影響正式推播。' },
  { key: 'history', label: '發送紀錄', description: '查閱近期推播的發送狀態與處理結果。', help: '發送成功代表後端處理結果；裝置是否顯示與開啟通知，仍需另外確認。' },
  { key: 'usage', label: '推播用量', description: '掌握通知服務用量，安排接下來的溝通。', help: '用量來自既有推播服務。讀取失敗時可重新整理，請勿把失敗當成零用量。' },
]
// The top tabs. The last three share one RAG workspace; conversation users is owner-only, like its data.
type TopTab = 'push' | 'rag' | 'conversations' | 'guide'
const WORKSPACES: readonly { key: TopTab; label: string; tag?: string; ownerOnly?: boolean }[] = [
  { key: 'push', label: '推播管理', tag: '正式功能' },
  { key: 'rag', label: 'RAG 知識工作台', tag: '內部測試' },
  { key: 'conversations', label: '使用者', ownerOnly: true },
  { key: 'guide', label: '技術架構導覽' },
]
const ragView = (key: Exclude<TopTab, 'push'>): RagView => (key === 'rag' ? 'workspace' : key)
const workspacesFor = (role: AdminRole) => WORKSPACES.filter(w => !w.ownerOnly || role === 'owner')
// Only the tabs this role can see open from the address; anything else is left to the page (e.g. the skip links).
const fromHash = (hash: string, role: AdminRole) => (hash === '' ? 'push' : workspacesFor(role).find(w => `#${w.key}` === hash)?.key)

interface Props { role: AdminRole; onLogout: () => void | Promise<void> }

export default function Dashboard({ role, onLogout }: Props) {
  const visibleTabs = visibleAdminTabs(role)
  const tabs = TABS.filter(tab => visibleTabs.includes(tab.key))
  const [activeTab, setActiveTab] = useState<AdminTab>(visibleTabs[0])
  const workspaces = workspacesFor(role)
  const [workspace, setWorkspace] = useState<TopTab>(() => fromHash(window.location.hash, role) ?? 'push')
  const [lastRag, setLastRag] = useState<Exclude<TopTab, 'push'>>(workspace === 'push' ? 'rag' : workspace)
  const [ragVisited, setRagVisited] = useState(workspace !== 'push')
  const active = tabs.find(tab => tab.key === activeTab) ?? tabs[0]

  // Only state setters inside, so the hash listener below may keep the first copy. A tab this role cannot see is
  // never opened, whether the address or a page link asks for it.
  function show(next: TopTab) {
    if (!workspacesFor(role).some(w => w.key === next)) return false
    setWorkspace(next)
    if (next !== 'push') { setLastRag(next); setRagVisited(true) }
    return true
  }

  useEffect(() => {
    const navigate = () => {
      const next = fromHash(window.location.hash, role)
      if (next) show(next)
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [role])

  function switchWorkspace(next: TopTab) {
    if (show(next)) window.location.hash = next
  }

  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    document.getElementById('workspace-content')?.focus()
  }

  return <div className="admin-app">
    <a className="admin-skip" href="#workspace-content" onClick={skipToContent}>跳至主要內容</a>
    <header className="admin-header">
      <div className="admin-brand"><img src={logo} alt="" width="40" height="40" /><div>CarbonGuide<small>營運管理工作台</small></div></div>
      <div className="admin-account"><span className="admin-badge">{{ owner: '管理者', editor: '編輯者', viewer: '唯讀者' }[role]}</span><button onClick={onLogout}>登出</button></div>
    </header>
    <nav className="workspace-tabs" aria-label="切換工作台">
      {workspaces.map(w => <button key={w.key} aria-current={workspace === w.key ? 'page' : undefined} onClick={() => switchWorkspace(w.key)}>
        {w.label}{w.tag && <> <span>{w.tag}</span></>}
      </button>)}
    </nav>
    <div id="workspace-content" tabIndex={-1}>
      <div className="push-shell" hidden={workspace !== 'push'}>
        <aside className="push-sidebar">
          <div className="workspace-label"><strong>通知與使用者溝通</strong><small>CarbonGuide · 推播管理</small></div>
          <nav aria-label="推播功能">{tabs.map(tab => <button key={tab.key} aria-current={active.key === tab.key ? 'page' : undefined} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}</nav>
          <p className="sidebar-note">{role === 'viewer' ? '目前為唯讀權限，可查看紀錄與用量。' : '發送前先確認內容、受眾及時間。正式推播會傳送到使用者裝置。'}</p>
        </aside>
        <main className="push-main">
          <div className="admin-breadcrumb">營運工作台 / 推播管理 / {active.label}</div>
          <div className="admin-page-title"><div><h1>{active.label}</h1><p>{active.description}</p></div><span className="admin-badge">正式功能</span></div>
          <details className="admin-help"><summary>操作說明</summary><p>{active.help}</p></details>
          <section className="push-panel" aria-label={active.label}>
            {active.key === 'system' && <SystemPushTab />}
            {active.key === 'rules' && <RulesTab />}
            {active.key === 'history' && <HistoryTab />}
            {active.key === 'usage' && <UsageTab />}
          </section>
        </main>
      </div>
      <div className="rag-panel" hidden={workspace === 'push'}>
        {ragVisited && <Suspense fallback={<p role="status">正在載入 RAG 知識工作台…</p>}>
          <RagWorkspace role={role} active={workspace !== 'push'} view={ragView(lastRag)} onView={v => switchWorkspace(v === 'workspace' ? 'rag' : v)} />
        </Suspense>}
      </div>
    </div>
  </div>
}
