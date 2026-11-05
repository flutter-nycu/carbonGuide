import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styleUrl from '../rag/styles.css?url'
import Workspace from '../rag/Workspace'
import type { RagApi, Role } from '../rag/api/types'

// The workspace keeps its own stylesheet inside a shadow root, so the push admin's Tailwind never reaches it.
// React renders into that root through a portal; the portal container receives the events.
const enabled = import.meta.env.VITE_RAG_ENABLED === 'true'

export default function RagWorkspace({ role, active }: { role: Role; active: boolean }) {
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

  const view = enabled && !api
    ? <p className="muted" role="status">正在連線到知識庫…</p>
    : <Workspace api={api} role={role} active={active} />
  return <div ref={host} className="rag-workspace" aria-label="RAG 知識工作台">{container && createPortal(view, container)}</div>
}
