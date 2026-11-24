import { useEffect, useRef, useState, type FormEvent } from 'react'
import { messageFor } from '../api/errors'
import { LIMITS, type ConversationUser, type ConversationUserStatus, type RagApi } from '../api/types'
import { ConversationDialog, ConversationTable } from '../ConversationList'
import { usePaged } from '../hooks'
import { ACCOUNT_LABEL, ACCOUNT_TONE, ROLE_LABEL, formatDate, formatOutcomes, formatUsd, formatEstimate } from '../labels'
import { LoadError, Notice, type PageProps } from '../ui'

const displayName = (u: ConversationUser) => (u.userId === null ? '已刪除帳號' : u.name || u.email || '沒有名稱的帳號')
const roleText = (u: ConversationUser) => (u.role ? ROLE_LABEL[u.role] : u.userId === null ? '—' : '一般使用者')
const accountTag = (status: ConversationUserStatus) =>
  <span className={`tag ${ACCOUNT_TONE[status.account]}`.trim()}>{ACCOUNT_LABEL[status.account]}</span>

// Accounts shown at once. The backend still hands out 50 per cursor page; the next batch is fetched when these run out.
const PAGE_SIZE = 10

/** Page numbers to offer: all of them when there are few, otherwise both ends and the neighbours of the current page. */
export function pageWindow(current: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i)
  const keep = [...new Set([0, count - 1, current - 1, current, current + 1])].filter(n => n >= 0 && n < count).sort((a, b) => a - b)
  return keep.flatMap((n, i) => (i > 0 && n - keep[i - 1] > 1 ? ['gap' as const, n] : [n]))
}

function Pager({ current, pages, loaded, hasMore, loading, onGo }: {
  current: number; pages: number; loaded: number; hasMore: boolean; loading: boolean; onGo: (page: number) => void
}) {
  const several = pages > 1 || hasMore
  const label = hasMore ? `第 ${current + 1} 頁，已載入 ${loaded} 位，還有更多`
    : several ? `第 ${current + 1}／${pages} 頁，共 ${loaded} 位` : `共 ${loaded} 位`
  return <nav className="pager" aria-label="使用者列表分頁">
    {several && <>
      <button type="button" className="secondary" disabled={current === 0} onClick={() => onGo(current - 1)}>上一頁</button>
      {pageWindow(current, pages).map((n, i) => n === 'gap'
        ? <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">…</span>
        : <button key={n} type="button" className={n === current ? 'primary' : 'secondary'} aria-current={n === current ? 'page' : undefined}
          aria-label={`第 ${n + 1} 頁`} onClick={() => onGo(n)}>{n + 1}</button>)}
      <button type="button" className="secondary" disabled={loading || (current + 1 >= pages && !hasMore)} onClick={() => onGo(current + 1)}>下一頁</button>
    </>}
    <span className="pager-status" role="status">{label}</span>
  </nav>
}

function StatusCell({ status }: { status: ConversationUserStatus | null }) {
  if (!status) return <>—</>
  return <>
    {accountTag(status)}
    {status.todayRequests !== null && status.todayRequests > 0 && <small>今日 {status.todayRequests}／{LIMITS.round.dailyLimit} 題</small>}
    {status.activeRounds.length > 0 && <small>{status.activeRounds.length} 份測驗額度使用中</small>}
  </>
}

export default function ConversationsPage({ api }: PageProps) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [person, setPerson] = useState<ConversationUser | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const opener = useRef<HTMLElement | null>(null)
  const listTop = useRef<HTMLDivElement>(null)
  const users = usePaged(cursor => api.listConversationUsers(query, cursor), query)
  const loaded = users.items?.length ?? 0
  const pages = Math.max(1, Math.ceil(loaded / PAGE_SIZE))
  const current = Math.min(pageIndex, pages - 1)
  const shown = users.items?.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE) ?? []
  // A page answer that arrives after a new search belongs to the old list.
  const searched = useRef(query)
  searched.current = query

  async function goTo(target: number) {
    const forQuery = query
    if (target >= pages && users.hasMore) await users.more()
    if (searched.current !== forQuery) return
    setPageIndex(target)
    listTop.current?.scrollIntoView?.({ block: 'nearest' })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = search.trim()
    if (value.length > 100) { setProblem(messageFor('invalid_query')); return }
    setProblem(null)
    setQuery(value)
    setPageIndex(0)
  }

  function back() {
    setPerson(null)
    // Return focus to the row the person was opened from once the list is visible again.
    requestAnimationFrame(() => opener.current?.focus())
  }

  return <>
    <section className="users-page" hidden={person !== null}>
      <form className="toolbar" role="search" onSubmit={submit}>
        <label className="field">搜尋名稱或 email<input value={search} maxLength={100} placeholder="輸入名稱或 email" onChange={event => setSearch(event.target.value)} /></label>
        <button type="submit" className="secondary">搜尋</button>
      </form>
      {problem && <p className="form-error" role="alert">{problem}</p>}
      {users.error && <LoadError message={users.error} onRetry={() => void users.reload()} />}
      {!users.items && !users.error && <p className="empty" role="status">正在讀取使用者…</p>}
      {users.items && <>
        <div className="table-wrap" ref={listTop}><table aria-label="使用者">
          <thead><tr><th>使用者</th><th>角色</th><th>目前狀態</th><th>對話次數</th><th>最近對話</th><th>累計估計費用</th><th><span className="sr-only">操作</span></th></tr></thead>
          <tbody>
            {shown.map(u => <tr key={u.userId ?? 'deleted'}>
              <td><strong>{displayName(u)}</strong><small>{u.email ?? '—'}</small></td>
              <td className="nowrap">{roleText(u)}</td>
              <td><StatusCell status={u.status} /></td>
              <td>{u.count} 次{u.count === 0 ? <small>還沒有對話</small> : u.status && <small>{formatOutcomes(u.status.outcomes)}</small>}</td>
              <td>{u.lastAt ? formatDate(u.lastAt) : '—'}</td>
              <td>{u.count === 0 ? '—' : <>{formatEstimate(u.estimatedUsd, u.unknownCostCalls)}<small>預留 {formatUsd(u.reservedUsd)}</small></>}</td>
              <td><button type="button" className="text-button" aria-label={`查看 ${displayName(u)} 的對話`}
                onClick={event => { opener.current = event.currentTarget; setPerson(u) }}>查看對話</button></td>
            </tr>)}
            {!users.items.length && <tr><td colSpan={7}><div className="empty">{query ? '沒有符合的使用者。' : '還沒有帳號。'}</div></td></tr>}
          </tbody>
        </table></div>
        <p className="scroll-hint">表格可以左右滑動</p>
        {loaded > 0 && <Pager current={current} pages={pages} loaded={loaded} hasMore={users.hasMore} loading={users.loading} onGo={page => void goTo(page)} />}
      </>}
      <p className="caption">有對話的人排前面，最近對話的在最上面；其他帳號依加入時間由新到舊排。對話次數只算試問，不含自動測驗；今日用量是試問和測驗一起算，臺灣時間早上 8 點換日。費用是依 Google 公告單價估計，實際金額以 Google 帳單為準。</p>
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

  return <section className="users-page">
    <div className="section-head">
      <h2 ref={heading} tabIndex={-1}>{name} 的對話</h2>
      <button type="button" className="secondary" onClick={onBack}>回到使用者列表</button>
    </div>
    <section aria-label="目前狀態">
      <h3>目前狀態</h3>
      <dl className="metadata">
        <dt>Email</dt><dd>{person.email ?? '—'}</dd>
        <dt>角色</dt><dd>{roleText(person)}</dd>
        {person.status ? <StatusDetails status={person.status} /> : <><dt>帳號狀態</dt><dd>—</dd></>}
        <dt>對話次數</dt><dd>{person.lastAt ? `${person.count} 次，最近一次在 ${formatDate(person.lastAt)}` : '還沒有對話'}</dd>
        {person.count > 0 && person.status && <><dt>對話結果</dt><dd>{formatOutcomes(person.status.outcomes)}</dd></>}
        {person.count > 0 && <><dt>累計估計費用</dt><dd>{formatEstimate(person.estimatedUsd, person.unknownCostCalls)}，預留 {formatUsd(person.reservedUsd)}</dd></>}
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
      <dt>今日用量</dt><dd>{status.todayRequests === null ? '—' : `${status.todayRequests}／${LIMITS.round.dailyLimit} 題，試問和測驗一起算`}</dd>
      <dt>測驗額度</dt><dd>{status.activeRounds.length
        ? status.activeRounds.map((r, index) => <div key={index}>
          {r.versionName}：已問 {r.requestCount}／{r.requestLimit} 題，已預留 {formatUsd(r.reservedUsd)}／{formatUsd(r.budgetUsd)}，{formatDate(r.expiresAt)} 到期
        </div>)
        : '沒有使用中的測驗額度'}</dd>
    </>}
  </>
}
