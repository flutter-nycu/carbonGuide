// @vitest-environment jsdom
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PlaygroundPage } from './PilotPage'
import { parsePilotDetail, parsePilotResult, type PilotRepository, type PilotRun } from './pilot'
import type { RagRepository } from './repository'

const id='70000000-0000-4000-8000-000000000001'
const run:PilotRun={id,state:'answered',reason:'validated',reserved_usd:0.03,created_at:new Date().toISOString(),finished_at:new Date().toISOString(),receipt_id:'70000000-0000-4000-8000-000000000002',prompt_version:'owner-pilot-v1'}
function setup(overrides:Partial<PilotRepository>={}) {
  const pilot:PilotRepository={status:vi.fn().mockResolvedValue({enabled:true,expires_at:new Date(Date.now()+3600000).toISOString(),max_requests:3,used_requests:0,budget_usd:0.09,reserved_usd:0}),history:vi.fn().mockResolvedValue([]),detail:vi.fn().mockResolvedValue(null),ask:vi.fn().mockImplementation(async(request_id)=>({request_id,state:'refused',answer:{answer:'資料不足',abstain:true,citations:[]},evidence:[]})),...overrides}
  return {pilot,repo:{pilot} as RagRepository}
}
async function fill(question='如何減少浪費？') {
  fireEvent.change(await screen.findByLabelText('問題'),{target:{value:question}})
  await waitFor(()=>expect((screen.getByRole('button',{name:'送出一次試問'}) as HTMLButtonElement).disabled).toBe(false))
}
afterEach(()=>cleanup())
describe('owner pilot',()=>{
  it('does not mount data reads or form for viewer/editor',()=>{
    for(const role of ['viewer','editor'] as const){const s=setup();const view=render(<PlaygroundPage repo={s.repo} role={role}/>);expect(screen.queryByLabelText('問題')).toBeNull();expect(s.pilot.status).not.toHaveBeenCalled();view.unmount()}
  })
  it('rejects multibyte oversized input and spent quota before submit',async()=>{
    const s=setup();render(<PlaygroundPage repo={s.repo} role="owner"/>);await fill()
    fireEvent.change(screen.getByLabelText('問題'),{target:{value:'碳'.repeat(534)}})
    expect((screen.getByRole('button',{name:'送出一次試問'}) as HTMLButtonElement).disabled).toBe(true)
    expect(s.pilot.ask).not.toHaveBeenCalled()
    cleanup();const used=setup({status:vi.fn().mockResolvedValue({enabled:true,expires_at:new Date(Date.now()+3600000).toISOString(),max_requests:3,used_requests:3,budget_usd:0.09,reserved_usd:0.09})})
    render(<PlaygroundPage repo={used.repo} role="owner"/>);fireEvent.change(await screen.findByLabelText('問題'),{target:{value:'測試'}})
    await screen.findByText(/本輪已預留 3/);expect((screen.getByRole('button',{name:'送出一次試問'}) as HTMLButtonElement).disabled).toBe(true)
  })
  it('submits once and state inspection never resubmits an ambiguous failure',async()=>{
    const s=setup({ask:vi.fn().mockRejectedValue(new Error('送出結果未知'))});render(<PlaygroundPage repo={s.repo} role="owner"/>);await fill()
    fireEvent.click(screen.getByRole('button',{name:'送出一次試問'}));await screen.findByRole('alert')
    const submitted=vi.mocked(s.pilot.ask).mock.calls[0][0]
    fireEvent.click(screen.getByRole('button',{name:'查詢這次狀態'}))
    await waitFor(()=>expect(s.pilot.detail).toHaveBeenCalledWith(submitted,expect.any(AbortSignal)))
    expect(s.pilot.ask).toHaveBeenCalledTimes(1)
  })
  it('renders model/source markup as plain text and does not persist answers',async()=>{
    const s=setup({ask:vi.fn().mockImplementation(async(request_id)=>({request_id,state:'answered',answer:{answer:'<img src=x onerror=alert(1)> [1]',abstain:false,citations:[{chunk_id:id,quote:'<script>引用</script>'}]},evidence:[{id,title:'來源',page_start:5,page_end:5,text:'原文',score:0.03}]}))})
    render(<PlaygroundPage repo={s.repo} role="owner"/>);await fill();fireEvent.click(screen.getByRole('button',{name:'送出一次試問'}))
    await screen.findByText('<img src=x onerror=alert(1)> [1]');expect(document.querySelector('img')).toBeNull();expect(document.querySelector('script')).toBeNull()
  })
  it('aborts a pending submit and ignores late results after role loss',async()=>{
    let resolve!:(value:unknown)=>void;const s=setup({ask:vi.fn().mockImplementation(()=>new Promise(r=>{resolve=r}))})
    const view=render(<PlaygroundPage repo={s.repo} role="owner"/>);await fill();fireEvent.click(screen.getByRole('button',{name:'送出一次試問'}))
    const args=vi.mocked(s.pilot.ask).mock.calls[0];view.rerender(<PlaygroundPage repo={s.repo} role="viewer"/>);expect(args[2].aborted).toBe(true)
    await act(async()=>resolve({request_id:args[0],answer:{answer:'秘密結果',abstain:false,citations:[]}}));expect(screen.queryByText('秘密結果')).toBeNull()
  })
  it('keeps a pending answer associated with its own request, then clears it for history',async()=>{
    let resolve!:(v:unknown)=>void
    const s=setup({history:vi.fn().mockResolvedValue([run]),ask:vi.fn().mockImplementation(()=>new Promise(r=>{resolve=r}))})
    render(<PlaygroundPage repo={s.repo} role="owner"/>);await fill();fireEvent.click(screen.getByRole('button',{name:'送出一次試問'}))
    const historyButton=await screen.findByRole('button',{name:'查看 70000000 流程'})
    expect((historyButton as HTMLButtonElement).disabled).toBe(true)
    const submitted=vi.mocked(s.pilot.ask).mock.calls[0][0]
    await act(async()=>resolve({request_id:submitted,state:'refused',answer:{answer:'本次唯一答案',abstain:true,citations:[]},evidence:[]}))
    await screen.findByText('本次唯一答案');fireEvent.click(screen.getByRole('button',{name:'查看 70000000 流程'}))
    expect(screen.queryByText('本次唯一答案')).toBeNull()
  })
  it('rejects a mismatched response and malformed/unknown step data',()=>{
    expect(()=>parsePilotResult({request_id:'wrong',replayed:true},id)).toThrow()
    expect(()=>parsePilotDetail({run,steps:[],billed_usd:null,price_version:'test'})).toThrow()
  })
})
