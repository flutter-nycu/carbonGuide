// @vitest-environment jsdom

import { fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, type MockInstance } from 'vitest'
import { createFakeRagApi, type FakeRagApi } from '../api/fake'
import type { ConversationSummary, ConversationUser } from '../api/types'
import { pageWindow } from './ConversationsPage'
import { NOW, openPage, openWith, setupPageTests } from './testing'

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

describe('conversation users (top tab)', () => {
  it('lists everyone who asked, including deleted accounts', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
    const owner = within(table(page(), '使用者')).getByText('張俊隆').closest('tr') as HTMLElement
    expect(owner.textContent).toContain('owner@carbonguide.test')
    expect(owner.textContent).toContain('管理者')
    expect(owner.textContent).toContain('3 次')
    expect(table(page(), '使用者').textContent).toContain('已刪除帳號')
    expect(table(page(), '使用者').textContent).not.toContain('照明怎麼省電？')
  })

  it('searches by name or email', async () => {
    const { api, page } = openPage('conversations')
    const list = vi.spyOn(api, 'listConversationUsers')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
    fireEvent.change(within(page()).getByLabelText('搜尋名稱或 email'), { target: { value: 'editor@' } })
    fireEvent.click(within(page()).getByRole('button', { name: '搜尋' }))
    await waitFor(() => expect(table(page(), '使用者').textContent).not.toContain('張俊隆'))
    expect(table(page(), '使用者').textContent).toContain('林編輯')
    expect(list).toHaveBeenLastCalledWith('editor@', null)
  })

  it('goes from a person to their conversations and one detail, then back', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 張俊隆 的對話' }))
    await waitFor(() => expect(table(page(), '張俊隆 的對話').textContent).toContain('如何減少食物浪費？'))
    expect(within(table(page(), '張俊隆 的對話')).getAllByRole('row')).toHaveLength(4)

    fireEvent.click(within(table(page(), '張俊隆 的對話')).getAllByRole('button', { name: /^檢視/ })[1])
    const dialog = within(page()).getByRole('dialog')
    await waitFor(() => expect(dialog.textContent).toContain('QA 回答'))
    fireEvent.click(within(dialog).getByRole('button', { name: '關閉' }))

    fireEvent.click(within(page()).getByRole('button', { name: '← 回到使用者列表' }))
    await waitFor(() => expect(table(page(), '使用者')).toBeTruthy())
  })

  it('opens the conversations of a deleted account', async () => {
    const { api, page } = openPage('conversations')
    const list = vi.spyOn(api, 'listUserConversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('已刪除帳號'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 已刪除帳號 的對話' }))
    await waitFor(() => expect(table(page(), '已刪除帳號 的對話').textContent).toContain('騎機車和搭公車'))
    expect(list).toHaveBeenCalledWith(null, null)
  })

  it('shows only the expiry note for a conversation older than 180 days', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
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

describe('conversation user status', () => {
  const region = (page: HTMLElement) => within(page).getByRole('region', { name: '目前狀態' })
  const person = (overrides: Partial<ConversationUser>): ConversationUser => ({
    userId: 'u-1', name: '測試帳號', email: 'test@carbonguide.test', role: null, count: 2, lastAt: '2026-11-05T07:00:00Z',
    reservedUsd: 0, estimatedUsd: 0, status: null, ...overrides,
  })
  const status = (account: NonNullable<ConversationUser['status']>['account']) => ({
    account, joinedAt: '2026-10-01T00:00:00Z', lastSignInAt: null, todayRequests: 0,
    outcomes: { qa: 0, document: 1, insufficient: 1, incomplete: 0 }, activeRounds: [],
  })

  it('shows the account, today’s questions and outcomes in the list', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
    expect(within(table(page(), '使用者')).getAllByRole('columnheader').map(h => h.textContent)).toContain('目前狀態')
    const owner = within(table(page(), '使用者')).getByText('張俊隆').closest('tr') as HTMLElement
    expect(owner.textContent).toContain('帳號正常')
    // Today's questions only show once there are some, so a long list of App accounts stays readable.
    expect(owner.textContent).not.toContain('今日')
    expect(owner.textContent).toContain('QA 回答 1、文件回答 2')
    const gone = within(table(page(), '使用者')).getAllByText('已刪除帳號')[0].closest('tr') as HTMLElement
    expect(gone.textContent).toContain('帳號已刪除')
    expect(gone.textContent).toContain('資料不足 1')
    expect(gone.textContent).not.toContain('今日')
  })

  it('shows the full status above a person’s conversations, including an open round', async () => {
    const api = createFakeRagApi({ role: 'owner', now: () => NOW })
    const round = await api.createRound('v-1', 'status-round')
    await api.ask(round.id, '如何減少食物浪費？', 'status-ask')
    const { page } = openWith(api, 'conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
    const owner = within(table(page(), '使用者')).getByText('張俊隆').closest('tr') as HTMLElement
    expect(owner.textContent).toContain('今日 1／150 題')
    expect(owner.textContent).toContain('1 個測試輪次進行中')
    fireEvent.click(within(page()).getByRole('button', { name: '查看 張俊隆 的對話' }))
    await waitFor(() => expect(region(page()).textContent).toContain('帳號正常'))
    const text = region(page()).textContent
    expect(text).toContain('管理者')
    expect(text).toContain('加入時間')
    expect(text).toContain('最近登入')
    expect(text).toContain('1／150 題')
    expect(text).toContain('2026-10 第一版：已問 1／20 題')
    expect(text).toContain('QA 回答 2、文件回答 2')
    expect(text).not.toContain('沒有進行中的測試輪次')
  })

  it('says when there is no open round', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 張俊隆 的對話' }))
    await waitFor(() => expect(region(page()).textContent).toContain('沒有進行中的測試輪次'))
  })

  it('leaves sign-in, quota and rounds out for a deleted account', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('已刪除帳號'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 已刪除帳號 的對話' }))
    await waitFor(() => expect(region(page()).textContent).toContain('帳號已刪除'))
    const text = region(page()).textContent
    expect(text).toContain('資料不足 1')
    for (const label of ['最近登入', '今日用量', '測試輪次']) expect(text).not.toContain(label)
  })

  it('names accounts without admin access and the other account states', async () => {
    const { page } = openPage('conversations', 'owner', {}, api => {
      vi.spyOn(api, 'listConversationUsers').mockResolvedValue({ nextCursor: null, items: [
        person({ userId: 'u-1', name: '停用帳號', status: status('disabled') }),
        person({ userId: 'u-2', name: '未驗證帳號', status: status('unverified') }),
      ] })
    })
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('停用帳號'))
    const row = (name: string) => within(table(page(), '使用者')).getByText(name).closest('tr') as HTMLElement
    expect(row('停用帳號').textContent).toContain('一般使用者')
    expect(row('停用帳號').textContent).toContain('帳號已停用')
    expect(row('未驗證帳號').textContent).toContain('email 未驗證')
  })

  it('keeps working when the backend has no status yet', async () => {
    const { page } = openPage('conversations', 'owner', {}, api => {
      vi.spyOn(api, 'listConversationUsers').mockResolvedValue({ nextCursor: null, items: [person({ name: '舊後端帳號', role: 'owner' })] })
    })
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('舊後端帳號'))
    const row = within(table(page(), '使用者')).getByText('舊後端帳號').closest('tr') as HTMLElement
    expect(row.textContent).not.toContain('帳號正常')
    expect(row.textContent).not.toContain('今日')
    fireEvent.click(within(page()).getByRole('button', { name: '查看 舊後端帳號 的對話' }))
    await waitFor(() => expect(region(page()).textContent).toContain('後端還沒有提供使用者狀態'))
    expect(region(page()).textContent).not.toContain('帳號正常')
  })
})

describe('every account in conversation users', () => {
  const rows = (page: HTMLElement) => within(table(page, '使用者')).getAllByRole('row').slice(1)

  it('lists accounts that never asked after the people who did', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('陳小華'))
    const names = rows(page()).map(r => r.textContent ?? '')
    const firstQuiet = names.findIndex(text => text.includes('還沒有對話'))
    expect(firstQuiet).toBeGreaterThan(0)
    expect(names.slice(0, firstQuiet).every(text => !text.includes('還沒有對話'))).toBe(true)
    expect(names.slice(firstQuiet).every(text => text.includes('還沒有對話'))).toBe(true)
    const quiet = within(table(page(), '使用者')).getByText('陳小華').closest('tr') as HTMLElement
    expect(quiet.textContent).toContain('一般使用者')
    expect(quiet.textContent).toContain('0 次')
    expect(quiet.textContent).toContain('帳號正常')
    expect(quiet.textContent).not.toContain('尚無資料')
  })

  it('opens an account that never asked', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('陳小華'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 陳小華 的對話' }))
    await waitFor(() => expect(table(page(), '陳小華 的對話').textContent).toContain('還沒有對話紀錄。'))
    const status = within(page()).getByRole('region', { name: '目前狀態' }).textContent
    expect(status).toContain('還沒有對話')
    expect(status).toContain('0／150 題')
    expect(status).not.toContain('最近一次在')
  })

  it('finds an account that never asked by email', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
    fireEvent.change(within(page()).getByLabelText('搜尋名稱或 email'), { target: { value: 'newcomer@' } })
    fireEvent.click(within(page()).getByRole('button', { name: '搜尋' }))
    await waitFor(() => expect(table(page(), '使用者').textContent).not.toContain('張俊隆'))
    expect(rows(page())).toHaveLength(1)
    expect(rows(page())[0].textContent).toContain('email 未驗證')
  })
})

describe('users list pages', () => {
  const account = (n: number): ConversationUser => ({
    userId: `u-${n}`, name: `帳號 ${String(n).padStart(2, '0')}`, email: `user${n}@example.test`, role: null, count: 0, lastAt: null,
    reservedUsd: 0, estimatedUsd: null,
    status: { account: 'active', joinedAt: '2026-11-01T00:00:00Z', lastSignInAt: null, todayRequests: 0,
      outcomes: { qa: 0, document: 0, insufficient: 0, incomplete: 0 }, activeRounds: [] },
  })
  const accounts = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => account(from + i))
  const names = (page: HTMLElement) => within(table(page, '使用者')).getAllByRole('row').slice(1).map(r => r.querySelector('strong')?.textContent)
  const pager = (page: HTMLElement) => within(page).getByRole('navigation', { name: '使用者列表分頁' })
  const status = (page: HTMLElement) => within(pager(page)).getByRole('status').textContent

  it('shows ten accounts a page with page numbers and the total', async () => {
    const { page } = openPage('conversations', 'owner', {}, api => {
      vi.spyOn(api, 'listConversationUsers').mockResolvedValue({ items: accounts(1, 26), nextCursor: null })
    })
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('帳號 01'))
    expect(names(page())).toEqual(accounts(1, 10).map(a => a.name))
    expect(status(page())).toBe('第 1／3 頁，共 26 位')
    expect((within(pager(page())).getByRole('button', { name: '上一頁' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(within(pager(page())).getByRole('button', { name: '下一頁' }))
    await waitFor(() => expect(names(page())).toEqual(accounts(11, 20).map(a => a.name)))
    expect(status(page())).toBe('第 2／3 頁，共 26 位')

    fireEvent.click(within(pager(page())).getByRole('button', { name: '第 3 頁' }))
    await waitFor(() => expect(names(page())).toEqual(accounts(21, 26).map(a => a.name)))
    expect(within(pager(page())).getByRole('button', { name: '第 3 頁' }).getAttribute('aria-current')).toBe('page')
    expect((within(pager(page())).getByRole('button', { name: '下一頁' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('fetches the next batch through the cursor only when the pages run out', async () => {
    let list!: MockInstance<FakeRagApi['listConversationUsers']>
    const { page } = openPage('conversations', 'owner', {}, api => {
      list = vi.spyOn(api, 'listConversationUsers')
        .mockResolvedValueOnce({ items: accounts(1, 50), nextCursor: 'c2' })
        .mockResolvedValueOnce({ items: accounts(51, 57), nextCursor: null })
    })
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('帳號 01'))
    expect(status(page())).toBe('第 1 頁，已載入 50 位，還有更多')
    fireEvent.click(within(pager(page())).getByRole('button', { name: '第 5 頁' }))
    await waitFor(() => expect(names(page())).toEqual(accounts(41, 50).map(a => a.name)))
    expect(list).toHaveBeenCalledTimes(1)

    fireEvent.click(within(pager(page())).getByRole('button', { name: '下一頁' }))
    await waitFor(() => expect(names(page())).toEqual(accounts(51, 57).map(a => a.name)))
    expect(list.mock.calls[1]).toEqual(['', 'c2'])
    expect(status(page())).toBe('第 6／6 頁，共 57 位')
  })

  it('goes back to the first page after a new search', async () => {
    const { page } = openPage('conversations', 'owner', {}, api => {
      vi.spyOn(api, 'listConversationUsers').mockResolvedValue({ items: accounts(1, 26), nextCursor: null })
    })
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('帳號 01'))
    fireEvent.click(within(pager(page())).getByRole('button', { name: '第 2 頁' }))
    await waitFor(() => expect(status(page())).toBe('第 2／3 頁，共 26 位'))
    fireEvent.change(within(page()).getByLabelText('搜尋名稱或 email'), { target: { value: 'user' } })
    fireEvent.click(within(page()).getByRole('button', { name: '搜尋' }))
    await waitFor(() => expect(status(page())).toBe('第 1／3 頁，共 26 位'))
  })

  it('keeps the page when coming back from a person', async () => {
    const { page } = openPage('conversations', 'owner', {}, api => {
      vi.spyOn(api, 'listConversationUsers').mockResolvedValue({ items: accounts(1, 26), nextCursor: null })
    })
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('帳號 01'))
    fireEvent.click(within(pager(page())).getByRole('button', { name: '第 2 頁' }))
    await waitFor(() => expect(names(page())[0]).toBe('帳號 11'))
    fireEvent.click(within(page()).getByRole('button', { name: '查看 帳號 12 的對話' }))
    fireEvent.click(await within(page()).findByRole('button', { name: '← 回到使用者列表' }))
    await waitFor(() => expect(names(page())[0]).toBe('帳號 11'))
    expect(status(page())).toBe('第 2／3 頁，共 26 位')
  })

  it('shows only the total when everyone fits on one page', async () => {
    const { page } = openPage('conversations')
    await waitFor(() => expect(table(page(), '使用者').textContent).toContain('張俊隆'))
    expect(status(page())).toBe('共 5 位')
    expect(within(pager(page())).queryByRole('button')).toBeNull()
  })
})

describe('page number window', () => {
  it('lists every page when there are few and keeps both ends and the neighbours when there are many', () => {
    expect(pageWindow(0, 5)).toEqual([0, 1, 2, 3, 4])
    expect(pageWindow(0, 20)).toEqual([0, 1, 'gap', 19])
    expect(pageWindow(2, 20)).toEqual([0, 1, 2, 3, 'gap', 19])
    expect(pageWindow(10, 20)).toEqual([0, 'gap', 9, 10, 11, 'gap', 19])
    expect(pageWindow(19, 20)).toEqual([0, 'gap', 18, 19])
  })
})
