import { useId, useState, type FormEvent } from 'react'
import { toRagError } from '../api/errors'
import { LIMITS, validateSettings } from '../api/types'
import { useLoader } from '../hooks'
import { formatDate } from '../labels'
import { Notice, useToast, type PageProps } from '../ui'

const SAVED = '設定已儲存，下次建立知識版本時才會生效。'

export default function SettingsPage({ api, role }: PageProps) {
  const owner = role === 'owner'
  const toast = useToast()
  const id = useId()
  const settings = useLoader(() => api.getSettings())
  const [form, setForm] = useState<{ candidates: string; contextChunks: string } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const data = settings.data
  const values = form ?? { candidates: data ? String(data.candidates) : '', contextChunks: data ? String(data.contextChunks) : '' }

  function edit(next: typeof values) {
    setForm(next)
    setSaved(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!data) return
    const input = { candidates: Number(values.candidates), contextChunks: Number(values.contextChunks) }
    const invalid = validateSettings(input)
    if (invalid) { setProblem(invalid); return }
    setBusy(true)
    setProblem(null)
    try {
      await api.saveSettings(input, data.updatedAt)
      setForm(null)
      setSaved(true)
      toast(SAVED)
      await settings.reload()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  const { candidates, contextChunks } = LIMITS
  return <>
    {settings.error && <Notice tone="error">{settings.error}</Notice>}
    {!owner && <Notice>只有 owner 可以修改檢索設定。</Notice>}
    <section className="panel">
      {/* Our own check explains the limits in plain words, instead of the browser's tooltip. */}
      <form noValidate onSubmit={event => void submit(event)}>
        <h2>教練要參考多少資料？</h2>
        <div className="setting-row">
          <div><label htmlFor={`${id}-candidates`}>先找幾筆資料</label>
            <p id={`${id}-candidates-help`}>用意思相近和關鍵字兩種方式先找出幾筆資料，可以設 {candidates.min} 到 {candidates.max}。找得多，不一定答得比較好。</p></div>
          <input id={`${id}-candidates`} type="number" inputMode="numeric" min={candidates.min} max={candidates.max} value={values.candidates}
            aria-describedby={`${id}-candidates-help`} disabled={!owner || !data} onChange={e => edit({ ...values, candidates: e.target.value })} />
        </div>
        <div className="setting-row">
          <div><label htmlFor={`${id}-context`}>回答時參考幾段</label>
            <p id={`${id}-context-help`}>從找到的資料裡挑幾段給教練參考，可以設 {contextChunks.min} 到 {contextChunks.max}，不能比先找的筆數多。太多容易混進不相關的內容。</p></div>
          <input id={`${id}-context`} type="number" inputMode="numeric" min={contextChunks.min} max={contextChunks.max} value={values.contextChunks}
            aria-describedby={`${id}-context-help`} disabled={!owner || !data} onChange={e => edit({ ...values, contextChunks: e.target.value })} />
        </div>
        {problem && <p className="form-error" role="alert">{problem}</p>}
        {saved && <p className="prompt-status" role="status">{SAVED}</p>}
        <div className="actions"><button type="submit" className="primary" disabled={!owner || busy || !data}>儲存設定</button></div>
        <p className="caption">{data ? `${formatDate(data.updatedAt)} 更新。` : ''}改完之後，下次建立知識版本才會生效，已發布的版本不受影響。</p>
      </form>
    </section>
  </>
}
