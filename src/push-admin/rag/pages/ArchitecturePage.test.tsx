// @vitest-environment jsdom

import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Workspace from '../Workspace'
import { openPage, setupPageTests } from './testing'

setupPageTests()

const diagram = (page: HTMLElement) => within(page).getByRole('list', { name: '架構總覽圖' })
const step = (page: HTMLElement) => page.querySelector('[aria-live="polite"]') as HTMLElement
const click = (page: HTMLElement, name: string | RegExp) => fireEvent.click(within(page).getByRole('button', { name }))
const currentBlock = (page: HTMLElement) => diagram(page).querySelector('[aria-current="true"]')?.textContent ?? ''
const facts = (live: HTMLElement) => [...live.querySelectorAll('dt')].map(dt => dt.textContent)

describe('technical architecture guide (top tab)', () => {
  it('shows the five blocks in the order data flows', () => {
    const { page } = openPage('guide')
    const blocks = within(diagram(page())).getAllByRole('listitem').map(item => item.textContent ?? '')
    expect(blocks).toHaveLength(5)
    expect(blocks.map(text => ['管理工作台', 'rag-v1', '資料庫', '自動處理', 'Gemini'].findIndex(name => text.includes(name)))).toEqual([0, 1, 2, 3, 4])
  })

  it('walks the document route one step at a time and lights up the block in use', () => {
    const { page } = openPage('guide')
    expect(step(page()).textContent).toContain('第 1 步，共 7 步')
    expect(step(page()).getAttribute('aria-atomic')).toBe('true')
    expect(step(page()).textContent).toContain('上傳或登記網址')
    expect((within(page()).getByRole('button', { name: '上一步' }) as HTMLButtonElement).disabled).toBe(true)
    for (let i = 0; i < 3; i++) click(page(), '下一步')
    expect(step(page()).querySelector('h3')?.textContent).toBe('轉成可搜尋的格式')
    expect(step(page()).textContent).toContain('gemini-embedding-001')
    expect(currentBlock(page())).toContain('Gemini')
    expect((within(page()).getByRole('button', { name: '上一步' }) as HTMLButtonElement).disabled).toBe(false)
    for (let i = 0; i < 3; i++) click(page(), '下一步')
    expect(step(page()).querySelector('h3')?.textContent).toBe('發布')
    expect((within(page()).getByRole('button', { name: '下一步' }) as HTMLButtonElement).disabled).toBe(true)
    // The pressed button is now disabled, so focus moves to the one that still works.
    expect(document.activeElement?.textContent).toBe('上一步')
    click(page(), '上一步')
    expect(step(page()).querySelector('h3')?.textContent).toBe('評測與人工審核')
    for (let i = 0; i < 5; i++) click(page(), '上一步')
    expect(step(page()).querySelector('h3')?.textContent).toBe('上傳或登記網址')
    expect(document.activeElement?.textContent).toBe('下一步')
  })

  it('jumps straight to a step from its dot', () => {
    const { page } = openPage('guide')
    click(page(), '第 5 步：建立知識版本')
    expect(step(page()).querySelector('h3')?.textContent).toBe('建立知識版本')
    expect(within(page()).getByRole('button', { name: '第 5 步：建立知識版本' }).getAttribute('aria-current')).toBe('step')
  })

  it('switches between the two routes with the mouse or the arrow keys', () => {
    const { page } = openPage('guide')
    const tabs = within(page()).getByRole('tablist', { name: '選擇流程' })
    fireEvent.click(within(tabs).getByRole('tab', { name: '一個問題怎麼被回答' }))
    expect(step(page()).textContent).toContain('第 1 步，共 8 步')
    expect(step(page()).querySelector('h3')?.textContent).toBe('確認身分與範圍')
    expect(within(tabs).getByRole('tab', { name: '一個問題怎麼被回答' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(within(tabs).getByRole('tab', { name: '一個問題怎麼被回答' }), { key: 'ArrowLeft' })
    expect(within(tabs).getByRole('tab', { name: '文件怎麼變成知識' }).getAttribute('aria-selected')).toBe('true')
    expect(step(page()).textContent).toContain('共 7 步')
    fireEvent.keyDown(within(tabs).getByRole('tab', { name: '文件怎麼變成知識' }), { key: 'ArrowRight' })
    expect(within(tabs).getByRole('tab', { name: '一個問題怎麼被回答' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(within(tabs).getByRole('tab', { name: '一個問題怎麼被回答' }), { key: 'Home' })
    expect(document.activeElement?.textContent).toBe('文件怎麼變成知識')
    fireEvent.keyDown(within(tabs).getByRole('tab', { name: '文件怎麼變成知識' }), { key: 'End' })
    expect(within(tabs).getByRole('tab', { name: '一個問題怎麼被回答' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement?.textContent).toBe('一個問題怎麼被回答')
  })

  it('jumps from a block to the first step that uses it, switching route when needed', () => {
    const { page } = openPage('guide')
    fireEvent.click(within(diagram(page())).getByRole('button', { name: /rag-v1/ }))
    expect(step(page()).querySelector('h3')?.textContent).toBe('自動開始處理')
    fireEvent.click(within(page()).getByRole('tab', { name: '一個問題怎麼被回答' }))
    fireEvent.click(within(diagram(page())).getByRole('button', { name: /Gemini/ }))
    expect(within(page()).getByRole('tab', { name: '一個問題怎麼被回答' }).getAttribute('aria-selected')).toBe('true')
    expect(step(page()).querySelector('h3')?.textContent).toBe('把問題轉成可搜尋的格式')
    fireEvent.click(within(diagram(page())).getByRole('button', { name: /自動處理/ }))
    expect(within(page()).getByRole('tab', { name: '文件怎麼變成知識' }).getAttribute('aria-selected')).toBe('true')
    expect(step(page()).querySelector('h3')?.textContent).toBe('讀出內容並切成段落')
  })

  it('opens the related workspace page', () => {
    const { page, view } = openPage('guide')
    fireEvent.click(within(page()).getByRole('tab', { name: '一個問題怎麼被回答' }))
    click(page(), '第 4 步：找資料')
    click(page(), /^到這一頁看看/)
    expect((view.container.querySelector('[data-page="settings"]') as HTMLElement).hidden).toBe(false)
    expect(page().hidden).toBe(true)
    // The admin's top tab follows: the guide lives in its own tab, settings in the RAG workspace.
    expect(view.getByRole('button', { name: 'RAG 知識工作台' }).getAttribute('aria-current')).toBe('page')
  })

  it('lists the safeguards and the glossary', () => {
    const { page } = openPage('guide')
    expect(within(page()).getByRole('list', { name: '品質與安全怎麼把關' }).children).toHaveLength(6)
    const glossary = within(page()).getByRole('region', { name: '名詞小辭典' })
    for (const term of ['RAG', '段落', '向量', '混合檢索', 'RRF', '知識版本', '驗收評測', '引用核對']) expect(glossary.textContent).toContain(term)
  })

  it('shows the live settings an owner can read, including the AI budget', async () => {
    const { page } = openPage('guide')
    const live = within(page()).getByRole('region', { name: '目前的實際設定' })
    await waitFor(() => expect(live.textContent).toContain('先找 20 筆資料，參考 6 段'))
    expect(live.textContent).toContain('共 6 份')
    expect(live.textContent).toContain('2026-10 第一版')
    expect(live.textContent).toContain('US$3.66')
    expect(live.textContent).toContain('gemini-3.1-flash-lite')
    expect(facts(live)).toEqual(['文件', '檢索設定', '知識版本', 'AI 預算', '模型'])
  })

  it('reads the live settings again when the guide is shown again', async () => {
    const { api, page, go } = openPage('guide')
    const live = within(page()).getByRole('region', { name: '目前的實際設定' })
    await waitFor(() => expect(live.textContent).toContain('先找 20 筆資料，參考 6 段'))
    go('settings')
    await api.saveSettings({ candidates: 30, contextChunks: 8 }, (await api.getSettings()).updatedAt)
    go('guide')
    await waitFor(() => expect(live.textContent).toContain('先找 30 筆資料，參考 8 段'))
  })

  it('does not ask for the budget for an editor, nor for versions for a viewer', async () => {
    let budget = vi.fn(), versions = vi.fn()
    const editor = openPage('guide', 'editor', {}, api => { budget = vi.spyOn(api, 'getBudget'); versions = vi.spyOn(api, 'listVersions') })
    const editorLive = within(editor.page()).getByRole('region', { name: '目前的實際設定' })
    await waitFor(() => expect(editorLive.textContent).toContain('2026-10 第一版'))
    expect(facts(editorLive)).toEqual(['文件', '檢索設定', '知識版本', '模型'])
    expect(budget).not.toHaveBeenCalled()
    editor.view.unmount()

    const viewer = openPage('guide', 'viewer', {}, api => { budget = vi.spyOn(api, 'getBudget'); versions = vi.spyOn(api, 'listVersions') })
    const viewerLive = within(viewer.page()).getByRole('region', { name: '目前的實際設定' })
    await waitFor(() => expect(viewerLive.textContent).toContain('先找 20 筆資料'))
    expect(facts(viewerLive)).toEqual(['文件', '檢索設定', '模型'])
    expect(versions).not.toHaveBeenCalled()
    expect(budget).not.toHaveBeenCalled()
    expect(viewer.page().textContent).toContain('文件怎麼變成知識')
  })

  it('still teaches when the backend is off, without sending any request', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const view = render(<Workspace api={null} role="owner" view="guide" />)
    const page = view.container.querySelector('[data-page="guide"]') as HTMLElement
    expect(within(page).getByRole('list', { name: '架構總覽圖' })).toBeTruthy()
    expect(page.textContent).toContain('上傳或登記網址')
    expect(within(page).getByRole('region', { name: '目前的實際設定' }).textContent).toContain('RAG 後端尚未啟用')
    expect(within(page).getByRole('list', { name: '品質與安全怎麼把關' }).children).toHaveLength(6)
    expect(within(page).getByRole('region', { name: '名詞小辭典' }).textContent).toContain('混合檢索')
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockRestore()
  })
})
