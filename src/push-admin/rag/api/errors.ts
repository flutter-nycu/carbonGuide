// Turns backend error codes and reasons into plain Chinese. The code stays attached for support.

const MESSAGES: Record<string, string> = {
  unauthorized: '登入已經過期，請重新登入。',
  admin_required: '這個帳號沒有管理權限。',
  editor_required: '這項操作需要編輯者以上的權限。',
  owner_required: '這項操作只有 owner 可以使用。',
  rag_disabled: 'RAG 後端尚未啟用。',
  network_error: '連不上伺服器，請檢查網路後再試。你輸入的內容還留在畫面上。',
  invalid_response: '伺服器回傳的資料格式不對，請稍後再試。',
  not_found: '找不到這筆資料，可能已經被刪除。',
  backend_not_ready: 'RAG 功能還在準備中，請稍後再試。',
  request_not_found: '找不到這筆對話紀錄。',
  operation_unavailable: '這個操作沒有完成，請確認輸入的內容後再試一次。',
  invalid_cursor: '列表已經變動，請重新整理頁面。',
  invalid_scope: '查詢的對象不正確，請重新整理。',
  invalid_query: '搜尋文字最多 100 個字。',

  unsupported_format: '只收 PDF、DOCX、TXT 檔案。',
  file_too_large: '檔案不能超過 20 MB。',
  file_empty: '這個檔案是空的。',
  file_name_invalid: '檔名有不能使用的字元，請先重新命名。',
  file_type_mismatch: '檔案內容和副檔名不一致。',
  original_integrity_failed: '伺服器收到的檔案和你選的不一樣，請重新上傳。',
  original_not_uploaded: '檔案還沒上傳完成，請選同一個檔案再試一次。',
  original_conflict: '這個檔案和之前上傳的不一致，請重新整理後確認。',
  upload_limit_reached: '今天的上傳數量或儲存空間已經到上限。',
  url_source_not_allowed: '請輸入 https 開頭的 PDF 網址，網址不能直接用 IP 位址，也不能含帳號密碼。',
  url_daily_limit: '今天登記的網址已經到上限，請明天再試。',
  url_request_conflict: '這個網址的請求先前送出的內容不一樣，請重新整理後再登記一次。',

  draft_changed: '這筆內容剛被別人改過，請重新整理再編輯。你輸入的內容還留在畫面上。',
  persona_minimum: '至少要保留一個啟用中的人格。',
  settings_invalid: '檢索設定不符合限制，請檢查兩個數字。',
  correction_too_long: '修改後的段落太長，請縮短一點。',
  source_version_changed: '這份文件的段落剛被別人改過，畫面已經更新，請確認後再修改。',
  cannot_exclude_all_chunks: '至少要留一段，不能全部排除。',
  invalid_correction: '修改的內容不完整，請重新打開文件再試一次。',
  invalid_citations: '引用的格式不正確，請重新選擇段落。',
  unverified_citation: '引用的文字和原文對不上，請直接從原文複製，不要改字。',

  snapshot_not_ready: '有文件還沒處理完成，或同一份文件選了兩個版本，暫時不能建立知識版本。',
  snapshot_draft_missing: '有些內容已經不存在或被停用，請重新整理。',
  snapshot_citation_missing: '有 QA 的引用還沒核對，或引用的段落不在這個版本裡。',
  snapshot_context_limit: '「回答時參考幾段」最多 12，「先找幾筆資料」最多 50，請先到「檢索設定」調整。',
  human_approval_required: '這個版本還沒通過人工審核。',
  evaluation_gate_required: '這個版本還沒通過驗收評測：至少 40 題全部通過、找到正確來源的比例 90% 以上、引用能支持回答的比例 95% 以上。',
  active_version_changed: '目前使用的版本剛被換掉，請重新整理。',
  activation_conflict: '這個請求先前送出的內容不一樣，請重新整理後再操作一次。',
  review_conflict: '這個請求先前送出的審核內容不一樣，請重新整理後再操作一次。',
  source_disabled: '這個版本有已停用的文件，不能發布，也不能改回這一版。',
  disable_before_reject: '要先停用或換掉目前使用的版本，才能把它退回。',
  snapshot_changed: '版本內容和畫面上的不一致，請重新整理。',
  snapshot_conflict: '建立版本的請求先前送出的內容不一樣，請重新整理後再建立一次。',
  rollback_target_unpublished: '只能改回曾經發布過的版本。',
  review_confirmation_required: '請先勾選「已核對版本內容與評測結果」。',
  invalid_review: '請寫下審核意見，最多 2000 個字。',
  invalid_snapshot: '版本名稱要填，最多 100 個字。',

  round_closed: '這一輪測試已經停止或到期。',
  round_limit: '這一輪的題數已經用完。',
  daily_limit: '今天的試問次數已經到上限。',
  budget_exhausted: '這期的 AI 預算已經用完，暫時不能試問。',
  campaign_closed: '這期的 AI 預算已經用完，暫時不能試問。',
  round_budget_exhausted: '這一輪的費用上限已經用完，請停止這一輪後再開始新的一輪。',
  request_conflict: '剛才已經送出另一個問題，請先查看那一次的結果。',
  invalid_round: '測試輪次的設定不符合限制。',
  request_still_active: '這個問題還在處理中，請稍等一下再按一次查看結果，不會重複收費。',
  invalid_question: '問題要填，最多 2000 個字。',
  round_user_denied: '這個帳號不能使用這一輪測試。',
  request_access_denied: '這個帳號不能查看這筆紀錄。',
  round_conflict: '這一輪測試先前送出的內容不一樣，請重新整理後再試。',

  invalid_dataset: '題組格式不正確，請檢查問題、來源和預期結果。',
  dataset_too_large: '題組檔案不能超過 64 KB。',
  dataset_coverage_required: '驗收題組至少要 40 題，並包含檢索、資料不足、安全、QA、人格這幾類題目。',
  duplicate_evaluation_case: '題組裡有重複的題目。',
  dataset_split_overlap: '練習題組和驗收題組不能有相同的題目。',
  evaluation_round_unavailable: '這一輪已經關閉，或剩下的題數不夠跑完整份題組。',
  evaluation_snapshot_mismatch: '題組指定的來源不在這個知識版本裡。',
  evaluation_incomplete: '還有題目沒跑完，暫時不能產生報告。',
  evaluation_conflict: '這次評測先前送出的內容不一樣，請重新整理後再開始。',
}

const FAILURES: Record<string, string> = {
  url_not_pdf: '這個網址下載到的不是 PDF。',
  campaign_unavailable: 'AI 預算不足，等補上預算後會自動接續。',
  url_download_failed: '網址下載失敗，可能是網站暫時連不上。',
  url_too_large: '網址下載的檔案超過 20 MB。',
  parse_failed: '讀不出這個檔案的內容，檔案可能損毀或有密碼保護。',
  attempts_exhausted: '已經自動重試 3 次仍然失敗，請重新上傳檔案或重新登記網址。',
  embedding_failed: '整理成可以搜尋的資料時失敗了，已經自動重試 3 次，請重新上傳檔案。',
  undecodable_text: '檔案裡有讀不出來的文字，請改存成 PDF 再上傳。',
}

const REASONS: Record<string, string> = {
  validated: '回答裡的引用和數字都已經和原文核對過，意思對不對還需要人工確認。',
  verified_qa: '問題對到這個版本裡的一筆 QA，直接使用 QA 的答案。',
  insufficient_evidence: '找不到足夠的資料支持回答，所以回答「資料不足」。',
  unsupported_number_or_unit: '回答裡的數字或單位在引用原文裡找不到，所以改成回答「資料不足」。',
  unsupported_quantity_unit: '數量或單位的格式沒辦法和原文核對。',
  missing_citation: '回答缺少引用，所以改成回答「資料不足」。',
  invalid_citation: '引用的來源或原文核對沒有通過，所以改成回答「資料不足」。',
  uncited_paragraph: '回答有段落沒有附上引用，所以改成回答「資料不足」。',
  invalid_answer: 'AI 回覆的格式沒有通過檢查。',
  provider_outcome_uncertain: '無法確認 AI 服務有沒有處理完成，預留的費用先不釋出。',
  model_receipt_uncertain: '無法確認 AI 的回覆或費用紀錄，這次可能已經計費。',
  request_receipt_uncertain: '無法確認最後結果有沒有存下來，請重新讀取這筆紀錄。',
  operation_unavailable: '有處理步驟沒有完成，請看下方的處理流程。',
  deterministic_calculation: '這筆紀錄來自舊版的流程，目前已不再使用。',
  full_bill_unsupported: '這筆紀錄來自舊版的流程，目前已不再使用。',
}

export class RagError extends Error {
  readonly code: string
  constructor(code: string, message = messageFor(code)) {
    super(message)
    this.name = 'RagError'
    this.code = code
  }
}

export function messageFor(code: string): string {
  return MESSAGES[code] ?? `操作沒有完成，請稍後再試。（錯誤碼：${code}）`
}

export function failureText(reason: string): string {
  return FAILURES[reason] ?? `處理沒有完成（原因碼：${reason}）。`
}

/** The explanation for a reason code, or null when there is no plain wording for it. */
export function knownReason(reason: string | null | undefined): string | null {
  return (reason && REASONS[reason]) || null
}

export function reasonText(reason: string | null | undefined): string {
  return (reason && REASONS[reason]) || '請看下方的處理流程。'
}

/** Anything thrown by the network or the backend becomes a RagError with a readable message. */
export function toRagError(error: unknown): RagError {
  if (error instanceof RagError) return error
  if (error instanceof TypeError) return new RagError('network_error')
  return new RagError('unknown_error', '操作沒有完成，請稍後再試。')
}
