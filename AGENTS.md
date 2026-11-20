# carbonGuide 網站 repo：Agent 指南

最後核對：2026-11-20 下午。上方分頁「使用者」（原「對話使用者」）列出所有 App 帳號並顯示目前狀態：網站程式基線 `092051a`（PR #1 合併 main），後端正式庫 migration `20261119100000` 與 `20261120100000` 都已套用，兩個 repo 的 main／develop 同步。Git 與 Vercel 狀態分開核對，完整紀錄與「目前狀態總表」在後端 docs/rag.md。

這份文件給 Codex、Claude 與其他 AI agent 接手時先讀。內容以本 repo 的程式碼、設定與 Git／部署紀錄為準；和程式碼不一致時，先確認實際行為，再在同一個變更裡修正文件。

## 這個 repo 是什麼

CarbonGuide 由兩個 repo 組成，這是其中的網站 repo：

| Repo | 負責 | 文件入口 |
|---|---|---|
| `flutter-nycu/carbonGuide`（本 repo） | 公開網站、推播管理前端、RAG 知識工作台 | 本檔 |
| `githyoung/carbon-navigation` | Flutter App、Supabase migrations 與 Edge Functions（含 RAG 後端 `rag-v1`）、Cloud Run 自動處理、專案文件中心 | 該 repo 的 `AGENTS.md`、`docs/README.md`；RAG 現況總表與待辦在 main 的 `docs/rag.md`（`feature/rag-backend-live` 只作歷史追查） |

產品、App 架構、MAS 檢測、後端角色矩陣和推播後端都在 App repo 維護。本 repo 只放瀏覽器端的頁面，不放任何 service role key 或 OneSignal REST key。

## 新 Agent 的閱讀順序

1. 先查 `git status --short --branch`、`git log -3 --oneline`，有網路時 fetch 比對 origin。不要直接 pull、切分支或建立工作樹。
2. 讀本檔與 [README](README.md)；Claude 同樣從 [CLAUDE.md](CLAUDE.md) 回到本檔，不維護另一套進度。
3. 全專案架構讀後端 main 的 [docs/README.md](https://github.com/githyoung/carbon-navigation/blob/main/docs/README.md) 和 [docs/architecture.md](https://github.com/githyoung/carbon-navigation/blob/main/docs/architecture.md)；RAG 部署、報告 ID、費用和剩餘事項以 [docs/rag.md](https://github.com/githyoung/carbon-navigation/blob/main/docs/rag.md) 為準。沒有後端 checkout 時讀這些連結，main 為正式文件來源。
4. 依下方程式地圖、OpenSpec design／tasks 與測試核對實作。先釐清已提交、已推送、已部署、機械評測通過、業主核准及公開發布各自的證據。

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

### 現況（2026-11-20）

一句話：管理員 RAG 工作台已在正式站 https://carbon-guide.vercel.app/push-admin#rag 營運，main 的程式基線是 `092051a`（「使用者」分頁列出所有帳號），後端對應的兩個 migration 已套用到正式庫；App 端未接入，Safari／手機未驗。下列為歷次經過。

- 正式來源改為 main，develop 一併整合；保留 main 的隱私政策及資料刪除文件。沿用既有 preview 分支完成工作，沒有新增分支或工作樹。
- Production 已設定 `VITE_RAG_ENABLED=true`。正式入口 https://carbon-guide.vercel.app/push-admin#rag ；main／develop 已推送，Production READY；正式入口與資產已通過 HTTP 檢查，最終收據見後端 `docs/rag.md`。
- 後端已套用每日 150 題 migration，原 US$5 campaign 無整體到期日，歷史帳本保留。試問／評測共用 UTC 當日計數，臺灣 08:00 換日；工作輪次仍為 20 題／7 天／最高 US$0.50，實際預算不超過總剩餘額度。
- 最新 40／40 候選已依使用者明確授權核准發布。只開既有 owner 管理問答；App 公開服務未接入，不新增其他管理員。
- 本次網站 188／188、TypeScript、RAG 啟用建置通過；配額與輪次餘額競態修正經獨立複審。Safari／手機未驗；11/16 Chrome 完整驗收仍是當日 Preview 的證據。
- 原規格 `rag-admin-live-workspace`（37／37）已歸檔到 `openspec/changes/archive/2026-11-19-rag-admin-live-workspace/`，主規格在 `openspec/specs/rag-admin-live-workspace/spec.md`。Chrome 未執行新正式站登入／試問，另列驗證邊界。
- 第 12 頁「技術架構導覽」在 `preview/rag-architecture-guide`（基準 main `a831af7`）完成，Preview `386f26e` 經使用者檢查後，2026-11-19 依使用者授權 fast-forward 合併 main 並部署正式站。使用者已登入正式站用真實資料驗證。規格已歸檔到 `openspec/changes/archive/2026-11-19-rag-architecture-guide/`，需求併入主規格 `openspec/specs/rag-admin-live-workspace/spec.md`；部署與驗證收據見後端 `docs/rag.md`。
- 上方分頁調整（James 提出，2026-11-19 Ken 選方案 A）：對話使用者與技術架構導覽移出 RAG 側欄，改成管理後台上方分頁，技術架構導覽排最後。在 `preview/rag-top-tabs`（基準 main `c3b2d6a`）完成，2026-11-19 依使用者指示不經 Preview、直接 fast-forward 合併 main 部署正式站並同步 develop；部署收據與驗證見後端 `docs/rag.md`。規格已歸檔到 `openspec/changes/archive/2026-11-19-rag-top-tabs/`，需求併入主規格 `openspec/specs/rag-admin-live-workspace/spec.md`；正式站的真實資料畫面待使用者登入確認。
- 對話使用者狀態（James 在 Multica C-3 提出，2026-11-19）：列表加「目前狀態」欄與結果分布，個人頁在對話列表上方顯示帳號狀態、角色、加入與最近登入、今日用量、進行中的測試輪次及結果分布。後端 `conversation_users` 每列多一個 `status`（後端 migration `20261119100000_rag_conversation_user_status.sql`，Edge Function 不變）。規格在 `openspec/changes/rag-conversation-user-status/`。2026-11-20 依 James 指示部署網站正式站（deployment `7931096289`）；同日依 Ken 授權用 Supabase MCP 在正式庫套用 migration，套用前後兩份 SQL 測試都通過並 rollback，後端分支合併 main。後端套用前狀態欄顯示「—」，套用後應顯示真實狀態；管理員登入確認真實畫面後再歸檔規格（tasks 6.4）。部署與套用收據見後端 `docs/rag.md`。
- 對話使用者列出所有帳號、分頁改名「使用者」（James 2026-11-20 補充並確認畫面；網址仍是 `#conversations`。同日 James 與 Ken 確認 owner 可看到所有 App 帳號的資料，Ken 用 Supabase MCP 在正式庫套用 migration，三份 SQL 測試前後都通過並 rollback；PR #1 `092051a` fast-forward 合併 main 部署正式站，develop 同步。部署與驗證收據見後端 `docs/rag.md`）：列表改成所有帳號，有提問的排前面（最近提問在上），其他帳號依加入時間排列，顯示「0 次」「還沒有對話」，角色「一般使用者」；列表上的今日用量只在當天有題數時顯示。後端新 migration `20261120100000_rag_conversation_users_all_accounts.sql`（cursor 多一個分組鍵，舊 cursor 回「列表已經變動，請重新整理頁面」）。這會讓 owner 看得到所有 App 帳號的 email 與登入時間，已於 2026-11-20 經人工確認。新網站搭配舊後端仍只列有提問的人，舊網站搭配新後端會多出 0 次的帳號、時間顯示「—」，兩邊可以先後上線。
- 「使用者」分頁的分頁與字體（James 2026-11-20 下午）：每頁 10 位，上一頁／下一頁／頁碼，已知總數時顯示「第 N／M 頁，共 X 位」；表格文字 14px。只改網站：後端仍以 cursor 每次給 50 位，頁數用完才取下一批，不送頁碼或 offset。

### 怎麼運作

- 程式入口是 `src/push-admin/components/RagWorkspace.tsx`：先通過既有登入與角色檢查，再以 `React.lazy` 載入（獨立 chunk，推播管理不用下載），用 React portal 把 `src/push-admin/rag/Workspace.tsx` 畫進 Shadow DOM。樣式只用 `rag/styles.css`（Tailwind 的 content 排除這個目錄）。正式站的 CSP 是 `style-src 'self'`，元件不能用 inline `style`。
- 開關：只有 `VITE_RAG_ENABLED=true` 才讀寫真實資料；沒有設定時 01–10 頁與使用者分頁顯示「RAG 後端尚未啟用」，技術架構導覽照常顯示教學內容，只有「目前的實際設定」一區顯示尚未啟用。任何一頁都不送出 RAG 請求。後端部署並驗收之前不要在正式站開啟，11/19 已授權開啟 Production；實際部署證據見後端 docs/rag.md。
- 資料層 `rag/api/`：`supabase.ts` 在 RLS 下直接讀表，所有寫入都經 App repo 的 `rag-v1` Edge Function；`fake.ts` 是記憶體版，只給測試和瀏覽器驗證用，不會被打包。
- 不能重複的操作（試問、建立輪次、建立版本、開始評測、登記網址、審核、發布、改回、停用）都帶請求鍵（`requestKeys.ts`，存在元件外，成功之後才清掉）。重送時沿用第一次送出的內容，因為後端只接受同一個請求鍵、同樣內容的重送；試問回來是「還在處理中」時保留請求鍵，避免重複扣款。
- 頁面第一次打開後保持掛載；被隱藏時會關掉對話框、停止輪詢和評測。輪詢只在頁面可見時每 15 秒一次。
- 上方分頁（`components/Dashboard.tsx`）依序是推播管理、RAG 知識工作台、使用者、技術架構導覽；使用者只給 owner。後三個共用同一個 `RagWorkspace`，由 `Workspace` 的 `view` 決定顯示側欄 10 頁或單一全寬頁，切換分頁不卸載頁面。網址 `#push`、`#rag`、`#conversations`、`#guide` 直接開分頁，角色看不到的分頁不會被網址打開。
- 頁面與可讀的角色（01–10 在 RAG 側欄，使用者與技術架構導覽在上方分頁）：

| 頁 | 檔案 | 可以看的角色 |
|---|---|---|
| 01 知識庫與文件 | `pages/DocumentsPage.tsx` | 全部；editor 以上可改分類、修正或排除段落 |
| 02 匯入與預檢 | `pages/ImportPage.tsx` | 全部；editor 以上可上傳 PDF／DOCX／TXT、登記 https PDF 網址 |
| 03 檢索試問台 | `pages/PlaygroundPage.tsx` | owner |
| 04 RAG 評測 | `pages/EvaluationPage.tsx` | owner |
| 05 知識版本 | `pages/ReleasesPage.tsx` | owner、editor（只有 owner 能建立、審核、發布） |
| 06 人格設定 | `pages/PersonasPage.tsx` | 全部；editor 以上可編輯 |
| 07 System Prompt | `pages/PromptPage.tsx` | 全部；editor 以上可編輯 |
| 08 基本通用 QA | `pages/QaPage.tsx` | 全部；editor 以上可編輯與核對引用 |
| 09 進階檢索設定 | `pages/SettingsPage.tsx` | 全部；只有 owner 能改 |
| 10 互動紀錄 | `pages/LogsPage.tsx` | owner |
| 上方分頁：使用者（原「對話使用者」） | `pages/ConversationsPage.tsx` | owner（其他角色看不到這個分頁） |
| 上方分頁：技術架構導覽 | `pages/ArchitecturePage.tsx`、`guideContent.ts` | 全部；「目前的實際設定」只讀，知識版本只查給 owner／editor，AI 預算只查給 owner，不呼叫付費模型 |

### 資料與重送契約

| 行為 | 必須保留的契約 |
|---|---|
| 上傳 | `upload_begin` 取 signed URL → 瀏覽器上傳 → `upload_verify` 核對 SHA-256 → 後端觸發 worker；上傳成功不等於解析／向量化成功 |
| 建立版本 | 只凍結有效文件與引用有效段落的 QA；disabled 驗收文件及其 QA 不得進入新 snapshot，既有 snapshot 不回寫 |
| 評測 | 題組與輪次固定；先扣除當日已用額度，進度只計 terminal requests。回應遺失時沿用原輪次／批次／請求鍵，離頁停止前端接續，不清除已完成結果 |
| 對話分頁 | 後端 cursor 綁定 cutoff、使用者與來源；保留 cursor，換篩選重開列表，不用 offset 或自行拼頁碼。「使用者」分頁的頁碼只在瀏覽器裡切已載入的資料，向後端仍只送 cursor |
| 使用者狀態 | 帳號、今日用量（UTC 日，試問與評測合計）與輪次以查詢當下計算；結果分布跟對話次數用同一個 cutoff，四項合計等於次數。後端沒提供 `status` 時顯示「—」，不補 0 或「正常」 |
| 費用 | 未取得模型用量不得顯示成零；呈現已知估計與未知筆數。campaign 預留、模型估計與 Google 帳單是不同數字 |
| 發布 | 自動評測與引用驗證通過仍需 owner 人工核准；候選 pending 不可直接發布，正式網站切換另需授權 |

### 程式地圖

| 檔案 | 用途 |
|---|---|
| `rag/pageList.ts` | 頁面順序、標題、副標、可讀角色，以及放在側欄或上方分頁（`placement`、`viewOf`） |
| `components/Dashboard.tsx`、`components/RagWorkspace.tsx` | 上方四個分頁、依角色顯示、網址 hash；三個 RAG 分頁共用的 Shadow DOM 外框 |
| `rag/guideContent.ts` | 技術架構導覽的文字：五個架構區塊、兩條路線（7 步、8 步）、把關小卡與名詞辭典。依後端 `docs/rag.md`（2026-11-19）撰寫，後端架構、模型或門檻改變時要一起更新 |
| `rag/Workspace.tsx`、`rag/ui.tsx`、`rag/hooks.ts` | 外框、導覽、對話框（`useId` 產生 id）、toast、讀取與分頁、輪詢 |
| `rag/api/types.ts` | `RagApi` 介面、各種資料型別、`LIMITS`、前端檢查（檔案、網址、設定、段落長度） |
| `rag/api/supabase.ts` | 真實資料層：讀表、`rag-v1` action、上傳 signed URL 流程、段落修正的基準與排除推算 |
| `rag/api/errors.ts` | 錯誤碼與原因碼轉白話中文 |
| `rag/api/status.ts` | 從資料表推出文件狀態、回答類型、知識版本的發布條件 |
| `rag/ConversationView.tsx`、`rag/ConversationList.tsx` | 單次對話詳情（流程、引用、費用）與對話列表 |
| `rag/labels.ts` | 狀態、角色、日期與金額格式 |
| `test/rag-live-preview.html`、`.tsx` | 只供本機驗證的預覽頁（記憶體資料層） |

### 不做的事與驗證

- 不做：App 端、計算與係數流程、Google 帳單匯入、多位管理員。
- 驗證：`npm test`（含 `src/push-admin/rag/**/*.test.tsx` 與 `test/rag-workspace.test.tsx`）；`test/verify-rag-workspace.py`（Vite dev server＋記憶體資料層，四種寬度、側欄 10 頁與兩個上方分頁、導覽頁鍵盤操作）；`test/verify-admin-integration.py`（正式 CSP、未啟用狀態、推播回歸）。驗證邊界見 README「開發與驗證」。2026-11-05 mock 驗證通過；2026-11-16 type-check、188 項測試（24 檔；11/19 重測）、build 及 npm ci 通過，真實 Google 登入、網址匯入、Chrome 原生選檔與 signed URL 上傳、自動處理、試問、引用與費用明細已驗證。實際逐頁結果及未驗證邊界見 App repo `docs/rag.md`；Safari 與本次手機版面未重測。2026-11-19 導覽頁分支：type-check、205 項測試（26 檔）、啟用 RAG 的 build 通過；兩支瀏覽器腳本以本機 headless Chromium 跑過（記憶體資料層與未啟用 RAG 的 build，含正式 CSP），不是真實資料或 Safari／實機手機驗收。2026-11-19 上方分頁分支：type-check、218 項測試（27 檔）、啟用 RAG 的 build 通過；兩支瀏覽器腳本重跑通過（四種寬度、上方分頁網址與角色、editor 看不到對話使用者、分頁頁全寬、鍵盤焦點框），同樣是 mock。2026-11-20 對話使用者狀態（`e92e010`）：推送前 type-check、228 項測試（27 檔）、啟用 RAG 的 build 通過；正式程式包在本機 headless Chromium 模擬新舊後端各一次通過，也是 mock。2026-11-20 下午列出所有帳號（`092051a`）：合併前在本機重跑 type-check 與 231 項測試（27 檔，單執行緒）通過，同一 commit 的 Vercel Preview 建置成功；本輪沒有啟動本機瀏覽器或伺服器。
- 舊的靜態示範（`rag/app.js`、`index.html`）在這個分支已經刪除；`openspec/changes/rag-admin-static-uiux-cleanup/`（已完成、未歸檔）與 `rag-admin-integration/` 是歷史紀錄。下方 Phase 0 原型也是歷史紀錄，其建置與驗證工具只適用原分支。

## AI 氣候教練 Phase 0 原型（原分支歷史紀錄）

- 用途：給業主審閱畫面和操作流程的靜態原型。全部是假資料，不接 Supabase、Gemini 或任何 API，重新整理就回到預設。
- 位置：原始獨立頁保留在分支 `preview/rag-phase0`；不以 Git 分支狀態推斷正式站目前的部署內容。
- 規格：`openspec/changes/rag-coach-phase0-preview/`，包含 proposal、spec、design、tasks。tasks 34 項都已完成；change 還沒歸檔，等業主回饋。
- 原始碼：`openspec/changes/rag-coach-phase0-preview/source/`（`app.js`、`style.css`、`head.html`、`body.html`）。
- 建置：改完 `source/` 之後執行 `source/build.py`，它會產生 `public/rag-preview/index.html`，從現有檔案取出內嵌 Logo，並依 `<script>` 內容重算 CSP 的 sha256。不要直接改產出的 HTML：script 內容變了而 hash 沒有重算，CSP 會擋掉整段 JS，頁面會變成空白。
- 驗證：`openspec/changes/rag-coach-phase0-preview/verify/verify_preview.py`（Python Playwright、Chromium），參數可以是檔案路徑或網址，加 `--screens 資料夾` 會輸出截圖。Phase 0 完成時最後一次執行，52 個情境全數通過，涵蓋 1440、1150、1024、768、390 寬度，以及 390×664。
- 內容：
  - 「氣候教練」頁：390×844 手機框，App 主頁入口卡片 → 選教練人格 → 對話
  - 「管理後台」：知識庫、人格、System Prompt、RAG 設定、基本通用 QA、測試對話、互動紀錄、服務連線
  - 「展示說明」：給業主的操作順序
  - 頁面設了 `noindex`，頂部有「示範原型，全部為假資料」橫幅
- 文字：畫面上的中文依 humanizer-zh-tw 改寫過，英文小標維持原樣。之後改文案請沿用同樣原則。
- 需求來源、各項決策和後續階段寫在 App repo 的 `docs/roadmap.md`「AI 氣候教練（RAG）進度」。

## 部署

- Vercel 專案 `carbon-guide`，團隊 FlutterMan's projects（`fluttermans-projects`），Hobby 方案。
- 推到 `main` 會直接部署 Production，也就是正式站 `carbon-guide.vercel.app`。App 的 Associated Domains、隱私權政策和密碼重設都靠這個網域。沒有明確授權，不要推 `main`。
- 推其他分支會建立 Preview 部署。專案開著 Vercel Authentication，預覽網址沒登入時會 302 導向 `vercel.com/sso-api`。要給外部的人看，需要專案擁有者或 Developer 以上角色的成員在部署頁按 Share，選 Anyone with the link。Hobby 方案每個帳號總共只能建立一個分享連結。
- 專案開了 Deployment Retention，舊的預覽部署過一段時間會被刪除；分享連結指向的部署被刪除後，連結也會失效。
- Vercel 回報的部署狀態可以從 GitHub deployments API 查到，環境分成 Production 和 Preview。
- 功能分支 push 可能建立新的 Preview。必須核對 deployment source SHA、target 與 READY；本頁的既有 Chrome 驗收屬於指定部署，不能自動移作新部署證據。Git push 不會部署 Supabase 或 Cloud Run。

## 開發與驗證

- 安裝：本分支的 `package-lock.json` 已同步，2026-11-16 `npm ci` 與 Vercel Preview 建置通過；不能推論 main 的 lockfile 已修復。
- 驗證指令：`npm run type-check`、`npm test`、`npm run build`；README 另外列了 `npm audit --audit-level=moderate`。瀏覽器驗證使用 `test/verify-rag-workspace.py`（RAG 各頁）和 `test/verify-admin-integration.py`（整合與推播），後端請求全部 mock，不代表真實登入、推播或 RAG 資料驗收。
- 本機驗證建置時用的是假的 `VITE_*` 值；`/push-admin` 在瀏覽器執行時需要真的值，缺少會直接報錯（`src/push-admin/lib/supabase.ts`）。
- 本機預覽：`npm run preview` 的 `/push-admin.html` 不套用 Vercel redirect/rewrite。2026-11-19 正式切換那一輪禁止啟動本機 server、Docker 或新瀏覽器；之後每一輪是否可以啟動，依當次授權。
- 過去 Linux 驗證環境曾缺 WebKit 系統函式庫；這不是目前 macOS Safari 的診斷。本輪只操作原本開啟的 Chrome，Safari 與手機版面仍無新證據。不要為此自行安裝或啟動瀏覽器。

## 分支與接手

main 是正式網站來源；develop 依使用者授權 fast-forward 到 main，兩者相同（最近一次 2026-11-20）。新工作從 main 開始。`preview/rag-architecture-guide`、`preview/rag-admin-live-20261105`（停在 `a831af7`，11 頁）、`preview/rag-phase0` 等 preview 分支只作歷史追查。最新遠端 SHA、deployment ID 與未驗證邊界統一見後端 main 的 `docs/rag.md` 最前面的「目前狀態總表」；不把舊 Preview URL 或 Git push 成功當成 Production 已驗收。

本次沒有啟動本機 server、Docker 或新瀏覽器，測試單工、同時最多兩個子程序。既有 Chrome 只依當次授權用 Computer Use；不自行啟動 Safari，不關閉使用者原有程式或雲端排程。

之後待辦：管理員登入確認「使用者」分頁列出所有帳號的真實畫面後，歸檔 `rag-conversation-user-status`（狀態欄的真實畫面 11/20 已由 James 截圖確認）、Safari／手機驗收、其餘歷史 OpenSpec change 的歸檔時機，以及另立需求的 App／多管理員。原 Phase 0 和參考分支僅供歷史追查，不執行舊 build 還原原型。

已知重送邊界：試問回應遺失又跨過輪次到期時，先查互動紀錄，不盲目重問；跨到期 pending ask 恢復尚未擴充。新建輪次遭明確 budget_exhausted 拒絕可重讀餘額；不明或網路錯誤保持原 body 與 key。

2026-11-19 正式程式部署：來源 `65b4da7ec7a49aaf20eb79fd956a0746b7294ba0`，Vercel `dpl_FtxQRmB7TC1RqasKtWmG42qDcmwV` READY，正式 alias 為 carbon-guide.vercel.app。七個公開入口 HTTP 200，RAG 真實資料層含每日 150／infinity 邏輯，匿名 rag-v1 回 401。這些是 HTTP／部署證據，不等於新正式站的瀏覽器端驗收；Computer Use 未找到既有 Chrome，未自行啟動。後續純文件提交的最新部署收據以後端 docs/rag.md 為準。
