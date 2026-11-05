import { useEffect, useRef, useState, type FormEvent } from 'react'
import { messageFor } from '../api/errors'
import type { ConversationUser, RagApi } from '../api/types'
import { ConversationDialog, ConversationTable } from '../ConversationList'
import { usePaged } from '../hooks'
import { ROLE_LABEL, formatDate, formatUsd } from '../labels'
import { Notice, type PageProps } from '../ui'

const displayName = (u: ConversationUser) => (u.userId === null ? '已刪除帳號' : u.name || u.email || '沒有名稱的帳號')
const roleText = (u: ConversationUser) => (u.role ? ROLE_LABEL[u.role] : '—')

export default function ConversationsPage({ api }: PageProps) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [person, setPerson] = useState<ConversationUser | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const users = usePaged(cursor => api.listConversationUsers(query, cursor), query)

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = search.trim()
    if (value.length > 100) { setProblem(messageFor('invalid_query')); return }
    setProblem(null)
    setQuery(value)
  }

  function back() {
    setPerson(null)
    // Return focus to the row the person was opened from once the list is visible again.
    requestAnimationFrame(() => opener.current?.focus())
  }

  return <>
    <section hidden={person !== null}>
      <form className="toolbar" role="search" onSubmit={submit}>
        <label className="field">搜尋名稱或 email<input value={search} maxLength={100} placeholder="輸入名稱或 email" onChange={event => setSearch(event.target.value)} /></label>
        <button type="submit" className="secondary">搜尋</button>
      </form>
      {problem && <p className="form-error" role="alert">{problem}</p>}
      {users.error && <Notice tone="error">{users.error}</Notice>}
      {!users.items && !users.error && <p className="empty" role="status">正在讀取使用者…</p>}
      {users.items && <>
        <div className="table-wrap"><table aria-label="對話使用者">
          <thead><tr><th>使用者</th><th>角色</th><th>對話次數</th><th>最近對話</th><th>累計估計費用</th><th>操作</th></tr></thead>
          <tbody>
            {users.items.map(u => <tr key={u.userId ?? 'deleted'}>
              <td><strong>{displayName(u)}</strong><small>{u.email ?? '—'}</small></td>
              <td>{roleText(u)}</td>
              <td>{u.count} 次</td>
              <td>{formatDate(u.lastAt)}</td>
              <td>{formatUsd(u.estimatedUsd)}<small>預留 {formatUsd(u.reservedUsd)}</small></td>
              <td><button type="button" className="text-button" aria-label={`查看 ${displayName(u)} 的對話`}
                onClick={event => { opener.current = event.currentTarget; setPerson(u) }}>查看對話 →</button></td>
            </tr>)}
            {!users.items.length && <tr><td colSpan={6}><div className="empty">{query ? '沒有符合的使用者。' : '還沒有人問過問題。'}</div></td></tr>}
          </tbody>
        </table></div>
        <p className="scroll-hint">表格可以左右滑動</p>
        {users.hasMore && <div className="actions"><button type="button" className="secondary" disabled={users.loading} onClick={() => void users.more()}>載入更多</button></div>}
      </>}
      <p className="caption">只列出在試問台問過問題的帳號，不含自動評測。費用是依 Google 公告單價的估計，實際金額以 Google 帳單為準。</p>
    </section>
    {person && <PersonConversations key={person.userId ?? 'deleted'} api={api} person={person} onBack={back} onOpen={setOpenId} />}
    <ConversationDialog api={api} id={openId} onClose={() => setOpenId(null)} />
  </>
}

function PersonConversations({ api, person, onBack, onOpen }: { api: RagApi; person: ConversationUser; onBack: () => void; onOpen: (id: string) => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const conversations = usePaged(cursor => api.listUserConversations(person.userId, cursor), person.userId ?? 'deleted')
  const name = displayName(person)
  useEffect(() => { heading.current?.focus() }, [])

  return <section>
    <div className="section-head">
      <h2 ref={heading} tabIndex={-1}>{name} 的對話</h2>
      <button type="button" className="secondary" onClick={onBack}>← 回到使用者列表</button>
    </div>
    <dl className="metadata">
      <dt>Email</dt><dd>{person.email ?? '—'}</dd>
      <dt>角色</dt><dd>{roleText(person)}</dd>
      <dt>對話次數</dt><dd>{person.count} 次，最近一次在 {formatDate(person.lastAt)}</dd>
      <dt>累計估計費用</dt><dd>{formatUsd(person.estimatedUsd)}（預留 {formatUsd(person.reservedUsd)}）</dd>
    </dl>
    <ConversationTable label={`${name} 的對話`} paged={conversations} onOpen={onOpen} />
  </section>
}
