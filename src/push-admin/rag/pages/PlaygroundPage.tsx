import { useEffect, useState, type FormEvent } from 'react'
import { messageFor, toRagError } from '../api/errors'
import { requestKeyFor, settleRequestKey } from '../api/requestKeys'
import { LIMITS, type ConversationDetail, type KnowledgeVersion, type TestRound } from '../api/types'
import ConversationView from '../ConversationView'
import { useLoader } from '../hooks'
import { formatDate, formatUsd } from '../labels'
import { LoadError, Notice, useNavigate, type PageProps } from '../ui'

/** A round can take another question: open, not expired, with questions and budget left. */
const usable = (round: TestRound | null) => !!round && round.state === 'active' && new Date(round.expiresAt).getTime() > Date.now()
  && round.requestCount < round.requestLimit && round.reservedUsd < round.budgetUsd

const versionLabel = (v: KnowledgeVersion) =>
  `${v.name}（${v.isActive ? '使用中' : v.review === 'approved' ? '已核准' : v.review === 'rejected' ? '已退回' : '待審核'}）`

export default function PlaygroundPage({ api, role }: PageProps) {
  const owner = role === 'owner'
  const navigate = useNavigate()
  const versions = useLoader(() => api.listVersions())
  const budget = useLoader(() => api.getBudget())
  const [versionId, setVersionId] = useState('')
  const [round, setRound] = useState<TestRound | null>(null)
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<ConversationDetail | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!versionId && versions.data?.length) setVersionId((versions.data.find(v => v.isActive) ?? versions.data[0]).id)
  }, [versions.data, versionId])
  useEffect(() => {
    if (!versionId) return
    let alive = true
    api.getActiveRound(versionId).then(r => { if (alive) setRound(r) }, () => { if (alive) setRound(null) })
    return () => { alive = false }
  }, [api, versionId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = question.trim()
    if (!text || !versionId) return
    setBusy(true)
    setProblem(null)
    try {
      let current = usable(round) ? round : await api.getActiveRound(versionId)
      if (!current || !usable(current)) {
        // A used-up round stays open on the server, so the key also names the round it replaces.
        const roundPayload = { versionId, replaces: current?.id ?? null }
        current = await api.createRound(versionId, requestKeyFor('round', roundPayload))
        settleRequestKey('round', roundPayload)
      }
      setRound(current)
      // The key stays until the answer arrives, so pressing 試問 again after a failure cannot charge twice.
      const payload = { roundId: current.id, question: text }
      const detail = await api.ask(current.id, text, requestKeyFor('ask', payload))
      if (detail.state === 'running' || detail.state === 'reserved') {
        // The first try is still being answered; the same key will show that answer instead of paying again.
        setProblem(messageFor('request_still_active'))
        return
      }
      settleRequestKey('ask', payload)
      setResult(detail)
      setRound(await api.getActiveRound(versionId))
      void budget.reload()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    if (!round) return
    try {
      await api.stopRound(round.id)
      setRound(null)
    } catch (caught) {
      setProblem(toRagError(caught).message)
    }
  }

  const list = versions.data ?? []
  return <div className="grid">
    <section className="panel">
      <h2>問一個問題</h2>
      {versions.error && <LoadError message={versions.error} onRetry={() => void versions.reload()} />}
      {!list.length && versions.data && <Notice tone="warn">還沒有版本，要先建立版本才能試問。<div className="actions"><button type="button" className="secondary" onClick={() => navigate('releases')}>前往「版本與發布」</button></div></Notice>}
      <form onSubmit={event => void submit(event)}>
        <label className="field">版本<select value={versionId} disabled={busy} onChange={event => { setVersionId(event.target.value); setRound(null); setResult(null) }}>
          {list.map(v => <option key={v.id} value={v.id}>{versionLabel(v)}</option>)}
        </select></label>
        <p className="form-tip">還沒發布的版本也可以試問。</p>
        <label className="field">問題<textarea value={question} maxLength={2000} required disabled={!owner} placeholder="輸入想問教練的問題" onChange={event => setQuestion(event.target.value)} /></label>
        <div className="actions">
          <button type="submit" className="primary" disabled={!owner || busy || !versionId}>{busy ? '處理中…' : '試問'}</button>
          {round && owner && <button type="button" className="secondary" onClick={() => void stop()}>結束這份額度</button>}
        </div>
        {!owner && <p className="caption">只有管理者可以試問。試問會用到 AI 預算。</p>}
        {problem && <p className="form-error" role="alert">{problem}</p>}
      </form>
      <dl className="metadata">
        <dt>測驗額度</dt>
        <dd>{round
          ? `還可以問 ${round.requestLimit - round.requestCount} 題，已預留 ${formatUsd(round.reservedUsd)}／上限 ${formatUsd(round.budgetUsd)}，${formatDate(round.expiresAt)} 到期。`
          : `第一次試問會自動開一份：最多 ${LIMITS.round.requestLimit} 題，${LIMITS.round.days} 天內有效，費用上限是剩餘預算和 ${formatUsd(LIMITS.round.budgetUsd)} 中較少的那個。`}</dd>
        <dt>每日上限</dt>
        <dd>每人每天最多 {LIMITS.round.dailyLimit} 題，試問和測驗一起算，臺灣時間早上 8 點換日；開新額度也不會歸零。</dd>
        <dt>這期 AI 預算</dt>
        <dd>{budget.data ? (budget.data.active ? `已預留 ${formatUsd(budget.data.reservedUsd)}／總額 ${formatUsd(budget.data.budgetUsd)}` : '現在沒有可用的預算') : '—'}</dd>
      </dl>
    </section>
    <section className="panel" aria-live="polite">
      <h2>回答與引用</h2>
      {result ? <ConversationView detail={result} /> : <p className="empty">試問後，這裡會顯示回答、引用、處理流程和費用。</p>}
    </section>
  </div>
}
