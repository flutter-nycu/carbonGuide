import { supabase } from '../lib/supabase'
import type { EvaluationRepository } from './v1'
export function createEvaluationRepository(action: (body: Record<string, unknown>) => Promise<Record<string, unknown>>): EvaluationRepository {
  const id = (result: Record<string, unknown>) => { if (typeof result.id !== 'string') throw new Error('未取得評測識別碼。'); return result.id }
  return {
    async list(signal) {
      const [datasets, batches, receipts] = await Promise.all([
        supabase.from('rag_v1_datasets').select('id,name,data_split,case_count,dataset_hash').order('created_at', { ascending: false }).limit(100).abortSignal(signal),
        supabase.from('rag_v1_evaluation_batches').select('id,dataset_id,round_id,created_at').order('created_at', { ascending: false }).limit(100).abortSignal(signal),
        supabase.from('rag_v1_evaluation_receipts').select('batch_id,evaluation_id').limit(1000).abortSignal(signal),
      ])
      if (datasets.error || batches.error || receipts.error) throw new Error('無法讀取評測清單。')
      return { datasets: datasets.data ?? [], batches: batches.data ?? [], receipts: receipts.data ?? [] }
    },
    async register(dataset) { return id(await action({ action: 'dataset_register', dataset })) },
    async begin(datasetId, roundId, requestKey) { return id(await action({ action: 'evaluation_begin', datasetId, roundId, requestKey })) },
    async next(batchId) { return await action({ action: 'evaluation_next', batchId }) as { complete: boolean; state?: string } },
    async finish(batchId) { return id(await action({ action: 'evaluation_finish', batchId })) },
    async report(id, signal) {
      const result = await supabase.from('rag_v1_evaluations').select('report,manifest_hash,dataset_hash,data_split,case_count,passed_count,recall_at_5,citation_validity,numerical_failures,unpublished_leaks').eq('id', id).abortSignal(signal).single()
      if (result.error || !result.data) throw new Error('無法取得評測報告。')
      return result.data
    },
  }
}
