// Turns backend error codes and reasons into plain Chinese. The code stays attached for support.

const MESSAGES: Record<string, string> = {
  unauthorized: '登入已經過期，請重新登入。',
  admin_required: '這個帳號沒有管理權限。',
  editor_required: '只有編輯者和管理者可以做這件事。',
  owner_required: '只有管理者可以做這件事。',
  rag_disabled: 'RAG 後端尚未啟用。',
  network_error: '連不上伺服器。請檢查網路後再試，剛才輸入的內容還在。',
  invalid_response: '伺服器回傳的資料有問題，請稍後再試。',
  not_found: '找不到這筆資料，可能已經刪除了。',
  backend_not_ready: '伺服器還在準備，請稍後再試。',
  request_not_found: '找不到這筆對話紀錄。',
  operation_unavailable: '沒有完成。請確認輸入的內容，再試一次。',
  invalid_cursor: '列表已經變動，請重新整理頁面。',
  invalid_scope: '查詢的對象不對，請重新整理頁面。',
  invalid_query: '搜尋文字最多 100 個字。',

  unsupported_format: '只能上傳 PDF、Word（.docx）和文字檔（.txt）。',
  file_too_large: '檔案不能超過 20 MB。',
  file_empty: '這個檔案是空的。',
  file_name_invalid: '檔名有不能用的字元，請改檔名後再上傳。',
  file_type_mismatch: '檔案內容和副檔名不符，請確認檔案格式。',
  original_integrity_failed: '伺服器收到的檔案不完整，請重新上傳。',
  original_not_uploaded: '檔案還沒傳完，請選同一個檔案再上傳一次。',
  original_conflict: '這個檔案和之前上傳的不同，請重新整理頁面確認。',
  upload_limit_reached: '今天的上傳數量或空間已經用完，請明天再上傳。',
  url_source_not_allowed: '網址要是 https 開頭的 PDF，不能是 IP 位址，也不能帶帳號密碼。',
  url_daily_limit: '今天登記的網址已經到上限，請明天再登記。',
  url_request_conflict: '這個網址之前送出的內容不同，請重新整理頁面再登記。',

  draft_changed: '別人剛改過這筆內容。請重新整理頁面再改，剛才輸入的內容還在。',
  persona_minimum: '至少要有一個啟用中的人格。',
  settings_invalid: '搜尋設定的數字超出範圍，請檢查兩個數字。',
  correction_too_long: '改過的段落太長，請刪短一點。',
  source_version_changed: '別人剛改過這份文件的段落，畫面已經更新，請確認後再改。',
  cannot_exclude_all_chunks: '至少要留一段，不能全部排除。',
  invalid_correction: '修改的內容不完整，請重新打開文件再改。',
  invalid_citations: '引用格式不對，請重新選段落。',
  unverified_citation: '引用的文字和原文對不上，請從原文直接複製，不要改字。',

  snapshot_not_ready: '有文件還沒整理好，或同一份文件選了兩個版本，現在還不能建立版本。',
  snapshot_draft_missing: '有些內容已經刪除或停用，請重新整理頁面。',
  snapshot_citation_missing: '有常見問答的引用還沒核對，或引用的段落不在這個版本裡。',
  snapshot_context_limit: '「回答時參考幾段」最多 12，「先找幾筆資料」最多 50。請先到「搜尋設定」調整。',
  human_approval_required: '這個版本還沒通過人工審核。',
  evaluation_gate_required: '這個版本還沒通過自動測驗。條件是：至少 40 題全部通過、找到正確來源 90% 以上、引用能支持回答 95% 以上。',
  active_version_changed: '使用中的版本剛換過，請重新整理頁面。',
  activation_conflict: '之前送出的內容不同，請重新整理頁面再做一次。',
  review_conflict: '之前送出的審核內容不同，請重新整理頁面再審一次。',
  source_disabled: '這個版本有已停用的文件，不能發布，也不能改回這一版。',
  disable_before_reject: '要先停用或換掉使用中的版本，才能退回它。',
  snapshot_changed: '版本內容和畫面上的不同，請重新整理頁面。',
  snapshot_conflict: '之前送出的建立內容不同，請重新整理頁面再建立。',
  rollback_target_unpublished: '只能改回發布過的版本。',
  review_confirmation_required: '請先勾選「已核對版本內容和測驗結果」。',
  invalid_review: '請寫審核意見，最多 2000 個字。',
  invalid_snapshot: '請填版本名稱，最多 100 個字。',

  round_closed: '這份測驗額度已經結束或到期。',
  round_limit: '這份測驗額度的題數用完了。',
  daily_limit: '今天的試問次數已經到上限，明天早上 8 點恢復。',
  budget_exhausted: '這期的 AI 預算已經用完，暫時不能試問。',
  campaign_closed: '這期的 AI 預算已經用完，暫時不能試問。',
  round_budget_exhausted: '這份測驗額度的費用用完了。請結束它，再開新的額度。',
  request_conflict: '剛才已經送出另一個問題，請先看那一題的結果。',
  invalid_round: '測驗額度的設定超出範圍。',
  request_still_active: '這一題還在處理，請稍等再按一次「試問」看結果，不會重複收費。',
  invalid_question: '請填問題，最多 2000 個字。',
  round_user_denied: '這個帳號不能用這份測驗額度。',
  request_access_denied: '這個帳號不能看這筆紀錄。',
  round_conflict: '之前送出的額度內容不同，請重新整理頁面再試。',

  invalid_dataset: '題組格式不對，請檢查問題、來源和預期結果。',
  dataset_too_large: '題組檔案不能超過 64 KB。',
  dataset_coverage_required: '驗收題組至少要 40 題，而且要有搜尋、資料不足、安全、常見問答、人格這幾類題目。',
  duplicate_evaluation_case: '題組裡有重複的題目。',
  dataset_split_overlap: '練習題組和驗收題組不能有相同的題目。',
  evaluation_round_unavailable: '這份測驗額度已經結束，或剩下的題數不夠跑完整份題組。',
  evaluation_snapshot_mismatch: '題組指定的來源不在這個版本裡。',
  evaluation_incomplete: '還有題目沒跑完，現在還不能產生報告。',
  evaluation_conflict: '之前送出的測驗內容不同，請重新整理頁面再開始。',
}

const FAILURES: Record<string, string> = {
  url_not_pdf: '這個網址下載到的不是 PDF。',
  campaign_unavailable: 'AI 預算不足，補上預算後會自動繼續。',
  url_download_failed: '網址下載失敗，對方網站可能暫時連不上。',
  url_too_large: '網址下載的檔案超過 20 MB。',
  parse_failed: '讀不出這個檔案的內容，檔案可能壞了或有密碼。',
  attempts_exhausted: '自動重試 3 次都失敗了，請重新上傳檔案或重新登記網址。',
  embedding_failed: '整理文件時失敗，自動重試 3 次都沒成功，請重新上傳。',
  undecodable_text: '檔案裡有讀不出來的字，請另存成 PDF 再上傳。',
}

const REASONS: Record<string, string> = {
  validated: '回答裡的引用和數字都和原文核對過了，意思對不對仍要人工確認。',
  verified_qa: '問題和這個版本的一筆常見問答相同，直接用寫好的答案。',
  insufficient_evidence: '找不到足夠的資料，所以回答「資料不足」。',
  unsupported_number_or_unit: '回答裡的數字或單位在原文找不到，所以改成「資料不足」。',
  unsupported_quantity_unit: '數量或單位的寫法沒辦法和原文核對。',
  missing_citation: '回答沒有附引用，所以改成「資料不足」。',
  invalid_citation: '引用核對沒有通過，所以改成「資料不足」。',
  uncited_paragraph: '回答有段落沒附引用，所以改成「資料不足」。',
  invalid_answer: 'AI 回覆的格式不對。',
  provider_outcome_uncertain: '不確定 AI 有沒有處理完，預留的費用先保留。',
  model_receipt_uncertain: '不確定 AI 的回覆和費用有沒有記下來，這次可能已經收費。',
  request_receipt_uncertain: '不確定結果有沒有存下來，請重新讀取這筆紀錄。',
  operation_unavailable: '有步驟沒有完成，請看下方的處理流程。',
  deterministic_calculation: '這筆紀錄來自已經停用的舊流程。',
  full_bill_unsupported: '這筆紀錄來自已經停用的舊流程。',
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
  return FAILURES[reason] ?? `處理沒有完成。（原因碼：${reason}）`
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
