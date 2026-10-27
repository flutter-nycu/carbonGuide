import { createContext, useContext, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

export const DetailVisibility = createContext(true)

/** Native modal keeps focus and scrolling inside the detail without moving the list. */
export function DetailDialog({ title, children, onClose, closeDisabled = false }: { title: string; children: ReactNode; onClose: () => void; closeDisabled?: boolean }) {
  const active = useContext(DetailVisibility)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  function keepFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [tabindex]:not([tabindex="-1"])'))
      .filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0)
    const first = controls[0], last = controls[controls.length - 1]
    if (!first) { event.preventDefault(); heading.current?.focus(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus()
    }
  }
  useEffect(() => {
    const element = dialog.current
    if (!active || !element) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '') // DOM test environments without dialog APIs.
    heading.current?.focus({ preventScroll: true })
    return () => {
      if (typeof element.close === 'function') element.close()
      else element.removeAttribute('open')
      document.documentElement.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [active])
  return <dialog ref={dialog} className="rag-detail-dialog" aria-labelledby={titleId} onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); if (!closeDisabled) onClose() }}>
    <header className="rag-detail-header"><h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2><button type="button" disabled={closeDisabled} onClick={onClose}>關閉詳情</button></header>
    <div className="rag-detail-body">{children}</div>
  </dialog>
}
