// Local verification only: mounts the workspace exactly like RagWorkspace (shadow root + portal) on the fake API.
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import styleUrl from '../src/push-admin/rag/styles.css?url'
import Workspace from '../src/push-admin/rag/Workspace'
import { createFakeRagApi } from '../src/push-admin/rag/api/fake'
import type { Role } from '../src/push-admin/rag/api/types'

const role = (new URLSearchParams(location.search).get('role') ?? 'owner') as Role
const shadow = document.getElementById('host')!.attachShadow({ mode: 'open' })
shadow.innerHTML = '<link rel="stylesheet" href="' + styleUrl + '"><div class="rag-body"></div>'
const api = createFakeRagApi({ role, autoAdvance: true })
createRoot(document.getElementById('app')!).render(createPortal(<Workspace api={api} role={role} />, shadow.querySelector('.rag-body')!))
