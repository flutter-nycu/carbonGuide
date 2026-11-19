// 12 技術架構導覽: a diagram of the five blocks, two step-by-step routes, safeguards, live settings and a glossary.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { KnowledgeDocument, RagApi, Role } from '../api/types'
import { GUIDE_GLOSSARY, GUIDE_MODELS, GUIDE_NODES, GUIDE_ROUTES, GUIDE_SAFEGUARDS, type GuideNodeId } from '../guideContent'
import { useLoader } from '../hooks'
import { formatUsd } from '../labels'
import { PAGES } from '../pageList'
import { Notice, useNavigate, usePageActive } from '../ui'

const TAB_KEYS: Record<string, (index: number, last: number) => number> = {
  ArrowRight: (index, last) => (index === last ? 0 : index + 1),
  ArrowLeft: (index, last) => (index === 0 ? last : index - 1),
  Home: () => 0,
  End: (_, last) => last,
}

export default function ArchitecturePage({ api, role }: { api: RagApi | null; role: Role }) {
  const id = useId()
  const navigate = useNavigate()
  const [routeIndex, setRouteIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const previous = useRef<HTMLButtonElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const route = GUIDE_ROUTES[routeIndex]
  const step = route.steps[stepIndex]
  const node = GUIDE_NODES.find(n => n.id === step.node)!
  const target = step.page ? PAGES.find(p => p.id === step.page) : undefined
  const last = route.steps.length - 1

  function chooseRoute(index: number) {
    if (index === routeIndex) return
    setRouteIndex(index)
    setStepIndex(0)
  }

  // Reaching either end disables the pressed button, so focus moves to the one that still works.
  function stepTo(index: number) {
    setStepIndex(index)
    if (index === 0) next.current?.focus()
    else if (index === last) previous.current?.focus()
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const move = TAB_KEYS[event.key]
    if (!move) return
    event.preventDefault()
    const chosen = move(index, GUIDE_ROUTES.length - 1)
    chooseRoute(chosen)
    tabs.current[chosen]?.focus()
  }

  // The first step that uses the block, in this route if it has one, otherwise in the route that does.
  function showBlock(block: GuideNodeId) {
    const here = route.steps.findIndex(s => s.node === block)
    if (here >= 0) { setStepIndex(here); return }
    const other = GUIDE_ROUTES.findIndex(r => r.steps.some(s => s.node === block))
    setRouteIndex(other)
    setStepIndex(GUIDE_ROUTES[other].steps.findIndex(s => s.node === block))
  }

  return <>
    <section className="panel guide-overview" aria-labelledby={`${id}-overview`}>
      <h2 id={`${id}-overview`}>架構總覽</h2>
      <p className="caption guide-lead">這套系統分成五個區塊。點一個區塊，下面會跳到用到它的步驟。</p>
      <ol className="guide-diagram" aria-label="架構總覽圖">
        {GUIDE_NODES.map(n => <li key={n.id}>
          <button type="button" className="guide-node" aria-current={n.id === step.node ? true : undefined} onClick={() => showBlock(n.id)}>
            <strong>{n.name}</strong><span>{n.tech}</span>
          </button>
        </li>)}
      </ol>
      <p className="guide-node-note"><strong>{node.name}</strong>{node.role}</p>
    </section>

    <section className="panel guide-walk" aria-labelledby={`${id}-walk`}>
      <h2 id={`${id}-walk`}>分步說明</h2>
      <div className="guide-tabs" role="tablist" aria-label="選擇流程">
        {GUIDE_ROUTES.map((r, index) => <button key={r.id} ref={element => { tabs.current[index] = element }} type="button" role="tab"
          id={`${id}-tab-${r.id}`} aria-controls={`${id}-panel`} aria-selected={index === routeIndex} tabIndex={index === routeIndex ? 0 : -1}
          onClick={() => chooseRoute(index)} onKeyDown={event => onTabKey(event, index)}>{r.label}</button>)}
      </div>
      <div className="guide-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${route.id}`}>
        <ol className="guide-dots" aria-label="步驟">
          {route.steps.map((s, index) => <li key={s.title}>
            <button type="button" aria-label={`第 ${index + 1} 步：${s.title}`} aria-current={index === stepIndex ? 'step' : undefined}
              onClick={() => setStepIndex(index)}>{index + 1}</button>
          </li>)}
        </ol>
        <div className="guide-step" aria-live="polite" aria-atomic="true">
          <p className="guide-count">第 {stepIndex + 1} 步，共 {route.steps.length} 步 · {node.name}</p>
          <h3>{step.title}</h3>
          <p>{step.plain}</p>
          <p className="guide-tech"><strong>背後技術</strong>{step.tech}</p>
        </div>
        <div className="actions guide-actions">
          <button ref={previous} type="button" className="secondary" disabled={stepIndex === 0} onClick={() => stepTo(stepIndex - 1)}>上一步</button>
          <button ref={next} type="button" className="primary" disabled={stepIndex === last} onClick={() => stepTo(stepIndex + 1)}>下一步</button>
          {target && <button type="button" className="text-button" onClick={() => navigate(target.id)}>到這一頁看看：{target.number} {target.label}</button>}
        </div>
      </div>
    </section>

    <section className="panel" aria-labelledby={`${id}-safeguards`}>
      <h2 id={`${id}-safeguards`}>品質與安全怎麼把關</h2>
      <ul className="guide-cards" aria-labelledby={`${id}-safeguards`}>
        {GUIDE_SAFEGUARDS.map(card => <li key={card.title}><h3>{card.title}</h3><p>{card.text}</p></li>)}
      </ul>
    </section>

    <section className="panel guide-live" aria-labelledby={`${id}-live`}>
      <h2 id={`${id}-live`}>目前的實際設定</h2>
      {api ? <LiveSettings api={api} role={role} />
        : <Notice tone="warn">RAG 後端尚未啟用。開啟之後，這裡會顯示正式環境目前的設定。</Notice>}
    </section>

    <section className="panel guide-glossary" aria-labelledby={`${id}-glossary`}>
      <h2 id={`${id}-glossary`}>名詞小辭典</h2>
      <dl>{GUIDE_GLOSSARY.map(entry => <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.meaning}</dd></div>)}</dl>
    </section>
  </>
}

function countDocuments(documents: KnowledgeDocument[]): string {
  if (!documents.length) return '還沒有文件'
  const count = (...statuses: KnowledgeDocument['status'][]) => documents.filter(d => statuses.includes(d.status)).length
  return `共 ${documents.length} 份：完成 ${count('completed')} 份、處理中 ${count('pending', 'processing')} 份、需要留意 ${count('failed', 'budget_paused')} 份`
}

// Read-only, and only what the role may read: versions for owner and editor, the budget for owner. No polling, no paid calls;
// each fact is read again when the guide is shown again, so a version published on 05 shows up here.
function LiveSettings({ api, role }: { api: RagApi; role: Role }) {
  return <>
    <dl className="guide-facts">
      <Fact label="文件" load={() => api.listDocuments()} show={countDocuments} />
      <Fact label="檢索設定" load={() => api.getSettings()} show={s => `先找 ${s.candidates} 筆資料，參考 ${s.contextChunks} 段`} />
      {role !== 'viewer' && <Fact label="知識版本" load={() => api.listVersions()}
        show={versions => versions.find(v => v.isActive)?.name ?? '目前沒有發布中的版本'} />}
      {role === 'owner' && <Fact label="AI 預算" load={() => api.getBudget()} show={b =>
        `總額 ${formatUsd(b.budgetUsd)}，已預留 ${formatUsd(b.reservedUsd)}，還剩 ${formatUsd(Math.max(0, b.budgetUsd - b.reservedUsd))}${b.active ? '' : '（目前停用）'}`} />}
      <div><dt>模型</dt><dd>回答用 {GUIDE_MODELS.answer}，向量用 {GUIDE_MODELS.embedding}</dd></div>
    </dl>
    <p className="caption">知識版本只有 owner 和編輯者看得到，AI 預算只有 owner 看得到。模型名稱依後端文件，{GUIDE_MODELS.checkedAt} 核對。</p>
  </>
}

function Fact<T>({ label, load, show }: { label: string; load: () => Promise<T>; show: (value: T) => string }) {
  const value = useLoader(load)
  const { reload } = value
  const active = usePageActive()
  const wasActive = useRef(active)
  useEffect(() => {
    if (active && !wasActive.current) void reload()
    wasActive.current = active
  }, [active, reload])
  return <div><dt>{label}</dt><dd>{value.data !== null ? show(value.data) : value.error ? `讀不到：${value.error}` : '讀取中…'}</dd></div>
}
