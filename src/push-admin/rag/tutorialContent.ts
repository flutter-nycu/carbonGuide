// Text for the workspace tutorial: the order an admin follows to turn new documents into a published version. Button and field names quote the pages word for word; update a step when its page's wording changes.
import { LIMITS } from './api/types'
import { formatUsd } from './labels'
import type { PageId } from './pageList'

export type TutorialStepId =
  | 'import' | 'documents' | 'personas' | 'prompt' | 'qa' | 'settings'
  | 'version' | 'playground' | 'evaluation' | 'review' | 'publish' | 'monitor'

export interface TutorialStep {
  id: TutorialStepId
  /** The stage of the work, matching the sidebar's groups where it can. */
  phase: string
  title: string
  /** Where the step is done; the panel offers a button to go there. */
  page: PageId
  /** Who may do the step's actions. Everyone else can still read the step. */
  actor: 'editor' | 'owner'
  /** Nothing to change when the current setup already fits; marking the step complete is enough. */
  optional?: boolean
  purpose: string
  actions: readonly string[]
  /** How the admin can tell the step is finished. */
  done: string
  notes?: readonly string[]
}

const { round, candidates, contextChunks } = LIMITS
const FILE_MB = LIMITS.maxFileBytes / 1024 / 1024
const DATASET_KB = LIMITS.datasetBytes / 1024

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'import', phase: '資料', title: '上傳文件', page: 'import', actor: 'editor',
    purpose: '把教練回答時要參考的資料放進來。可以上傳檔案，也可以登記公開的 PDF 網址，之後會自動整理。',
    actions: [
      `在「上傳檔案」按「選擇檔案」，選 PDF、Word 或文字檔，每個 ${FILE_MB} MB 以內，可以一次選好幾個。`,
      '資料在網路上的話，在「PDF 網址」貼上 https 開頭的網址，按「登記網址」。',
      '檔案的結果看「上傳結果」，網址看下方「已登記的網址」。',
    ],
    done: '每個檔案都顯示「上傳完成」或「已經有這個檔案，略過」，網址出現在「已登記的網址」裡。',
    notes: [
      '上傳完成只代表收到了，內容還要整理，下一步就是看整理進度。',
      '一般網頁收不進來，登記的網址下載下來必須是 PDF。',
    ] },
  { id: 'documents', phase: '資料', title: '確認整理好並分類', page: 'documents', actor: 'editor',
    purpose: '文件會被讀出來、切成段落，再轉成可以搜尋的格式。這一步確認每份文件都整理好了，補上分類，必要時修正段落。',
    actions: [
      '看上方的數字。「已整理好」的文件才能放進版本；「整理中」的會自己更新，不用重新整理頁面。',
      '「需要處理」不是 0 時，在表格裡找失敗或預算不足的文件，狀態下面會寫原因。',
      '按文件右邊的「檢視」，填好資料用途、生活領域和適用對象，按「儲存分類」。',
      '順便讀一下段落。有錯字按「修改文字」，和主題無關的按「排除這一段」，兩種都要寫原因。',
    ],
    done: '要用的文件都顯示「完成」，分類也填好了。',
    notes: [
      '文件不用一份一份核准，審核版本時會一起確認。',
      '修改或排除段落後，要建立新版本才會生效。',
    ] },
  { id: 'personas', phase: '教練', title: '檢查教練人格', page: 'personas', actor: 'editor', optional: true,
    purpose: '人格決定教練說話的語氣，例如直接給建議，或比較溫和地陪伴。回答的內容和引用不會因人格而不同。',
    actions: [
      '看每張卡片的「語氣範例」和「回答方式」，確認是你要的口吻。',
      '要調整就按「編輯」，改完按「儲存」；想多一種口吻就按「新增人格」。',
      '用卡片右上角的開關決定要不要啟用。',
    ],
    done: '至少一個人格是「啟用中」，語氣範例符合你的預期。',
    notes: [
      '至少要留一個啟用中的人格。',
      '已經滿意就不用改，直接按「標記完成」。修改後，要建立新版本才會生效。',
    ] },
  { id: 'prompt', phase: '教練', title: '確認回答規則', page: 'prompt', actor: 'editor', optional: true,
    purpose: '回答規則是所有人格都要遵守的規定，例如只能根據文件回答、每個說法都要附引用。',
    actions: [
      '讀「規則內容」，確認沒有漏掉的規定，也沒有過時的內容。',
      '小修改直接改，按「儲存」；想保留舊的，就換一個「名稱」，按「另存新版」。',
      '確認上方標籤「下次建立版本會用…」寫的是你要的那一份。',
    ],
    done: '標籤寫的就是你要用的回答規則。',
    notes: ['修改後，要建立新版本才會生效。'] },
  { id: 'qa', phase: '教練', title: '整理常見問答', page: 'qa', actor: 'editor', optional: true,
    purpose: '常見問題可以先寫好標準答案。使用者問的和這裡的問題一樣時，教練直接用這個答案，不用問 AI，也不花錢。',
    actions: [
      '按「新增問答」，填問題與答案。若由管理者提供答案，勾選「人工標準答案」後儲存，不必再選文件段落。',
      '若答案依據文件，填來源說明並儲存，再按這筆問答的「編輯」。在下方「引用」選來源文件和段落，貼上和段落一字不差的引用原文，按「加入引用」，最後按「儲存引用」。',
      `一筆問答最多 ${LIMITS.qaCitations} 筆引用，同一段只能引用一次。`,
    ],
    done: '要用的問答已啟用；人工答案顯示「下次建立版本時收錄」，文件型顯示「引用已填，建立版本時核對」。',
    notes: [
      '文件型問答沒有有效引用就不會放進版本；引用要用第 2 步整理好的文件段落。',
      '儲存後要建立新版本，並在試問選取它。可在版本詳情查看「已收錄常見問答」。',
    ] },
  { id: 'settings', phase: '教練', title: '檢查搜尋設定', page: 'settings', actor: 'owner', optional: true,
    purpose: '決定教練找資料時先找幾筆、回答時參考幾段。大多數時候維持現在的設定就好。',
    actions: [
      `「先找幾筆資料」可以設 ${candidates.min} 到 ${candidates.max}；「回答時參考幾段」可以設 ${contextChunks.min} 到 ${contextChunks.max}，不能比先找的筆數多。`,
      '要調整就改數字，按「儲存設定」。',
    ],
    done: '數字是你要的，或確定維持原本的設定。',
    notes: [
      '找得多不一定答得好，參考太多段反而容易混進無關的內容。',
      '修改後，要建立新版本才會生效，已發布的版本不受影響。',
    ] },
  { id: 'version', phase: '測試與發布', title: '建立版本', page: 'releases', actor: 'owner',
    purpose: '把前面準備好的內容打包成一個版本：整理好的文件、啟用中的人格與人工答案、引用有效的文件型問答、回答規則和搜尋設定。之後的試問、測驗和發布都用這個版本。',
    actions: [
      '在「建立版本」的「版本名稱」輸入好認的名字，例如「2026-12 冬季版」。',
      '按「建立版本」。',
      '在右邊「版本紀錄」找到它，審核欄是「待審核」，自動測驗欄是「還沒測驗」。',
    ],
    done: '新版本出現在「版本紀錄」裡。',
    notes: ['版本建好後內容就固定了。之後再改文件、人格、問答或設定，要另外建一個新版本。'] },
  { id: 'playground', phase: '測試與發布', title: '試問', page: 'playground', actor: 'owner',
    purpose: '用剛建立的版本問幾個真實的問題，看教練怎麼回答、引用了哪份文件、花了多少錢。',
    actions: [
      '在「版本」選剛建立的版本。',
      '在「問題」輸入使用者可能會問的話，按「試問」。',
      '在右邊「回答與引用」看回答、引用的原文、處理流程和費用。',
      '多問幾題，也問一題資料裡沒有的，確認教練會說資料不足，不會自己編答案。',
    ],
    done: '人工答案標示「管理者提供」，文件回答附上引用；內容正確，資料不夠時會說資料不足。',
    notes: [
      `試問會用 AI 預算。第一次試問會自動開一份測驗額度：最多 ${round.requestLimit} 題、${round.days} 天內有效，費用上限是剩餘預算和 ${formatUsd(round.budgetUsd)} 中較少的那個。`,
      `每人每天最多 ${round.dailyLimit} 題，試問和測驗一起算，臺灣時間早上 8 點換日。`,
      '畫面說還在處理時，用同一個問題再按一次「試問」，會拿到那一次的回答，不會重複收費；換別的問題就算新的一題。',
    ] },
  { id: 'evaluation', phase: '測試與發布', title: '跑自動測驗', page: 'evaluation', actor: 'owner',
    purpose: '用一組固定的驗收題目考這個版本，系統自動檢查有沒有找對資料、引用能不能支持回答。結果是發布條件之一。',
    actions: [
      '第一次用要先登記題組：在「題組檔案」選 JSON 檔，確認名稱、類型和題數，按「登記題組」。',
      '在「開始測驗」選驗收題組和剛建立的版本，按「開始測驗」。',
      '一次跑一題，畫面會顯示完成幾題，跑完會出現「測驗報告」。',
      '中途離開這一頁會暫停。回來後在「測驗紀錄」按「接續」，跑過的題目不會重跑。',
    ],
    done: '「測驗紀錄」顯示「已產生報告」，報告裡每一題都通過。',
    notes: [
      `驗收題組至少 40 題，要有搜尋、資料不足、安全、常見問答、人格這幾類題目，檔案 ${DATASET_KB} KB 以內。`,
      '發布條件：每一題都通過，找到正確來源 90% 以上，引用能支持回答 95% 以上。',
      '練習題組的結果只供參考，不算發布條件。測驗一樣會用 AI 預算。',
    ] },
  { id: 'review', phase: '測試與發布', title: '人工審核', page: 'releases', actor: 'owner',
    purpose: '自動測驗通過，不代表每個回答的意思都對。管理者要親自看過版本內容和測驗結果，再決定核准或退回。',
    actions: [
      '在「版本紀錄」按這個版本的「檢視」。',
      '看「發布條件」，確認哪幾項還是「還沒符合」。',
      '在「審核」選「核准」或「退回」，「審核意見」寫下看過哪些內容、為什麼這樣決定。',
      '勾選「已核對版本內容和測驗結果」，按「送出審核」。',
    ],
    done: '這個版本的審核欄顯示「已核准」。',
    notes: ['退回後，把內容改好，再建立新版本，重新試問、測驗和審核。'] },
  { id: 'publish', phase: '測試與發布', title: '發布', page: 'releases', actor: 'owner',
    purpose: '發布後，這個版本就是 App 教練使用的版本，版本紀錄會標成「使用中」。',
    actions: [
      '在版本詳情確認「發布條件」每一項都是「已符合」。',
      '按「發布這個版本」。',
      '回到「版本紀錄」，確認這個版本旁邊出現「使用中」。',
    ],
    done: '版本紀錄裡這個版本標著「使用中」。',
    notes: [
      '發布後發現問題，可以打開之前發布過的版本按「改回這個版本」，或在使用中的版本按「停用這個版本」。',
      '停用後，教練會暫時沒有版本可用，直到發布或改回另一個版本。',
    ] },
  { id: 'monitor', phase: '紀錄', title: '追蹤紀錄和使用者', page: 'logs', actor: 'owner',
    purpose: '上線後定期看每一次問答的品質和費用，發現問題就回到前面的步驟修正。',
    actions: [
      '在「問答紀錄」用「類型」篩選人工試問或自動測驗，按「檢視」看問題、回答、處理過程和費用。',
      '在上方的「使用者」分頁，看每個帳號的狀態、今日用量和對話紀錄。',
      '要更新知識時，按操作教學最下面的「重設進度」，從第 1 步再走一次。',
    ],
    done: '知道去哪裡看紀錄，就可以按「標記完成」。',
    notes: [`問題和回答保存 ${LIMITS.retentionDays} 天，之後只留時間、結果、版本和費用。`] },
]
