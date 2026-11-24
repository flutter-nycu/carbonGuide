// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createFakeRagApi } from './api/fake'
import type { Role } from './api/types'
import { PAGES } from './pageList'
import { WorkspaceHost, setupPageTests } from './pages/testing'
import { TUTORIAL_STEPS } from './tutorialContent'
import { TUTORIAL_KEY } from './Tutorial'
import Workspace from './Workspace'

setupPageTests()

const launcher = () => screen.getByRole('button', { name: /^操作教學/ })
/** The workspace with the tutorial opened from its button, which is how it starts. */
function open(role: Role = 'owner') {
  const view = render(<WorkspaceHost api={createFakeRagApi({ role })} role={role} />)
  fireEvent.click(launcher())
  return view
}
const panel = () => screen.getByRole('complementary', { name: '操作教學' })
const inPanel = () => within(panel())
const stepTitle = () => panel().querySelector('.tutorial-current h3')!.textContent
const nav = () => screen.getByRole('navigation', { name: '知識庫頁面' })
const marked = () => [...nav().querySelectorAll('[data-tutorial="next"]')].map(b => b.textContent)
const complete = () => fireEvent.click(inPanel().getByRole('button', { name: '標記完成' }))

describe('tutorial content', () => {
  it('walks twelve steps in order, each on an existing page and with something to do', () => {
    expect(TUTORIAL_STEPS.map(s => s.title)).toEqual(['上傳文件', '確認整理好並分類', '檢查教練人格', '確認回答規則', '整理常見問答',
      '檢查搜尋設定', '建立版本', '試問', '跑自動測驗', '人工審核', '發布', '追蹤紀錄和使用者'])
    expect(new Set(TUTORIAL_STEPS.map(s => s.id)).size).toBe(TUTORIAL_STEPS.length)
    for (const step of TUTORIAL_STEPS) {
      const page = PAGES.find(p => p.id === step.page)
      expect(page, step.id).toBeTruthy()
      expect(step.purpose && step.done, step.id).toBeTruthy()
      expect(step.actions.length, step.id).toBeGreaterThan(0)
      // A page only the owner may read cannot be a step someone else is told to do.
      if (page!.readers === 'owner') expect(step.actor, step.id).toBe('owner')
    }
  })
})

describe('tutorial panel', () => {
  it('starts closed as a small button that shows the progress', () => {
    const view = render(<WorkspaceHost api={createFakeRagApi({ role: 'owner' })} role="owner" />)
    expect(screen.queryByRole('complementary', { name: '操作教學' })).toBeNull()
    expect(launcher().getAttribute('aria-label')).toBe('操作教學，已完成 0／12 步')
    expect(launcher().textContent).toBe('操作教學0／12')
    expect(marked()).toEqual([])
    expect(view.container.querySelector('.shell')!.classList.contains('with-launcher')).toBe(true)
  })

  it('opens at step 1 and explains what the step is for, how to do it and how to tell it is done', () => {
    open()
    expect(inPanel().getByRole('heading', { level: 2, name: '操作教學' })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('操作教學')
    expect(panel().textContent).toContain('已完成 0／12 步，下一步是第 1 步')
    expect(stepTitle()).toBe('上傳文件')
    for (const heading of ['這一步在做什麼', '怎麼做', '怎麼知道完成了', '要注意']) expect(inPanel().getByRole('heading', { level: 4, name: heading })).toBeTruthy()
    expect((panel().querySelector('progress') as HTMLProgressElement).value).toBe(0)
    expect(inPanel().getByRole('button', { name: '上一步' }).hasAttribute('disabled')).toBe(true)
    // The sidebar marks the page of the next step.
    expect(marked()).toEqual(['上傳文件'])
  })

  it('takes the admin to the step\'s page, then says they are there', () => {
    const view = open()
    fireEvent.click(inPanel().getByRole('button', { name: '前往「上傳文件」' }))
    expect((view.container.querySelector('[data-page="import"]') as HTMLElement).hidden).toBe(false)
    expect(inPanel().getByRole('status').textContent).toContain('你現在就在「上傳文件」')
    expect(inPanel().queryByRole('button', { name: /^前往/ })).toBeNull()
  })

  it('marks a step done and moves on to the next unfinished one', () => {
    open()
    complete()
    expect(stepTitle()).toBe('確認整理好並分類')
    expect(document.activeElement?.textContent).toBe('確認整理好並分類')
    expect(panel().textContent).toContain('已完成 1／12 步，下一步是第 2 步')
    expect((panel().querySelector('progress') as HTMLProgressElement).value).toBe(1)
    expect(marked()).toEqual(['文件'])
    // Going back shows the finished step, which can be undone.
    fireEvent.click(inPanel().getByRole('button', { name: '上一步' }))
    expect(stepTitle()).toBe('上傳文件')
    expect(within(panel().querySelector('.tutorial-tags')!).getByText('已完成')).toBeTruthy()
    fireEvent.click(inPanel().getByRole('button', { name: '改回還沒做' }))
    expect(panel().textContent).toContain('已完成 0／12 步')
    expect(inPanel().getByRole('button', { name: '標記完成' })).toBeTruthy()
  })

  it('closes to its button and reopens at the next unfinished step', () => {
    open()
    complete()
    complete()
    fireEvent.click(inPanel().getByRole('button', { name: '下一步' }))
    expect(stepTitle()).toBe('確認回答規則')
    fireEvent.click(inPanel().getByRole('button', { name: '關閉操作教學' }))
    expect(screen.queryByRole('complementary', { name: '操作教學' })).toBeNull()
    expect(marked()).toEqual([])
    expect(launcher().getAttribute('aria-label')).toBe('操作教學，已完成 2／12 步')
    expect(document.activeElement).toBe(launcher())
    fireEvent.click(launcher())
    // Reopens at the next unfinished step, not the one last browsed.
    expect(stepTitle()).toBe('檢查教練人格')
    expect(document.activeElement?.textContent).toBe('操作教學')
    expect(marked()).toEqual(['教練人格'])
  })

  it('closes with Escape', () => {
    open()
    fireEvent.keyDown(inPanel().getByRole('button', { name: '標記完成' }), { key: 'Escape' })
    expect(screen.queryByRole('complementary', { name: '操作教學' })).toBeNull()
    expect(launcher()).toBeTruthy()
  })

  it('jumps to any step from the list of all steps', () => {
    open()
    const list = inPanel().getByRole('list', { name: '教學步驟' })
    const items = within(list).getAllByRole('button')
    expect(items.map(b => b.textContent)).toEqual(TUTORIAL_STEPS.map((s, i) => `${i + 1}${i + 1}. ${s.title}${i === 0 ? '下一步' : '還沒做'}`))
    fireEvent.click(items[10])
    expect(stepTitle()).toBe('發布')
    expect(items[10].getAttribute('aria-current')).toBe('step')
    expect(inPanel().getByRole('button', { name: '前往「版本與發布」' })).toBeTruthy()
  })

  it('keeps progress across the RAG top tabs', () => {
    open()
    complete()
    fireEvent.click(screen.getByRole('button', { name: '運作原理' }))
    expect(panel().textContent).toContain('已完成 1／12 步')
    fireEvent.click(screen.getByRole('button', { name: '知識庫' }))
    expect(stepTitle()).toBe('確認整理好並分類')
  })

  it('remembers progress and whether it is open after the page reloads', () => {
    const first = open()
    complete()
    complete()
    first.unmount()
    render(<WorkspaceHost api={createFakeRagApi({ role: 'owner' })} role="owner" />)
    expect(panel().textContent).toContain('已完成 2／12 步')
    expect(stepTitle()).toBe('檢查教練人格')
    fireEvent.click(inPanel().getByRole('button', { name: '關閉操作教學' }))
    expect(JSON.parse(localStorage.getItem(TUTORIAL_KEY)!)).toEqual({ open: false, viewing: 'personas', done: ['import', 'documents'] })
  })

  it('drops saved steps it does not know, and starts closed when the saved state is unreadable', () => {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ open: true, viewing: 'gone', done: ['gone', 'import'] }))
    const view = render(<WorkspaceHost api={createFakeRagApi({ role: 'owner' })} role="owner" />)
    expect(panel().textContent).toContain('已完成 1／12 步')
    expect(stepTitle()).toBe('確認整理好並分類')
    view.unmount()
    localStorage.setItem(TUTORIAL_KEY, '{not json')
    render(<WorkspaceHost api={createFakeRagApi({ role: 'owner' })} role="owner" />)
    expect(screen.queryByRole('complementary', { name: '操作教學' })).toBeNull()
    expect(launcher().getAttribute('aria-label')).toBe('操作教學，已完成 0／12 步')
  })

  it('still works when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    open()
    complete()
    expect(panel().textContent).toContain('已完成 1／12 步')
    vi.restoreAllMocks()
  })

  it('hides while the push workspace is shown and comes back where it was', () => {
    const api = createFakeRagApi({ role: 'owner' })
    const view = render(<Workspace api={api} role="owner" active />)
    fireEvent.click(launcher())
    complete()
    view.rerender(<Workspace api={api} role="owner" active={false} />)
    expect(screen.queryByRole('complementary', { name: '操作教學' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^操作教學/ })).toBeNull()
    view.rerender(<Workspace api={api} role="owner" active />)
    expect(stepTitle()).toBe('確認整理好並分類')
  })

  it('tells the layout whether the panel or its button is showing, so the page can leave room at its end', () => {
    const api = createFakeRagApi({ role: 'owner' })
    const view = render(<Workspace api={api} role="owner" active />)
    const shell = () => view.container.querySelector('.shell')!
    expect(shell().classList.contains('with-launcher')).toBe(true)
    fireEvent.click(launcher())
    expect(shell().contains(panel())).toBe(true)
    expect(shell().classList.contains('with-tutorial')).toBe(true)
    fireEvent.click(inPanel().getByRole('button', { name: '關閉操作教學' }))
    expect(shell().classList.contains('with-tutorial')).toBe(false)
    expect(shell().classList.contains('with-launcher')).toBe(true)
    view.rerender(<Workspace api={api} role="owner" active={false} />)
    expect([...shell().classList].filter(c => c.startsWith('with-'))).toEqual([])
    // The step's buttons come before the explanation, so they stay in view when it is long.
    view.rerender(<Workspace api={api} role="owner" active />)
    fireEvent.click(launcher())
    const order = [...panel().querySelectorAll('button, h4')].map(e => e.textContent)
    expect(order.indexOf('標記完成')).toBeLessThan(order.indexOf('這一步在做什麼'))
  })

  it('tells a role that cannot do a step who should, and still explains it', () => {
    open('editor')
    expect(inPanel().queryByText(/這一步要由/)).toBeNull()
    fireEvent.click(within(inPanel().getByRole('list', { name: '教學步驟' })).getAllByRole('button')[6])
    expect(stepTitle()).toBe('建立版本')
    expect(inPanel().getByText('這一步要由管理者操作，你的角色可以先看說明。')).toBeTruthy()
    // Steps an editor may do carry no such notice.
    fireEvent.click(within(inPanel().getByRole('list', { name: '教學步驟' })).getAllByRole('button')[0])
    expect(inPanel().queryByText(/這一步要由/)).toBeNull()
    expect(inPanel().getByRole('heading', { level: 4, name: '怎麼做' })).toBeTruthy()
  })

  it('says when every step is done, and starts over only after confirming', () => {
    open()
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) complete()
    expect(panel().textContent).toContain('已完成 12／12 步')
    expect(inPanel().getByText(/12 個步驟都完成了/)).toBeTruthy()
    expect(marked()).toEqual([])
    fireEvent.click(inPanel().getByRole('button', { name: '重設進度' }))
    fireEvent.click(inPanel().getByRole('button', { name: '取消' }))
    expect(panel().textContent).toContain('已完成 12／12 步')
    fireEvent.click(inPanel().getByRole('button', { name: '關閉操作教學' }))
    expect(launcher().textContent).toBe('操作教學12／12')
    fireEvent.click(launcher())
    fireEvent.click(inPanel().getByRole('button', { name: '重設進度' }))
    fireEvent.click(inPanel().getByRole('button', { name: '確定重設' }))
    expect(panel().textContent).toContain('已完成 0／12 步')
    expect(stepTitle()).toBe('上傳文件')
  })
})
