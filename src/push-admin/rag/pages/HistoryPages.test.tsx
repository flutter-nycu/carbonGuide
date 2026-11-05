// @vitest-environment jsdom

import { fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, type MockInstance } from 'vitest'
import type { FakeRagApi } from '../api/fake'
import type { ConversationSummary } from '../api/types'
import { openPage, setupPageTests } from './testing'

setupPageTests()

const table = (page: HTMLElement, name: string) => within(page).getByRole('table', { name })

describe('10 interaction history', () => {
  it('lists queries and evaluations, newest first, and filters by origin', async () => {
    const { page } = openPage('logs')
    await waitFor(() => expect(table(page(), '互動紀錄').textContent).toContain('照明怎麼省電？'))
    const rows = within(table(page(), '互動紀錄')).getAllByRole('row').slice(1)
    expect(rows[0].textContent).toContain('每月少用 20 度電')
    expect(rows[rows.length - 1].textContent).toContain('內容已超過保存期限')

    fireEvent.change(within(page()).getByLabelText('紀錄類型'), { target: { value: 'query' } })
    await waitFor(() => expect(table(page(), '互動紀錄').textContent).not.toContain('照明怎麼省電？'))
    expect(table(page(), '互動紀錄').textContent).toContain('如何減少食物浪費？')
  })

  it('loads the next page on request', async () => {
    const item = (n: number): ConversationSummary => ({ id: `r-${n}`, createdAt: '2026-11-01T00:00:00Z', origin: 'query', userLabel: '張俊隆', questionPreview: `第 ${n} 題`,
      kind: 'document', state: 'answered', versionName: '2026-10 第一版', reservedUsd: 0.002, estimatedUsd: 0.0006 })
    let list!: MockInstance<FakeRagApi['listInteractions']>
    const { page } = openPage('logs', 'owner', {}, api => {
      list = vi.spyOn(api, 'listInteractions')
        .mockResolvedValueOnce({ items: [item(1)], nextCursor: '20' })
        .mockResolvedValueOnce({ items: [item(2)], nextCursor: null })
    })
    await waitFor(() => expect(table(page(), '互動紀錄').textContent).toContain('第 1 題'))
    fireEvent.click(within(page()).getByRole('button', { name: '載入更多' }))
    await waitFor(() => expect(table(page(), '互動紀錄').textContent).toContain('第 2 題'))
    expect(table(page(), '互動紀錄').textContent).toContain('第 1 題')
    expect(list.mock.calls[1]).toEqual(['all', '20'])
    expect(within(page()).queryByRole('button', { name: '載入更多' })).toBeNull()
  })

  it('opens the detail of one interaction', async () => {
    const { page } = openPage('logs')
    await waitFor(() => expect(table(page(), '互動紀錄').textContent).toContain('每月少用 20 度電'))
    fireEvent.click(within(page()).getAllByRole('button', { name: /^檢視/ })[0])
    const dialog = within(page()).getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('region', { name: '處理流程' })).toBeTruthy())
    expect(within(dialog).getByRole('region', { name: '引用來源' }).textContent).toContain('綠生活指引.pdf')
    expect(within(dialog).getByRole('region', { name: '費用' }).textContent).toContain('google-standard-text-2026-10-26')
  })
})

describe('11 conversation users', () => {
  it('lists everyone who asked, including deleted accounts', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '對話使用者').textContent).toContain('張俊隆'))
    const owner = within(table(page(), '對話使用者')).getByText('張俊隆').closest('tr') as HTMLElement
    expect(owner.textContent).toContain('owner@carbonguide.test')
    expect(owner.textContent).toContain('管理者')
    expect(owner.textContent).toContain('3 次')
    expect(table(page(), '對話使用者').textContent).toContain('已刪除帳號')
    expect(table(page(), '對話使用者').textContent).not.toContain('照明怎麼省電？')
  })

  it('searches by name or email', async () => {
    const { api, page } = openPage('conversations')
    const list = vi.spyOn(api, 'listConversationUsers')
    await waitFor(() => expect(table(page(), '對話使用者').textContent).toContain('張俊隆'))
    fireEvent.change(within(page()).getByLabelText('搜尋名稱或 email'), { target: { value: 'editor@' } })
    fireEvent.click(within(page()).getByRole('button', { name: '搜尋' }))
    await waitFor(() => expect(table(page(), '對話使用者').textContent).not.toContain('張俊隆'))
    expect(table(page(), '對話使用者').textContent).toContain('林編輯')
    expect(list).toHaveBeenLastCalledWith('editor@', null)
  })

  it('goes from a person to their conversations and one detail, then back', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '對話使用者').textContent).toContain('張俊隆'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 張俊隆 的對話' }))
    await waitFor(() => expect(table(page(), '張俊隆 的對話').textContent).toContain('如何減少食物浪費？'))
    expect(within(table(page(), '張俊隆 的對話')).getAllByRole('row')).toHaveLength(4)

    fireEvent.click(within(table(page(), '張俊隆 的對話')).getAllByRole('button', { name: /^檢視/ })[1])
    const dialog = within(page()).getByRole('dialog')
    await waitFor(() => expect(dialog.textContent).toContain('QA 回答'))
    fireEvent.click(within(dialog).getByRole('button', { name: '關閉' }))

    fireEvent.click(within(page()).getByRole('button', { name: '← 回到使用者列表' }))
    await waitFor(() => expect(table(page(), '對話使用者')).toBeTruthy())
  })

  it('opens the conversations of a deleted account', async () => {
    const { api, page } = openPage('conversations')
    const list = vi.spyOn(api, 'listUserConversations')
    await waitFor(() => expect(table(page(), '對話使用者').textContent).toContain('已刪除帳號'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 已刪除帳號 的對話' }))
    await waitFor(() => expect(table(page(), '已刪除帳號 的對話').textContent).toContain('騎機車和搭公車'))
    expect(list).toHaveBeenCalledWith(null, null)
  })

  it('shows only the expiry note for a conversation older than 180 days', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '對話使用者').textContent).toContain('張俊隆'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 張俊隆 的對話' }))
    await waitFor(() => expect(table(page(), '張俊隆 的對話').textContent).toContain('內容已超過保存期限'))
    const buttons = within(table(page(), '張俊隆 的對話')).getAllByRole('button', { name: /^檢視/ })
    fireEvent.click(buttons[buttons.length - 1])
    const dialog = within(page()).getByRole('dialog')
    await waitFor(() => expect(dialog.textContent).toContain('超過 180 天的保存期限'))
    expect(dialog.textContent).toContain('估計費用')
  })

  it('is closed to editors and sends no query', async () => {
    const { api, page } = openPage('conversations', 'editor')
    const list = vi.spyOn(api, 'listConversationUsers')
    await waitFor(() => expect(page().textContent).toContain('這一頁只有 owner 可以查看。'))
    expect(list).not.toHaveBeenCalled()
  })
})
