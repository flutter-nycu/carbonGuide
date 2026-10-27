// Explanations for administrators, never a replacement for the stored response.
export function missingResponse(state: string): string {
  if (state === 'running' || state === 'reserved') return '尚在處理中，還沒有最終回覆。請稍後重新讀取這筆紀錄。'
  if (state === 'uncertain') return '無法確認本次是否完成，也無法確認最終回覆。請查閱流程與費用帳；不要另建同題重跑。'
  if (state === 'failed') return '本次未完成，未產生可確認的最終回覆。這不是一則已保存的拒答。'
  if (state === 'abstained') return '這筆紀錄標示拒答，但沒有可讀取的回覆正文；不能用現在的拒答文案還原當時內容。'
  return '這筆紀錄沒有可讀取的文字回覆；請檢查計算結果或請維護者核對紀錄。'
}

export function reasonExplanation(reason?: string): string {
  const labels: Record<string, string> = {
    validated: '回答已通過程式的引用與數值檢查；語意仍需人工核對。',
    verified_qa: '問題命中這個版本已選入的通用 QA，直接使用固定答案。',
    deterministic_calculation: '依固定版本的公式與資料計算，未呼叫回答模型。',
    full_bill_unsupported: '服務目前不提供完整帳單計算，因此回傳拒答。',
    insufficient_evidence: '目前證據不足以形成可確認的回答；可能未取到足夠來源，或回答階段選擇拒答。',
    unsupported_number_or_unit: '回答的數字或單位無法由引用逐字支持，因此回傳拒答。',
    unsupported_quantity_unit: '數量或單位格式無法安全核對。',
    missing_citation: '回答缺少必要引用，因此回傳拒答。',
    invalid_citation: '引用編號、來源或原文核對未通過，因此回傳拒答。',
    uncited_paragraph: '有回答段落沒有附上引用，因此回傳拒答。',
    invalid_answer: '模型回覆格式或回答規則未通過檢查。',
    provider_outcome_uncertain: '模型服務的處理結果無法確認，預留費用仍保留。',
    model_receipt_uncertain: '模型回覆或費用紀錄未能確認，不能視為未收費。',
    request_receipt_uncertain: '最終結果寫入未能確認，請重新讀取既有紀錄。',
    operation_unavailable: '處理步驟未完成，請維護者依原因代碼與流程排查。',
  }
  return reason && labels[reason] || '請依下方流程與原因代碼核對；此說明不會改寫已保存的回答。'
}
