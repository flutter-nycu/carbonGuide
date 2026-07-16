import { useState } from 'react'
import type { AdminRole, AdminTab } from '../auth'
import { visibleAdminTabs } from '../auth'
import SystemPushTab from './SystemPushTab'
import RulesTab from './RulesTab'
import HistoryTab from './HistoryTab'
import UsageTab from './UsageTab'

const TABS: readonly { key: AdminTab; label: string }[] = [
  { key: 'system', label: '系統推播' },
  { key: 'rules', label: '個人化規則' },
  { key: 'history', label: '發送紀錄' },
  { key: 'usage', label: '推播用量' },
]

// Tabs that need extra horizontal room (sidebars / wide stat grids).
const WIDE_TABS = new Set(['rules', 'usage'])

interface Props {
  role: AdminRole
  onLogout: () => void | Promise<void>
}
export default function Dashboard({ role, onLogout }: Props) {
  const visibleTabs = visibleAdminTabs(role)
  const tabs = TABS.filter(tab => visibleTabs.includes(tab.key))
  const [activeTab, setActiveTab] = useState<AdminTab>(visibleTabs[0])
  const wideTab = WIDE_TABS.has(activeTab)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800">推播管理後台</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{role}</span>
          <button
            onClick={onLogout}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            登出
          </button>
        </div>
      </header>

      <div className="border-b bg-white px-6">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-sm border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className={`mx-auto p-6 ${wideTab ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {activeTab === 'system' && <SystemPushTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'usage' && <UsageTab />}
      </main>
    </div>
  )
}
