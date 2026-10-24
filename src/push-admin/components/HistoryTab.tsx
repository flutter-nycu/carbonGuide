import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Campaign {
  id: string
  type: string
  status: string
  title: string
  audience_count: number | null
  success_count: number | null
  failure_count: number | null
  created_at: string
}
const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  sending: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-teal-100 text-teal-700',
  draft: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-400',
}

const STATUS_LABEL: Record<string, string> = {
  sent: '已發送',
  failed: '失敗',
  sending: '發送中',
  scheduled: '已排程',
  draft: '草稿',
  cancelled: '已取消',
}

export default function HistoryTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('push_campaigns')
      .select('id, type, status, title, audience_count, success_count, failure_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) setError(error.message)
    else setCampaigns((data ?? []) as Campaign[])
    setLoading(false)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">發送紀錄</h2>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          重新整理
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">載入中...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-12">尚無發送紀錄</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium whitespace-nowrap">時間</th>
                  <th className="px-4 py-3 text-left font-medium">類型</th>
                  <th className="px-4 py-3 text-left font-medium">狀態</th>
                  <th className="px-4 py-3 text-left font-medium">標題</th>
                  <th className="px-4 py-3 text-right font-medium">受眾</th>
                  <th className="px-4 py-3 text-right font-medium">成功</th>
                  <th className="px-4 py-3 text-right font-medium">失敗</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.type === 'system' ? '系統' : '個人化'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs">
                      <div className="truncate">{c.title}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{c.audience_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{c.success_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-red-500">{c.failure_count ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
