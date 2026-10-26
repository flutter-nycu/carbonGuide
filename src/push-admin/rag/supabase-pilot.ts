import { supabase } from '../lib/supabase'
import { parsePilotDetail, parsePilotHistory, parsePilotResult, parsePilotStatus, pilotErrors, type PilotRepository } from './pilot'

export function createPilotRepository():PilotRepository {
  async function read(name:string,args:Record<string,unknown>,signal:AbortSignal) {
    const {data,error}=await supabase.rpc(name,args).abortSignal(signal)
    if(error)throw new Error('無法讀取試問服務，請檢查登入權限與連線。')
    return data
  }
  return {
    async status(signal){return parsePilotStatus(await read('rag_pilot_status',{},signal))},
    async history(signal){return parsePilotHistory(await read('rag_pilot_history',{},signal))},
    async detail(id,signal){
      const result=parsePilotDetail(await read('rag_pilot_detail',{p_id:id},signal))
      if(result&&result.run.id!==id)throw new Error('試問識別碼不符，請重新整理。')
      return result
    },
    async ask(id,question,signal){
      const {data,error}=await supabase.functions.invoke('rag-pilot',{body:{request_id:id,question},signal})
      if(error){
        let code:string|undefined
        if(error.context instanceof Response)try{const body=await error.context.json();if(typeof body?.error==='string')code=body.error}catch{/* Do not display provider/gateway bodies. */}
        throw new Error((code&&pilotErrors[code])||'送出結果未知，沒有自動重試。請查詢這次請求的流程紀錄。')
      }
      return parsePilotResult(data,id)
    }
  }
}
