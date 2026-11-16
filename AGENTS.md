# carbonGuide 網站 repo：Agent 指南

最後核對：2026-11-16（工作分支 `preview/rag-admin-live-20261105`；提交前已 fetch 確認遠端基線。Git 與 Vercel 部署須分別核對）

這份文件給 Codex、Claude 與其他 AI agent 接手時先讀。內容以本 repo 的程式碼、設定與 Git／部署紀錄為準；和程式碼不一致時，先確認實際行為，再在同一個變更裡修正文件。

## 這個 repo 是什麼

CarbonGuide 由兩個 repo 組成，這是其中的網站 repo：

| Repo | 負責 | 文件入口 |
|---|---|---|
| `flutter-nycu/carbonGuide`（本 repo） | 公開網站、推播管理前端、RAG 知識工作台 | 本檔 |
| `githyoung/carbon-navigation` | Flutter App、Supabase migrations 與 Edge Functions（含 RAG 後端 `rag-v1`）、Cloud Run 自動處理、專案文件中心 | 該 repo 的 `AGENTS.md`、`docs/README.md`；RAG 現況與待辦在 `docs/rag.md`（分支 `feature/rag-backend-live`） |

產品、App 架構、MAS 檢測、後端角色矩陣和推播後端都在 App repo 維護。本 repo 只放瀏覽器端的頁面，不放任何 service role key 或 OneSignal REST key。

## 新 Agent 的閱讀順序

1. 先查 `git status --short --branch`、`git log -3 --oneline`，有網路時 fetch 比對 origin。不要直接 pull、切分支或建立工作樹。
2. 讀本檔與 [README](README.md)；Claude 同樣從 [CLAUDE.md](CLAUDE.md) 回到本檔，不維護另一套進度。
3. 全專案架構讀後端功能分支的 [docs/README.md](https://github.com/githyoung/carbon-navigation/blob/feature/rag-backend-live/docs/README.md) 和 [docs/architecture.md](https://github.com/githyoung/carbon-navigation/blob/feature/rag-backend-live/docs/architecture.md)；RAG 部署、報告 ID、費用和剩餘事項以 [docs/rag.md](https://github.com/githyoung/carbon-navigation/blob/feature/rag-backend-live/docs/rag.md) 為準。沒有後端 checkout 時讀這些連結，不改讀 main 的舊文件。
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

### 現況（2026-11-16）

- 新版工作台在分支 `preview/rag-admin-live-20261105`；已驗收 Preview 以 `a1d5360` 加同輪修正建立，程式與文件納入本次功能分支交接。僅此分支 Preview 開啟 `VITE_RAG_ENABLED=true`，尚未合併或切換 Production。已驗收部署 `dpl_FCNfU7UyuYeHJtmdK1jNu42Hy5Qu`，網址 https://carbon-guide-t1ufi6m6d-fluttermans-projects.vercel.app/push-admin#rag ，保留 Vercel Authentication。
- 正式站 `main`（`88e4c90`）的 `/push-admin#rag` 仍是舊的靜態示範（假資料）。
- 後端在 App repo `feature/rag-backend-live`，正式 Supabase、Cloud Run、即時觸發與每小時排程已部署並驗證。整體現況、架構、資料流、待辦與已知限制以 App repo 的 `docs/rag.md` 為準，本節只記網站這一側。
- 規格：`openspec/changes/rag-admin-live-workspace/`（33／34，11.2 真實 Preview 逐頁核對完成；剩 11.3 合併上線。內容核准與 Safari 驗收仍另行追蹤）。

### 怎麼運作

- 程式入口是 `src/push-admin/components/RagWorkspace.tsx`：先通過既有登入與角色檢查，再以 `React.lazy` 載入（獨立 chunk，推播管理不用下載），用 React portal 把 `src/push-admin/rag/Workspace.tsx` 畫進 Shadow DOM。樣式只用 `rag/styles.css`（Tailwind 的 content 排除這個目錄）。正式站的 CSP 是 `style-src 'self'`，元件不能用 inline `style`。
- 開關：只有 `VITE_RAG_ENABLED=true` 才讀寫真實資料；沒有設定時每一頁顯示「RAG 後端尚未啟用」，不送出任何 RAG 請求。後端部署並驗收之前不要在正式站開啟，本次已獲授權開啟指定分支 Preview；Production 尚未切換。
- 資料層 `rag/api/`：`supabase.ts` 在 RLS 下直接讀表，所有寫入都經 App repo 的 `rag-v1` Edge Function；`fake.ts` 是記憶體版，只給測試和瀏覽器驗證用，不會被打包。
- 不能重複的操作（試問、建立輪次、建立版本、開始評測、登記網址、審核、發布、改回、停用）都帶請求鍵（`requestKeys.ts`，存在元件外，成功之後才清掉）。重送時沿用第一次送出的內容，因為後端只接受同一個請求鍵、同樣內容的重送；試問回來是「還在處理中」時保留請求鍵，避免重複扣款。
- 頁面第一次打開後保持掛載；被隱藏時會關掉對話框、停止輪詢和評測。輪詢只在頁面可見時每 15 秒一次。
- 11 頁與可讀的角色：

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
| 11 對話使用者 | `pages/ConversationsPage.tsx` | owner |

### 資料與重送契約

| 行為 | 必須保留的契約 |
|---|---|
| 上傳 | `upload_begin` 取 signed URL → 瀏覽器上傳 → `upload_verify` 核對 SHA-256 → 後端觸發 worker；上傳成功不等於解析／向量化成功 |
| 建立版本 | 只凍結有效文件與引用有效段落的 QA；disabled 驗收文件及其 QA 不得進入新 snapshot，既有 snapshot 不回寫 |
| 評測 | 題組與輪次固定；先扣除當日已用額度，進度只計 terminal requests。回應遺失時沿用原輪次／批次／請求鍵，離頁停止前端接續，不清除已完成結果 |
| 對話分頁 | 後端 cursor 綁定 cutoff、使用者與來源；保留 cursor，換篩選重開列表，不用 offset 或自行拼頁碼 |
| 費用 | 未取得模型用量不得顯示成零；呈現已知估計與未知筆數。campaign 預留、模型估計與 Google 帳單是不同數字 |
| 發布 | 自動評測與引用驗證通過仍需 owner 人工核准；候選 pending 不可直接發布，正式網站切換另需授權 |

### 程式地圖

| 檔案 | 用途 |
|---|---|
| `rag/pageList.ts` | 11 頁的順序、標題、副標與可讀角色 |
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
- 驗證：`npm test`（含 `src/push-admin/rag/**/*.test.tsx` 與 `test/rag-workspace.test.tsx`）；`test/verify-rag-workspace.py`（Vite dev server＋記憶體資料層，四種寬度、11 頁）；`test/verify-admin-integration.py`（正式 CSP、未啟用狀態、推播回歸）。驗證邊界見 README「開發與驗證」。2026-11-05 mock 驗證通過；2026-11-16 type-check、183 項測試（24 檔）、build 及 npm ci 通過，真實 Google 登入、網址匯入、Chrome 原生選檔與 signed URL 上傳、自動處理、試問、引用與費用明細已驗證。實際逐頁結果及未驗證邊界見 App repo `docs/rag.md`；Safari 與本次手機版面未重測。
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
- 本機預覽手冊只供未來另獲授權時使用：`npm run preview` 的 `/push-admin.html` 不套用 Vercel redirect/rewrite。本輪禁止啟動本機 server、Docker 或新瀏覽器；不可自動執行瀏覽器驗證腳本。
- 過去 Linux 驗證環境曾缺 WebKit 系統函式庫；這不是目前 macOS Safari 的診斷。本輪只操作原本開啟的 Chrome，Safari 與手機版面仍無新證據。不要為此自行安裝或啟動瀏覽器。

## 分支與部署現況（2026-11-16）

| 分支 | Commit | 狀態 |
|---|---|---|
| `main` | `88e4c90` | Production（2026-11-05 部署成功）。含 githyoung 的隱私權政策與資料刪除申請文件；RAG 仍是靜態示範 |
| `develop` | `9a479c4` | 與 2026-11-01 的正式站相同，落後 `main` 兩個 commit |
| `preview/rag-admin-live-20261105` | `f17d5b0` 起 | **RAG 工作台新版**，之後在這裡繼續。真實 Preview 已部署（`a1d5360` 加同輪修正，納入本次交接）；沒有包含 `main` 上那兩個文件 commit，合併時要一起處理 |
| `preview/rag-admin-uiux-20261101` | `9a479c4` | 靜態示範的介面整理，已上線 |
| `preview/rag-admin-20261024` | `c34f02c` | githyoung 的參考架構（React＋真實 rag-v1），只供參考，不要合併 |
| `preview/rag-phase0` | `14937b1` | Phase 0 靜態原型，歷史紀錄 |

剩餘事項（完整證據在 App repo `docs/rag.md`）：

1. 真實後端與 Preview 已部署；Computer Use 操作既有 Chrome 的原生選檔及 signed URL 上傳補驗成功，自動解析與向量化完成，驗收檔已停用並排除候選。Safari 與本次手機版面未實測。
2. 先前 40／40 候選因語意問題退回；本輪已修正分類、摘要範圍、不確定性與術語，另建候選以 Chrome 跑完同題組 40／40，數字錯誤與版本外來源 0。舊報告與退回收據保留；本輪內容複核狀態見 App repo docs/rag.md，尚未代替業主核准或發布。舊 503 文件已恢復。原 US$5 campaign 剩餘約 US$0.38；使用者明確授權本次輪次每日 150、至 2026-11-17 14:00，當日累計 142，未重設紀錄。
3. 本次使用者已授權將程式與完整交接 commit 並 push 至現有功能分支；合併 `develop`、`main` 及 Production 切換尚未授權或執行。不得新增分支或 worktree。
4. 舊 OpenSpec 尚未歸檔。

## 工作規則

- 開始前先跑 `git status --short --branch` 和 `git log -3 --oneline`，分清楚本機 commit、已推送的分支和已部署的版本。
- commit、push、合併 `main`、改 Vercel 設定，都要有當次明確授權。本次已授權兩個現有功能分支 commit／push；不延伸成未來任務的永久授權。推送明列目標分支，不 force push。
- 本輪最多同時兩個子程序；使用單 worker 測試。可直接以 Node 執行 Vitest，指定 `--maxWorkers=1 --no-file-parallelism --pool=threads`，避免額外 npm 父程序與多個 workers。
- 不啟動本機瀏覽器、server 或 Docker，不新增分支／worktree。關閉程序只針對 Agent 確實啟動的任務程序；保留使用者原本的 Chrome、其他 App 與雲端排程。
- 不要提交 secrets、`.env`、`node_modules/`、`dist/` 或 `.vercel/`。
- 非小型的變更先寫 OpenSpec change（`openspec/changes/`），使用 `openspec validate --strict`。
- 回報時附上實際執行過的指令和結果。沒驗證過的項目要明講，例如 Safari、預覽網址是否被保護擋住。
