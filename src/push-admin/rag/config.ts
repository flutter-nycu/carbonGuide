export function ragConfiguration(env: Record<string, unknown>): { enabled: boolean; message: string } {
  if (env.VITE_RAG_ENABLED !== 'true') return { enabled: false, message: '完成測試環境設定後，即可讀取與儲存內容。目前不會送出 RAG 資料請求。' }
  try {
    const url = new URL(String(env.VITE_SUPABASE_URL))
    const ref = String(env.VITE_RAG_PROJECT_REF ?? '')
    const local = ['localhost', '127.0.0.1'].includes(url.hostname)
    if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) throw new Error()
    if (local ? ref !== 'local' : url.protocol !== 'https:' || !/^[a-z]{20}$/.test(ref) || url.hostname !== `${ref}.supabase.co`) throw new Error()
    return { enabled: true, message: local ? '本機 Supabase 測試環境' : `測試專案：${ref}` }
  } catch {
    return { enabled: false, message: 'RAG 測試專案與後台登入環境不一致，請核對環境設定。' }
  }
}
