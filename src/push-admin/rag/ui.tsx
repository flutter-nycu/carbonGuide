import type { ReactNode } from 'react'
import { PageHelp } from './PageHelp'

export function PageHeading({ title, description, secondary = false }: { title: string; description: string; secondary?: boolean }) {
  return <header className="rag-page-heading">{secondary ? <h2>{title}</h2> : <h1>{title}</h1>}<p>{description}</p>{!secondary && <PageHelp title={title} />}</header>
}
export function ResourceState({ resource, empty, children }: { resource: { loading: boolean; error: string; connected: boolean; data: unknown[]; reload: () => void }; empty: string; children: ReactNode }) {
  if (!resource.connected) return <p className="rag-empty">連線完成後顯示資料。</p>
  if (resource.loading) return <p className="rag-empty" role="status">正在讀取…</p>
  if (resource.error) return <div className="rag-error" role="alert"><p>{resource.error}</p><button onClick={resource.reload}>重新讀取</button></div>
  if (!resource.data.length) return <p className="rag-empty">{empty}</p>
  return <>{children}{resource.data.length === 200 && <p className="rag-muted">目前顯示前 200 筆資料。</p>}</>
}
export const dateLabel = (value: string) => new Date(value).toLocaleString('zh-TW')
export const processingLabels: Record<string, string> = { pending: '待處理', parsing: '解析中', parsed: '已解析', embedding: '向量化中', ready: '可用', failed: '失敗' }
export const contentLabels: Record<string, string> = { draft: '草稿', in_review: '審核中', approved: '核准', published: '已發布', disabled: '停用', frozen: '已凍結', passed: '通過', failed: '失敗', pending: '待執行', completed: '完成' }
