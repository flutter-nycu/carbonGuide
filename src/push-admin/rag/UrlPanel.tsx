import { useEffect, useState } from 'react'
import type { AdminRole } from '../auth'
import type { RagV1Repository, UrlSnapshot } from './v1'

const labels: Record<string, string> = { pending: '待本機批次下載', running: '下載中', downloaded: '原檔已核對，解析與審核另計', failed: '下載失敗' }
const failures: Record<string, string> = { url_tls_verification_failed: '來源憑證未通過驗證，請由維護者核對來源憑證或另行取得可信原檔。', url_http_403: '來源拒絕下載；未繞過存取限制。', url_too_large: '來源超過 20 MiB，未匯入。' }
export function UrlPanel({ repository, role }: { repository: NonNullable<RagV1Repository['urls']>; role: AdminRole }) {
  const [rows, setRows] = useState<UrlSnapshot[]>([]), [refresh, setRefresh] = useState(0)
  const [url, setUrl] = useState(''), [key, setKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    repository.list(controller.signal).then(value => { if (!controller.signal.aborted) setRows(value) })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '讀取失敗。') })
    return () => controller.abort()
  }, [repository, refresh])
  async function submit() {
    setBusy(true); setError('')
    try { await repository.register(url.trim(), key); setUrl(''); setKey(crypto.randomUUID()); setRefresh(n => n + 1) }
    catch (error) { setError(error instanceof Error ? error.message : '登記失敗。') }
    finally { setBusy(false) }
  }
  return <section aria-label="網址快照匯入"><h3>網址快照</h3>
    <p>限 IPCC、台灣自來水、能源署及國發會。每次擷取保存完整原始回應與雜湊；不執行網頁程式、不下載外部圖片。新內容須另行解析及人工核對。</p>
    {role !== 'viewer' && <div className="rag-row"><label>來源 HTTPS 網址<input type="url" value={url} disabled={busy} maxLength={2048} onChange={event => { setUrl(event.target.value); setKey(crypto.randomUUID()) }} /></label><button disabled={busy || !url.trim()} onClick={submit}>{busy ? '登記中…' : '加入下載佇列'}</button></div>}
    <button onClick={() => setRefresh(n => n + 1)}>更新網址進度</button>{error && <p role="alert">{error}</p>}
    <details><summary>已登記 {rows.length} 個網址</summary><ul>{rows.map(row => <li key={row.id}><code style={{ overflowWrap: 'anywhere' }}>{row.source_url}</code><p>{labels[row.state] ?? row.state}{row.failure_reason && `：${failures[row.failure_reason] ?? row.failure_reason}`}</p>{row.metadata.embedded_images_fetched === false && <small>嵌入圖片尚未擷取，須核對是否包含必要表格或數據。</small>}</li>)}</ul></details>
  </section>
}
