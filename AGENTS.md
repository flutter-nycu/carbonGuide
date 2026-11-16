# carbonGuide 網站 repo：Agent 指南

最後核對：2026-11-16（分支 `preview/rag-admin-live-20261105`；`main`、`develop` 與 Vercel 部署狀態依 GitHub 紀錄）

這份文件給 Codex、Claude 與其他 AI agent 接手時先讀。內容以本 repo 的程式碼、設定與 Git／部署紀錄為準；和程式碼不一致時，先確認實際行為，再在同一個變更裡修正文件。

## 這個 repo 是什麼

CarbonGuide 由兩個 repo 組成，這是其中的網站 repo：

| Repo | 負責 | 文件入口 |
|---|---|---|
| `flutter-nycu/carbonGuide`（本 repo） | 公開網站、推播管理前端、RAG 知識工作台 | 本檔 |
| `githyoung/carbon-navigation` | Flutter App、Supabase migrations 與 Edge Functions（含 RAG 後端 `rag-v1`）、Cloud Run 自動處理、專案文件中心 | 該 repo 的 `AGENTS.md`、`docs/README.md`；RAG 現況與待辦在 `docs/rag.md`（分支 `feature/rag-backend-live`） |

產品、App 架構、MAS 檢測、後端角色矩陣和推播後端都在 App repo 維護。本 repo 只放瀏覽器端的頁面，不放任何 service role key 或 OneSignal REST key。

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
- 帳號限制：目前只允許一個管理員 Email，限制在三個地方：本 repo 的 `src/push-admin/auth.ts` 常數、App repo Edge Functions 的 `supabase/functions/_shared/push-admin-roles.ts` 常數，以及資料庫的 `admin_users_single_email` constraint 和 `is_push_*` 函式。要讓業主或其他人進後台，三處都要改（資料庫要新的 migration），屬於權限變更，需要另外確認。README 裡「Bootstrap the first administrator」的步驟只適用於這一個 Email。
- 呼叫後端：發送、受眾預覽和用量查詢呼叫 Supabase Edge Functions（`send-system-push`、`send-personalized-push`、`preview-push-audience`、`onesignal-usage`）；個人化規則是前端直接更新 `push_rules`，由 RLS 限制只有 editor 以上能改。Functions、資料表、RLS 和角色檢查都在 App repo。
- 環境變數：`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`，都是公開值，範例在 `.env.example`；另有 RAG 開關 `VITE_RAG_ENABLED`（見下一節）。不要把任何伺服器端 secret 放進 `VITE_*`。

## RAG 知識工作台

### 現況（2026-11-16）

- 新版工作台在分支 `preview/rag-admin-live-20261105`（`f17d5b0` 起），**還沒合併、沒上線**。Vercel Preview 建置成功，但 `VITE_RAG_ENABLED` 沒開，畫面只顯示「RAG 後端尚未啟用」。
- 正式站 `main`（`88e4c90`）的 `/push-admin#rag` 仍是舊的靜態示範（假資料）。
- 後端在 App repo `feature/rag-backend-live`，也還沒部署。整體現況、架構、資料流、待辦與已知限制以 App repo 的 `docs/rag.md` 為準，本節只記網站這一側。
- 規格：`openspec/changes/rag-admin-live-workspace/`（32／34，剩 11.2 接真實後端逐頁核對、11.3 合併上線）。

### 怎麼運作

- 程式入口是 `src/push-admin/components/RagWorkspace.tsx`：先通過既有登入與角色檢查，再以 `React.lazy` 載入（獨立 chunk，推播管理不用下載），用 React portal 把 `src/push-admin/rag/Workspace.tsx` 畫進 Shadow DOM。樣式只用 `rag/styles.css`（Tailwind 的 content 排除這個目錄）。正式站的 CSP 是 `style-src 'self'`，元件不能用 inline `style`。
- 開關：只有 `VITE_RAG_ENABLED=true` 才讀寫真實資料；沒有設定時每一頁顯示「RAG 後端尚未啟用」，不送出任何 RAG 請求。後端部署並驗收之前不要在正式站開啟，開啟由 Ken 在 Vercel 設定。
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
- 驗證：`npm test`（含 `src/push-admin/rag/**/*.test.tsx` 與 `test/rag-workspace.test.tsx`）；`test/verify-rag-workspace.py`（Vite dev server＋記憶體資料層，四種寬度、11 頁）；`test/verify-admin-integration.py`（正式 CSP、未啟用狀態、推播回歸）。用法見 README「推播與 RAG 整合工作台」。2026-11-05 全部通過；接上真實後端之後的逐頁核對還沒做。
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

## 開發與驗證

- 安裝：`main` 現有的 `package-lock.json` 和 `package.json` 不同步，npm 12 的 `npm ci` 會拒絕安裝。本機驗證可以改用 `npm install --package-lock=false`，lock 檔不會被改。修正 lock 檔要另外處理，並確認 Vercel 的建置方式。
- 驗證指令：`npm run type-check`、`npm test`、`npm run build`；README 另外列了 `npm audit --audit-level=moderate`。瀏覽器驗證使用 `test/verify-rag-workspace.py`（RAG 各頁）和 `test/verify-admin-integration.py`（整合與推播），後端請求全部 mock，不代表真實登入、推播或 RAG 資料驗收。
- 本機驗證建置時用的是假的 `VITE_*` 值；`/push-admin` 在瀏覽器執行時需要真的值，缺少會直接報錯（`src/push-admin/lib/supabase.ts`）。
- 本機預覽：`npm run preview` 後開啟 `/push-admin.html`；Vite preview 不套用 Vercel 的 redirect/rewrite。跑完要用實際的 PID 停掉 server。
- 執行 agent 的那台主機上，Playwright 的瀏覽器快取由多個工作區共用。執行 `playwright install` 會自動刪掉其他版本的瀏覽器，必要時先列出現況、裝完再比對。WebKit 在那台主機缺系統函式庫，跑不起來，所以 Safari 一直沒有實測。

## 分支與部署現況（2026-11-16）

| 分支 | Commit | 狀態 |
|---|---|---|
| `main` | `88e4c90` | Production（2026-11-05 部署成功）。含 githyoung 的隱私權政策與資料刪除申請文件；RAG 仍是靜態示範 |
| `develop` | `9a479c4` | 與 2026-11-01 的正式站相同，落後 `main` 兩個 commit |
| `preview/rag-admin-live-20261105` | `f17d5b0` 起 | **RAG 工作台新版**，之後在這裡繼續。Preview 建置成功；沒有包含 `main` 上那兩個文件 commit，合併時要一起處理 |
| `preview/rag-admin-uiux-20261101` | `9a479c4` | 靜態示範的介面整理，已上線 |
| `preview/rag-admin-20261024` | `c34f02c` | githyoung 的參考架構（React＋真實 rag-v1），只供參考，不要合併 |
| `preview/rag-phase0` | `14937b1` | Phase 0 靜態原型，歷史紀錄 |

還沒做的事（每一步都要 Ken 授權，完整清單在 App repo `docs/rag.md`）：

1. App repo 的 RAG 後端部署（正式庫 migration、`rag-v1`），以及業主提供 Google Cloud 建置自動處理。
2. 在這個分支的 Preview 打開 `VITE_RAG_ENABLED`，用真實資料逐頁核對（tasks 11.2）。
3. 合併 `develop`、`main`，正式站打開 `VITE_RAG_ENABLED`（tasks 11.3）。
4. 歸檔已完成的 OpenSpec change。
5. `package-lock.json` 不同步、Safari 沒有實測，這兩件事還沒處理。

## 工作規則

- 開始前先跑 `git status --short --branch` 和 `git log -3 --oneline`，分清楚本機 commit、已推送的分支和已部署的版本。
- commit、push、合併 `main`、改 Vercel 設定，都要有當次的明確授權。Ken 的習慣是：問題一題一題確認，等他說開始才改程式。
- 不要提交 secrets、`.env`、`node_modules/`、`dist/` 或 `.vercel/`。
- 非小型的變更先寫 OpenSpec change（`openspec/changes/`），使用 `openspec validate --strict`。
- 回報時附上實際執行過的指令和結果。沒驗證過的項目要明講，例如 Safari、預覽網址是否被保護擋住。
