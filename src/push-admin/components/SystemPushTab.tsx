import { useState } from 'react'
import { callEdgeFunction } from '../lib/supabase'

interface PreviewResult { success: boolean; audienceCount: number }
interface SendResult {
  success: boolean
  dryRun?: boolean
  scheduled?: boolean
  campaignId?: string
  audienceCount?: number
  sent?: number
  failed?: number
}
const ROUTES = [
  { value: '/home', label: '首頁 (/home)' },
  { value: '/dashboard', label: '排放總覽 (/dashboard)' },
  { value: '/actions', label: '行動建議 (/actions)' },
  { value: '/news', label: '文章 (/news)' },
  { value: '/questionnaire', label: '問卷 (/questionnaire)' },
]

export default function SystemPushTab() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [route, setRoute] = useState('/home')
  const [scheduledAt, setScheduledAt] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [loading, setLoading] = useState(false)
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePreview() {
    setLoading(true)
    setError(null)
    setAudienceCount(null)
    try {
      const data = await callEdgeFunction<PreviewResult>('preview-push-audience', { type: 'system' })
      setAudienceCount(data.audienceCount)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError('標題和內文為必填')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload: Record<string, unknown> = { title: title.trim(), body: body.trim(), dryRun }
      if (route) payload.route = route
      if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString()

      const data = await callEdgeFunction<SendResult>('send-system-push', payload)

      if (data.dryRun) {
        setResult(`乾跑模式：受眾 ${data.audienceCount ?? 0} 人（未實際發送）`)
      } else if (data.scheduled) {
        setResult(`已排程：受眾 ${data.audienceCount ?? 0} 人，活動 ID: ${data.campaignId}`)
      } else {
        setResult(`發送完成：成功 ${data.sent ?? 0} 封，失敗 ${data.failed ?? 0} 封，活動 ID: ${data.campaignId}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-700">系統推播（全體用戶）</h2>

      <div>
        <label className="block text-sm text-gray-600 mb-1">標題 *</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例：本月碳排提醒"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">內文 *</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="例：記得填寫本月的碳排問卷！"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">點擊路由</label>
        <select
          value={route}
          onChange={e => setRoute(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ROUTES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-1">
          排程時間 <span className="text-gray-400">（留空 = 立即發送）</span>
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={dryRun}
          onChange={e => setDryRun(e.target.checked)}
          className="rounded"
        />
        乾跑模式（不實際發送，僅確認受眾人數）
      </label>

      <div className="flex gap-3 pt-1">
        <button
          onClick={handlePreview}
          disabled={loading}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          預覽受眾
        </button>
        <button
          onClick={handleSend}
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? '處理中...' : dryRun ? '乾跑測試' : '發送推播'}
        </button>
      </div>

      {audienceCount !== null && (
        <div className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
          受眾人數：{audienceCount} 人（已啟用系統通知）
        </div>
      )}
      {result && (
        <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{result}</div>
      )}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}
    </div>
  )
}
