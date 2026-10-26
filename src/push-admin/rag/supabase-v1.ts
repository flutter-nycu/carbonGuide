import { supabase } from '../lib/supabase'
import { createVersionRepository } from './supabase-versions'
import { createTrialRepository } from './supabase-trials'
import { createEvaluationRepository } from './supabase-evaluation'
import { validateFile, type Campaign, type IngestionJob, type Original, type RagV1Repository } from './v1'

const errors: Record<string, string> = {
  unauthorized: '登入已到期，請重新登入。', admin_required: '目前帳號沒有管理權限。',
  editor_required: '需要編輯者權限。', owner_required: '這項操作需要 owner 權限。',
  url_source_not_allowed: '目前只接受 IPCC、台灣自來水、能源署與國發會的 HTTPS 網址。', url_daily_limit: '今日 URL 匯入已達上限。',
  original_integrity_failed: '伺服器檔案與上傳內容不一致，尚未加入處理佇列。',
  original_not_uploaded: '原始檔尚未上傳完成，請選擇同一檔案重試。',
  original_conflict: '檔案與既有版本不符，請重新整理確認。',
  upload_limit_reached: '已達本日匯入數量或私有語料容量上限，請聯絡維護者。',
  file_type_mismatch: '檔案內容與副檔名不符。', invalid_json_file: 'JSON 格式無法解析。',
  draft_changed: '草稿已更新，請保留輸入並重新整理。', snapshot_not_ready: '所選段落須全部完成同一 profile 的 embedding；每份文件只能選一個版本，且不能停用。',
  snapshot_draft_missing: '部分草稿不存在或已停用，請重新整理。', snapshot_citation_missing: 'QA 或計算資料的引用尚未核對，或不在所選段落中。',
  snapshot_context_limit: '請將引用段落數設為最多 12、檢索候選數設為最多 50，再建立版本。',
  human_approval_required: '這個版本尚未取得有效的人工核准。', evaluation_gate_required: '尚未通過此版本的驗收評測：至少 40 題、檢索命中率 90%、引用有效率 95%，數值錯誤與越權引用均為 0。',
  active_version_changed: '使用中的版本已變更，請重新整理後確認。', source_disabled: '此版本包含已停用來源，無法發布或回滾。',
  disable_before_reject: '請先停用或切換目前使用的版本，再將它退回。', snapshot_changed: '快照雜湊不符，請重新載入。',
  rollback_target_unpublished: '只能回滾至曾經發布的版本。', review_confirmation_required: '請先確認已核對版本內容與評測。',
  round_closed: '這個輪次已停止或到期。', round_limit: '這個輪次的題數已用完。', daily_limit: '已達今日跨輪次的個人題數上限。',
  budget_exhausted: '共用模型預算不足。', round_budget_exhausted: '這個輪次的模型預算不足。', campaign_closed: '共用模型預算已停止或到期。',
  request_conflict: '請求識別碼已綁定另一個問題，請先查詢原本的處理結果。', invalid_round: '輪次的預算、題數或期限不符；期限不可超過共用預算到期日或七天。',
  invalid_dataset: '題庫格式不符，請依使用說明的格式核對問題、來源與預期結果。', dataset_coverage_required: '驗收題庫須至少 40 題，並涵蓋檢索、計算、拒答、安全、QA 與人格測試。',
  duplicate_evaluation_case: '題庫包含重複問題與輸入。', dataset_split_overlap: '開發題與驗收題不能重複，請保留獨立驗收題。',
  evaluation_round_unavailable: '輪次已關閉或剩餘題數不足以完成整份題庫。', evaluation_snapshot_mismatch: '題庫指定的來源或計算資料不在這個固定版本內。',
  evaluation_incomplete: '仍有未完成題目，或診斷資料已過期，尚不能產生報告。', request_still_active: '尚未超過 5 分鐘處理期限，請稍後查詢原請求。',
  correction_too_long: '修訂文字連同文件標題與章節需在 1800 UTF-8 bytes 內。長表格請使用批次工具重新解析。',
  unverified_citation: '引用不是來源中的完整摘錄，或係數與原始資料不一致。請核對識別碼、數字與單位。',
}
async function action(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('rag-v1', { body })
  if (error) {
    let code = ''
    if (error.context instanceof Response) {
      try { const detail = await error.context.clone().json(); code = typeof detail?.error === 'string' ? detail.error : '' } catch { /* Safe generic message below. */ }
    }
    throw new Error(errors[code] ?? '操作未完成。請確認輸入與連線後重試；輸入仍保留在畫面。')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('服務回傳格式不符。')
  return data
}
export function createV1Repository(): RagV1Repository {
  return {
    urls: {
      async list(signal) {
        const result = await supabase.from('rag_v1_urls').select('id,source_url,state,attempt,original_id,metadata,failure_reason,created_at').order('created_at', { ascending: false }).limit(500).abortSignal(signal)
        if (result.error) throw new Error('無法讀取網址匯入狀態。')
        return result.data ?? []
      },
      async register(url, requestKey) { const result = await action({ action: 'url_register', url, requestKey }); return String(result.id) },
    },
    evaluation: createEvaluationRepository(action),
    operations: {
      async summary(campaignId) { return await action({ action: 'operations', campaignId }) as unknown as import('./v1').OperationSummary },
      async recordBill(campaignId, bill, evidenceSha256) { await action({ action: 'bill_record', campaignId, ...bill, evidenceSha256 }) },
    },
    trials: createTrialRepository(action),
    editorial: {
      async calculations(offset, signal) {
        const result = await supabase.from('rag_v1_calculation_drafts').select('id,kind,definition,updated_at').order('created_at').order('id').range(offset, offset + 49).abortSignal(signal)
        if (result.error) throw new Error('無法讀取計算草稿。')
        return result.data ?? []
      },
      async coefficients(offset, search) {
        const result = await action({ action: 'coefficients', offset, search })
        if (!Array.isArray(result.rows)) throw new Error('係數清單格式不符。')
        return result.rows
      },
      async classify(documentId, purpose, domain, scope) { await action({ action: 'classify', documentId, purpose, domain, scope }) },
      async correct(parentId, hash, edits, reason) {
        const result = await action({ action: 'correct_chunks', parentId, hash, edits, reason })
        if (typeof result.id !== 'string') throw new Error('尚未取得修訂版識別碼。')
        return result.id
      },
      async qaCitations(id, signal) {
        const result = await supabase.from('rag_v1_qa_citations').select('chunk_id,quote').eq('qa_id', id).order('chunk_id').limit(5).abortSignal(signal)
        if (result.error) throw new Error('無法取得 QA 引用。')
        return result.data ?? []
      },
      async saveQaCitations(qaId, updatedAt, citations) { await action({ action: 'qa_citations', qaId, updatedAt, citations }) },
      async saveCalculation(id, updatedAt, kind, definition) {
        const result = await action({ action: 'calculation_save', id, updatedAt, kind, definition })
        if (typeof result.id !== 'string') throw new Error('尚未取得計算草稿識別碼。')
        return result.id
      },
    },
    versions: createVersionRepository(action),
    async ingestion(signal) {
      const [originals, jobs] = await Promise.all([
        supabase.from('rag_v1_originals').select('id,document_version_id,sha256,byte_size,source_name,upload_state,created_at').order('created_at', { ascending: false }).limit(1000).abortSignal(signal),
        supabase.from('rag_v1_jobs').select('id,original_id,stage,status,attempt,output_set_id,failure_reason,quality,updated_at').order('updated_at', { ascending: false }).limit(2000).abortSignal(signal),
      ])
      if (originals.error || jobs.error) throw new Error('無法讀取匯入狀態，請重新整理或檢查權限。')
      return { originals: (originals.data ?? []) as Original[], jobs: (jobs.data ?? []) as IngestionJob[] }
    },
    async upload(file, progress) {
      const invalid = validateFile(file)
      if (invalid) throw new Error(invalid)
      progress('核對檔案內容…')
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('')
      const result = await action({ action: 'upload_begin', name: file.name, format: file.name.split('.').pop()!.toLowerCase(), sha256: hash, bytes: file.size })
      if (typeof result.id !== 'string') throw new Error('缺少文件識別碼。')
      if (result.verified === true) { progress('此檔案已在私有知識庫中，無須重複上傳。'); return }
      if (typeof result.path !== 'string' || !/^originals\/[a-f0-9]{64}\.(pdf|docx|txt|json)$/.test(result.path) || typeof result.token !== 'string') throw new Error('上傳授權格式不符。')
      progress('上傳至私有儲存空間…')
      const { error } = await supabase.storage.from('rag-originals').uploadToSignedUrl(result.path, result.token, file, { upsert: false })
      // An earlier upload may have succeeded before a lost response. Verification safely detects that case.
      if (error) progress('正在確認伺服器是否已收到相同檔案…')
      else progress('伺服器正在重新驗證檔案雜湊…')
      await action({ action: 'upload_verify', originalId: result.id })
      progress('上傳與雜湊核對完成，已排入本機批次處理；內容仍待審。')
    },
    async download(originalId) {
      const result = await action({ action: 'download_original', originalId })
      if (typeof result.url !== 'string') throw new Error('下載授權無效。')
      const url = new URL(result.url)
      const configured = new URL(import.meta.env.VITE_SUPABASE_URL)
      if (url.origin !== configured.origin || !url.pathname.startsWith('/storage/v1/object/sign/rag-originals/')) throw new Error('下載來源不符。')
      return url.href
    },
    async campaigns(signal) {
      const result = await supabase.from('rag_v1_campaigns').select('id,name,budget_usd,reserved_usd,call_limit,call_count,state,expires_at').order('created_at', { ascending: false }).limit(30).abortSignal(signal)
      if (result.error) throw new Error('無法讀取模型預算。')
      return (result.data ?? []) as Campaign[]
    },
    async stopCampaign(id) { await action({ action: 'campaign_stop', campaignId: id }) },
  }
}
