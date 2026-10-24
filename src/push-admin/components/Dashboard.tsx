import { useEffect, useState } from 'react'
import type { AdminRole, AdminTab } from '../auth'
import { visibleAdminTabs } from '../auth'
import SystemPushTab from './SystemPushTab'
import RulesTab from './RulesTab'
import HistoryTab from './HistoryTab'
import UsageTab from './UsageTab'
import RagWorkspace from './RagWorkspace'
import logo from '../rag/logo.png'

const TABS: readonly { key: AdminTab; label: string; description: string; help: string }[] = [
  { key: 'system', label: '系統推播', description: '準備一則清楚、適時的通知，傳遞給使用者。', help: '填寫內容後先預覽受眾；勾選乾跑可檢查發送流程，不會真的傳送通知。' },
  { key: 'rules', label: '個人化規則', description: '依使用者的減碳行動與進度，設定適合的提醒。', help: '先選規則、核對條件與受眾，再儲存或執行。這裡的設定會影響正式推播。' },
  { key: 'history', label: '發送紀錄', description: '查閱近期推播的發送狀態與處理結果。', help: '發送成功代表後端處理結果；裝置是否顯示與開啟通知，仍需另外確認。' },
  { key: 'usage', label: '推播用量', description: '掌握通知服務用量，安排接下來的溝通。', help: '用量來自既有推播服務。讀取失敗時可重新整理，請勿把失敗當成零用量。' },
]
interface Props { role: AdminRole; onLogout: () => void | Promise<void> }

export default function Dashboard({ role, onLogout }: Props) {
  const visibleTabs = visibleAdminTabs(role)
  const tabs = TABS.filter(tab => visibleTabs.includes(tab.key))
  const [activeTab, setActiveTab] = useState<AdminTab>(visibleTabs[0])
  const [workspace, setWorkspace] = useState(() => window.location.hash === '#rag' ? 'rag' : 'push')
  const [ragVisited, setRagVisited] = useState(workspace === 'rag')
  const active = tabs.find(tab => tab.key === activeTab) ?? tabs[0]

  useEffect(() => {
    const navigate = () => {
      const next = window.location.hash === '#rag' ? 'rag' : 'push'
      setWorkspace(next)
      if (next === 'rag') setRagVisited(true)
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

  function switchWorkspace(next: string) {
    setWorkspace(next)
    if (next === 'rag') setRagVisited(true)
    window.location.hash = next
  }

  return <div className="admin-app">
    <a className="admin-skip" href="#workspace-content">跳至主要內容</a>
    <header className="admin-header">
      <div className="admin-brand"><img src={logo} alt="" width="40" height="40" /><div>CarbonGuide<small>營運管理工作台</small></div></div>
      <div className="admin-account"><span className="admin-badge">{{ owner: '管理者', editor: '編輯者', viewer: '唯讀者' }[role]}</span><button onClick={onLogout}>登出</button></div>
    </header>
    <nav className="workspace-tabs" aria-label="切換工作台">
      <button aria-current={workspace === 'push' ? 'page' : undefined} onClick={() => switchWorkspace('push')}>推播管理 <span>正式功能</span></button>
      <button aria-current={workspace === 'rag' ? 'page' : undefined} onClick={() => switchWorkspace('rag')}>RAG 知識工作台 <span>假資料示範</span></button>
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
      <div hidden={workspace !== 'rag'}>{ragVisited && <RagWorkspace />}</div>
    </div>
  </div>
}
