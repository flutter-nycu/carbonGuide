import { useState, useEffect } from 'react'
import { supabase, callEdgeFunction } from '../lib/supabase'

interface PushRule {
  id: string
  rule_key: string
  name: string
  description: string | null
  enabled: boolean
  title_zh: string
  body_zh: string
  route: string | null
  config: {
    multiplier?: number
    limit?: number
    [key: string]: unknown
  }
}
interface ExecSummary {
  ruleKey: string
  audienceCount: number
  sent?: number
  dryRun?: boolean
}
interface ExecResult { success: boolean; processedRules: number; summaries: ExecSummary[] }
interface PreviewResult { success: boolean; audienceCount: number }

// Friendly Chinese labels for the numeric keys that can appear in rule.config.
const CONFIG_LABELS: Record<string, string> = {
  multiplier: '倍率閾值（超過前期幾倍觸發）',
  dominance_pct: '占比閾值（%）',
  approach_pct: '接近目標比例（%）',
  inactive_days: '未填寫天數',
  min_km: '燃油運具每週里程閾值（公里）',
  red_meat_meals: '紅肉每週餐數閾值',
  rate_pct: '任務完成率閾值（%）',
  min_tasks: '本週最少任務數',
  limit: '每次上限人數',
}

// Step / min hints per config key for nicer number inputs.
const CONFIG_INPUT: Record<string, { step?: string; min?: string }> = {
  multiplier: { step: '0.1', min: '1' },
  dominance_pct: { step: '1', min: '1' },
  approach_pct: { step: '1', min: '1' },
  inactive_days: { step: '1', min: '1' },
  min_km: { step: '5', min: '0' },
  red_meat_meals: { step: '1', min: '0' },
  rate_pct: { step: '5', min: '0' },
  min_tasks: { step: '1', min: '1' },
  limit: { step: '1', min: '1' },
}

export default function RulesTab() {
  const [rules, setRules] = useState<PushRule[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [previewCounts, setPreviewCounts] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [execResult, setExecResult] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => { loadRules() }, [])

  function scrollToRule(ruleKey: string) {
    setActiveKey(ruleKey)
    document
      .getElementById(`rule-${ruleKey}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function loadRules() {
    setLoading(true)
    const { data, error } = await supabase.from('push_rules').select('*').order('created_at')
    if (error) setError(error.message)
    else setRules((data ?? []) as PushRule[])
    setLoading(false)
  }

  function updateRule(id: string, patch: Partial<PushRule>) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function updateConfig(id: string, patch: Partial<PushRule['config']>) {
    setRules(prev => prev.map(r =>
      r.id === id ? { ...r, config: { ...r.config, ...patch } } : r
    ))
  }

  async function handleSave(rule: PushRule) {
    setSavingId(rule.id)
    setError(null)
    const { error } = await supabase
      .from('push_rules')
      .update({
        enabled: rule.enabled,
        title_zh: rule.title_zh,
        body_zh: rule.body_zh,
        route: rule.route,
        config: rule.config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rule.id)
    if (error) setError(error.message)
    setSavingId(null)
  }

  async function handlePreview(rule: PushRule) {
    setError(null)
    try {
      const data = await callEdgeFunction<PreviewResult>('preview-push-audience', {
        type: 'personalized',
        ruleKey: rule.rule_key,
      })
      setPreviewCounts(prev => ({ ...prev, [rule.id]: data.audienceCount }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleSendOne(rule: PushRule) {
    if (!confirm(`確定要立即發送「${rule.name}」嗎？`)) return
    setSendingId(rule.id)
    setError(null)
    setExecResult(null)
    try {
      const data = await callEdgeFunction<ExecResult>('send-personalized-push', {
        ruleKey: rule.rule_key,
      })
      const s = data.summaries[0]
      setExecResult(
        s
          ? `「${rule.name}」已發送 ${s.sent ?? 0} 封（受眾 ${s.audienceCount}）`
          : `「${rule.name}」沒有符合條件的受眾`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSendingId(null)
    }
  }

  async function handleExecuteAll() {
    if (!confirm('確定要立即執行所有啟用的個人化推播規則嗎？')) return
    setExecuting(true)
    setError(null)
    setExecResult(null)
    try {
      const data = await callEdgeFunction<ExecResult>('send-personalized-push', {})
      const parts = data.summaries.map(s =>
        `${s.ruleKey}: ${s.sent ?? 0} 封（受眾 ${s.audienceCount}）`
      )
      setExecResult(`執行完成（${data.processedRules} 條規則）：${parts.join('；') || '無'}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExecuting(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-400">載入中...</div>

  return (
    <div className="flex gap-6 items-start">
      {/* Left rule navigator — sticky, click to jump */}
      <nav className="hidden lg:block sticky top-4 w-48 shrink-0 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="text-xs font-medium text-gray-400 px-2 mb-1">
          規則（{rules.length}）
        </div>
        <ul className="space-y-0.5">
          {rules.map(rule => (
            <li key={rule.id}>
              <button
                onClick={() => scrollToRule(rule.rule_key)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-2 transition-colors ${
                  activeKey === rule.rule_key
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title={rule.title_zh}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    rule.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <span className="truncate">{rule.title_zh || rule.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">個人化推播規則</h2>
          <button
            onClick={handleExecuteAll}
            disabled={executing}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {executing ? '執行中...' : '立即執行所有啟用規則'}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}
        {execResult && (
          <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{execResult}</div>
        )}

        {rules.map(rule => (
        <div key={rule.id} id={`rule-${rule.rule_key}`} className="bg-white rounded-xl border p-5 space-y-4 scroll-mt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-medium text-gray-800">{rule.name}</div>
              {rule.description && (
                <div className="text-xs text-gray-400 mt-0.5">{rule.description}</div>
              )}
              <div className="text-xs text-gray-400 mt-1 font-mono">{rule.rule_key}</div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={e => updateRule(rule.id, { enabled: e.target.checked })}
                className="rounded"
              />
              啟用
            </label>
          </div>

          {Object.keys(rule.config).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.keys(rule.config)
                .filter(key => typeof rule.config[key] === 'number')
                .map(key => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">
                      {CONFIG_LABELS[key] ?? key}
                    </label>
                    <input
                      type="number"
                      step={CONFIG_INPUT[key]?.step ?? '1'}
                      min={CONFIG_INPUT[key]?.min ?? '0'}
                      value={rule.config[key] as number}
                      onChange={e =>
                        updateConfig(rule.id, { [key]: parseFloat(e.target.value) })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                ))}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              中文標題
              <span className="text-gray-400 ml-1">（可用 {'{{delta_pct}}'}、{'{{current_month_emission}}'}）</span>
            </label>
            <input
              value={rule.title_zh}
              onChange={e => updateRule(rule.id, { title_zh: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">中文內文</label>
            <textarea
              value={rule.body_zh}
              onChange={e => updateRule(rule.id, { body_zh: e.target.value })}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => handlePreview(rule)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              預覽受眾
            </button>
            <button
              onClick={() => handleSave(rule)}
              disabled={savingId === rule.id}
              className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {savingId === rule.id ? '儲存中...' : '儲存規則'}
            </button>
            <button
              onClick={() => handleSendOne(rule)}
              disabled={sendingId === rule.id}
              className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {sendingId === rule.id ? '發送中...' : '立即發送'}
            </button>
            {previewCounts[rule.id] !== undefined && (
              <span className="text-sm text-teal-600">
                受眾：{previewCounts[rule.id]} 人
              </span>
            )}
          </div>
        </div>
        ))}

        {rules.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-8">尚無推播規則</div>
        )}
      </div>
    </div>
  )
}
