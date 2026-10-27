import { useRef, useState } from 'react'
import type { AdminRole } from '../auth'
import { IngestionPanel } from './IngestionPanel'
import { DetailDialog } from './DetailDialog'
import { ClassificationForm, ChunkCorrection } from './EditorialForms'
import type { DocumentRecord, RagRepository } from './repository'
import { useResource } from './use-resource'
import { contentLabels, dateLabel, PageHeading, processingLabels, ResourceState } from './ui'

function DocumentDetail({ document, repo, close, role, changed }: { document: DocumentRecord; repo: RagRepository | null; close: () => void; role: AdminRole; changed: () => void }) {
  const versions = useResource(repo, 'document_versions', { column: 'document_id', value: document.id })
  const [versionId, setVersionId] = useState('')
  const selected = versions.data.find(v => v.id === versionId) ?? versions.data[0]
  return <DetailDialog title={document.title} onClose={close}><section aria-label="文件詳情">
    {repo?.v1?.editorial && role !== 'viewer' && <ClassificationForm api={repo.v1.editorial} document={document} saved={changed} />}
    <ResourceState resource={versions} empty="尚未建立文件版本。">
      <label>文件版本<select value={selected?.id ?? ''} onChange={event => setVersionId(event.target.value)}>{versions.data.map(version => <option key={version.id} value={version.id}>v{version.version} · {dateLabel(version.created_at)}</option>)}</select></label>
      {selected && <><dl className="rag-metadata"><dt>處理狀態</dt><dd>{processingLabels[selected.processing_status] ?? selected.processing_status}</dd><dt>內容狀態</dt><dd>{contentLabels[selected.content_status] ?? selected.content_status}</dd></dl>
        {selected.failure_reason && <p role="alert" className="rag-error">{selected.failure_reason}</p>}
        <ChunkSets key={selected.id} repo={repo} versionId={selected.id} role={role} /></>}
    </ResourceState>
  </section></DetailDialog>
}
function ChunkSets({ repo, versionId, role }: { repo: RagRepository | null; versionId: string; role: AdminRole }) {
  const sets = useResource(repo, 'chunk_sets', { column: 'document_version_id', value: versionId })
  const [setId, setSetId] = useState('')
  const selected = sets.data.find(set => set.id === setId) ?? sets.data[0]
  return <ResourceState resource={sets} empty="尚無段落集合。文件需由後續的批次解析工具處理。">
    <label>段落集合<select value={selected?.id ?? ''} onChange={event => setSetId(event.target.value)}>{sets.data.map(set => <option key={set.id} value={set.id}>{set.content_hash.slice(0, 12)} · {set.chunker_version} · {set.sealed ? '已固定' : '處理中'}</option>)}</select></label>
    {selected && <ChunkList key={selected.id} repo={repo} setId={selected.id} hash={selected.content_hash} role={role} saved={id => { setSetId(id); sets.reload() }} />}
  </ResourceState>
}
function ChunkList({ repo, setId, hash, role, saved }: { repo: RagRepository | null; setId: string; hash: string; role: AdminRole; saved: (id: string) => void }) {
  const [page, setPage] = useState(0)
  const top = useRef<HTMLDivElement>(null)
  const pageSize = 25
  const chunks = useResource(repo, 'chunks', { column: 'chunk_set_id', value: setId }, { offset: page * pageSize, limit: pageSize + 1 })
  function turn(next: number) { setPage(next); top.current?.scrollIntoView?.({ block: 'start' }) }
  return <><div ref={top} /><div className="rag-chunk-toolbar"><h3>段落預覽</h3><div className="rag-pagination" aria-label="段落分頁"><span>第 {page + 1} 頁 · 每頁 {pageSize} 段</span><div className="rag-actions"><button disabled={page === 0 || chunks.loading} onClick={() => turn(page - 1)}>上一頁</button><button disabled={chunks.loading || chunks.data.length <= pageSize} onClick={() => turn(page + 1)}>下一頁</button></div></div></div><ResourceState resource={chunks} empty="本頁沒有段落。">{chunks.data.slice(0, pageSize).map(chunk => <article className="rag-chunk" key={chunk.id}><strong>§{chunk.ordinal} · {chunk.section_path || '未標記章節'}</strong><small>{chunk.page_start === null ? '無頁碼' : `第 ${chunk.page_start}–${chunk.page_end ?? chunk.page_start} 頁`} · 段落識別碼 <code>{chunk.id}</code></small><p>{chunk.original_text}</p>
    {repo?.v1?.editorial && role !== 'viewer' && <ChunkCorrection api={repo.v1.editorial} chunk={chunk} parentId={setId} hash={hash} saved={saved} />}
  </article>)}</ResourceState>
  </>
}
export function DocumentsPage({ repo, role = 'viewer' }: { repo: RagRepository | null; role?: AdminRole }) {
  const documents = useResource(repo, 'documents')
  const versions = useResource(repo, 'document_versions')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<DocumentRecord | null>(null)
  const [page, setPage] = useState(0)
  const pageSize = 12
  const filtered = documents.data.filter(doc => `${doc.title} ${doc.purpose} ${doc.domain}`.toLowerCase().includes(query.toLowerCase()))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1))
  return <>
    <PageHeading title="文件與段落" description="核對來源、處理結果與內容狀態，為下一次知識發布準備依據。" />
    <div className="rag-notice"><strong>處理完成後仍須審核</strong><p>逐版本檢查來源與頁碼；舊樣本版本與新全文版本分開保存。只有網址的來源仍需取得原文，不能當成已收錄全文。</p></div>
    {repo?.v1 && <details className="rag-panel"><summary>匯入文件與查看處理進度</summary><IngestionPanel repository={repo.v1} role={role} changed={() => { documents.reload(); versions.reload() }} /></details>}
    <div className="rag-row"><label className="rag-search">搜尋文件<input value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="文件名稱、用途或生活領域" /></label><button onClick={() => { documents.reload(); versions.reload() }} disabled={!repo || documents.loading}>重新整理</button></div>
    {!!filtered.length && <div className="rag-pagination" aria-label="文件分頁"><p>{filtered.length} 份文件 · 第 {currentPage + 1} / {Math.ceil(filtered.length / pageSize)} 頁</p><div className="rag-actions"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一頁文件</button><button disabled={(currentPage + 1) * pageSize >= filtered.length} onClick={() => setPage(currentPage + 1)}>下一頁文件</button></div></div>}
    <ResourceState resource={documents} empty="知識庫尚無文件。使用批次工具匯入後，文件會出現在這裡。">
      {versions.error && <div role="alert" className="rag-error">無法取得處理狀態。<button onClick={versions.reload}>重試狀態讀取</button></div>}
      {!filtered.length ? <p className="rag-empty">沒有符合條件的文件。</p> : <div className="rag-table"><table><thead><tr><th>文件</th><th>用途 / 領域</th><th>處理狀態</th><th>內容狀態</th><th>操作</th></tr></thead><tbody>{filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(doc => {
        const latest = versions.data.filter(v => v.document_id === doc.id).sort((a, b) => b.version - a.version)[0]
        return <tr key={doc.id}><td data-label="文件"><strong>{doc.title}</strong><small>{doc.source_type.toUpperCase()}{latest ? ` · v${latest.version}` : ''}</small></td><td data-label="用途 / 領域">{doc.purpose} / {doc.domain}</td><td data-label="處理狀態">{versions.loading ? '讀取中' : latest ? processingLabels[latest.processing_status] : '—'}</td><td data-label="內容狀態">{latest ? contentLabels[latest.content_status] : '—'}</td><td data-label="操作"><button aria-label={`檢視 ${doc.title}`} onClick={() => setSelected(doc)}>檢視</button></td></tr>
      })}</tbody></table></div>}
    </ResourceState>
    {selected && <DocumentDetail key={selected.id} document={selected} repo={repo} role={role} changed={documents.reload} close={() => setSelected(null)} />}
  </>
}
