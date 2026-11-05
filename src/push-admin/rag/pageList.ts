// The eleven workspace pages: order, sidebar groups, headings and one-line subtitles.

export type PageId = 'documents' | 'import' | 'playground' | 'evaluation' | 'releases' | 'personas' | 'prompt' | 'qa' | 'settings' | 'logs' | 'conversations'

export interface PageDefinition {
  id: PageId
  number: string
  label: string
  group?: string
  title: string
  subtitle: string
  /** Who may read the page's data under RLS and the spec; everyone else sees a notice and no query is sent. */
  readers?: 'owner' | 'editor'
}

export const PAGES: readonly PageDefinition[] = [
  { id: 'documents', number: '01', label: '知識庫與文件', group: '管理來源', title: '知識庫與文件', subtitle: '教練回答時會用到的文件都在這裡，可以看處理進度和段落內容。' },
  { id: 'import', number: '02', label: '匯入與預檢', title: '匯入與預檢', subtitle: '上傳檔案或登記 PDF 網址，系統會自動整理成可以搜尋的資料。' },
  { id: 'playground', number: '03', label: '檢索試問台', group: '驗證回答', title: '檢索試問台', subtitle: '選一個知識版本問問題，看教練怎麼回答、引用了哪份文件、花了多少錢。', readers: 'owner' },
  { id: 'evaluation', number: '04', label: 'RAG 評測', title: 'RAG 評測', subtitle: '用一組固定的問題，檢查教練有沒有找對資料、引用有沒有支持回答。', readers: 'owner' },
  { id: 'releases', number: '05', label: '知識版本', title: '知識版本', subtitle: '把整理好的內容做成知識版本，審核和評測都通過之後再發布。', readers: 'editor' },
  { id: 'personas', number: '06', label: '人格設定', group: '教練設定', title: '人格設定', subtitle: '先看每個人格的語氣範例，再決定要不要調整。' },
  { id: 'prompt', number: '07', label: 'System Prompt', title: '全域提示詞', subtitle: '所有人格都照這份規則回答。' },
  { id: 'qa', number: '08', label: '基本通用 QA', title: '基本通用 QA', subtitle: '常見問題先寫好標準答案，並連到來源文件的原文。' },
  { id: 'settings', number: '09', label: '進階檢索設定', group: '進階與紀錄', title: '檢索設定', subtitle: '調整教練找資料的方式。' },
  { id: 'logs', number: '10', label: '互動紀錄', title: '互動紀錄', subtitle: '看看每一次試問和評測的問題、回答與處理過程。', readers: 'owner' },
  { id: 'conversations', number: '11', label: '對話使用者', title: '對話使用者', subtitle: '看看有誰問過問題，點進去可以看每一次的對話和費用。', readers: 'owner' },
]
