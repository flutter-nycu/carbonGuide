// The RAG pages: ten in the workspace sidebar, two in the admin's top tabs. The sidebar follows the order of the
// work (data, coach, test and publish, records); names and one-line subtitles are what the screen shows.

export type PageId = 'documents' | 'import' | 'playground' | 'evaluation' | 'releases' | 'personas' | 'prompt' | 'qa' | 'settings' | 'logs' | 'conversations' | 'guide'

/** Which top tab shows a page: the RAG workspace with its sidebar, or a page of its own. */
export type RagView = 'workspace' | 'conversations' | 'guide'

export interface PageDefinition {
  id: PageId
  placement: 'sidebar' | 'tab'
  /** The page's name in the sidebar, the top tabs, links and its heading. */
  label: string
  /** Starts a new sidebar group. */
  group?: string
  /** One short line under the heading. */
  subtitle: string
  /** Who may read the page's data under RLS and the spec; everyone else sees a notice and no query is sent. */
  readers?: 'owner' | 'editor'
}

export const PAGES: readonly PageDefinition[] = [
  { id: 'documents', placement: 'sidebar', group: '資料', label: '文件', subtitle: '教練回答時會引用的文件。' },
  { id: 'import', placement: 'sidebar', label: '上傳文件', subtitle: '上傳檔案或貼上 PDF 網址。' },
  { id: 'personas', placement: 'sidebar', group: '教練', label: '教練人格', subtitle: '設定教練說話的語氣。' },
  { id: 'prompt', placement: 'sidebar', label: '回答規則', subtitle: '所有人格都要遵守的回答規則。' },
  { id: 'qa', placement: 'sidebar', label: '常見問答', subtitle: '常見問題的標準答案，附上引用。' },
  { id: 'settings', placement: 'sidebar', label: '搜尋設定', subtitle: '教練找資料時要找幾筆、參考幾段。' },
  { id: 'releases', placement: 'sidebar', group: '測試與發布', label: '版本與發布', subtitle: '把內容打包成版本，審核通過再發布。', readers: 'editor' },
  { id: 'playground', placement: 'sidebar', label: '試問', subtitle: '用指定版本問問題，看回答和引用。', readers: 'owner' },
  { id: 'evaluation', placement: 'sidebar', label: '自動測驗', subtitle: '用固定題目檢查教練有沒有找對資料。', readers: 'owner' },
  { id: 'logs', placement: 'sidebar', group: '紀錄', label: '問答紀錄', subtitle: '每一次試問和測驗的問題與回答。', readers: 'owner' },
  { id: 'conversations', placement: 'tab', label: '使用者', subtitle: '所有帳號的狀態和對話紀錄。', readers: 'owner' },
  { id: 'guide', placement: 'tab', label: '運作原理', subtitle: '文件怎麼變成知識，問題怎麼被回答。' },
]

export const SIDEBAR_PAGES = PAGES.filter(p => p.placement === 'sidebar')

export const pageById = (id: PageId) => PAGES.find(p => p.id === id)!

export const viewOf = (id: PageId): RagView => (id === 'conversations' || id === 'guide' ? id : 'workspace')
