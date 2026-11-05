import { useState } from 'react'
import { toRagError } from '../api/errors'
import type { PromptInput } from '../api/types'
import { useLoader } from '../hooks'
import { canEdit, formatDate } from '../labels'
import { Notice, useToast, type PageProps } from '../ui'

export default function PromptPage({ api, role }: PageProps) {
  const editable = canEdit(role)
  const toast = useToast()
  const prompts = useLoader(() => api.listPrompts())
  const [draft, setDraft] = useState<PromptInput | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const list = prompts.data ?? []
  const latest = list[0]
  const values = draft ?? { name: latest?.name ?? '', content: latest?.content ?? '' }

  function edit(next: PromptInput) {
    setDraft(next)
    setStatus(null)
  }

  async function save(asNew: boolean) {
    const input = { name: values.name.trim(), content: values.content.trim() }
    if (!input.name || input.name.length > 100) { setProblem('版本名稱要填，最多 100 個字。'); return }
    if (!input.content || input.content.length > 20000) { setProblem('提示詞內容要填，最多 20000 個字。'); return }
    setBusy(true)
    setProblem(null)
    try {
      await api.savePrompt(input, asNew || !latest ? undefined : latest)
      const message = asNew ? `已另存成新版本「${input.name}」。` : '已儲存。'
      setDraft(null)
      setStatus(`${message}下次建立知識版本時，會用這份內容。`)
      toast(message)
      await prompts.reload()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  return <>
    {prompts.error && <Notice tone="error">{prompts.error}</Notice>}
    <section className="panel">
      <div className="section-head"><h2>共用規則</h2>{latest && <span className="tag">下次建立知識版本會用「{latest.name}」</span>}</div>
      <label className="field">版本名稱<input value={values.name} maxLength={100} readOnly={!editable} onChange={e => edit({ ...values, name: e.target.value })} /></label>
      <label className="field">提示詞內容<textarea value={values.content} rows={10} maxLength={20000} readOnly={!editable} onChange={e => edit({ ...values, content: e.target.value })} /></label>
      {editable ? <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void save(false)}>儲存</button>
        {latest && <button type="button" className="secondary" disabled={busy} onClick={() => void save(true)}>另存成新版本</button>}
      </div> : <p className="caption">唯讀權限只能檢視。</p>}
      {problem && <p className="form-error" role="alert">{problem}</p>}
      {status && <p className="prompt-status" role="status">{status}</p>}
      <p className="caption">「儲存」會直接覆蓋目前這一版；想保留舊的內容，請用「另存成新版本」。修改之後，下次建立知識版本才會生效，已發布的版本不受影響。</p>
    </section>
    <section className="panel">
      <h2>歷次版本</h2>
      <ul className="checklist" aria-label="歷次版本">
        {list.map(p => <li key={p.id}>
          <details><summary>{p.name}</summary><p className="small-note">{p.content}</p></details>
          <small className="muted">{formatDate(p.updatedAt)}</small>
        </li>)}
      </ul>
      {prompts.data && !list.length && <p className="empty">還沒有提示詞，寫好之後按「儲存」。</p>}
    </section>
  </>
}
