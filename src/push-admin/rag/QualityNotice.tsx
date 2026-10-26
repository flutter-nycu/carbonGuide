export function QualityNotice({ quality }: { quality: Record<string, unknown> }) {
  const value = quality.quarantine
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.count !== 'number' || !Number.isInteger(item.count) || item.count < 1) return null
  const numbers = (input: unknown) => Array.isArray(input) ? input.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0).slice(0, 10000).join('、') : ''
  return <details className="rag-notice"><summary>已隔離 {item.count} 個原始段落，內容不完整</summary>
    <p>含無法解碼字元的整段內容未納入這個候選，原檔與解析紀錄仍保留。請核對原文後再決定是否補回。</p>
    <p>受影響物理頁：{numbers(item.physical_pages) || '未提供頁碼'}</p>
    <p>原始段落序號：{numbers(item.chunk_ordinals) || '未提供序號'}</p>
  </details>
}
