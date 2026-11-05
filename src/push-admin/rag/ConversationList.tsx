// Conversation lists for the history and users pages, and the dialog that opens one conversation.
import type { ConversationSummary, RagApi } from './api/types'
import ConversationView from './ConversationView'
import { useLoader, type Paged } from './hooks'
import { KIND_LABEL, KIND_TONE, formatDate, formatUsd } from './labels'
import { Dialog, Notice } from './ui'

export function ConversationTable({ label, paged, showUser, onOpen }: {
  label: string
  paged: Paged<ConversationSummary>
  showUser?: boolean
  onOpen: (id: string) => void
}) {
  if (paged.error) return <Notice tone="error">{paged.error}</Notice>
  if (!paged.items) return <p className="empty" role="status">正在讀取對話…</p>
  return <>
    <div className="table-wrap"><table aria-label={label}>
      <thead><tr><th>問題</th>{showUser && <th>使用者</th>}<th>結果</th><th>知識版本</th><th>估計費用</th><th>操作</th></tr></thead>
      <tbody>
        {paged.items.map(c => <tr key={c.id}>
          <td>{c.questionPreview ?? <span className="muted">內容已超過保存期限</span>}
            <small>{formatDate(c.createdAt)} · {c.origin === 'evaluation' ? '自動評測' : '人工試問'}</small></td>
          {showUser && <td>{c.userLabel}</td>}
          <td><span className={`tag ${KIND_TONE[c.kind]}`.trim()}>{KIND_LABEL[c.kind]}</span></td>
          <td>{c.versionName || '—'}</td>
          <td>{formatUsd(c.estimatedUsd)}<small>預留 {formatUsd(c.reservedUsd)}</small></td>
          <td><button type="button" className="text-button" aria-label={`檢視 ${formatDate(c.createdAt)} 的對話`} onClick={() => onOpen(c.id)}>檢視 →</button></td>
        </tr>)}
        {!paged.items.length && <tr><td colSpan={showUser ? 6 : 5}><div className="empty">還沒有對話紀錄。</div></td></tr>}
      </tbody>
    </table></div>
    <p className="scroll-hint">表格可以左右滑動</p>
    {paged.hasMore && <div className="actions"><button type="button" className="secondary" disabled={paged.loading} onClick={() => void paged.more()}>載入更多</button></div>}
  </>
}

export function ConversationDialog({ api, id, onClose }: { api: RagApi; id: string | null; onClose: () => void }) {
  return <Dialog open={id !== null} title="對話詳情" onClose={onClose}>
    {id && <Detail key={id} api={api} id={id} />}
  </Dialog>
}

function Detail({ api, id }: { api: RagApi; id: string }) {
  const detail = useLoader(() => api.getConversation(id))
  if (detail.data) return <ConversationView detail={detail.data} />
  return detail.error ? <Notice tone="error">{detail.error}</Notice> : <p className="empty" role="status">正在讀取對話…</p>
}
