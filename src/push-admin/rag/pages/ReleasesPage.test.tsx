// @vitest-environment jsdom

import { fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RagApi } from '../api/types'
import { openPage, setupPageTests } from './testing'

setupPageTests()

const table = (page: HTMLElement) => within(page).getByRole('table', { name: '版本列表' })
const row = (page: HTMLElement, name: string) => within(table(page)).getByText(name).closest('tr') as HTMLElement
async function openVersion(page: HTMLElement, name: string) {
  await waitFor(() => expect(table(page).textContent).toContain(name))
  fireEvent.click(within(page).getByRole('button', { name: `檢視 ${name}` }))
  const dialog = within(page).getByRole('dialog')
  // The dialog reads the version again before showing it.
  await waitFor(() => expect(within(dialog).getByRole('list', { name: '發布條件' })).toBeTruthy())
  return dialog
}
async function passAcceptance(api: RagApi, versionId: string) {
  await api.reviewVersion(versionId, 'approve', '內容已核對', true, 'review-key')
  const batch = await api.beginEvaluation('ds-acceptance', versionId, 'eval-key')
  while (!(await api.nextEvaluation(batch)).complete) { /* run every case */ }
  await api.finishEvaluation(batch)
}

describe('05 releases', () => {
  it('lists the frozen manual FAQ in version details after the draft was edited', async () => {
    const { api, page } = openPage('releases')
    const input = { question: '怎麼開始減碳？', answer: '版本原答案', sourceNote: '管理者提供', manualAnswer: true, enabled: true }
    await api.saveQa(input)
    await api.createVersion('人工問答版本', 'manual-version')
    const entry = (await api.listQa()).find(q => q.question === input.question)!
    await api.saveQa({ ...input, answer: '新的草稿答案' }, entry)
    // Reopen reads all versions including the one created outside this mounted list.
    const dialog = await openVersion(page(), '2026-11 候選版')
    fireEvent.click(within(dialog).getByRole('button', { name: '關閉' }))
    // The page refreshes through the create action; its new version captures the edited draft.
    fireEvent.change(within(page()).getByLabelText('版本名稱'), { target: { value: '畫面建立版本' } })
    fireEvent.click(within(page()).getByRole('button', { name: '建立版本' }))
    await waitFor(() => expect(table(page()).textContent).toContain('人工問答版本'))
    const frozen = await openVersion(page(), '人工問答版本')
    await waitFor(() => expect(within(frozen).getByRole('list', { name: '已收錄常見問答' }).textContent).toContain('版本原答案'))
    expect(frozen.textContent).toContain('管理者提供')
    expect(frozen.textContent).not.toContain('新的草稿答案')
  })
  it('lists versions with their review state and which one is in use', async () => {
    const { page } = openPage('releases')
    await waitFor(() => expect(table(page()).textContent).toContain('2026-11 候選版'))
    expect(row(page(), '2026-10 第一版').textContent).toContain('使用中')
    expect(row(page(), '2026-11 候選版').textContent).toContain('待審核')
  })

  it('disables publishing and lists what is missing', async () => {
    const { page } = openPage('releases')
    const dialog = await openVersion(page(), '2026-11 候選版')
    const checks = within(dialog).getByRole('list', { name: '發布條件' }).textContent
    expect(checks).toContain('還沒通過人工審核')
    expect(checks).toContain('還沒跑自動測驗')
    expect((within(dialog).getByRole('button', { name: '發布這個版本' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('asks for the confirmation box before sending a review', async () => {
    const { api, page } = openPage('releases')
    const review = vi.spyOn(api, 'reviewVersion')
    const dialog = await openVersion(page(), '2026-11 候選版')
    fireEvent.click(within(dialog).getByLabelText('核准'))
    fireEvent.change(within(dialog).getByLabelText('審核意見'), { target: { value: '文件與 QA 都核對過了' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '送出審核' }))
    await waitFor(() => expect(dialog.textContent).toContain('請先勾選「已核對版本內容和測驗結果」'))
    expect(review).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByLabelText('已核對版本內容和測驗結果'))
    fireEvent.click(within(dialog).getByRole('button', { name: '送出審核' }))
    await waitFor(() => expect(row(page(), '2026-11 候選版').textContent).toContain('已核准'))
    expect(review.mock.calls[0].slice(0, 4)).toEqual(['v-2', 'approve', '文件與 QA 都核對過了', true])
  })

  it('needs a written reason for a review', async () => {
    const { api, page } = openPage('releases')
    const review = vi.spyOn(api, 'reviewVersion')
    const dialog = await openVersion(page(), '2026-11 候選版')
    fireEvent.click(within(dialog).getByLabelText('退回'))
    fireEvent.click(within(dialog).getByLabelText('已核對版本內容和測驗結果'))
    fireEvent.click(within(dialog).getByRole('button', { name: '送出審核' }))
    await waitFor(() => expect(dialog.textContent).toContain('請寫審核意見'))
    expect(review).not.toHaveBeenCalled()
  })

  it('publishes once review and acceptance pass, then switches back to the earlier version', async () => {
    const { api, page } = openPage('releases')
    await passAcceptance(api, 'v-2')
    let dialog = await openVersion(page(), '2026-11 候選版')
    const publish = within(dialog).getByRole('button', { name: '發布這個版本' }) as HTMLButtonElement
    await waitFor(() => expect(publish.disabled).toBe(false))
    fireEvent.click(publish)
    await waitFor(() => expect(row(page(), '2026-11 候選版').textContent).toContain('使用中'))
    expect(row(page(), '2026-10 第一版').textContent).not.toContain('使用中')

    fireEvent.click(within(dialog).getByRole('button', { name: '關閉' }))
    dialog = await openVersion(page(), '2026-10 第一版')
    fireEvent.click(within(dialog).getByRole('button', { name: '改回這個版本' }))
    await waitFor(() => expect(row(page(), '2026-10 第一版').textContent).toContain('使用中'))
  })

  it('disables the version in use only after a second confirmation', async () => {
    const { api, page } = openPage('releases')
    const disable = vi.spyOn(api, 'disableVersion')
    const dialog = await openVersion(page(), '2026-10 第一版')
    fireEvent.click(within(dialog).getByRole('button', { name: '停用這個版本' }))
    expect(disable).not.toHaveBeenCalled()
    expect(dialog.textContent).toContain('停用後')
    fireEvent.click(within(dialog).getByRole('button', { name: '確定停用' }))
    await waitFor(() => expect(disable).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(row(page(), '2026-10 第一版').textContent).not.toContain('使用中'))
  })

  it('creates a version from the current content and reuses the key after a failure', async () => {
    const { api, page } = openPage('releases')
    const create = vi.spyOn(api, 'createVersion').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await waitFor(() => expect(table(page()).textContent).toContain('2026-11 候選版'))
    fireEvent.change(within(page()).getByLabelText('版本名稱'), { target: { value: '2026-12 冬季版' } })
    fireEvent.click(within(page()).getByRole('button', { name: '建立版本' }))
    await waitFor(() => expect(page().textContent).toContain('連不上伺服器'))
    fireEvent.click(within(page()).getByRole('button', { name: '建立版本' }))
    await waitFor(() => expect(table(page()).textContent).toContain('2026-12 冬季版'))
    expect(create.mock.calls[1][1]).toBe(create.mock.calls[0][1])
  })

  it('shows versions to an editor without any actions', async () => {
    const { page } = openPage('releases', 'editor')
    await waitFor(() => expect(table(page()).textContent).toContain('2026-11 候選版'))
    expect((within(page()).getByRole('button', { name: '建立版本' }) as HTMLButtonElement).disabled).toBe(true)
    expect(page().textContent).toContain('只有管理者可以建立、審核和發布版本')
    const dialog = await openVersion(page(), '2026-11 候選版')
    expect(within(dialog).queryByRole('button', { name: '送出審核' })).toBeNull()
    expect((within(dialog).getByRole('button', { name: '發布這個版本' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
