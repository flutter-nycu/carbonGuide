import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { AdminRole } from '../auth'
import type { RagRepository } from './repository'
import { type PilotDetail, type PilotRepository, type PilotResult, type PilotRun, type PilotStatus, pilotErrors, pilotNodes, pilotStates } from './pilot'
import { PageHeading, dateLabel } from './ui'
import { duration, usd } from './traces'
import './pilot.css'

export function PlaygroundPage({repo,role}:{repo:RagRepository|null;role:AdminRole}) {
  return <><PageHeading title="試問" description="使用固定的待審樣本，檢查真實回答、引用與每個步驟的費用。" />
    {role!=='owner'?<p className="rag-notice">只有 owner 可以執行與查看試問。</p>:repo?.pilot?<OwnerPilot key={role} api={repo.pilot}/>:<p className="rag-notice">試問服務尚未連線。</p>}
  </>
}
function OwnerPilot({api}:{api:PilotRepository}) {
  const [question,setQuestion]=useState('');const [status,setStatus]=useState<PilotStatus|null>(null)
  const [history,setHistory]=useState<PilotRun[]>([]);const [detail,setDetail]=useState<PilotDetail|null>(null)
  const [result,setResult]=useState<PilotResult|null>(null);const [error,setError]=useState('');const [readError,setReadError]=useState('')
  const [busy,setBusy]=useState(false);const [selected,setSelected]=useState<string|null>(null);const [revision,setRevision]=useState(0)
  const submitController=useRef<AbortController|null>(null);const currentApi=useRef(api)
  useEffect(()=>{currentApi.current=api;setResult(null);setDetail(null);setSelected(null);setBusy(false);setError('');return()=>submitController.current?.abort()},[api])
  useEffect(()=>{
    const controller=new AbortController();setReadError('');setStatus(null);setHistory([])
    Promise.all([api.status(controller.signal),api.history(controller.signal)]).then(([s,h])=>{if(!controller.signal.aborted){setStatus(s);setHistory(h)}}).catch(()=>{if(!controller.signal.aborted)setReadError('無法讀取試問狀態，請重新整理。')})
    return()=>controller.abort()
  },[api,revision])
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;setDetail(null)
    if(selected) {
      const read=()=>api.detail(selected,controller.signal).then(value=>{
        if(controller.signal.aborted)return
        setDetail(value)
        if(busy)timer=setTimeout(read,1500)
      }).catch(()=>{if(!controller.signal.aborted)setReadError('暫時無法讀取流程；請稍後查詢這次請求。')})
      void read()
    }
    return()=>{controller.abort();if(timer)clearTimeout(timer)}
  },[api,selected,busy,revision])
  async function submit(event:FormEvent) {
    event.preventDefault();if(busy||!status?.enabled)return
    const controller=new AbortController();submitController.current=controller
    const requestId=crypto.randomUUID();setBusy(true);setError('');setResult(null);setSelected(requestId)
    try {
      const response=await api.ask(requestId,question.trim(),controller.signal)
      if(!controller.signal.aborted&&currentApi.current===api)setResult(response)
    }catch(e){if(!controller.signal.aborted&&currentApi.current===api)setError(e instanceof Error?e.message:'送出結果未知。請查詢這次狀態，不要重複送出。')}
    finally {if(!controller.signal.aborted&&currentApi.current===api){setBusy(false);setRevision(v=>v+1)}}
  }
  const count=new TextEncoder().encode(question.trim()).length
  const available=status?.enabled&&Date.parse(status.expires_at)>Date.now()&&status.used_requests<status.max_requests&&status.reserved_usd+0.03<=status.budget_usd+1e-8
  return <>
    <div className="rag-notice"><strong>管理員小量測試 · 待審資料</strong><p>僅使用兩份文件的 24 個選定段落，並非全文或已發布知識。每題最多一次向量化與一次回答，不使用工具或自動重試。</p><p>問題與答案只留在當次畫面，請勿輸入個資或秘密；伺服器保存流程與用量。離開畫面不一定停止已送出的呼叫。</p></div>
    <div className="rag-row"><p>{status?`本輪已預留 ${status.used_requests} / ${status.max_requests} 題 · ${usd(status.reserved_usd)} / ${usd(status.budget_usd)}`:'正在讀取試問額度…'}<small>{status?`截止 ${dateLabel(status.expires_at)}${available?'':' · 目前無法送出新試問'}`:''}</small></p><button disabled={busy} onClick={()=>setRevision(v=>v+1)}>重新整理試問</button></div>
    {readError&&<p role="alert" className="rag-error">{readError}</p>}
    <form className="rag-panel" onSubmit={submit}><label>問題<textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={1600} disabled={busy} placeholder="例如：如何減少食物浪費？"/></label><div className="rag-row"><small>{count} / 1600 UTF-8 bytes · 每次保守預留 USD 0.03，非帳單金額</small><button className="rag-primary" disabled={busy||!available||count===0||count>1600}>{busy?'試問處理中…':'送出一次試問'}</button></div></form>
    {error&&<p role="alert" className="rag-error">{error} 請先查詢這次狀態；再次送出會建立新請求並占用另一題額度。</p>}
    {selected&&<p className="rag-muted">請求 <code>{selected}</code> <button onClick={()=>setRevision(v=>v+1)}>查詢這次狀態</button></p>}
    {result?.replayed&&<p className="rag-notice">這個請求已受理，沒有再次呼叫模型。答案沒有存入資料庫，請查看流程紀錄。</p>}
    {result?.answer&&result.request_id===selected&&<section className="rag-panel" aria-label="試問回答"><h2>{result.answer.abstain?'未提供回答':'候選回答'}</h2><p className="rag-pilot-answer">{result.answer.answer}</p>{result.answer.citations.map((c,i)=>{
      const source=result.evidence?.find(e=>e.id===c.chunk_id)
      return <details key={c.chunk_id}><summary>[{i+1}] {source?.title} · 第 {source?.page_start}–{source?.page_end} 頁</summary><blockquote>{c.quote}</blockquote><small>檢索 RRF：{source?.score.toFixed(6)} · 段落 {c.chunk_id}</small></details>
    })}</section>}
    {detail&&<PilotFlow key={detail.run.id} detail={detail}/>}
    <section className="rag-panel"><h2>本輪試問紀錄</h2><p className="rag-muted">僅保存流程與用量，30 天後不再顯示。未完成的請求仍保留費用預留，不會自動重跑。</p>{history.length?<ul className="rag-pilot-history">{history.map(run=><li key={run.id}><span>{dateLabel(run.created_at)} · {pilotStates[run.state]}</span><button disabled={busy} onClick={()=>{setSelected(run.id);setResult(null);setError('');setRevision(v=>v+1)}}>查看 {run.id.slice(0,8)} 流程</button></li>)}</ul>:<p>尚無可讀取的試問紀錄。</p>}</section>
  </>
}
function PilotFlow({detail}:{detail:PilotDetail}) {
  const [selected,setSelected]=useState(3)
  const step=detail.steps.find(s=>s.ordinal===selected)??detail.steps[0]
  const uncertain=(detail.run.state==='running'&&Date.now()-Date.parse(detail.run.created_at)>120000)||(detail.run.state==='failed'&&detail.steps.some(s=>s.state==='running'))
  const executed=detail.steps.filter(s=>s.reserved_usd!==null)
  const estimated=executed.every(s=>s.estimated_usd!==null)?executed.reduce((v,s)=>v+s.estimated_usd!,0):null
  return <section className="rag-panel" aria-label="本次試問流程"><div className="rag-row"><h2>本次試問流程</h2><span className="rag-tag">{uncertain?'執行結果待確認':pilotStates[detail.run.state]}</span></div>
    <p>請求預留 {usd(detail.run.reserved_usd)} · 已開始模型步驟預留 {usd(executed.reduce((v,s)=>v+s.reserved_usd!,0))} · 單價估算 {usd(estimated)} · 帳單 未知</p>
    <p className="rag-muted">預留金額用於阻擋超額請求，失敗或拒答也不自動退回額度。單價估算以模型回報用量計算，缺資料顯示未知；不是實際扣款。</p>
    <ol className="rag-pilot-flow">{detail.steps.map(s=><li key={s.ordinal}><button aria-pressed={selected===s.ordinal} onClick={()=>setSelected(s.ordinal)} className={`is-${s.state}`}><small>{s.ordinal.toString().padStart(2,'0')} · {pilotStates[s.state]}</small><strong>{pilotNodes[s.node]}</strong><span>{duration(s.duration_ms)}</span></button></li>)}</ol>
    <div className="rag-pilot-node" aria-label="試問節點詳情"><h3>{pilotNodes[step.node]}</h3><dl className="rag-metadata"><dt>狀態</dt><dd>{pilotStates[step.state]}{uncertain&&step.state==='running'?'（後端結果尚未確認）':''}</dd><dt>耗時</dt><dd>{duration(step.duration_ms)}</dd><dt>模型</dt><dd>{step.model??'未呼叫模型'}</dd><dt>輸入 / 輸出 tokens</dt><dd>{step.input_tokens??'未知'} / {step.output_tokens??'未知'}</dd><dt>步驟預留 / 估算</dt><dd>{usd(step.reserved_usd)} / {usd(step.estimated_usd)}</dd></dl>{step.reason&&<p>{pilotErrors[step.reason]??'步驟未完成，請核對服務紀錄。'} <code>{step.reason}</code></p>}{step.reference_ids.length>0&&<p className="rag-muted">記錄 {step.reference_ids.length} 個來源段落識別碼。</p>}</div>
  </section>
}
