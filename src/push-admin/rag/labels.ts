// Plain labels and formatting shared by the pages.
import type { AccountState, AnswerKind, ProcessStatus, Role } from './api/types'

export const STATUS_LABEL: Record<ProcessStatus, string> = {
  pending: '待處理', processing: '處理中', completed: '完成', failed: '失敗', budget_paused: '預算不足暫停',
}
export const STATUS_TONE: Record<ProcessStatus, '' | 'warn' | 'error' | 'quiet'> = {
  pending: 'quiet', processing: 'warn', completed: '', failed: 'error', budget_paused: 'warn',
}
export const KIND_LABEL: Record<AnswerKind, string> = { qa: '用常見問答回答', document: '用文件回答', insufficient: '資料不足', incomplete: '沒有完成' }
export const KIND_TONE: Record<AnswerKind, '' | 'warn' | 'error'> = { qa: '', document: '', insufficient: 'warn', incomplete: 'error' }
export const ROLE_LABEL: Record<Role, string> = { owner: '管理者', editor: '編輯者', viewer: '唯讀者' }
export const ACCOUNT_LABEL: Record<AccountState, string> = { active: '帳號正常', disabled: '帳號已停用', unverified: 'email 未驗證', deleted: '帳號已刪除' }
export const ACCOUNT_TONE: Record<AccountState, '' | 'warn' | 'error' | 'quiet'> = { active: '', disabled: 'error', unverified: 'warn', deleted: 'quiet' }

/** Non-zero results in a fixed order, e.g. 「用常見問答回答 1、用文件回答 2」. */
export function formatOutcomes(outcomes: Record<AnswerKind, number>): string {
  const parts = (Object.keys(KIND_LABEL) as AnswerKind[]).filter(kind => outcomes[kind] > 0).map(kind => `${KIND_LABEL[kind]} ${outcomes[kind]}`)
  return parts.length ? parts.join('、') : '—'
}

export const PURPOSES = ['生活指引', '研究資料', '參考數據'] as const
export const DOMAINS = ['居家', '交通', '飲食', '生活'] as const

const dateFormat = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
export function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date)
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '還沒有資料'
  if (value === 0) return 'US$0'
  if (value > 0 && value < 0.0001) return '不到 US$0.0001'
  return value < 0.01 ? `US$${value.toFixed(4)}` : `US$${value.toFixed(2)}`
}

export const canEdit = (role: Role) => role === 'owner' || role === 'editor'

// A partial estimate must not look like the total for every model call.
export function formatEstimate(value: number | null | undefined, unknownCalls = 0): string {
  if (unknownCalls <= 0) return formatUsd(value)
  const known = value === null || value === undefined ? '還沒有費用資料' : `已知 ${formatUsd(value)}`
  return `${known}，另有 ${unknownCalls} 筆還沒有用量資料`
}
