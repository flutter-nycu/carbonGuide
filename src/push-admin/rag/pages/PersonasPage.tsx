import { useState, type FormEvent } from 'react'
import { messageFor, toRagError } from '../api/errors'
import type { Persona, PersonaInput, RagApi } from '../api/types'
import { useLoader } from '../hooks'
import { canEdit, formatDate } from '../labels'
import { Dialog, Notice, useToast, type PageProps } from '../ui'

const inputOf = (p: Persona): PersonaInput => ({ name: p.name, example: p.example, instruction: p.instruction, enabled: p.enabled })

export default function PersonasPage({ api, role }: PageProps) {
  const editable = canEdit(role)
  const toast = useToast()
  const personas = useLoader(() => api.listPersonas())
  const [editing, setEditing] = useState<Persona | 'new' | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const list = personas.data ?? []
  const enabledCount = list.filter(p => p.enabled).length

  async function toggle(persona: Persona) {
    setProblem(null)
    if (persona.enabled && enabledCount <= 1) { setProblem(messageFor('persona_minimum')); return }
    setBusy(true)
    try {
      await api.savePersona({ ...inputOf(persona), enabled: !persona.enabled }, persona)
      toast(persona.enabled ? `已停用「${persona.name}」。` : `已啟用「${persona.name}」。`)
      await personas.reload()
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="section-head">
      <p className="persona-scenario">人格只改變說話的方式，回答的內容和來源都一樣。</p>
      {editable && <button type="button" className="primary" onClick={() => setEditing('new')}>＋ 新增人格</button>}
    </div>
    {personas.error && <Notice tone="error">{personas.error}</Notice>}
    {problem && <p className="form-error" role="alert">{problem}</p>}
    {!personas.data && personas.loading && <p className="empty" role="status">正在讀取人格…</p>}
    <div className="grid persona-grid">
      {list.map((p, index) => <section key={p.id} className="panel persona-card">
        <div className="persona-heading">
          <span className={`persona-icon ${index % 2 ? 'empath' : ''}`.trim()} aria-hidden="true">{index % 2 ? '♡' : '↗'}</span>
          <div><h2>{p.name}</h2><p>{formatDate(p.updatedAt)} 更新</p></div>
          <button type="button" className="persona-switch" role="switch" aria-label={`${p.name}啟用狀態`} aria-checked={p.enabled}
            disabled={!editable || busy} onClick={() => void toggle(p)} />
        </div>
        <div className="persona-tone"><h3>語氣範例</h3><blockquote>「{p.example}」</blockquote></div>
        <p className="persona-instruction"><strong>回答方式：</strong>{p.instruction}</p>
        <div className="section-head">
          {editable ? <button type="button" className="text-button" aria-label={`編輯 ${p.name}`} onClick={() => setEditing(p)}>編輯人格 →</button> : <span />}
          <span className={p.enabled ? 'tag' : 'tag quiet'}>{p.enabled ? '啟用中' : '已停用'}</span>
        </div>
      </section>)}
    </div>
    <p className="caption">至少要保留一個啟用中的人格。修改之後，下次建立知識版本才會生效。{editable ? '' : '唯讀權限只能檢視。'}</p>
    <Dialog open={editing !== null} title={editing === 'new' ? '新增人格' : '編輯人格'} onClose={() => setEditing(null)}>
      {editing && <PersonaForm key={editing === 'new' ? 'new' : editing.id} api={api} persona={editing === 'new' ? null : editing}
        lastEnabled={editing !== 'new' && editing.enabled && enabledCount <= 1}
        onSaved={name => { setEditing(null); toast(`已儲存「${name}」。`); void personas.reload() }} />}
    </Dialog>
  </>
}

function PersonaForm({ api, persona, lastEnabled, onSaved }: { api: RagApi; persona: Persona | null; lastEnabled: boolean; onSaved: (name: string) => void }) {
  const [values, setValues] = useState<PersonaInput>(persona ? inputOf(persona) : { name: '', example: '', instruction: '', enabled: true })
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const input = { ...values, name: values.name.trim(), example: values.example.trim(), instruction: values.instruction.trim() }
    if (!input.name || !input.example || !input.instruction) { setProblem('名稱、語氣範例和回答方式都要填。'); return }
    if (lastEnabled && !input.enabled) { setProblem(messageFor('persona_minimum')); return }
    setBusy(true)
    setProblem(null)
    try {
      await api.savePersona(input, persona ?? undefined)
      onSaved(input.name)
    } catch (caught) {
      setProblem(toRagError(caught).message)
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={event => void submit(event)}>
    <label className="field">名稱<input value={values.name} maxLength={100} onChange={e => setValues({ ...values, name: e.target.value })} /></label>
    <label className="field">語氣範例<textarea value={values.example} maxLength={2000} placeholder="用這個人格的語氣，寫一句會對使用者說的話" onChange={e => setValues({ ...values, example: e.target.value })} /></label>
    <label className="field">回答方式<textarea value={values.instruction} maxLength={10000} placeholder="告訴教練用這個人格時要怎麼回答" onChange={e => setValues({ ...values, instruction: e.target.value })} /></label>
    <label className="check-label"><input type="checkbox" checked={values.enabled} onChange={e => setValues({ ...values, enabled: e.target.checked })} />啟用這個人格</label>
    {problem && <p className="form-error" role="alert">{problem}</p>}
    <button type="submit" className="primary" disabled={busy}>儲存</button>
  </form>
}
