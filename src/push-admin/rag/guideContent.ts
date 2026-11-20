// Text for the 技術架構導覽 tab. Facts follow the backend's docs/rag.md as checked on GUIDE_MODELS.checkedAt;
// update this file together with that document when the architecture changes.
import { LIMITS } from './api/types'
import { formatUsd } from './labels'
import type { PageId } from './pageList'

export type GuideNodeId = 'web' | 'edge' | 'database' | 'worker' | 'gemini'

export interface GuideNode { id: GuideNodeId; name: string; tech: string; role: string }

export interface GuideStep {
  title: string
  /** What happens, in words for someone who does not write code. */
  plain: string
  /** The technology and limits behind the step. */
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
  { id: 'web', name: '管理工作台', tech: '網站（React）',
    role: '就是你現在看到的畫面。大部分資料直接從資料庫讀；上傳、建立版本、試問這些寫入動作一律交給 rag-v1。' },
  { id: 'edge', name: 'rag-v1', tech: 'Supabase Edge Function',
    role: '後端的總窗口。先檢查登入身分和角色，再處理上傳、知識版本、試問和評測，也負責呼叫 Gemini。' },
  { id: 'database', name: '資料庫', tech: 'PostgreSQL、pgvector、PGroonga',
    role: '存文件段落、向量、知識版本、對話紀錄和費用帳本，也在這裡找資料。' },
  { id: 'worker', name: '自動處理', tech: 'Cloud Run、Docling',
    role: '在雲端下載網址上的 PDF、讀出內容並切成段落，再轉成向量；有新文件就自動開工。' },
  { id: 'gemini', name: 'Gemini', tech: 'Google Gemini API',
    role: `兩個模型：${GUIDE_MODELS.embedding} 把文字轉成向量，${GUIDE_MODELS.answer} 根據找到的段落寫回答。` },
]

export const GUIDE_ROUTES: readonly GuideRoute[] = [
  { id: 'ingest', label: '文件怎麼變成知識', steps: [
    { title: '上傳或登記網址', node: 'web', page: 'import',
      plain: '在「02 匯入與預檢」上傳 PDF、Word（.docx）或文字檔，或貼上公開的 PDF 網址。檔案直接存進不公開的儲存空間，傳完會核對檔案有沒有傳完整。',
      tech: `只收 PDF、DOCX、TXT，每個檔案 ${FILE_MB} MB 以內；用 signed URL 上傳後核對 SHA-256。網址只收 https 的 PDF，不能是 IP 位址。` },
    { title: '自動開始處理', node: 'edge', page: 'import',
      plain: '上傳完成或登記網址之後，rag-v1 會通知雲端的自動處理開工，不用有人按按鈕。萬一這次通知沒接到，每小時還會再補做一次。',
      tech: 'rag-v1 不等觸發結果就先回應，由背景啟動 Cloud Run Job rag-drain；已經有一個在跑就不重複啟動。Cloud Scheduler 每小時第 17 分補做。' },
    { title: '讀出內容並切成段落', node: 'worker', page: 'documents',
      plain: '自動處理把文件內容讀出來，依標題和段落切成一段一段，並記下每一段在第幾頁、屬於哪一節。掃描的頁面會先用文字辨識（OCR）讀字。',
      tech: 'Docling 解析，掃描頁用 RapidOCR；超過 12 頁的 PDF 分批處理。每份文件最多試 3 次，3 次都沒成功就標為失敗。' },
    { title: '轉成可搜尋的格式', node: 'gemini', page: 'documents',
      plain: '每一段文字都送給 Gemini 換成一串數字，也就是「向量」。意思相近的兩段話，數字也會很接近，之後就能依意思找資料，不只是比對字面。',
      tech: `${GUIDE_MODELS.embedding}，每段 ${GUIDE_MODELS.dimensions} 個數字，存進 pgvector。每次呼叫前先預留費用；預算不夠時標成「預算不足暫停」，補了預算再接著做。` },
    { title: '建立知識版本', node: 'database', page: 'releases',
      plain: '把處理好的文件、啟用中的人格、核對過引用的 QA、最新的 System Prompt 和檢索設定，一起凍結成一個知識版本。之後就算改了文件，這個版本的內容也不會變。',
      tech: '資料庫存成 snapshot，並記下整份內容的雜湊值（manifest hash）。版本建好後不能修改，要改就另建一個。' },
    { title: '評測與人工審核', node: 'edge', page: 'evaluation',
      plain: '用一組固定的驗收題目考這個版本，看它有沒有找對資料、引用有沒有支持回答。owner 也要親自看過，勾選確認後才算完成審核。',
      tech: '驗收題組至少 40 題且全部通過，前 5 筆就找到正確來源的比例 ≥ 90%，引用支持回答的比例 ≥ 95%，數字錯誤和版本外來源都是 0。' },
    { title: '發布', node: 'database', page: 'releases',
      plain: '條件都達到了，owner 才能按發布，這個版本就成為正式版本。發現問題時，可以改回之前發布過的版本，或先停用。',
      tech: '資料庫函式在切換前再檢查一次發布條件；每次發布、改回和停用都留下紀錄。' },
  ] },
  { id: 'answer', label: '一個問題怎麼被回答', steps: [
    { title: '確認身分與範圍', node: 'edge', page: 'playground',
      plain: 'rag-v1 先確認是誰在問、這個角色能不能問，再載入這次指定的知識版本。後面每一步都只用這個版本裡的內容。',
      tech: `驗證登入的 JWT 和 admin_users 裡的角色；試問只開放給 owner。每人每天最多 ${round.dailyLimit} 題（臺灣時間早上 8 點換日），試問和評測一起算。` },
    { title: '先比對 QA', node: 'database', page: 'qa',
      plain: '問題如果和某一題基本通用 QA 的問法一模一樣，就直接給寫好的標準答案和引用。不用問 AI，也不花錢，但仍算一題。',
      tech: '比對版本裡每一題 QA 的題目和其他問法，去掉空白和句尾的問號、句號、驚嘆號後完全相同才算數。這一步不呼叫模型。' },
    { title: '把問題轉成可搜尋的格式', node: 'gemini',
      plain: '沒有現成的 QA，就把問題也送給 Gemini 換成向量。問題和文件段落用同一種方式表示，才能比較意思接不接近。',
      tech: `${GUIDE_MODELS.embedding}，${GUIDE_MODELS.dimensions} 個數字。這是一次付費呼叫，呼叫前先預留費用。` },
    { title: '找資料', node: 'database', page: 'settings',
      plain: '資料庫同時用兩種方式找：一種找意思相近的段落，一種找含有相同關鍵字的段落，再把兩份名單合成一份排行。',
      tech: 'pgvector 比對向量相似度，PGroonga 比對關鍵字（中文和英文都適用），再用 RRF 合併兩份排名。09 的「先找幾筆資料」決定取幾筆。' },
    { title: '挑出要參考的段落', node: 'edge', page: 'settings',
      plain: '從排行裡挑出最相關的幾段交給 AI。太不相關或重複的段落會跳過；一段都挑不到時，直接回答「資料不足」。',
      tech: `09 的「回答時參考幾段」決定最多幾段，上限 ${LIMITS.contextChunks.max} 段；相似度低於門檻或內容重複的段落不採用。` },
    { title: '產生回答', node: 'gemini', page: 'playground',
      plain: 'Gemini 只能根據挑出來的段落回答，每一句都要指出引用哪一段。文件或問題裡夾帶的指令，規則要求只當成資料，不照著做。',
      tech: `${GUIDE_MODELS.answer}，temperature 0，輸出固定格式的 JSON，輸出上限 2048 tokens。不能用段落以外的知識補數字。` },
    { title: '核對引用與數字', node: 'edge', page: 'playground',
      plain: 'rag-v1 逐句檢查引用的原文是否存在，數字和單位能不能在引用的那段原文找到。任何一句對不上，整個回答就改成「資料不足」。',
      tech: '引用只能指向伺服器提供的原文片段，由伺服器插入逐字摘錄；數字與單位逐句比對原文。' },
    { title: '記下流程與費用', node: 'database', page: 'logs',
      plain: '每次問答都會記下問題、回答、每一步花了多少時間和估計費用，實際金額以 Google 收費為準。10 互動紀錄和上方的「使用者」分頁，看到的就是這些資料。',
      tech: `存在 rag_v1_requests 和 rag_v1_request_details；細節保存 ${LIMITS.retentionDays} 天，之後只留時間、結果、版本和費用。費用帳本不刪除。` },
  ] },
]

export const GUIDE_SAFEGUARDS: readonly { title: string; text: string }[] = [
  { title: '發布條件', text: '驗收題組至少 40 題全部通過，前 5 筆就找到正確來源 ≥ 90%、引用支持回答 ≥ 95%，數字錯誤和版本外來源都是 0，再加上 owner 人工審核，才能發布。' },
  { title: '引用與數字核對', text: '每個說法都要附原文引用，數字和單位要在引用的原文裡找得到，對不上就改成「資料不足」。這是機器核對，意思有沒有講對，仍要靠評測和人工審核。' },
  { title: '費用先預留', text: `每次呼叫 Gemini 前先從總預算預留費用，不夠就停，不會自動加值。每輪試問最多 ${round.requestLimit} 題、${formatUsd(round.budgetUsd)}、${round.days} 天，每人每天最多 ${round.dailyLimit} 題。` },
  { title: `對話保存 ${LIMITS.retentionDays} 天`, text: `問題、回答和處理過程保存 ${LIMITS.retentionDays} 天，之後只留時間、結果、版本和費用。這些紀錄只有 owner 看得到。` },
  { title: '金鑰只在伺服器', text: 'Gemini 金鑰只放在 Supabase 和 Cloud Run 的機密設定裡。網站只拿得到公開的 Supabase 網址和匿名金鑰。' },
  { title: '角色權限', text: 'owner、編輯者和唯讀者能做的事不同。畫面會停用不能用的按鈕，後端和資料庫也會再擋一次，不只靠畫面。' },
]

export const GUIDE_GLOSSARY: readonly { term: string; meaning: string }[] = [
  { term: 'RAG', meaning: 'Retrieval-Augmented Generation，先找資料再回答。AI 不憑記憶作答，而是根據找到的文件段落回答。' },
  { term: '段落', meaning: '文件切開後的一小段文字，是搜尋的基本單位，會記下出自第幾頁、哪一節。引用時會從段落裡截一小段原文。' },
  { term: '向量', meaning: '把一段文字換成的一串數字。意思越接近的兩段文字，數字也越接近，所以能依意思找資料。' },
  { term: '混合檢索', meaning: '同時用「意思相近」和「關鍵字相同」兩種方式找資料，互相補足漏掉的部分。' },
  { term: 'RRF', meaning: 'Reciprocal Rank Fusion，把兩份排行合成一份的方法。在兩份名單都排得前面的段落，合併後也會排在前面。' },
  { term: '知識版本', meaning: '在某個時間點凍結的一整套內容，包含文件、人格、QA、System Prompt 和檢索設定。發布後就成為正式版本。' },
  { term: '驗收評測', meaning: '用一組固定題目考某個知識版本，每項指標都達標才能發布。' },
  { term: '引用核對', meaning: '檢查回答的每一句都附上存在的原文，數字和單位也能在原文找到。' },
]
