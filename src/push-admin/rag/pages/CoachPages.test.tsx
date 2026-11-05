// @vitest-environment jsdom

import { fireEvent, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RagError } from '../api/errors'
import { openPage, setupPageTests } from './testing'

setupPageTests()

const field = (scope: HTMLElement, label: string) => within(scope).getByLabelText(label) as HTMLInputElement
const type = (scope: HTMLElement, label: string, value: string) => fireEvent.change(field(scope, label), { target: { value } })
const click = (scope: HTMLElement, name: string | RegExp) => fireEvent.click(within(scope).getByRole('button', { name }))

describe('06 personas', () => {
  it('shows each persona with its example and instruction', async () => {
    const { page } = openPage('personas', 'viewer')
    await waitFor(() => expect(page().textContent).toContain('理性型'))
    expect(page().textContent).toContain('先比較碳排、時間和花費')
    expect(page().textContent).toContain('先回應使用者的心情')
    expect(within(page()).queryByRole('button', { name: '＋ 新增人格' })).toBeNull()
    expect((within(page()).getByRole('switch', { name: '理性型啟用狀態' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('adds a persona', async () => {
    const { page } = openPage('personas', 'editor')
    await waitFor(() => expect(page().textContent).toContain('理性型'))
    click(page(), '＋ 新增人格')
    const dialog = within(page()).getByRole('dialog')
    type(dialog, '名稱', '鼓勵型')
    type(dialog, '語氣範例', '你已經做得很好了，再多一步就好。')
    type(dialog, '回答方式', '先肯定使用者做到的事，再提下一步。')
    click(dialog, '儲存')
    await waitFor(() => expect(page().textContent).toContain('鼓勵型'))
  })

  it('keeps at least one persona enabled without sending the change', async () => {
    const { api, page } = openPage('personas', 'editor')
    await waitFor(() => expect(page().textContent).toContain('理性型'))
    fireEvent.click(within(page()).getByRole('switch', { name: '理性型啟用狀態' }))
    await waitFor(() => expect(within(page()).getByRole('switch', { name: '理性型啟用狀態' }).getAttribute('aria-checked')).toBe('false'))
    const save = vi.spyOn(api, 'savePersona')
    fireEvent.click(within(page()).getByRole('switch', { name: '共感型啟用狀態' }))
    await waitFor(() => expect(page().textContent).toContain('至少要保留一個啟用中的人格'))
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps the typed text when someone else changed the persona', async () => {
    const { api, page } = openPage('personas', 'editor')
    vi.spyOn(api, 'savePersona').mockRejectedValueOnce(new RagError('draft_changed'))
    await waitFor(() => expect(page().textContent).toContain('理性型'))
    click(page(), '編輯 理性型')
    const dialog = within(page()).getByRole('dialog')
    type(dialog, '回答方式', '新的回答方式')
    click(dialog, '儲存')
    await waitFor(() => expect(dialog.textContent).toContain('這筆內容剛被別人改過'))
    expect(field(dialog, '回答方式').value).toBe('新的回答方式')
  })
})

describe('07 system prompt', () => {
  it('saves the latest draft and keeps a version history', async () => {
    const { api, page } = openPage('prompt', 'editor')
    const save = vi.spyOn(api, 'savePrompt')
    await waitFor(() => expect(field(page(), '提示詞內容').value).toContain('用繁體中文回答'))
    type(page(), '提示詞內容', '用繁體中文回答，語氣親切。')
    click(page(), '儲存')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][1]?.id).toBe('pr-1')
    await waitFor(() => expect(page().textContent).toContain('已儲存'))

    type(page(), '版本名稱', '第二版')
    type(page(), '提示詞內容', '第二版的規則')
    click(page(), '另存成新版本')
    await waitFor(() => expect(within(page()).getByRole('list', { name: '歷次版本' }).textContent).toContain('第二版'))
    expect(save.mock.calls[1][1]).toBeUndefined()
    expect(within(page()).getByRole('list', { name: '歷次版本' }).textContent).toContain('第一版')
    expect(page().textContent).toContain('下次建立知識版本')
  })

  it('is read-only for a viewer', async () => {
    const { page } = openPage('prompt', 'viewer')
    await waitFor(() => expect(field(page(), '提示詞內容').value).toContain('用繁體中文回答'))
    expect(field(page(), '提示詞內容').readOnly).toBe(true)
    expect(within(page()).queryByRole('button', { name: '儲存' })).toBeNull()
  })
})

describe('08 QA', () => {
  it('adds, edits and disables a QA', async () => {
    const { page } = openPage('qa', 'editor')
    await waitFor(() => expect(page().textContent).toContain('如何減少食物浪費？'))
    click(page(), '＋ 新增 QA')
    let dialog = within(page()).getByRole('dialog')
    type(dialog, '問題', '冷氣開幾度比較省電？')
    type(dialog, '答案', '設定在 26 到 28 度，搭配電扇。')
    type(dialog, '來源說明', '綠生活指引')
    click(dialog, '儲存')
    await waitFor(() => expect(page().textContent).toContain('冷氣開幾度比較省電？'))

    click(page(), '編輯 如何減少食物浪費？')
    dialog = within(page()).getByRole('dialog')
    fireEvent.click(within(dialog).getByLabelText('啟用'))
    click(dialog, '儲存')
    await waitFor(() => expect(within(page()).getByText('如何減少食物浪費？').closest('article')?.textContent).toContain('已停用'))
  })

  it('adds a citation from a document passage and limits citations to five', async () => {
    const { api, page } = openPage('qa', 'editor')
    const save = vi.spyOn(api, 'saveQaCitations')
    await waitFor(() => expect(page().textContent).toContain('如何減少食物浪費？'))
    click(page(), '編輯 如何減少食物浪費？')
    const dialog = within(page()).getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '綠生活指引.pdf' })).toBeTruthy())
    fireEvent.change(field(dialog, '來源文件'), { target: { value: 'd-green' } })
    await waitFor(() => expect(within(dialog).getByRole('option', { name: /第 3 段/ })).toBeTruthy())
    fireEvent.change(field(dialog, '段落'), { target: { value: 'c-green-3' } })
    expect(field(dialog, '引用原文').value).toContain('冷氣設定在 26 到 28 度')
    type(dialog, '引用原文', '冷氣設定在 26 到 28 度')
    click(dialog, '加入引用')
    click(dialog, '儲存引用')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][2]).toEqual([
      { chunkId: 'c-food-2', quote: '剩菜收好，快到期的食材先用，可以減少食物浪費。' },
      { chunkId: 'c-green-3', quote: '冷氣設定在 26 到 28 度' },
    ])
    await waitFor(() => expect(page().textContent).toContain('2 筆引用'))

    for (const chunkId of ['c-green-1', 'c-green-2']) {
      fireEvent.change(field(dialog, '段落'), { target: { value: chunkId } })
      click(dialog, '加入引用')
    }
    fireEvent.change(field(dialog, '來源文件'), { target: { value: 'd-food' } })
    await waitFor(() => expect(within(dialog).getByRole('option', { name: /買菜之前/ })).toBeTruthy())
    fireEvent.change(field(dialog, '段落'), { target: { value: 'c-food-1' } })
    click(dialog, '加入引用')
    expect(within(dialog).getByRole('list', { name: '這筆 QA 的引用' }).children).toHaveLength(5)
    expect((within(dialog).getByRole('button', { name: '加入引用' }) as HTMLButtonElement).disabled).toBe(true)
    expect(dialog.textContent).toContain('最多 5 筆')
  })

  it('checks the length of a quote before adding it', async () => {
    const { page } = openPage('qa', 'editor')
    await waitFor(() => expect(page().textContent).toContain('如何減少食物浪費？'))
    click(page(), '編輯 如何減少食物浪費？')
    const dialog = within(page()).getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '綠生活指引.pdf' })).toBeTruthy())
    fireEvent.change(field(dialog, '來源文件'), { target: { value: 'd-green' } })
    await waitFor(() => expect(within(dialog).getByRole('option', { name: /第 3 段/ })).toBeTruthy())
    fireEvent.change(field(dialog, '段落'), { target: { value: 'c-green-3' } })
    type(dialog, '引用原文', '冷氣')
    click(dialog, '加入引用')
    expect(dialog.textContent).toContain('引用原文要 5 到 800 個字')
    type(dialog, '引用原文', '冷'.repeat(801))
    click(dialog, '加入引用')
    expect(dialog.textContent).toContain('引用原文要 5 到 800 個字')
    expect(within(dialog).getByRole('list', { name: '這筆 QA 的引用' }).children).toHaveLength(1)
  })

  it('shows when a quote does not match the passage', async () => {
    const { page } = openPage('qa', 'editor')
    await waitFor(() => expect(page().textContent).toContain('如何減少食物浪費？'))
    click(page(), '編輯 如何減少食物浪費？')
    const dialog = within(page()).getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('option', { name: '綠生活指引.pdf' })).toBeTruthy())
    fireEvent.change(field(dialog, '來源文件'), { target: { value: 'd-green' } })
    await waitFor(() => expect(within(dialog).getByRole('option', { name: /第 3 段/ })).toBeTruthy())
    fireEvent.change(field(dialog, '段落'), { target: { value: 'c-green-3' } })
    type(dialog, '引用原文', '原文裡沒有的句子')
    click(dialog, '加入引用')
    click(dialog, '儲存引用')
    await waitFor(() => expect(dialog.textContent).toContain('引用的文字和原文對不上'))
  })
})

describe('09 retrieval settings', () => {
  it('checks the numbers before saving', async () => {
    const { api, page } = openPage('settings')
    const save = vi.spyOn(api, 'saveSettings')
    await waitFor(() => expect(field(page(), '先找幾筆資料').value).toBe('20'))
    expect(field(page(), '回答時參考幾段').value).toBe('6')
    type(page(), '先找幾筆資料', '5')
    click(page(), '儲存設定')
    await waitFor(() => expect(page().textContent).toContain('回答時參考的段數，不能比先找的資料筆數多。'))
    type(page(), '先找幾筆資料', '20')
    type(page(), '回答時參考幾段', '13')
    click(page(), '儲存設定')
    await waitFor(() => expect(page().textContent).toContain('回答時參考的段數要是 1 到 12 的整數。'))
    expect(save).not.toHaveBeenCalled()
    expect(page().textContent).not.toContain('Rerank')
  })

  it('saves and says the change applies to the next version', async () => {
    const { api, page } = openPage('settings')
    const save = vi.spyOn(api, 'saveSettings')
    await waitFor(() => expect(field(page(), '先找幾筆資料').value).toBe('20'))
    type(page(), '回答時參考幾段', '8')
    click(page(), '儲存設定')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][0]).toEqual({ candidates: 20, contextChunks: 8 })
    await waitFor(() => expect(page().textContent).toContain('設定已儲存，下次建立知識版本時才會生效。'))
  })

  it('lets only the owner change the settings', async () => {
    const { page } = openPage('settings', 'editor')
    await waitFor(() => expect(field(page(), '先找幾筆資料').value).toBe('20'))
    expect(field(page(), '先找幾筆資料').disabled).toBe(true)
    expect((within(page()).getByRole('button', { name: '儲存設定' }) as HTMLButtonElement).disabled).toBe(true)
    expect(page().textContent).toContain('只有 owner 可以修改檢索設定')
  })
})
