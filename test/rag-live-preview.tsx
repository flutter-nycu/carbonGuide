// Local verification only: mounts the workspace exactly like RagWorkspace (shadow root + portal) on the fake API,
// with plain buttons standing in for the admin's top tabs that switch its three views.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import styleUrl from '../src/push-admin/rag/styles.css?url'
import Workspace from '../src/push-admin/rag/Workspace'
import { createFakeRagApi } from '../src/push-admin/rag/api/fake'
import type { Role } from '../src/push-admin/rag/api/types'
import type { RagView } from '../src/push-admin/rag/pageList'

const role = (new URLSearchParams(location.search).get('role') ?? 'owner') as Role
const shadow = document.getElementById('host')!.attachShadow({ mode: 'open' })
shadow.innerHTML = '<link rel="stylesheet" href="' + styleUrl + '"><div class="rag-body"></div>'
const api = createFakeRagApi({ role, autoAdvance: true })
const VIEWS: readonly { view: RagView; label: string }[] = [
  { view: 'workspace', label: '知識庫' }, { view: 'conversations', label: '使用者' }, { view: 'guide', label: '運作原理' },
]

function Preview() {
  const [view, setView] = useState<RagView>('workspace')
  return <>
    <nav aria-label="切換工作台">{VIEWS.filter(v => v.view !== 'conversations' || role === 'owner').map(v =>
      <button key={v.view} type="button" aria-current={view === v.view ? 'page' : undefined} onClick={() => setView(v.view)}>{v.label}</button>)}</nav>
    {createPortal(<Workspace api={api} role={role} view={view} onView={setView} />, shadow.querySelector('.rag-body')!)}
  </>
}

createRoot(document.getElementById('app')!).render(<Preview />)
