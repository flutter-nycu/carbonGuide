import { supabase } from '../lib/supabase'
import type { VersionData, VersionRepository } from './v1'

export function createVersionRepository(action: (input: Record<string, unknown>) => Promise<Record<string, unknown>>): VersionRepository {
  return {
    async versions(signal) {
      const requests = {
        snapshots: supabase.from('knowledge_releases').select('id,name,manifest_hash,created_at').order('created_at', { ascending: false }).limit(100),
        sets: supabase.from('rag_v1_sets').select('chunk_set_id,original_id,profile_id,chunk_count,embedding_state,quality').order('created_at', { ascending: false }).limit(1000),
        originals: supabase.from('rag_v1_originals').select('id,source_name').order('created_at', { ascending: false }).limit(1000),
        calculations: supabase.from('rag_v1_calculation_drafts').select('id,kind,definition,updated_at').order('updated_at', { ascending: false }).limit(200),
        reviews: supabase.from('rag_v1_reviews').select('id,release_id,verdict,reason,sequence,created_at').order('sequence', { ascending: false }).limit(1000),
        publications: supabase.from('rag_v1_activations').select('id,release_id,previous_id,action,reason,sequence,created_at').order('sequence', { ascending: false }).limit(1000),
        evaluations: supabase.from('rag_v1_evaluations').select('id,release_id,manifest_hash,data_split,case_count,passed_count,recall_at_5,citation_validity,numerical_failures,unpublished_leaks,created_at').order('created_at', { ascending: false }).limit(1000),
      }
      const result: Record<string, unknown[]> = {}
      await Promise.all(Object.entries(requests).map(async ([key, query]) => {
        const response = await query.abortSignal(signal)
        if (response.error) throw new Error('無法取得版本資料，請重新整理或確認權限。')
        result[key] = response.data ?? []
      }))
      return result as unknown as VersionData
    },
    async snapshotDetail(id, signal) {
      const response = await supabase.from('knowledge_releases').select('manifest').eq('id', id).abortSignal(signal).single()
      if (response.error || !response.data) throw new Error('無法取得內容快照。')
      return response.data.manifest as Record<string, unknown>
    },
    async createSnapshot(name, selection, requestKey) {
      const result = await action({ action: 'snapshot_create', requestKey, name, selection })
      if (typeof result.id !== 'string') throw new Error('未取得版本識別碼。')
      return result.id
    },
    async reviewSnapshot(releaseId, hash, verdict, reason, requestKey) {
      await action({ action: 'snapshot_review', requestKey, releaseId, hash, verdict, reason, confirmation: '我已核對這個版本及其評測' })
    },
    async activateSnapshot(releaseId, expectedId, operation, reason, requestKey) {
      await action({ action: 'snapshot_activate', requestKey, releaseId, expectedId, operation, reason })
    },
  }
}
