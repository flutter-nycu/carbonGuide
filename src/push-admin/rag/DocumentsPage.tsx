import { useState } from 'react'
import type { DocumentRecord, RagRepository } from './repository'
import { useResource } from './use-resource'
import { contentLabels, dateLabel, PageHeading, processingLabels, ResourceState } from './ui'

function DocumentDetail({ document, repo, close }: { document: DocumentRecord; repo: RagRepository | null; close: () => void }) {
  const versions = useResource(repo, 'document_versions', { column: 'document_id', value: document.id })
  const [versionId, setVersionId] = useState('')
  const selected = versions.data.find(v => v.id === versionId) ?? versions.data[0]
  return <section className="rag-panel" aria-label="文件詳情">
    <div className="rag-row"><h2>{document.title}</h2><button onClick={close}>關閉詳情</button></div>
    <ResourceState resource={versions} empty="尚未建立文件版本。">
      <label>文件版本<select value={selected?.id ?? ''} onChange={event => setVersionId(event.target.value)}>{versions.data.map(version => <option key={version.id} value={version.id}>v{version.version} · {dateLabel(version.created_at)}</option>)}</select></label>
      {selected && <><dl className="rag-metadata"><dt>處理狀態</dt><dd>{processingLabels[selected.processing_status] ?? selected.processing_status}</dd><dt>內容狀態</dt><dd>{contentLabels[selected.content_status] ?? selected.content_status}</dd></dl>
        {selected.failure_reason && <p role="alert" className="rag-error">{selected.failure_reason}</p>}
        <ChunkSets key={selected.id} repo={repo} versionId={selected.id} /></>}
    </ResourceState>
  </section>
}
function ChunkSets({ repo, versionId }: { repo: RagRepository | null; versionId: string }) {
  const sets = useResource(repo, 'chunk_sets', { column: 'document_version_id', value: versionId })
  const [setId, setSetId] = useState('')
  const selected = sets.data.find(set => set.id === setId) ?? sets.data[0]
  return <ResourceState resource={sets} empty="尚無段落集合。文件需由後續的批次解析工具處理。">
    <label>段落集合<select value={selected?.id ?? ''} onChange={event => setSetId(event.target.value)}>{sets.data.map(set => <option key={set.id} value={set.id}>{set.content_hash.slice(0, 12)} · {set.chunker_version} · {set.sealed ? '已固定' : '處理中'}</option>)}</select></label>
    {selected && <ChunkList key={selected.id} repo={repo} setId={selected.id} />}
  </ResourceState>
}
function ChunkList({ repo, setId }: { repo: RagRepository | null; setId: string }) {
  const chunks = useResource(repo, 'chunks', { column: 'chunk_set_id', value: setId })
  return <><h3>段落預覽</h3><ResourceState resource={chunks} empty="尚無解析段落。文件需由後續的批次解析工具處理。">{chunks.data.map(chunk => <article className="rag-chunk" key={chunk.id}><strong>§{chunk.ordinal} · {chunk.section_path || '未標記章節'}</strong><small>{chunk.page_start === null ? '無頁碼' : `第 ${chunk.page_start}–${chunk.page_end ?? chunk.page_start} 頁`}</small><p>{chunk.original_text}</p></article>)}</ResourceState></>
}
export function DocumentsPage({ repo }: { repo: RagRepository | null }) {
  const documents = useResource(repo, 'documents')
  const versions = useResource(repo, 'document_versions')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<DocumentRecord | null>(null)
  const filtered = documents.data.filter(doc => `${doc.title} ${doc.purpose} ${doc.domain}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <PageHeading title="文件與段落" description="核對來源、處理結果與內容狀態，為下一次知識發布準備依據。" />
    <div className="rag-notice"><strong>核對已匯入的待審語料</strong><p>目前由批次工具匯入選定樣本，並非文件全文；待審內容尚未用於公開回答。瀏覽器上傳、段落修訂與發布尚未開放。</p></div>
    <div className="rag-row"><label className="rag-search">搜尋文件<input value={query} onChange={event => setQuery(event.target.value)} placeholder="文件名稱、用途或生活領域" /></label><button onClick={() => { documents.reload(); versions.reload() }} disabled={!repo || documents.loading}>重新整理</button></div>
    <ResourceState resource={documents} empty="知識庫尚無文件。使用批次工具匯入後，文件會出現在這裡。">
      {versions.error && <div role="alert" className="rag-error">無法取得處理狀態。<button onClick={versions.reload}>重試狀態讀取</button></div>}
      {!filtered.length ? <p className="rag-empty">沒有符合條件的文件。</p> : <div className="rag-table"><table><thead><tr><th>文件</th><th>用途 / 領域</th><th>處理狀態</th><th>內容狀態</th><th>操作</th></tr></thead><tbody>{filtered.map(doc => {
        const latest = versions.data.filter(v => v.document_id === doc.id).sort((a, b) => b.version - a.version)[0]
        return <tr key={doc.id}><td data-label="文件"><strong>{doc.title}</strong><small>{doc.source_type.toUpperCase()}{latest ? ` · v${latest.version}` : ''}</small></td><td data-label="用途 / 領域">{doc.purpose} / {doc.domain}</td><td data-label="處理狀態">{versions.loading ? '讀取中' : latest ? processingLabels[latest.processing_status] : '—'}</td><td data-label="內容狀態">{latest ? contentLabels[latest.content_status] : '—'}</td><td data-label="操作"><button onClick={() => setSelected(doc)}>檢視 {doc.title}</button></td></tr>
      })}</tbody></table></div>}
    </ResourceState>
    {selected && <DocumentDetail key={selected.id} document={selected} repo={repo} close={() => setSelected(null)} />}
  </>
}
