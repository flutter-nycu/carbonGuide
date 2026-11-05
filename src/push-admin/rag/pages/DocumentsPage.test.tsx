// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createFakeRagApi } from '../api/fake'
import type { Role } from '../api/types'
import Workspace from '../Workspace'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) }
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const NOW = new Date('2026-11-05T08:00:00Z')
function open(role: Role = 'owner', api = createFakeRagApi({ role, now: () => NOW })) {
  const view = render(<Workspace api={api} role={role} />)
  const page = () => view.container.querySelector('[data-page="documents"]') as HTMLElement
  return { api, view, page }
}
const rows = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>("tbody tr")]

describe('01 knowledge base', () => {
  it('lists documents with plain status labels, reasons and totals', async () => {
    const { page } = open()
    await waitFor(() => expect(rows(page())).toHaveLength(6))
    const text = page().textContent!
    for (const label of ['完成', '處理中', '待處理', '失敗', '預算不足暫停']) expect(text).toContain(label)
    expect(text).toContain('讀不出這個檔案的內容')
    expect(text).toContain('AI 預算不足，等補上預算後會自動接續。')
    expect(within(page()).getByText('文件總數').parentElement!.textContent).toContain('6')
  })

  it('filters by name, purpose and domain', async () => {
    const { page } = open()
    await waitFor(() => expect(rows(page())).toHaveLength(6))
    fireEvent.change(within(page()).getByLabelText('搜尋文件'), { target: { value: '綠生活' } })
    expect(rows(page())).toHaveLength(1)
    fireEvent.change(within(page()).getByLabelText('搜尋文件'), { target: { value: '' } })
    fireEvent.change(within(page()).getByLabelText('資料用途'), { target: { value: '研究資料' } })
    expect(rows(page()).every(r => r.textContent!.includes('研究資料'))).toBe(true)
    fireEvent.change(within(page()).getByLabelText('生活領域'), { target: { value: '飲食' } })
    expect(page().textContent).toContain('沒有符合條件的文件')
  })

  it('shows chunks and lets an editor exclude one with a reason', async () => {
    const { page, view } = open('editor')
    await waitFor(() => expect(rows(page())).toHaveLength(6))
    const row = rows(page()).find(r => r.textContent!.includes('綠生活指引.pdf'))!
    fireEvent.click(within(row).getByRole('button', { name: '檢視 綠生活指引.pdf' }))
    const dialog = view.container.querySelector('dialog') as HTMLElement
    await waitFor(() => expect(dialog.textContent).toContain('第 1 段'))
    expect(dialog.textContent).toContain('第 3 頁')
    fireEvent.click(within(dialog).getAllByRole('button', { name: '排除這一段' })[0])
    fireEvent.change(within(dialog).getByLabelText('排除原因'), { target: { value: '內容過期' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '確認排除' }))
    await waitFor(() => expect(within(dialog).getByRole('region', { name: '已排除的段落' }).textContent).toContain('先看看家裡怎麼用電'))
    expect(view.container.querySelector('#toast')!.textContent).toContain('已排除第 1 段')
    // The kept passages are numbered again, like the backend does.
    expect(dialog.textContent).toContain('第 1 段 · 第 3 頁 · 第一章 家庭用電示範數字')
  })

  it('refuses a correction when someone changed the document after it was opened', async () => {
    const { api, page, view } = open('editor')
    await waitFor(() => expect(rows(page())).toHaveLength(6))
    fireEvent.click(within(page()).getByRole('button', { name: '檢視 綠生活指引.pdf' }))
    const dialog = view.container.querySelector('dialog') as HTMLElement
    await waitFor(() => expect(dialog.textContent).toContain('第 1 段'))
    await api.reviseChunks('d-green', [{ ordinal: 3, exclude: true }], '別人先改了', (await api.getDocument('d-green')).basis)
    fireEvent.click(within(dialog).getAllByRole('button', { name: '排除這一段' })[0])
    fireEvent.change(within(dialog).getByLabelText('排除原因'), { target: { value: '內容過期' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '確認排除' }))
    await waitFor(() => expect(dialog.textContent).toContain('這份文件的段落剛被別人改過'))
    await waitFor(() => expect(within(dialog).getByRole('region', { name: '已排除的段落' }).textContent).toContain('冷氣設定在 26 到 28 度'))
  })

  it('counts the title and section toward the size limit of a corrected passage', async () => {
    const { api, page, view } = open('editor')
    const revise = vi.spyOn(api, 'reviseChunks')
    await waitFor(() => expect(rows(page())).toHaveLength(6))
    fireEvent.click(within(page()).getByRole('button', { name: '檢視 綠生活指引.pdf' }))
    const dialog = view.container.querySelector('dialog') as HTMLElement
    await waitFor(() => expect(dialog.textContent).toContain('第 1 段'))
    fireEvent.click(within(dialog).getAllByRole('button', { name: '修改文字' })[0])
    fireEvent.change(within(dialog).getByLabelText('段落內容'), { target: { value: '字'.repeat(590) } })
    fireEvent.change(within(dialog).getByLabelText('修改原因'), { target: { value: '補充' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存修改' }))
    await waitFor(() => expect(dialog.textContent).toContain('修改後的段落太長'))
    expect(revise).not.toHaveBeenCalled()
  })

  it('does not offer edits to viewers', async () => {
    const { page, view } = open('viewer')
    await waitFor(() => expect(rows(page())).toHaveLength(6))
    fireEvent.click(within(rows(page())[0]).getAllByRole('button')[0])
    const dialog = view.container.querySelector('dialog') as HTMLElement
    await waitFor(() => expect(dialog.textContent).toContain('唯讀權限'))
    expect(within(dialog).queryByRole('button', { name: '排除這一段' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: '儲存分類' })).toBeNull()
  })

  it('saves a new purpose and shows it in the list', async () => {
    const { page, view } = open('editor')
    await waitFor(() => expect(rows(page())).toHaveLength(6))
    const row = rows(page()).find(r => r.textContent!.includes('綠生活指引.pdf'))!
    fireEvent.click(within(row).getByRole('button', { name: '檢視 綠生活指引.pdf' }))
    const dialog = view.container.querySelector('dialog') as HTMLElement
    await waitFor(() => expect(within(dialog).getByLabelText('資料用途')).toBeTruthy())
    fireEvent.change(within(dialog).getByLabelText('資料用途'), { target: { value: '政策文件' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '儲存分類' }))
    await waitFor(() => expect(rows(page()).find(r => r.textContent!.includes('綠生活指引.pdf'))!.textContent).toContain('政策文件'))
  })

  it('offers a retry when loading fails', async () => {
    const api = createFakeRagApi({ role: 'owner', now: () => NOW })
    const list = vi.spyOn(api, 'listDocuments').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { page } = open('owner', api)
    await waitFor(() => expect(page().textContent).toContain('連不上伺服器'))
    fireEvent.click(within(page()).getByRole('button', { name: '重新讀取' }))
    await waitFor(() => expect(rows(page())).toHaveLength(6))
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('opens the import page from the header button', async () => {
    const { page, view } = open('editor')
    fireEvent.click(within(page()).getByRole('button', { name: '＋ 匯入來源' }))
    expect((view.container.querySelector('[data-page="import"]') as HTMLElement).hidden).toBe(false)
  })

  it('refreshes every 15 seconds while something is still processing and the page is visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const api = createFakeRagApi({ role: 'owner', now: () => NOW })
    const list = vi.spyOn(api, 'listDocuments')
    const { view } = open('owner', api)
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    await act(async () => { vi.advanceTimersByTime(15_000) })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    fireEvent.change(view.getByLabelText('切換管理功能'), { target: { value: 'settings' } })
    await act(async () => { vi.advanceTimersByTime(45_000) })
    expect(list).toHaveBeenCalledTimes(2)
  })
})
