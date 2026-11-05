// @vitest-environment jsdom
// Checks that span all eleven RAG pages. Each page's own behaviour is tested next to it in src/push-admin/rag/pages.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createFakeRagApi } from '../src/push-admin/rag/api/fake'
import { clearRequestKeys } from '../src/push-admin/rag/api/requestKeys'
import type { Role } from '../src/push-admin/rag/api/types'
import { PAGES, type PageId } from '../src/push-admin/rag/pageList'
import Workspace from '../src/push-admin/rag/Workspace'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) }
})
afterEach(() => { cleanup(); clearRequestKeys() })

const RAG = resolve('src/push-admin/rag')
const NOW = new Date('2026-11-05T08:00:00Z')

function open(role: Role) {
  const api = createFakeRagApi({ role, now: () => NOW })
  const view = render(<Workspace api={api} role={role} />)
  const page = (id: PageId) => view.container.querySelector(`[data-page="${id}"]`) as HTMLElement
  async function visit(id: PageId) {
    fireEvent.change(view.getByLabelText('切換管理功能'), { target: { value: id } })
    // Every page shows a table, a list, a form or a notice once its data has arrived.
    await waitFor(() => expect(page(id).querySelector('[role="status"].empty')).toBeNull())
    return page(id)
  }
  return { api, view, page, visit }
}

describe('RAG workspace', () => {
  it('shows eleven pages in order, with nothing about coefficients or service connections', () => {
    const { view } = open('owner')
    const nav = within(view.getByRole('navigation', { name: 'RAG 工作台頁面' }))
    expect(nav.getAllByRole('button').map(b => b.textContent)).toEqual([
      '01知識庫與文件', '02匯入與預檢', '03檢索試問台', '04RAG 評測', '05知識版本', '06人格設定',
      '07System Prompt', '08基本通用 QA', '09進階檢索設定', '10互動紀錄', '11對話使用者',
    ])
    expect([...(view.getByLabelText('切換管理功能') as HTMLSelectElement).options].map(o => o.value)).toEqual(PAGES.map(p => p.id))
  })

  it('has a subtitle and no onboarding or explanation blocks on any page', async () => {
    const { visit } = open('owner')
    for (const { id } of PAGES) {
      const page = await visit(id)
      expect(page.querySelector('.subtitle')?.textContent?.trim()).not.toBe('')
      expect(page.querySelector('details[data-help], .page-help, .quick-start, .guide-side')).toBeNull()
      for (const text of ['第一次使用', '操作說明', '使用說明', '怎麼判斷有沒有變好', '假資料', '示範']) expect(page.textContent).not.toContain(text)
    }
  })

  it('never shows the calculation flow, bill import or service settings', async () => {
    const { visit } = open('owner')
    const seen: string[] = []
    for (const { id } of PAGES) seen.push((await visit(id)).textContent ?? '')

    const playground = await visit('playground')
    fireEvent.change(within(playground).getByLabelText('問題'), { target: { value: '每月少用 20 度電，少多少碳排？' } })
    fireEvent.click(within(playground).getByRole('button', { name: '試問' }))
    await waitFor(() => expect(playground.textContent).toContain('文件回答'))
    seen.push(playground.textContent ?? '')

    const logs = await visit('logs')
    fireEvent.click(within(logs).getAllByRole('button', { name: /^檢視/ })[0])
    await waitFor(() => expect(within(logs).getByRole('dialog').textContent).toContain('處理流程'))
    seen.push(within(logs).getByRole('dialog').textContent ?? '')

    const all = seen.join(' ')
    for (const word of ['計算', '排放係數', '係數與費率', '帳單匯入', '匯入帳單', '服務連線', '向量維度', 'Rerank', '重新排序']) expect(all).not.toContain(word)
    expect(within(await visit('import')).getByLabelText('選擇檔案').getAttribute('accept')).toBe('.pdf,.docx,.txt')
  })

  it('shows text from the knowledge base as text, never as markup', async () => {
    const { api, visit } = open('owner')
    await api.savePersona({ name: '<img src=x onerror=alert(1)>', example: '<b>粗體</b>', instruction: '<script>alert(1)</script>', enabled: true })
    const page = await visit('personas')
    await waitFor(() => expect(page.textContent).toContain('<img src=x onerror=alert(1)>'))
    expect(page.querySelector('img, b, script')).toBeNull()
  })

  it('leaves a viewer with nothing that writes', async () => {
    const { visit } = open('viewer')
    const writes = /^(＋ 匯入來源|上傳|登記網址|試問|停止這一輪|登記題組|開始評測|接續|建立知識版本|＋ 新增人格|＋ 新增 QA|儲存|另存成新版本|儲存設定)$/
    for (const { id, readers } of PAGES) {
      const page = await visit(id)
      if (readers) { expect(page.textContent).toMatch(/這一頁只有 owner (和編輯者)?可以查看。/); continue }
      const enabled = within(page).queryAllByRole('button').filter(b => writes.test(b.textContent ?? '') && !(b as HTMLButtonElement).disabled)
      expect(enabled.map(b => b.textContent)).toEqual([])
      const fields = [...page.querySelectorAll('input:not([type="search"]), textarea')] as (HTMLInputElement | HTMLTextAreaElement)[]
      for (const field of fields.filter(f => f.closest('form, .panel') && !f.closest('.toolbar'))) expect(field.disabled || field.readOnly).toBe(true)
    }
  })

  it('no longer ships the static demo, and keeps nothing in browser storage', () => {
    for (const name of ['app.js', 'app.d.ts', 'index.html']) expect(existsSync(join(RAG, name))).toBe(false)
    const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? sources(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : [])
    for (const file of sources(RAG)) expect(readFileSync(file, 'utf8'), file).not.toMatch(/\b(localStorage|sessionStorage|innerHTML|dangerouslySetInnerHTML)\b/)
  })

  it('pads dialog content through a valid selector', () => {
    const css = readFileSync(join(RAG, 'styles.css'), 'utf8')
    expect(css).not.toContain('#dialog-.rag-body')
    expect(css).toMatch(/\.dialog-body\{padding:24px/)
  })
})
