// Shared setup for the page tests: opens the workspace on one page backed by the in-memory API.
import { useState, type ComponentProps } from 'react'
import { cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import { createFakeRagApi, type FakeOptions, type FakeRagApi } from '../api/fake'
import { clearRequestKeys } from '../api/requestKeys'
import type { Role } from '../api/types'
import { viewOf, type PageId, type RagView } from '../pageList'
import Workspace from '../Workspace'

export const NOW = new Date('2026-11-05T08:00:00Z')

// Walking every page takes a few seconds when the whole suite shares a busy two-core machine.
export const ALL_PAGES_TIMEOUT = 15_000

/** jsdom has no modal dialogs; call once per test file. */
export function setupPageTests() {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) }
  })
  afterEach(() => { cleanup(); clearRequestKeys() })
}

// The admin's top tabs that hold the RAG workspace. Dashboard shows the same names (plus a tag on the RAG tab);
// this host does not hide tabs by role or follow the address, which Dashboard's own tests cover.
const VIEW_LABEL: Record<RagView, string> = { workspace: 'RAG 知識工作台', conversations: '對話使用者', guide: '技術架構導覽' }

/** Stands in for the admin's top tabs: one workspace, switched between its three views. */
export function WorkspaceHost({ initialView = 'workspace', ...props }: Omit<ComponentProps<typeof Workspace>, 'view' | 'onView'> & { initialView?: RagView }) {
  const [view, setView] = useState<RagView>(initialView)
  return <>
    <nav aria-label="上方分頁">{(Object.keys(VIEW_LABEL) as RagView[]).map(v =>
      <button key={v} type="button" aria-current={view === v ? 'page' : undefined} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>)}</nav>
    <Workspace {...props} view={view} onView={setView} />
  </>
}

/** Opens a page the way an admin does: its top tab, then the page select for the sidebar pages. */
export function showPage(view: RenderResult, id: PageId) {
  const target = viewOf(id)
  fireEvent.click(within(view.getByRole('navigation', { name: '上方分頁' })).getByRole('button', { name: VIEW_LABEL[target] }))
  if (target === 'workspace') fireEvent.change(view.getByLabelText('切換管理功能'), { target: { value: id } })
}

/** `prepare` runs before the first render, for spies that must see the first request. */
export function openPage(id: PageId, role: Role = 'owner', options: FakeOptions = {}, prepare?: (api: FakeRagApi) => void) {
  const api = createFakeRagApi({ role, now: () => NOW, ...options })
  prepare?.(api)
  return openWith(api, id)
}

/** Opens a page on an API the test has already filled with data. */
export function openWith(api: FakeRagApi, id: PageId) {
  const role = api.role
  const view = render(<WorkspaceHost api={api} role={role} />)
  const go = (target: PageId) => showPage(view, target)
  go(id)
  const page = () => view.container.querySelector(`[data-page="${id}"]`) as HTMLElement
  return { api, view, page, go }
}

/** A dataset in the backend's rag-v1-evaluation-1 format. */
export function dataset(split: 'development' | 'acceptance', size: number, name = split === 'acceptance' ? '驗收題組 v2' : '練習題組 v1') {
  const categories = split === 'acceptance'
    ? [...Array(12).fill('retrieval'), ...Array(8).fill('abstention'), ...Array(8).fill('safety'), ...Array(6).fill('qa'), ...Array(6).fill('persona')]
    : ['retrieval']
  return {
    schema: 'rag-v1-evaluation-1', name, split,
    cases: Array.from({ length: size }, (_, index) => {
      const category = categories[index % categories.length]
      return { id: `${split}-${index + 1}`, category, input: { question: `${name} 第 ${index + 1} 題`, tool_requests: [] },
        expected: { state: ['abstention', 'safety'].includes(category) ? 'abstained' : 'answered' } }
    }),
  }
}
