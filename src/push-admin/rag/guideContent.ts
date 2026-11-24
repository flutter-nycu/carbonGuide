// Text for the 運作原理 tab. The plain lines are for someone who does not write code; the tech lines, shown only when
// opened, keep the names and limits. Facts follow the backend's docs/rag.md as checked on GUIDE_MODELS.checkedAt;
// update this file together with that document when the architecture changes.
import { LIMITS } from './api/types'
import { formatUsd } from './labels'
import type { PageId } from './pageList'

export type GuideNodeId = 'web' | 'edge' | 'database' | 'worker' | 'gemini'

export interface GuideNode {
  id: GuideNodeId
  name: string
  /** A few words under the name in the diagram. */
  summary: string
  /** What it does, in plain words. */
  role: string
  /** The products behind it, shown only when opened. */
  tech: string
}

export interface GuideStep {
  title: string
  /** What happens, in words for someone who does not write code. */
  plain: string
  /** The technology and limits behind the step, shown only when opened. */
  tech: string
  node: GuideNodeId
  /** The workspace page where this step can be seen or done. */
  page?: PageId
}

export interface GuideRoute { id: 'ingest' | 'answer'; label: string; steps: readonly GuideStep[] }

export const GUIDE_MODELS = { checkedAt: '2026-11-19', answer: 'gemini-3.1-flash-lite', embedding: 'gemini-embedding-001', dimensions: 768 } as const

const { round } = LIMITS
const FILE_MB = LIMITS.maxFileBytes / 1024 / 1024

export const GUIDE_NODES: readonly GuideNode[] = [
  { id: 'web', name: '管理後台', summary: '你現在用的網頁', tech: '網站（React）',
    role: '就是這個網頁。大部分資料直接從資料庫讀；上傳、建立版本、試問這些動作都交給後端服務。' },
  { id: 'edge', name: '後端服務', summary: '檢查權限、處理請求', tech: 'rag-v1（Supabase Edge Function）',
    role: '所有請求的入口。先確認是誰、有沒有權限，再處理上傳、版本、試問和測驗，也由它呼叫 AI。' },
  { id: 'database', name: '資料庫', summary: '存資料、找資料', tech: 'PostgreSQL、pgvector、PGroonga',
    role: '存文件段落、版本、對話紀錄和費用。找資料也在這裡做。' },
  { id: 'worker', name: '自動整理', summary: '讀文件、切段落', tech: 'Cloud Run、Docling',
    role: '在雲端下載網址上的 PDF，讀出內容、切成段落，再轉成可以搜尋的格式。有新文件就自動開始。' },
  { id: 'gemini', name: 'AI 模型', summary: 'Google Gemini', tech: `${GUIDE_MODELS.embedding}、${GUIDE_MODELS.answer}`,
    role: '兩個 Google 的 AI 模型：一個把文字換成可以比對意思的數字，一個根據找到的段落寫回答。' },
]

export const GUIDE_ROUTES: readonly GuideRoute[] = [
  { id: 'ingest', label: '文件怎麼變成知識', steps: [
    { title: '上傳檔案或網址', node: 'web', page: 'import',
      plain: '在「上傳文件」上傳 PDF、Word 或文字檔，或貼上公開的 PDF 網址。檔案存進不公開的空間，傳完會檢查有沒有傳完整。',
      tech: `只收 PDF、DOCX、TXT，每個檔案 ${FILE_MB} MB 以內；用 signed URL 上傳後核對 SHA-256。網址只收 https 的 PDF，不能是 IP 位址。` },
    { title: '自動開始整理', node: 'edge', page: 'import',
      plain: '上傳或登記網址後，後端服務會通知雲端開始整理，不用有人按按鈕。萬一這次沒通知到，每小時還會再補做一次。',
      tech: 'rag-v1 不等觸發結果就先回應，由背景啟動 Cloud Run Job rag-drain；已經有一個在跑就不重複啟動。Cloud Scheduler 每小時第 17 分補做。' },
    { title: '讀出內容、切成段落', node: 'worker', page: 'documents',
      plain: '把文件內容讀出來，依標題和段落切成一段一段，記下每段在第幾頁、哪一節。掃描的頁面會先辨識文字。',
      tech: 'Docling 解析，掃描頁用 RapidOCR；超過 12 頁的 PDF 分批處理。每份文件最多試 3 次，3 次都沒成功就標為失敗。' },
    { title: '轉成可搜尋的格式', node: 'gemini', page: 'documents',
      plain: '每一段文字都交給 AI 換成一串數字。意思相近的兩段話，數字也很接近，之後就能照意思找資料，不只比對字面。',
      tech: `${GUIDE_MODELS.embedding}，每段 ${GUIDE_MODELS.dimensions} 個數字，存進 pgvector。每次呼叫前先預留費用；預算不夠時標成「預算不足暫停」，補了預算再接著做。` },
    { title: '建立版本', node: 'database', page: 'releases',
      plain: '把整理好的文件、啟用中的人格、核對過引用的常見問答、回答規則和搜尋設定，一起打包成一個版本。之後再改文件，這個版本也不會變。',
      tech: '資料庫存成 snapshot，並記下整份內容的雜湊值（manifest hash）。版本建好後不能修改，要改就另建一個。' },
    { title: '自動測驗和人工審核', node: 'edge', page: 'evaluation',
      plain: '用一組固定的題目考這個版本，看它有沒有找對資料、引用能不能支持回答。管理者還要親自看過、勾選確認，才算審核完成。',
      tech: '驗收題組至少 40 題且全部通過，前 5 筆就找到正確來源的比例 ≥ 90%，引用支持回答的比例 ≥ 95%，數字錯誤和版本外來源都是 0。' },
    { title: '發布', node: 'database', page: 'releases',
      plain: '條件都達到，管理者才能按發布，這個版本就成為 App 教練使用的版本。發現問題時，可以改回之前發布過的版本，或先停用。',
      tech: '資料庫函式在切換前再檢查一次發布條件；每次發布、改回和停用都留下紀錄。' },
  ] },
  { id: 'answer', label: '一個問題怎麼被回答', steps: [
    { title: '確認身分和版本', node: 'edge', page: 'playground',
      plain: '後端服務先確認是誰在問、有沒有權限，再載入這次指定的版本。後面每一步都只用這個版本裡的內容。',
      tech: `驗證登入的 JWT 和 admin_users 裡的角色；試問只開放給 owner。每人每天最多 ${round.dailyLimit} 題（臺灣時間早上 8 點換日），試問和測驗一起算。` },
    { title: '先比對常見問答', node: 'database', page: 'qa',
      plain: '問題如果和某一筆常見問答的問法一樣，就直接給寫好的答案和引用。不用問 AI，不花錢，但仍算一題。',
      tech: '比對版本裡每一筆 QA 的題目和其他問法，去掉空白和句尾的問號、句號、驚嘆號後完全相同才算數。這一步不呼叫模型。' },
    { title: '把問題轉成可搜尋的格式', node: 'gemini',
      plain: '沒有現成的答案，就把問題也交給 AI 換成一串數字。問題和文件段落用同一種方式表示，才能比較意思接不接近。',
      tech: `${GUIDE_MODELS.embedding}，${GUIDE_MODELS.dimensions} 個數字。這是一次付費呼叫，呼叫前先預留費用。` },
    { title: '找資料', node: 'database', page: 'settings',
      plain: '同時用兩種方式找：一種找意思相近的段落，一種找有相同關鍵字的段落，再把兩份名單合成一份排行。',
      tech: 'pgvector 比對向量相似度，PGroonga 比對關鍵字（中文和英文都適用），再用 RRF 合併兩份排名。「搜尋設定」的「先找幾筆資料」決定取幾筆。' },
    { title: '挑出要參考的段落', node: 'edge', page: 'settings',
      plain: '從排行挑出最相關的幾段交給 AI。太不相關或重複的段落會跳過；一段都挑不到，就直接回答「資料不足」。',
      tech: `「搜尋設定」的「回答時參考幾段」決定最多幾段，上限 ${LIMITS.contextChunks.max} 段；相似度低於門檻或內容重複的段落不採用。` },
    { title: '寫回答', node: 'gemini', page: 'playground',
      plain: 'AI 只能根據挑出來的段落回答，每一句都要標出引用哪一段。文件或問題裡夾帶的指令，只當成資料，不照著做。',
      tech: `${GUIDE_MODELS.answer}，temperature 0，輸出固定格式的 JSON，輸出上限 2048 tokens。不能用段落以外的知識補數字。` },
    { title: '核對引用和數字', node: 'edge', page: 'playground',
      plain: '逐句檢查引用的原文是不是真的存在，數字和單位能不能在原文找到。任何一句對不上，整個回答就改成「資料不足」。',
      tech: '引用只能指向伺服器提供的原文片段，由伺服器插入逐字摘錄；數字與單位逐句比對原文。' },
    { title: '記下過程和費用', node: 'database', page: 'logs',
      plain: '每次問答都會記下問題、回答、每一步花多久和估計費用，實際金額以 Google 帳單為準。「問答紀錄」和上方的「使用者」分頁看到的就是這些資料。',
      tech: `存在 rag_v1_requests 和 rag_v1_request_details；細節保存 ${LIMITS.retentionDays} 天，之後只留時間、結果、版本和費用。費用帳本不刪除。` },
  ] },
]

export const GUIDE_SAFEGUARDS: readonly { title: string; text: string }[] = [
  { title: '發布條件', text: '驗收題組至少 40 題全部通過，前 5 筆就找到正確來源 90% 以上、引用能支持回答 95% 以上，數字錯誤和版本外的來源都是 0，再經管理者人工審核，才能發布。' },
  { title: '核對引用和數字', text: '每個說法都要附原文引用，數字和單位要在引用的原文找得到，對不上就改成「資料不足」。這是機器核對，意思對不對還要靠測驗和人工審核。' },
  { title: '費用先預留', text: `每次用 AI 前先從總預算預留費用，不夠就停，不會自動加值。每份測驗額度最多 ${round.requestLimit} 題、${formatUsd(round.budgetUsd)}、${round.days} 天，每人每天最多 ${round.dailyLimit} 題。` },
  { title: `對話保存 ${LIMITS.retentionDays} 天`, text: `問題、回答和處理過程保存 ${LIMITS.retentionDays} 天，之後只留時間、結果、版本和費用。只有管理者看得到這些紀錄。` },
  { title: '金鑰只在伺服器', text: 'AI 服務的金鑰只放在伺服器的機密設定裡，網頁拿不到。' },
  { title: '角色權限', text: '管理者、編輯者和唯讀者能做的事不同。畫面會停用不能按的按鈕，伺服器和資料庫也會再擋一次。' },
]

export const GUIDE_GLOSSARY: readonly { term: string; meaning: string }[] = [
  { term: 'RAG', meaning: '先找資料再回答。AI 不靠記憶作答，而是根據找到的文件段落回答。' },
  { term: '段落', meaning: '文件切開後的一小段文字，是搜尋的單位，會記下出自第幾頁、哪一節。' },
  { term: '向量', meaning: '把一段文字換成的一串數字。意思越接近的兩段文字，數字也越接近，所以能照意思找資料。' },
  { term: '混合搜尋', meaning: '同時用「意思相近」和「關鍵字相同」兩種方式找資料，互相補上對方漏掉的。' },
  { term: 'RRF', meaning: '把兩份排行合成一份的方法。兩份名單都排在前面的段落，合併後也排在前面。' },
  { term: '版本', meaning: '某個時間點打包的一整套內容：文件、人格、常見問答、回答規則和搜尋設定。發布後就是 App 教練使用的內容。' },
  { term: '自動測驗', meaning: '用一組固定題目考某個版本，每項指標都達標才能發布。' },
  { term: '引用核對', meaning: '檢查回答的每一句都附上真實存在的原文，數字和單位也能在原文找到。' },
]
