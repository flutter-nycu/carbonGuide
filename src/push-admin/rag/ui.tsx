// Shared workspace pieces. Class names come from rag/styles.css, which lives inside the shadow root.
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RagApi, Role } from './api/types'
import type { PageId } from './pageList'

/** True while the page that renders a component is the visible one. Hidden pages close dialogs and stop polling. */
export const PageActiveContext = createContext(true)
export const usePageActive = () => useContext(PageActiveContext)

/** Switches workspace pages from inside a page, e.g. the knowledge base's import button. */
export const NavigateContext = createContext<(page: PageId) => void>(() => undefined)
export const useNavigate = () => useContext(NavigateContext)

export interface PageProps { api: RagApi; role: Role }

export function PageHeader({ title, subtitle, breadcrumb, action }: { title: string; subtitle: string; breadcrumb: string; action?: ReactNode }) {
  return <>
    <div className="breadcrumb">管理工作台 / 臺灣日常減碳 / {breadcrumb}</div>
    <div className="page-head">
      <div><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>
      {action}
    </div>
  </>
}

export function Notice({ tone, children }: { tone?: 'warn' | 'error'; children: ReactNode }) {
  return <div className={tone ? `notice ${tone}` : 'notice'} role={tone === 'error' ? 'alert' : undefined}>{children}</div>
}

function activeElement(node: Node | null): HTMLElement | null {
  const root = node?.getRootNode() as Document | ShadowRoot | undefined
  return (root?.activeElement as HTMLElement | null) ?? null
}

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const pageActive = usePageActive()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // Kept-alive pages each hold a dialog in the same shadow root, so ids must be unique.
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handle = () => closeRef.current()
    dialog.addEventListener('close', handle)
    return () => dialog.removeEventListener('close', handle)
  }, [])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && pageActive && !dialog.open) {
      opener.current = activeElement(dialog)
      dialog.showModal()
    } else if ((!open || !pageActive) && dialog.open) {
      dialog.close()
      opener.current?.focus()
      opener.current = null
    }
  }, [open, pageActive])

  return <dialog ref={ref} aria-labelledby={titleId}>
    <div className="dialog-head"><h2 id={titleId}>{title}</h2><button type="button" className="secondary" onClick={() => onClose()}>關閉</button></div>
    <div className="dialog-body">{open ? children : null}</div>
  </dialog>
}

const ToastContext = createContext<(message: string) => void>(() => undefined)
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const show = useCallback((text: string) => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(''), 4500)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const value = useMemo(() => show, [show])
  return <ToastContext.Provider value={value}>
    {children}
    {/* Always in place and only the text changes, so screen readers announce each message. */}
    <div id="toast" className="toast" role="status">{message}</div>
  </ToastContext.Provider>
}
