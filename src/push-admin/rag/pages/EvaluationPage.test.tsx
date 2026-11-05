// @vitest-environment jsdom

import { fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EvaluationStep } from '../api/types'
import { createFakeRagApi } from '../api/fake'
import { NOW, dataset, openPage, openWith, setupPageTests } from './testing'

setupPageTests()

function chooseFile(page: HTMLElement, content: string, name = 'cases.json') {
  const file = new File([content], name, { type: 'application/json' })
  fireEvent.change(within(page).getByLabelText('題組檔案'), { target: { files: [file] } })
}
async function start(page: HTMLElement, datasetId: string, versionId: string) {
  await waitFor(() => expect(within(page).getByRole('option', { name: /驗收題組 v1/ })).toBeTruthy())
  fireEvent.change(within(page).getByLabelText('題組'), { target: { value: datasetId } })
  fireEvent.change(within(page).getByLabelText('知識版本'), { target: { value: versionId } })
  fireEvent.click(within(page).getByRole('button', { name: '開始評測' }))
}

describe('04 evaluation', () => {
  it('previews a JSON dataset and registers it', async () => {
    const { page } = openPage('evaluation')
    chooseFile(page(), JSON.stringify(dataset('development', 3)))
    await waitFor(() => expect(page().textContent).toContain('練習題組 v1 · 練習題組 · 3 題'))
    fireEvent.click(within(page()).getByRole('button', { name: '登記題組' }))
    await waitFor(() => expect(within(page()).getByRole('table', { name: '已登記的題組' }).textContent).toContain('練習題組 v1'))
  })

  it('refuses a file over 64 KB or one that is not JSON without sending it', async () => {
    const { api, page } = openPage('evaluation')
    const register = vi.spyOn(api, 'registerDataset')
    chooseFile(page(), 'x'.repeat(70_000))
    await waitFor(() => expect(page().textContent).toContain('題組檔案不能超過 64 KB。'))
    chooseFile(page(), '{ not json')
    await waitFor(() => expect(page().textContent).toContain('題組格式不正確'))
    expect(register).not.toHaveBeenCalled()
  })

  it('shows the backend reason when a dataset is rejected', async () => {
    const { page } = openPage('evaluation')
    chooseFile(page(), JSON.stringify(dataset('acceptance', 12)))
    await waitFor(() => expect(within(page()).getByRole('button', { name: '登記題組' })).toBeTruthy())
    fireEvent.click(within(page()).getByRole('button', { name: '登記題組' }))
    await waitFor(() => expect(page().textContent).toContain('題組格式不正確'))
  })

  it('runs every case and shows the report', async () => {
    const { page } = openPage('evaluation')
    await start(page(), 'ds-acceptance', 'v-2')
    await waitFor(() => expect(within(page()).getByRole('region', { name: '評測報告' }).textContent).toContain('40／40'))
    const report = within(page()).getByRole('region', { name: '評測報告' }).textContent
    expect(report).toContain('95%')
    expect(report).toContain('97%')
    expect(report).toContain('驗收')
  })

  it('pauses when the page is left and resumes from the next case', async () => {
    const { api, page, go } = openPage('evaluation')
    const original = api.nextEvaluation
    const seen: EvaluationStep[] = []
    const next = vi.spyOn(api, 'nextEvaluation').mockImplementation(async batchId => {
      const step = await original(batchId)
      seen.push(step)
      if (seen.length === 12) go('documents')
      return step
    })
    await start(page(), 'ds-acceptance', 'v-2')
    await waitFor(() => expect(next).toHaveBeenCalledTimes(12))
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(next).toHaveBeenCalledTimes(12)

    go('evaluation')
    await waitFor(() => expect(page().textContent).toContain('已完成 12／40 題'))
    fireEvent.click(within(page()).getByRole('button', { name: '接續' }))
    await waitFor(() => expect(within(page()).getByRole('region', { name: '評測報告' })).toBeTruthy())
    // 40 cases and one more call that reports completion, as in rag-v1.
    expect(next).toHaveBeenCalledTimes(41)
    expect(new Set(seen.filter(s => s.caseId).map(s => s.caseId)).size).toBe(40)
  })

  it('does not stay busy when the page was left while the evaluation was being created', async () => {
    const { api, page, go } = openPage('evaluation')
    const original = api.beginEvaluation
    let created: Promise<string> | undefined
    vi.spyOn(api, 'beginEvaluation').mockImplementation((...args) => { go('documents'); created = original(...args); return created })
    const next = vi.spyOn(api, 'nextEvaluation')
    await start(page(), 'ds-acceptance', 'v-2')
    await created
    await new Promise(resolve => setTimeout(resolve, 0))
    go('evaluation')
    await waitFor(() => expect((within(page()).getByRole('button', { name: '接續' }) as HTMLButtonElement).disabled).toBe(false))
    expect(next).not.toHaveBeenCalled()
    expect(page().textContent).toContain('已完成 0／40 題')
  })

  it('stops at a case that did not finish instead of moving on', async () => {
    const { api, page } = openPage('evaluation')
    const next = vi.spyOn(api, 'nextEvaluation').mockResolvedValue({ complete: false, caseId: 'case-7', state: 'uncertain' })
    await start(page(), 'ds-acceptance', 'v-2')
    await waitFor(() => expect(page().textContent).toContain('case-7'))
    expect(page().textContent).toContain('結果不確定')
    expect(next).toHaveBeenCalledTimes(1)
    expect(within(page()).getByRole('button', { name: '接續' })).toBeTruthy()
  })

  it('stops after one pass over the dataset if the backend never reports completion', async () => {
    const { api, page } = openPage('evaluation')
    const step: EvaluationStep = { complete: false, caseId: 'case', state: 'answered' }
    const next = vi.spyOn(api, 'nextEvaluation').mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(step), 0)))
    await start(page(), 'ds-acceptance', 'v-2')
    await waitFor(() => expect((within(page()).getByRole('button', { name: '接續' }) as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 })
    expect(next.mock.calls.length).toBeLessThanOrEqual(41)
    expect(page().textContent).toContain('系統還沒回報完成')
  })

  it('reuses the request key when starting again after a network failure', async () => {
    const { api, page } = openPage('evaluation')
    const begin = vi.spyOn(api, 'beginEvaluation').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await start(page(), 'ds-acceptance', 'v-2')
    await waitFor(() => expect(page().textContent).toContain('連不上伺服器'))
    fireEvent.click(within(page()).getByRole('button', { name: '開始評測' }))
    await waitFor(() => expect(begin).toHaveBeenCalledTimes(2))
    expect(begin.mock.calls[1][2]).toBe(begin.mock.calls[0][2])
  })

  it('is closed to editors, whose account cannot read datasets', () => {
    const { page } = openPage('evaluation', 'editor')
    expect(page().textContent).toContain('這一頁只有 owner 可以查看。')
    expect(within(page()).queryByRole('table', { name: '已登記的題組' })).toBeNull()
  })

  it('opens the report of a finished evaluation again from the list', async () => {
    const api = createFakeRagApi({ role: 'owner', now: () => NOW })
    const batch = await api.beginEvaluation('ds-acceptance', 'v-2', 'earlier')
    while (!(await api.nextEvaluation(batch)).complete) { /* run every case */ }
    await api.finishEvaluation(batch)
    const { page } = openWith(api, 'evaluation')
    const table = () => within(page()).getByRole('table', { name: '評測紀錄' })
    await waitFor(() => expect(table().textContent).toContain('已產生報告'))
    fireEvent.click(within(table()).getByRole('button', { name: '查看報告' }))
    await waitFor(() => expect(within(page()).getByRole('region', { name: '評測報告' }).textContent).toContain('40／40'))
  })

  it('does not ask for calculation cases', async () => {
    const { page } = openPage('evaluation')
    await waitFor(() => expect(within(page()).getByRole('table', { name: '已登記的題組' })).toBeTruthy())
    expect(page().textContent).not.toContain('計算')
  })
})
