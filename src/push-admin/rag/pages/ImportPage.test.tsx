// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createFakeRagApi } from '../api/fake'
import { clearRequestKeys } from '../api/requestKeys'
import type { Role } from '../api/types'
import Workspace from '../Workspace'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) }
})
afterEach(() => { cleanup(); clearRequestKeys() })

const NOW = new Date('2026-11-05T08:00:00Z')
function open(role: Role = 'editor') {
  const api = createFakeRagApi({ role, now: () => NOW })
  const view = render(<Workspace api={api} role={role} />)
  fireEvent.change(view.getByLabelText('切換管理功能'), { target: { value: 'import' } })
  const page = () => view.container.querySelector('[data-page="import"]') as HTMLElement
  return { api, view, page }
}
const file = (name: string, size = 64) => new File([new Uint8Array(size)], name)
function choose(page: HTMLElement, files: File[]) {
  const input = within(page).getByLabelText('選擇檔案') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  fireEvent.change(input)
}

describe('02 import', () => {
  it('only offers PDF, DOCX and TXT in the file picker', () => {
    const { page } = open()
    expect(within(page()).getByLabelText('選擇檔案').getAttribute('accept')).toBe('.pdf,.docx,.txt')
    expect(page().textContent).not.toMatch(/示範批次|JSON/)
  })

  it('uploads several files one by one and reports each result', async () => {
    const { api, page } = open()
    const upload = vi.spyOn(api, 'uploadFile')
    choose(page(), [file('甲.pdf'), file('乙.docx'), file('係數.json')])
    await waitFor(() => expect(page().textContent).toMatch(/乙\.docx\s*上傳完成/))
    const results = page().querySelector('[aria-label="上傳結果"]')!.textContent!
    expect(results).toMatch(/甲\.pdf\s*上傳完成/)
    expect(results).toMatch(/係數\.json\s*只收 PDF、DOCX、TXT 檔案。/)
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload.mock.calls.map(([f]) => f.name)).toEqual(['甲.pdf', '乙.docx'])
    expect((await api.listDocuments()).map(d => d.title)).toEqual(expect.arrayContaining(['甲.pdf', '乙.docx']))
  })

  it('says when a file is already in the knowledge base', async () => {
    const { page } = open()
    choose(page(), [file('甲.pdf')])
    await waitFor(() => expect(page().textContent).toMatch(/甲\.pdf\s*上傳完成/))
    choose(page(), [file('甲.pdf')])
    await waitFor(() => expect(page().textContent).toContain('這個檔案已經在知識庫裡'))
  })

  it('checks addresses before registering and lists their status', async () => {
    const { api, page } = open()
    const register = vi.spyOn(api, 'registerUrl')
    const input = within(page()).getByLabelText('PDF 網址')
    fireEvent.change(input, { target: { value: 'http://example.org/a.pdf' } })
    fireEvent.click(within(page()).getByRole('button', { name: '登記網址' }))
    expect(page().textContent).toContain('請輸入 https 開頭')
    expect(register).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'https://example.org/report.pdf' } })
    fireEvent.click(within(page()).getByRole('button', { name: '登記網址' }))
    await waitFor(() => expect(page().textContent).toContain('已登記，系統會自動下載'))
    const list = page().querySelector('[aria-label="已登記的網址"]')!.textContent!
    expect(list).toContain('https://example.org/report.pdf')
    expect(list).toContain('待處理')
    expect(list).toContain('這個網址下載到的不是 PDF。')
  })

  it('keeps viewers to reading only', () => {
    const { page } = open('viewer')
    expect((within(page()).getByLabelText('選擇檔案') as HTMLInputElement).disabled).toBe(true)
    expect((within(page()).getByRole('button', { name: '登記網址' }) as HTMLButtonElement).disabled).toBe(true)
    expect(page().textContent).toContain('唯讀權限不能上傳')
  })
})
