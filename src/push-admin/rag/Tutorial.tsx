// The workspace tutorial: a panel floating in the corner that walks an admin through the pages in order.
// Closed, it is a small button that shows the progress and reopens the panel at the next unfinished step.
// It starts closed. Progress and whether it is open are kept in this browser's storage, so they survive a reload;
// without storage they last until the page reloads. The tutorial sends no requests.
import { useEffect, useId, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import type { Role } from './api/types'
import { canEdit } from './labels'
import { pageById, type PageId } from './pageList'
import { readStored, writeStored } from './storage'
import { TUTORIAL_STEPS, type TutorialStep, type TutorialStepId } from './tutorialContent'
import { Notice, useNavigate } from './ui'

export interface TutorialState { open: boolean; viewing: TutorialStepId; done: readonly TutorialStepId[] }

const IDS = TUTORIAL_STEPS.map(s => s.id)
const firstUndone = (done: readonly TutorialStepId[]) => TUTORIAL_STEPS.find(s => !done.includes(s.id)) ?? null

export interface TutorialHandle {
  state: TutorialState
  setState: Dispatch<SetStateAction<TutorialState>>
  /** The first unfinished step, or null when every step is done. */
  next: TutorialStep | null
  /** While the panel is open, the sidebar marks the page of the next step. */
  markedPage: PageId | null
}

export const TUTORIAL_KEY = 'rag-tutorial'

/** The saved state, keeping only step ids this version knows; anything unreadable starts over, closed. */
function savedState(): TutorialState {
  const fresh: TutorialState = { open: false, viewing: IDS[0], done: [] }
  try {
    const saved = JSON.parse(readStored(TUTORIAL_KEY) ?? 'null') as Partial<TutorialState> | null
    if (!saved || typeof saved !== 'object') return fresh
    const known = (id: unknown): id is TutorialStepId => IDS.includes(id as TutorialStepId)
    const done = Array.isArray(saved.done) ? IDS.filter(id => saved.done!.some(d => d === id)) : []
    return { open: saved.open === true, viewing: known(saved.viewing) ? saved.viewing : firstUndone(done)?.id ?? IDS[0], done }
  } catch {
    return fresh
  }
}

/** Held by the workspace, so the sidebar can mark the next step's page. */
export function useTutorial(): TutorialHandle {
  const [state, setState] = useState<TutorialState>(savedState)
  useEffect(() => { writeStored(TUTORIAL_KEY, JSON.stringify(state)) }, [state])
  const next = firstUndone(state.done)
  return { state, setState, next, markedPage: state.open ? next?.page ?? null : null }
}

const ACTOR_LABEL = { owner: '管理者', editor: '編輯者或管理者' } as const

export default function Tutorial({ tutorial, role, shown }: { tutorial: TutorialHandle; role: Role; shown: PageId }) {
  const navigate = useNavigate()
  const { state, setState, next } = tutorial
  const headingId = useId()
  const stepTitleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const stepTitle = useRef<HTMLHeadingElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const body = useRef<HTMLDivElement>(null)
  // Focus follows the admin's own clicks only; opening on the first visit leaves focus where the page put it.
  const focusAfter = useRef<'panel' | 'launcher' | 'step' | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // After every render: the click that asked for focus has re-rendered by now, even when the state came out the same.
  useEffect(() => {
    const target = focusAfter.current
    focusAfter.current = null
    if (target === 'panel') heading.current?.focus()
    else if (target === 'launcher') launcher.current?.focus()
    else if (target === 'step') stepTitle.current?.focus()
  })

  useEffect(() => { if (body.current) body.current.scrollTop = 0 }, [state.viewing])

  const total = TUTORIAL_STEPS.length
  const index = Math.max(0, IDS.indexOf(state.viewing))
  const step = TUTORIAL_STEPS[index]
  const isDone = state.done.includes(step.id)
  const page = pageById(step.page)
  const allowed = step.actor === 'owner' ? role === 'owner' : canEdit(role)

  function open() {
    focusAfter.current = 'panel'
    setState(s => ({ ...s, open: true, viewing: firstUndone(s.done)?.id ?? s.viewing }))
  }
  function close() {
    focusAfter.current = 'launcher'
    setConfirmReset(false)
    setState(s => ({ ...s, open: false }))
  }
  function view(id: TutorialStepId) {
    focusAfter.current = 'step'
    setState(s => ({ ...s, viewing: id }))
  }
  function complete() {
    focusAfter.current = 'step'
    setState(s => {
      const done = IDS.filter(id => id === step.id || s.done.includes(id))
      return { ...s, done, viewing: firstUndone(done)?.id ?? s.viewing }
    })
  }
  function undo() {
    setState(s => ({ ...s, done: s.done.filter(id => id !== step.id) }))
  }
  function reset() {
    focusAfter.current = 'step'
    setConfirmReset(false)
    setState(s => ({ ...s, done: [], viewing: IDS[0] }))
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }

  if (!state.open) {
    return <button ref={launcher} type="button" className="tutorial-launcher" aria-label={`操作教學，已完成 ${state.done.length}／${total} 步`} onClick={open}>
      <strong>操作教學</strong><span aria-hidden="true">{state.done.length}／{total}</span>
    </button>
  }

  // The step's name and its buttons stay at the top; only the explanation below them scrolls.
  return <aside className="tutorial" aria-labelledby={headingId} onKeyDown={onKeyDown}>
    <div className="tutorial-head">
      <div>
        <h2 id={headingId} ref={heading} tabIndex={-1}>操作教學</h2>
        <p>已完成 {state.done.length}／{total} 步{next ? `，下一步是第 ${IDS.indexOf(next.id) + 1} 步` : ''}</p>
      </div>
      <button type="button" className="secondary tutorial-close" aria-label="關閉操作教學" onClick={close}>關閉</button>
    </div>
    <progress className="tutorial-progress" value={state.done.length} max={total} aria-label="教學進度" />

    <div className="tutorial-current">
      <p className="tutorial-phase">{step.phase} · 第 {index + 1}／{total} 步</p>
      <h3 id={stepTitleId} ref={stepTitle} tabIndex={-1}>{step.title}</h3>
      <div className="tutorial-tags">
        {isDone ? <span className="tag">已完成</span> : next?.id === step.id && <span className="tag warn">下一步</span>}
        {step.optional && <span className="tag quiet">不用改可以直接完成</span>}
        {step.actor === 'owner' && <span className="tag quiet">管理者操作</span>}
      </div>
      {shown === step.page
        ? <p className="tutorial-here" role="status">你現在就在「{page.label}」，照下面的說明操作。</p>
        : <button type="button" className="primary tutorial-go" onClick={() => navigate(step.page)}>前往「{page.label}」</button>}
      <div className="actions tutorial-nav">
        <button type="button" className="secondary" disabled={index === 0} onClick={() => view(IDS[index - 1])}>上一步</button>
        <button type="button" className="secondary" disabled={index === total - 1} onClick={() => view(IDS[index + 1])}>下一步</button>
        {isDone
          ? <button type="button" className="text-button tutorial-done" onClick={undo}>改回還沒做</button>
          : <button type="button" className="primary tutorial-done" onClick={complete}>標記完成</button>}
      </div>
    </div>

    <div className="tutorial-body" ref={body}>
      {state.done.length === 0 && <p className="tutorial-intro">
        {/* One line: JSX turns a line break inside the text into a space. */}
        照順序做完這 {total} 步，新文件就會變成正式版本。每做完一步按「標記完成」，進度會記在這台電腦的瀏覽器裡。想先了解整套怎麼運作，可以看<button type="button" className="text-button" onClick={() => navigate('guide')}>運作原理</button>。
      </p>}
      {!next && <Notice>{total} 個步驟都完成了。之後要更新知識，按最下面的「重設進度」，從第 1 步再走一次。</Notice>}

      <details className="tutorial-outline">
        <summary>全部步驟</summary>
        <ol aria-label="教學步驟">
          {TUTORIAL_STEPS.map((s, i) => {
            const done = state.done.includes(s.id)
            return <li key={s.id}>
              <button type="button" aria-current={s.id === step.id ? 'step' : undefined} onClick={() => view(s.id)}>
                <span className={done ? 'tutorial-num done' : 'tutorial-num'} aria-hidden="true">{done ? '✓' : i + 1}</span>
                <span className="tutorial-name">{i + 1}. {s.title}</span>
                <span className={done ? 'tag' : next?.id === s.id ? 'tag warn' : 'tag quiet'}>{done ? '已完成' : next?.id === s.id ? '下一步' : '還沒做'}</span>
              </button>
            </li>
          })}
        </ol>
      </details>

      <section className="tutorial-step" aria-labelledby={stepTitleId}>
        {!allowed && <Notice tone="warn">這一步要由{ACTOR_LABEL[step.actor]}操作，你的角色可以先看說明。</Notice>}
        <h4>這一步在做什麼</h4>
        <p>{step.purpose}</p>
        <h4>怎麼做</h4>
        <ol>{step.actions.map(a => <li key={a}>{a}</li>)}</ol>
        <h4>怎麼知道完成了</h4>
        <p>{step.done}</p>
        {step.notes && step.notes.length > 0 && <>
          <h4>要注意</h4>
          <ul>{step.notes.map(n => <li key={n}>{n}</li>)}</ul>
        </>}
      </section>

      {confirmReset
        ? <div className="tutorial-reset" role="group" aria-label="確認重設進度">
          <span>清除所有完成記號，從第 1 步重新開始？</span>
          <button type="button" className="text-button" onClick={reset}>確定重設</button>
          <button type="button" className="text-button" onClick={() => setConfirmReset(false)}>取消</button>
        </div>
        : <button type="button" className="text-button tutorial-reset-button" disabled={state.done.length === 0} onClick={() => setConfirmReset(true)}>重設進度</button>}
    </div>
  </aside>
}
