import { useEffect, useRef } from 'react'
import template from '../rag/index.html?raw'
import styleUrl from '../rag/styles.css?url'
import { mountRag } from '../rag/app'

// Reuse the existing demo within a scoped DOM. No standalone public HTML route.
// Its mock state is created after authorization and disposed when logged out.
const body = template.split('<body>')[1].split('</body>')[0]

export default function RagWorkspace() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = host.current!.shadowRoot ?? host.current!.attachShadow({ mode: 'open' })
    root.innerHTML = '<link rel="stylesheet" href="' + styleUrl + '"><div class="rag-body">' + body + '</div>'
    const dispose = mountRag(root)
    return () => { dispose(); root.replaceChildren() }
  }, [])
  return <div ref={host} className="rag-workspace" aria-label="RAG 知識工作台（假資料示範）" />
}
