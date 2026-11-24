import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styleUrl from '../rag/styles.css?url'
import Workspace from '../rag/Workspace'
import type { RagApi, Role } from '../rag/api/types'
import type { RagView } from '../rag/pageList'

// The workspace keeps its own stylesheet inside a shadow root, so the push admin's Tailwind never reaches it.
// React renders into that root through a portal; the portal container receives the events.
const enabled = import.meta.env.VITE_RAG_ENABLED === 'true'

// One instance serves the three RAG top tabs, so switching between them keeps every page and the data connection.
export default function RagWorkspace({ role, active, view, onView }: { role: Role; active: boolean; view: RagView; onView: (view: RagView) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [api, setApi] = useState<RagApi | null>(null)

  useEffect(() => {
    const root = host.current!.shadowRoot ?? host.current!.attachShadow({ mode: 'open' })
    root.innerHTML = '<link rel="stylesheet" href="' + styleUrl + '"><div class="rag-body"></div>'
    setContainer(root.querySelector<HTMLElement>('.rag-body'))
    return () => { setContainer(null); root.replaceChildren() }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    // Loaded only when the backend is switched on; the client module needs the Supabase variables.
    void Promise.all([import('../lib/supabase'), import('../rag/api/supabase')]).then(([lib, module]) => {
      if (alive) setApi(module.createSupabaseRagApi(lib.supabase, { role, supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string }))
    })
    return () => { alive = false }
  }, [role])

  const content = enabled && !api
    ? <p className="muted" role="status">正在連線到知識庫…</p>
    : <Workspace api={api} role={role} active={active} view={view} onView={onView} />
  return <div ref={host} className="rag-workspace" aria-label="知識庫">{container && createPortal(content, container)}</div>
}
