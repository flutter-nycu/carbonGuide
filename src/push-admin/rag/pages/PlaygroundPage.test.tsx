// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createFakeRagApi, type FakeOptions } from '../api/fake'
import { clearRequestKeys } from '../api/requestKeys'
import type { Role } from '../api/types'
import Workspace from '../Workspace'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) }
})
afterEach(() => { cleanup(); clearRequestKeys() })

const NOW = new Date('2026-11-05T08:00:00Z')
function open(role: Role = 'owner', options: FakeOptions = {}) {
  const api = createFakeRagApi({ role, now: () => NOW, ...options })
  const view = render(<Workspace api={api} role={role} />)
  fireEvent.change(view.getByLabelText('切換管理功能'), { target: { value: 'playground' } })
  const page = () => view.container.querySelector('[data-page="playground"]') as HTMLElement
  return { api, view, page }
}
async function ask(page: HTMLElement, question: string) {
  await waitFor(() => expect(within(page).getByLabelText('知識版本')).toBeTruthy())
  fireEvent.change(within(page).getByLabelText('問題'), { target: { value: question } })
  fireEvent.click(within(page).getByRole('button', { name: '試問' }))
}

describe('03 playground', () => {
  it('asks the active version and shows the answer with citations and the round', async () => {
    const { page } = open()
    await waitFor(() => expect(page().textContent).toContain('第一次試問時會自動開一輪'))
    expect((within(page()).getByLabelText('知識版本') as HTMLSelectElement).selectedOptions[0].textContent).toContain('2026-10 第一版')
    await ask(page(), '每月少用 20 度電，少多少碳排？')
    await waitFor(() => expect(page().textContent).toContain('文件回答'))
    expect(page().textContent).toContain('綠生活指引.pdf')
    expect(page().textContent).toContain('這一輪還可以問 19 題')
  })

  it('reuses the request key when the same question is sent again after a failure', async () => {
    const { api, page } = open()
    const spy = vi.spyOn(api, 'ask').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await ask(page(), '如何減少食物浪費？')
    await waitFor(() => expect(page().textContent).toContain('連不上伺服器'))
    fireEvent.click(within(page()).getByRole('button', { name: '試問' }))
    await waitFor(() => expect(page().textContent).toContain('QA 回答'))
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls[1][2]).toBe(spy.mock.calls[0][2])
  })

  it('keeps the request key while the first try is still running on the server', async () => {
    const { api, page } = open()
    const original = api.ask
    const asked = vi.spyOn(api, 'ask').mockImplementationOnce(async (...args) => ({ ...(await original(...args)), state: 'running', kind: 'incomplete', answer: null }))
    await ask(page(), '如何減少食物浪費？')
    await waitFor(() => expect(page().textContent).toContain('還在處理中'))
    fireEvent.click(within(page()).getByRole('button', { name: '試問' }))
    await waitFor(() => expect(page().textContent).toContain('QA 回答'))
    expect(asked.mock.calls[1][2]).toBe(asked.mock.calls[0][2])
  })

  it('locks the version while a question is on its way', async () => {
    const { api, page } = open()
    let finish: () => void = () => undefined
    const original = api.ask
    vi.spyOn(api, 'ask').mockImplementationOnce((...args) => new Promise(resolve => { finish = () => resolve(original(...args)) }))
    await ask(page(), '如何減少食物浪費？')
    await waitFor(() => expect((within(page()).getByLabelText('知識版本') as HTMLSelectElement).disabled).toBe(true))
    finish()
    await waitFor(() => expect((within(page()).getByLabelText('知識版本') as HTMLSelectElement).disabled).toBe(false))
  })

  it('opens a new round when the current one is used up', async () => {
    const { api, page } = open()
    const round = await api.createRound('v-1', 'earlier-round')
    for (let i = 0; i < round.requestLimit; i++) await api.ask(round.id, '如何減少食物浪費？', `earlier-${i}`)
    const create = vi.spyOn(api, 'createRound')
    await ask(page(), '如何減少食物浪費？')
    await waitFor(() => expect(page().textContent).toContain('QA 回答'))
    expect(create).toHaveBeenCalledTimes(1)
    expect(page().textContent).toContain('這一輪還可以問 19 題')
  })

  it('has no persona option', async () => {
    const { page } = open()
    await waitFor(() => expect(within(page()).getByLabelText('知識版本')).toBeTruthy())
    expect(page().textContent).not.toContain('人格')
  })

  it('is closed to editors, whose account cannot read the AI budget', async () => {
    const { api, page } = open('editor')
    const versions = vi.spyOn(api, 'listVersions')
    expect(page().textContent).toContain('這一頁只有 owner 可以查看。')
    expect(versions).not.toHaveBeenCalled()
  })

  it('explains when the AI budget is used up', async () => {
    const { page } = open('owner', { budgetUsd: 3.66 })
    await ask(page(), '如何減少食物浪費？')
    await waitFor(() => expect(page().textContent).toContain('這期的 AI 預算已經用完，暫時不能試問。'))
  })

  it('stops the current round on request', async () => {
    const { api, page } = open()
    await ask(page(), '如何減少食物浪費？')
    await waitFor(() => expect(page().textContent).toContain('QA 回答'))
    const stop = vi.spyOn(api, 'stopRound')
    fireEvent.click(within(page()).getByRole('button', { name: '停止這一輪' }))
    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(page().textContent).toContain('第一次試問時會自動開一輪'))
  })
})
