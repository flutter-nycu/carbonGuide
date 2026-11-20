import { useEffect, useRef, useState, type FormEvent } from 'react'
import { messageFor } from '../api/errors'
import { LIMITS, type ConversationUser, type ConversationUserStatus, type RagApi } from '../api/types'
import { ConversationDialog, ConversationTable } from '../ConversationList'
import { usePaged } from '../hooks'
import { ACCOUNT_LABEL, ACCOUNT_TONE, ROLE_LABEL, formatDate, formatOutcomes, formatUsd, formatEstimate } from '../labels'
import { Notice, type PageProps } from '../ui'

const displayName = (u: ConversationUser) => (u.userId === null ? '已刪除帳號' : u.name || u.email || '沒有名稱的帳號')
const roleText = (u: ConversationUser) => (u.role ? ROLE_LABEL[u.role] : u.userId === null ? '—' : '沒有後台權限')
const accountTag = (status: ConversationUserStatus) =>
  <span className={`tag ${ACCOUNT_TONE[status.account]}`.trim()}>{ACCOUNT_LABEL[status.account]}</span>

function StatusCell({ status }: { status: ConversationUserStatus | null }) {
  if (!status) return <>—</>
  return <>
    {accountTag(status)}
    {status.todayRequests !== null && <small>今日 {status.todayRequests}／{LIMITS.round.dailyLimit} 題</small>}
    {status.activeRounds.length > 0 && <small>{status.activeRounds.length} 個測試輪次進行中</small>}
  </>
}

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
          <thead><tr><th>使用者</th><th>角色</th><th>目前狀態</th><th>對話次數</th><th>最近對話</th><th>累計估計費用</th><th>操作</th></tr></thead>
          <tbody>
            {users.items.map(u => <tr key={u.userId ?? 'deleted'}>
              <td><strong>{displayName(u)}</strong><small>{u.email ?? '—'}</small></td>
              <td className="nowrap">{roleText(u)}</td>
              <td><StatusCell status={u.status} /></td>
              <td>{u.count} 次{u.status && <small>{formatOutcomes(u.status.outcomes)}</small>}</td>
              <td>{formatDate(u.lastAt)}</td>
              <td>{formatEstimate(u.estimatedUsd, u.unknownCostCalls)}<small>預留 {formatUsd(u.reservedUsd)}</small></td>
              <td><button type="button" className="text-button" aria-label={`查看 ${displayName(u)} 的對話`}
                onClick={event => { opener.current = event.currentTarget; setPerson(u) }}>查看對話 →</button></td>
            </tr>)}
            {!users.items.length && <tr><td colSpan={7}><div className="empty">{query ? '沒有符合的使用者。' : '還沒有人問過問題。'}</div></td></tr>}
          </tbody>
        </table></div>
        <p className="scroll-hint">表格可以左右滑動</p>
        {users.hasMore && <div className="actions"><button type="button" className="secondary" disabled={users.loading} onClick={() => void users.more()}>載入更多</button></div>}
      </>}
      <p className="caption">只列出在試問台問過問題的帳號，對話次數不含自動評測；今日用量是試問與評測合計，每天臺灣時間 08:00 換日。費用是依 Google 公告單價的估計，實際金額以 Google 帳單為準。</p>
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
    <section aria-label="目前狀態">
      <h3>目前狀態</h3>
      <dl className="metadata">
        <dt>Email</dt><dd>{person.email ?? '—'}</dd>
        <dt>角色</dt><dd>{roleText(person)}</dd>
        {person.status ? <StatusDetails status={person.status} /> : <><dt>帳號狀態</dt><dd>後端還沒有提供使用者狀態</dd></>}
        <dt>對話次數</dt><dd>{person.count} 次，最近一次在 {formatDate(person.lastAt)}</dd>
        {person.status && <><dt>對話結果</dt><dd>{formatOutcomes(person.status.outcomes)}</dd></>}
        <dt>累計估計費用</dt><dd>{formatEstimate(person.estimatedUsd, person.unknownCostCalls)}（預留 {formatUsd(person.reservedUsd)}）</dd>
      </dl>
    </section>
    <ConversationTable label={`${name} 的對話`} paged={conversations} onOpen={onOpen} />
  </section>
}

function StatusDetails({ status }: { status: ConversationUserStatus }) {
  return <>
    <dt>帳號狀態</dt><dd>{accountTag(status)}</dd>
    {status.account !== 'deleted' && <>
      <dt>加入時間</dt><dd>{status.joinedAt ? formatDate(status.joinedAt) : '—'}</dd>
      <dt>最近登入</dt><dd>{status.lastSignInAt ? formatDate(status.lastSignInAt) : '還沒有登入紀錄'}</dd>
      <dt>今日用量</dt><dd>{status.todayRequests === null ? '—' : `${status.todayRequests}／${LIMITS.round.dailyLimit} 題`}（試問與評測合計）</dd>
      <dt>測試輪次</dt><dd>{status.activeRounds.length
        ? status.activeRounds.map((r, index) => <div key={index}>
          {r.versionName}：已問 {r.requestCount}／{r.requestLimit} 題，已預留 {formatUsd(r.reservedUsd)}／{formatUsd(r.budgetUsd)}，{formatDate(r.expiresAt)} 到期
        </div>)
        : '沒有進行中的測試輪次'}</dd>
    </>}
  </>
}
