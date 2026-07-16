import { useState, useEffect } from 'react'
import { callEdgeFunction } from '../lib/supabase'

interface SendWindow {
  sent: number
  failed: number
  total: number
}
interface UsageResult {
  success: boolean
  oneSignal: { totalDevices: number | null; error?: string }
  audience: { marketing: number; system: number }
  sends: Record<string, SendWindow>
}

const SEND_WINDOWS: { key: string; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'month', label: '本月' },
  { key: 'total', label: '累計' },
]

function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'green' | 'red' | 'gray'
}) {
  const toneClass =
    tone === 'green'
      ? 'text-green-600'
      : tone === 'red'
      ? 'text-red-600'
      : tone === 'gray'
      ? 'text-gray-400'
      : 'text-gray-800'
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function UsageTab() {
  const [data, setData] = useState<UsageResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await callEdgeFunction<UsageResult>('onesignal-usage', {})
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="text-sm text-gray-400">載入中...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">推播用量</h2>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          重新整理
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>
      )}

      {data && (
        <>
          {/* Capacity / audience */}
          <div>
            <div className="text-xs font-medium text-gray-400 mb-2">可觸及範圍</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="OneSignal 訂閱裝置數"
                value={
                  data.oneSignal.totalDevices !== null
                    ? data.oneSignal.totalDevices.toLocaleString()
                    : '—'
                }
                sub={
                  data.oneSignal.error
                    ? '無法取得（見下方說明）'
                    : 'OneSignal 記錄的裝置總數'
                }
                tone={data.oneSignal.totalDevices !== null ? 'default' : 'gray'}
              />
              <StatCard
                label="已開啟個人化推播"
                value={data.audience.marketing.toLocaleString()}
                sub="個人化推播可觸及人數"
              />
              <StatCard
                label="已開啟系統推播"
                value={data.audience.system.toLocaleString()}
                sub="系統推播可觸及人數"
              />
            </div>
          </div>

          {/* Send volume */}
          <div>
            <div className="text-xs font-medium text-gray-400 mb-2">發送量</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SEND_WINDOWS.map(w => {
                const s = data.sends[w.key] ?? { sent: 0, failed: 0, total: 0 }
                const rate =
                  s.total > 0 ? Math.round((s.sent / s.total) * 100) : null
                return (
                  <div key={w.key} className="bg-white rounded-xl border p-5">
                    <div className="text-xs text-gray-400 mb-1">{w.label}發送</div>
                    <div className="text-2xl font-semibold text-gray-800">
                      {s.sent.toLocaleString()}
                      <span className="text-sm text-gray-400 font-normal"> 成功</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      失敗 {s.failed.toLocaleString()}・共 {s.total.toLocaleString()}
                      {rate !== null && `・成功率 ${rate}%`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quota note */}
          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-3 leading-relaxed">
            <div className="font-medium text-gray-500 mb-1">關於「剩餘可發送量」</div>
            OneSignal 對行動推播多數方案<span className="text-gray-600">不限制發送則數</span>，
            因此沒有「剩餘則數」這個數值；真正會卡的是<span className="text-gray-600">訂閱裝置數</span>與方案上限
            （免費方案約 1 萬名網頁訂閱者；行動推播訂閱者數量請參考 OneSignal 後台方案頁）。
            上方的訂閱裝置數即為目前的容量指標。
            {data.oneSignal.error && (
              <div className="mt-2 text-red-500">
                OneSignal 訂閱數讀取失敗：{data.oneSignal.error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
