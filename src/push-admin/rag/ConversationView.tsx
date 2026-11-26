// One conversation: question, answer, citations, processing steps and costs. Shared by the playground, history and users pages.
import { knownReason, reasonText } from './api/errors'
import type { ConversationDetail } from './api/types'
import { KIND_LABEL, KIND_TONE, formatDate, formatUsd, formatEstimate } from './labels'
import { Notice } from './ui'

const STEP_LABEL: Record<string, string> = {
  snapshot_and_access: '確認版本與權限', scope_guard: '檢查問題範圍', verified_qa: '比對常見問答', query_embedding: '整理問題',
  hybrid_retrieval: '搜尋相關段落', rewrite: '改寫問題', rewritten_embedding: '整理改寫後的問題', rewritten_retrieval: '再搜尋一次',
  context_selection: '挑選要參考的段落', answer: '寫回答', citation_and_number_validation: '核對引用和數字', deterministic_tools: '已停用的舊流程',
}
const STATE_LABEL: Record<string, string> = {
  succeeded: '完成', skipped: '略過', failed: '失敗', abstained: '資料不足', running: '處理中', started: '已開始', reserved: '已預留費用',
  received: '已收到回應', http_error: 'AI 服務回傳錯誤', uncertain: '結果不確定', answered: '已回答',
}
const PURPOSE_LABEL: Record<string, string> = {
  query_embedding: '整理問題', rewrite: '改寫問題', answer: '寫回答', evaluation: '測驗', document_embedding: '整理文件',
}
const seconds = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(2)} 秒`)

export default function ConversationView({ detail }: { detail: ConversationDetail }) {
  return <div className="conversation">
    <div className="section-head">
      <span className={`tag ${KIND_TONE[detail.kind]}`.trim()}>{KIND_LABEL[detail.kind]}</span>
      <small className="muted">{formatDate(detail.createdAt)} · {detail.userLabel} · {detail.origin === 'evaluation' ? '自動測驗' : '人工試問'}</small>
    </div>
    {detail.expired
      ? <Notice tone="warn">這筆對話已超過 180 天保存期限，只留下時間、結果、版本和費用。</Notice>
      : <>
        <p className="small-note">問題：{detail.question ?? '沒有內容'}</p>
        <div className="answer">{detail.answer ?? '這次沒有產生回答。'}</div>
        {detail.kind === 'qa' && detail.manualAnswer && <p className="small-note">來源：管理者提供</p>}
      </>}
    <div className="decision"><strong>結果說明</strong>{reasonText(detail.reason)}</div>

    {!detail.expired && detail.citations.length > 0 && <section aria-label="引用">
      <h3>引用</h3>
      {detail.citations.map((c, index) => <div key={index} className="source-result">
        <span className="tag">[{index + 1}]</span>
        <div><h3>{c.documentTitle}{c.page ? ` · 第 ${c.page} 頁` : ''}</h3>{c.section && <small className="muted">{c.section}</small>}<p>{c.quote}</p></div>
      </div>)}
    </section>}

    {!detail.expired && detail.steps.length > 0 && <section aria-label="處理流程">
      <h3>處理流程</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>步驟</th><th>結果</th><th>花費時間</th></tr></thead>
        <tbody>{detail.steps.map((s, index) => <tr key={index}>
          <td>{STEP_LABEL[s.node] ?? s.node}{knownReason(s.reason) && <small>{knownReason(s.reason)}</small>}</td>
          <td>{STATE_LABEL[s.state] ?? s.state}</td><td>{seconds(s.durationMs)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    <section aria-label="費用">
      <h3>費用</h3>
      <dl className="metadata">
        <dt>版本</dt><dd>{detail.versionName || '—'}</dd>
        <dt>預留費用</dt><dd>{formatUsd(detail.reservedUsd)}</dd>
        <dt>估計費用</dt><dd>{formatEstimate(detail.estimatedUsd, detail.unknownCostCalls)}</dd>
      </dl>
      {detail.calls.length > 0 && <div className="table-wrap"><table>
        <thead><tr><th>AI 使用項目</th><th>預留</th><th>估計</th><th>花費時間</th></tr></thead>
        <tbody>{detail.calls.map(c => <tr key={c.id}>
          <td>{PURPOSE_LABEL[c.purpose] ?? c.purpose}<small>{c.model} · {STATE_LABEL[c.status] ?? c.status}</small></td>
          <td>{formatUsd(c.reservedUsd)}</td><td>{formatUsd(c.estimatedUsd)}</td><td>{seconds(c.durationMs)}</td>
        </tr>)}</tbody>
      </table></div>}
      <p className="caption">「預留」是每次用 AI 前先保留的上限，「估計」是用量乘上 Google 公告的單價，價目表版本 {detail.priceVersion}。實際金額以 Google 帳單為準。</p>
    </section>
  </div>
}
