# CarbonGuide 網站與管理工作台

本 repo 負責公開網站、密碼重設 callback、App Links、React 推播管理與 RAG 知識工作台。另一個 repo `githyoung/carbon-navigation` 負責 Flutter App、Supabase migrations／Edge Functions、Cloud Run worker 及全專案文件。

Codex、Claude 與新開發者先讀 [AGENTS.md](AGENTS.md)，再讀本頁；Claude 的 [CLAUDE.md](CLAUDE.md) 導向相同文件。全專案入口在後端 `docs/README.md`，整體資料流在 `docs/architecture.md`，跨 repo 版本與 RAG 證據統一在 `docs/rag.md`。有本次交接 checkout／包時優先讀其中文件；尚未 push 的 C-4 資訊不會出現在 [GitHub main 文件](https://github.com/githyoung/carbon-navigation/blob/main/docs/README.md)。

## 目前進度（2026-11-26）

| 項目 | 狀態 |
|---|---|
| 正式入口 | https://carbon-guide.vercel.app/push-admin#rag；上方分頁為「知識庫」，另有 `#conversations` 使用者、`#guide` 運作原理 |
| 正式版本 | origin/main `065d3abdfe5c041312036f063b993d76ce56f178`；Production deployment `8034551534` success，建立於 `2026-11-24T16:49:04Z`，11/26 重查 |
| 現有功能 | 既有 RAG 真實工作台、全帳號使用者列表、每頁 10 位、白話文案、可收合側欄及預設收起的教學；App 端未接入 |
| C-4 候選 | 本分支 `agent/cto/336ff7935d6a`，程式 commit `9725c350b91f37a76071c2493331746f1c0bf2a1`；本輪文件 commit 接在它之後。人工標準答案與版本收錄提示已實作，未部署 |
| 後端配套 | `e9056c5d3b9fa6f7a7c1ffd4c4d86526c4e5fe0f`、新增 `20261126033000_rag_manual_faq.sql`，尚未部署；後端候選另缺 main 的兩份使用者 migration，整合前必看後端 rag.md |
| 分支差異 | 網站 origin/develop `cbb4bba28a8a33ca04a4496d406b2580d4e8763d`，已落後 main；舊 preview 分支只供歷史追查，不可假定已同步 |
| 最新指示 | Ken 暫停重新授權與部署，先完整更新架構／進度並 commit；本輪不 push、merge 或觸發 Preview |
| 尚待驗證 | 人工 FAQ 真實登入與端到端、Safari／實機手機、原 8.17 秒檢索失敗的 logs；本機測試不能替代 |

前次部署預檢中，Supabase 連線無權存取卡夢 project，且未確認獨立後端測試環境。既有 Preview 與正式站共用正式 Supabase。現在依使用者指示暫停，不能自動重試部署，也不能改用可存取的其他 project。

## 工具與專案邊界

React 18、TypeScript 5、Vite 8、Tailwind 3、Supabase JS 2；精確版本以 package-lock.json 為準。11/26 候選在 Node 22.23.2 驗證。沒有獨立 Node API server；瀏覽器打包產物部署到 Vercel，服務端權限與資料規則在後端 repo。

## 目錄與頁面

| 路徑 | 正式網址 | 內容 |
|---|---|---|
| `index.html` | `/` | 網站首頁 |
| `privacy-policy.html` | `/privacy-policy.html` | 隱私權政策正式頁。政策工作稿在 App repo 的 `docs/privacy-policy.html` |
| `support.html` | `/support.html` | App Store 支援頁 |
| `auth-callback.html`、`src/auth-callback.ts` | `/auth/callback` | 密碼重設 callback，把使用者帶回 App |
| `push-admin.html`、`src/push-admin/` | `/push-admin` | 推播與 RAG 整合工作台（React） |
| `public/.well-known/` | `/.well-known/...` | iOS AASA 與 Android asset links，給 Universal Link／App Links 使用 |
| `src/push-admin/rag/` | `/push-admin#rag` | 登入後掛載的 RAG 知識工作台（React），接上 App 的正式 Supabase，由 `VITE_RAG_ENABLED` 開關；舊 `/rag-preview/` 導向此入口 |
| `openspec/` | 不部署 | OpenSpec 規格與 change |

建置設定：`vite.config.ts` 列出 5 個 HTML entry；`public/` 底下的檔案由 Vite 原樣複製，不經過打包。`vercel.json` 設定 `/push-admin.html` 轉到 `/push-admin` 的 redirect、`/push-admin` 與 `/auth/callback` 的 rewrite 和安全 header（CSP、`X-Frame-Options`、`noindex` 等），以及 AASA 的 `Content-Type`。`src/push-admin/deployment.test.ts` 只檢查 `/push-admin` 的 redirect、rewrite、CSP 和 `X-Frame-Options`；`/auth/callback` 和 AASA 的設定目前沒有測試。

## 推播管理前端

- 技術：React 18、TypeScript、Vite、Tailwind、`@supabase/supabase-js`。
- 登入：Supabase Auth 的 Google OAuth。登入後查 `admin_users` 取得角色。
- 角色：`owner`、`editor` 可以看到系統推播、個人化規則、發送紀錄、推播用量四個分頁；`viewer` 只看得到發送紀錄和推播用量（見 `src/push-admin/auth.ts`）。
- 帳號限制：目前只允許一個管理員 Email，限制在三個地方：本 repo 的 `src/push-admin/auth.ts` 常數、App repo Edge Functions 的 `supabase/functions/_shared/push-admin-roles.ts` 常數，以及資料庫的 `admin_users_single_email` constraint 和 `is_push_*` 函式。要讓業主或其他人進後台，三處都要改（資料庫要新的 migration），屬於權限變更，需要另外確認。README「角色與設定」中的管理員初始化只適用於這一個 Email，不是開放新帳號的授權。
- 呼叫後端：發送、受眾預覽和用量查詢呼叫 Supabase Edge Functions（`send-system-push`、`send-personalized-push`、`preview-push-audience`、`onesignal-usage`）；個人化規則是前端直接更新 `push_rules`，由 RLS 限制只有 editor 以上能改。Functions、資料表、RLS 和角色檢查都在 App repo。
- 環境變數：`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，都是公開值，範例在 `.env.example`；另有 RAG 開關 `VITE_RAG_ENABLED`（見下一節）。不要把任何伺服器端 secret 放進 `VITE_*`。

## RAG 知識工作台

### 載入、頁面與互動

- 程式入口是 `src/push-admin/components/RagWorkspace.tsx`：先通過既有登入與角色檢查，再以 `React.lazy` 載入（獨立 chunk，推播管理不用下載），用 React portal 把 `src/push-admin/rag/Workspace.tsx` 畫進 Shadow DOM。樣式只用 `rag/styles.css`（Tailwind 的 content 排除這個目錄）。正式站的 CSP 是 `style-src 'self'`，元件不能用 inline `style`。
- 開關：只有 `VITE_RAG_ENABLED=true` 才讀寫真實資料；沒有設定時知識庫 10 頁與使用者分頁顯示「RAG 後端尚未啟用」，運作原理照常顯示說明，只有「目前的實際設定」一區顯示尚未啟用。任何一頁都不送出 RAG 請求。正式開關已有歷史上線證據；新增 schema／API 的相容性仍要依本次候選核對，不能因開關已開就先部署網站。
- 資料層 `rag/api/`：`supabase.ts` 在 RLS 下直接讀表，所有寫入都經 App repo 的 `rag-v1` Edge Function；`fake.ts` 是記憶體版，只給測試和瀏覽器驗證用，不會被打包。
- 不能重複的操作（試問、建立輪次、建立版本、開始評測、登記網址、審核、發布、改回、停用）都帶請求鍵（`requestKeys.ts`，存在元件外，成功之後才清掉）。重送時沿用第一次送出的內容，因為後端只接受同一個請求鍵、同樣內容的重送；試問回來是「還在處理中」時保留請求鍵，避免重複扣款。
- 頁面第一次打開後保持掛載；被隱藏時會關掉對話框、停止輪詢和評測。輪詢只在頁面可見時每 15 秒一次。
- 上方列（`components/Dashboard.tsx`）是一列：品牌、分頁、角色與登出，桌面 52px 並固定在頂端，720px 以下分兩列。分頁依序是推播管理、知識庫、使用者、運作原理；使用者只給 owner。後三個共用同一個 `RagWorkspace`，由 `Workspace` 的 `view` 決定顯示側欄 10 頁或單一全寬頁，切換分頁不卸載頁面。上方列高度透過 `.rag-workspace` 上的 CSS 變數 `--rag-top` 傳進 shadow root，讓側欄黏在它下面。
- 側欄可以收成圖示窄條（`rag/icons.tsx` 的 inline SVG，不用 style 屬性）。收合狀態與操作教學的進度存在 localStorage（`rag-sidebar-collapsed`、`rag-tutorial`），只經 `rag/storage.ts` 讀寫並包 try/catch；這是每台瀏覽器自己的偏好，不是共用資料。操作教學（`rag/Tutorial.tsx`、`tutorialContent.ts`）預設收起，不發任何請求。網址 `#push`、`#rag`、`#conversations`、`#guide` 直接開分頁，角色看不到的分頁不會被網址打開。
- 頁面與可讀的角色（側欄依分組排列，使用者與運作原理在上方分頁）：

| 頁（舊名） | 檔案 | 可以看的角色 |
|---|---|---|
| 資料：文件（01 知識庫與文件） | `pages/DocumentsPage.tsx` | 全部；editor 以上可改分類、修正或排除段落 |
| 資料：上傳文件（02 匯入與預檢） | `pages/ImportPage.tsx` | 全部；editor 以上可上傳 PDF／DOCX／TXT、登記 https PDF 網址 |
| 教練：教練人格（06 人格設定） | `pages/PersonasPage.tsx` | 全部；editor 以上可編輯 |
| 教練：回答規則（07 System Prompt） | `pages/PromptPage.tsx` | 全部；editor 以上可編輯 |
| 教練：常見問答（08 基本通用 QA） | `pages/QaPage.tsx` | 全部；editor 以上可編輯與核對引用 |
| 教練：搜尋設定（09 進階檢索設定） | `pages/SettingsPage.tsx` | 全部；只有 owner 能改 |
| 測試與發布：版本與發布（05 知識版本） | `pages/ReleasesPage.tsx` | owner、editor（只有 owner 能建立、審核、發布） |
| 測試與發布：試問（03 檢索試問台） | `pages/PlaygroundPage.tsx` | owner |
| 測試與發布：自動測驗（04 RAG 評測） | `pages/EvaluationPage.tsx` | owner |
| 紀錄：問答紀錄（10 互動紀錄） | `pages/LogsPage.tsx` | owner |
| 上方分頁：使用者（原「對話使用者」） | `pages/ConversationsPage.tsx` | owner（其他角色看不到這個分頁） |
| 上方分頁：運作原理（原「技術架構導覽」） | `pages/ArchitecturePage.tsx`、`guideContent.ts` | 全部；「目前的實際設定」只讀，使用中的版本只查給 owner／editor，AI 預算只查給 owner，不呼叫付費模型 |

畫面上的角色叫管理者、編輯者、唯讀者（owner、editor、viewer）。文字規則與完整名稱對照見 `openspec/changes/rag-plain-ui-refresh/design.md`：短動詞、不加箭頭或加號、每頁一句 20 字內的副標、技術名詞只放在運作原理的「技術細節」。改文案時沿用，並同步 `tutorialContent.ts` 裡引用的按鈕與欄位名稱。

### 資料與重送契約

| 行為 | 必須保留的契約 |
|---|---|
| 上傳 | `upload_begin` 取 signed URL → 瀏覽器上傳 → `upload_verify` 核對 SHA-256 → 後端觸發 worker；上傳成功不等於解析／向量化成功 |
| 建立版本 | 凍結有效文件、明確標記 manual_answer 的啟用人工答案，以及引用有效段落的文件型 QA；disabled 驗收文件及依賴它的文件型 QA 不得進入新 snapshot，既有 snapshot 不回寫。人工答案來源為「管理者提供」，不得偽造文件引用；這項 C-4 變更尚未部署 |
| 評測 | 題組與輪次固定；先扣除當日已用額度，進度只計 terminal requests。回應遺失時沿用原輪次／批次／請求鍵，離頁停止前端接續，不清除已完成結果 |
| 對話分頁 | 後端 cursor 綁定 cutoff、使用者與來源；保留 cursor，換篩選重開列表，不用 offset 或自行拼頁碼。「使用者」分頁的頁碼只在瀏覽器裡切已載入的資料，向後端仍只送 cursor |
| 使用者狀態 | 帳號、今日用量（UTC 日，試問與評測合計）與輪次以查詢當下計算；結果分布跟對話次數用同一個 cutoff，四項合計等於次數。後端沒提供 `status` 時顯示「—」，不補 0 或「正常」 |
| 費用 | 未取得模型用量不得顯示成零；呈現已知估計與未知筆數。campaign 預留、模型估計與 Google 帳單是不同數字 |
| 發布 | 自動評測與引用驗證通過仍需 owner 人工核准；候選 pending 不可直接發布，正式網站切換另需授權 |

### 程式地圖

下表 `rag/`、`components/` 相對於 `src/push-admin/`；`test/` 相對 repo 根目錄。

| 檔案 | 用途 |
|---|---|
| `rag/pageList.ts` | 頁面順序、分組、頁名、副標、可讀角色，以及放在側欄或上方分頁（`placement`、`viewOf`） |
| `rag/icons.tsx`、`rag/storage.ts` | 側欄圖示（inline SVG）；localStorage 的安全讀寫，只給側欄收合與操作教學用 |
| `rag/Tutorial.tsx`、`rag/tutorialContent.ts` | 右下角的操作教學面板與 12 個步驟的文字；步驟裡引用的按鈕名稱要和頁面一致 |
| `components/Dashboard.tsx`、`components/RagWorkspace.tsx` | 上方四個分頁、依角色顯示、網址 hash；三個 RAG 分頁共用的 Shadow DOM 外框 |
| `rag/guideContent.ts` | 運作原理的文字：五個架構區塊、兩條路線（7 步、8 步）、把關小卡與名詞辭典。白話說明與收起的技術細節分開存放；依後端 `docs/rag.md`（2026-11-19）撰寫，後端架構、模型或門檻改變時要一起更新 |
| `rag/Workspace.tsx`、`rag/ui.tsx`、`rag/hooks.ts` | 外框、可收合側欄、頁首與標題列按鈕（`PageAction`）、對話框（`useId` 產生 id）、讀取失敗與重新讀取（`LoadError`）、toast、讀取與分頁、輪詢 |
| `rag/api/types.ts` | `RagApi` 介面、各種資料型別、`LIMITS`、前端檢查（檔案、網址、設定、段落長度） |
| `rag/api/supabase.ts` | 真實資料層：讀表、`rag-v1` action、上傳 signed URL 流程、段落修正的基準與排除推算 |
| `rag/api/errors.ts` | 錯誤碼與原因碼轉白話中文 |
| `rag/api/status.ts` | 從資料表推出文件狀態、回答類型、知識版本的發布條件 |
| `rag/ConversationView.tsx`、`rag/ConversationList.tsx` | 單次對話詳情（流程、引用、費用）與對話列表 |
| `rag/labels.ts` | 狀態、角色、日期與金額格式 |
| `test/rag-live-preview.html`、`test/rag-live-preview.tsx` | 只供本機驗證的預覽頁（記憶體資料層） |

## C-4 人工標準答案如何生效

1. 在常見問答明確勾選「人工標準答案」，填入問題與答案並啟用；預設未勾選，舊資料維持文件型。
2. 儲存只改草稿。依提示建立新知識版本，從版本詳情確認該 FAQ 確實已收錄。
3. 試問選擇該新版本，輸入相同問題；後端移除空白及末尾一個 `?？。!！` 再比對主問題／alternate_questions。沒有語意或同義詞搜尋。
4. 命中回傳版本凍結的原答案，來源標示「管理者提供」，沒有檢索或模型呼叫。角色、輪次、每日題數、campaign 與模型設定仍須符合既有門檻。
5. 修改草稿不改舊版本或舊對話；要使用新答案，再建新版本。發布仍需既有評測與 owner 人工核准，儲存不等於發布。

文件型 FAQ 仍需有效引用。人工回答不產生假的文件引用；過期對話不保留人工來源細節。後端 migration 必須先完成，再部署 rag-v1，最後才部署本網站；新前端直接讀 manual_answer，不能搭配尚無欄位的 DB。

相關程式：`src/push-admin/rag/pages/QaPage.tsx`、`pages/ReleasesPage.tsx`、`api/types.ts`、`api/supabase.ts`、`api/fake.ts`、`ConversationView.tsx`、`tutorialContent.ts`（簡寫路徑皆相對 src/push-admin/rag）。需求與驗收在 [C-4 規格](openspec/changes/rag-manual-faq/proposal.md)、[設計](openspec/changes/rag-manual-faq/design.md)、[tasks](openspec/changes/rag-manual-faq/tasks.md)。

## 開發與驗證

所有指令從本 repo 根目錄執行。沿用既有 checkout，不先 pull、切分支或建立工作樹。先看 `git status --short --branch`，保留使用者修改；精確 SHA 與遠端差異用 fetch 後的 refs 核對。

| 工作 | 指令／位置 | 結果與邊界 |
|---|---|---|
| 相依套件 | `npm ci` | 使用 package-lock，不覆寫依賴來掩蓋 lock 問題；換環境先確認 Node 與套件 engines |
| 型別 | `npm run type-check` | 11/26 C-4 通過；package.json 沒有獨立 lint script |
| 單元與元件測試 | `npm test -- --maxWorkers=1 --no-file-parallelism` | 11/26 為 266／266、28 檔，mock 資料，不發送推播或付費請求 |
| 正式打包 | `VITE_RAG_ENABLED=true npm run build` | C-4 通過；另核對未啟用時的行為。建置成功不代表 DB 相容或登入驗收 |
| 規格 | `openspec validate rag-manual-faq --strict`；全量 `openspec validate --all --strict` | C-4 通過；全量 7／8，既有 rag-plain-ui-refresh 缺 7 個 scenario，不能稱全綠 |
| 依賴 | `npm audit --audit-level=moderate` | 11/26 既有 8 項（4 moderate、4 high），本次未改依賴，另評估升級 |
| 文件 | `git diff --check`、相對連結／章節／程式路徑與版本表核對 | 本次只改文件，不重跑未變動的完整功能測試 |
| 瀏覽器 | `test/verify-rag-workspace.py`、`test/verify-admin-integration.py` | 需 server／Chromium；全部 mock，不代表真實 Google 登入、Supabase、推播或 Safari 驗收 |

設定只列名稱：`.env.example` 的 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`，以及 `VITE_RAG_ENABLED`。缺少必要 Supabase 設定時瀏覽器端初始化會報錯；公開設定也不必貼入聊天室。service role、Gemini、OneSignal REST key 或 Google 服務帳號私鑰絕不能放 `VITE_*`。

本輪不啟動開發 server、Docker 或瀏覽器，測試單工、同時最多兩個子程序。之後另獲授權才執行 `npm run dev`／`npm run preview`；Vite preview 不套用 Vercel rewrite，入口用 `/push-admin.html`。記錄自啟程序 PID，結束後只清理自己啟動的程序。

## 排查入口

| 現象 | 先查什麼 |
|---|---|
| RAG 尚未啟用 | 該 deployment 的 VITE_RAG_ENABLED 與 build；開關是建置期值，改設定不會改既有產物 |
| 登入後無管理權限 | Auth session、網站白名單、admin_users、Edge／DB 角色；不能為修 UI 擅自開新帳號 |
| FAQ 已儲存但沒命中 | 是否人工型／enabled、是否建立並選取新版本、版本詳情是否收錄、問句是否符合精確正規化 |
| 文件型 FAQ 顯示無引用 | 先核對有效段落與引用；只有人工標準答案可免引用，不能放寬所有來源規則 |
| 請求失敗或回應遺失 | 保留原 body／request key，查問答紀錄與 trace／錯誤碼；跨輪次到期先查既有結果，不盲目重問或重開付費輪次 |
| 上傳成功但文件不可用 | upload_verify、worker queue／lease、解析／embedding job、預算與原檔 hash；signed upload 成功不是處理完成 |
| 使用者頁狀態為「—」或 cursor 失效 | DB 是否含兩份使用者 migration；舊 cursor 需重新讀列表，不自行轉成 offset |
| 檢索 8.17 秒失敗 | 此 C-4 尚未證明根因；取得該 request 的 trace／Edge logs 後另診斷，不把人工 FAQ 命中當檢索已修復 |

## 部署與恢復工作

Vercel 專案 carbon-guide；main push 會觸發 Production、其他分支 push 可能觸發 Preview，純文件 commit 也可能重新部署。Git push 不會部署 Supabase／Cloud Run。Preview 可能受 Vercel Authentication 保護，且並非資料隔離；以當次平台設定確認，不靠舊分享網址判定可用。

恢復部署前依後端 docs/deployment-and-release.md 的 C-4 段落，確認正確 project、獨立測試目標、候選 SHA、DB 定義、測試及 rollback。保留既有公開網站、政策、支援、auth callback、AASA／assetlinks；部署後同時核對 source SHA、HTTP／CSP／匿名拒絕、管理員登入與人工 FAQ 真實功能。知識版本核准／發布與程式部署分開，不自行追加預算或開 App 公開服務。

## 規格與待辦

- rag-manual-faq：實作／本機驗證完成，未部署；C-4 為追蹤入口，詳細狀態與下一步在後端 rag.md。
- rag-plain-ui-refresh：程式已在 main；strict scenario 缺口、真實資料／Safari／手機驗收仍待補。
- rag-conversation-user-status：程式與兩個 DB migration 已有歷史上線證據；確認所有帳號真實畫面後處理歸檔，不把 tasks 狀態直接當成平台狀態。
- rag-admin-live-workspace、rag-architecture-guide、rag-top-tabs 已歸檔，現行主規格在 `openspec/specs/rag-admin-live-workspace/spec.md`。
- Phase 0、靜態工作台及 preview 分支只是歷史；不執行舊 build 來還原公開原型。App 接入、多管理員、Google 帳單整合、加預算仍是獨立需求。

維護時只在本頁寫瀏覽器端架構、在後端 rag.md 寫完整跨端進度；不要再做 Codex／Claude 各一份狀態。每次交接更新 evidence 日期、SHA、已驗／未驗與下一個動作。
