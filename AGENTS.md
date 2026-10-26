# carbonGuide 網站 repo：Agent 指南

最後核對：2026-10-26（分支 `preview/rag-admin-20261024`，owner 小量試問階段；本輪尚未 commit／push）

這份文件給 Codex、Claude 與其他 AI agent 接手時先讀。內容以本 repo 的程式碼、設定與 Git／部署紀錄為準；和程式碼不一致時，先確認實際行為，再在同一個變更裡修正文件。

## 這個 repo 是什麼

CarbonGuide 由兩個 repo 組成，這是其中的網站 repo：

| Repo | 負責 | 文件入口 |
|---|---|---|
| `flutter-nycu/carbonGuide`（本 repo） | 公開網站、推播管理前端、AI 氣候教練的靜態原型 | 本檔 |
| `githyoung/carbon-navigation` | Flutter App、Supabase migrations 與 Edge Functions、專案文件中心 | 該 repo 的 `AGENTS.md` 與 `docs/README.md` |

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
| `src/push-admin/rag/` | `/push-admin#rag` | 登入後掛載的 React RAG 工作台；舊 `/rag-preview/` 導向此入口 |
| `openspec/` | 不部署 | OpenSpec 規格與 change |

建置設定：`vite.config.ts` 列出 5 個 HTML entry；`public/` 底下的檔案由 Vite 原樣複製，不經過打包。`vercel.json` 設定 `/push-admin.html` 轉到 `/push-admin` 的 redirect、`/push-admin` 與 `/auth/callback` 的 rewrite 和安全 header（CSP、`X-Frame-Options`、`noindex` 等），以及 AASA 的 `Content-Type`。`src/push-admin/deployment.test.ts` 只檢查 `/push-admin` 的 redirect、rewrite、CSP 和 `X-Frame-Options`；`/auth/callback` 和 AASA 的設定目前沒有測試。

## 推播管理前端

- 技術：React 18、TypeScript、Vite、Tailwind、`@supabase/supabase-js`。
- 登入：Supabase Auth 的 Google OAuth。登入後查 `admin_users` 取得角色。
- 角色：`owner`、`editor` 可以看到系統推播、個人化規則、發送紀錄、推播用量四個分頁；`viewer` 只看得到發送紀錄和推播用量（見 `src/push-admin/auth.ts`）。
- 帳號限制：目前只允許一個管理員 Email，限制在三個地方：本 repo 的 `src/push-admin/auth.ts` 常數、App repo Edge Functions 的 `supabase/functions/_shared/push-admin-roles.ts` 常數，以及資料庫的 `admin_users_single_email` constraint 和 `is_push_*` 函式。要讓業主或其他人進後台，三處都要改（資料庫要新的 migration），屬於權限變更，需要另外確認。README 裡「Bootstrap the first administrator」的步驟只適用於這一個 Email。
- 呼叫後端：發送、受眾預覽和用量查詢呼叫 Supabase Edge Functions（`send-system-push`、`send-personalized-push`、`preview-push-audience`、`onesignal-usage`）；個人化規則是前端直接更新 `push_rules`，由 RLS 限制只有 editor 以上能改。Functions、資料表、RLS 和角色檢查都在 App repo。
- 公開連線值為 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`；RAG 另用 `VITE_RAG_ENABLED` 與 `VITE_RAG_PROJECT_REF` 明確指定啟用目標，範例在 `.env.example`。不要把任何伺服器端 secret 放進 `VITE_*`。

## 新版 RAG 工作台

- `RagWorkspace.tsx` 掛載七個原生 React 畫面；`repository.ts`、`v1.ts` 定義契約，`supabase-*.ts` 為資料邊界。樣式以 `.rag-v1` 隔離。舊原型僅供歷史回歸。
- 私有上傳、URL 登記、修訂、QA、人格、提示詞、計算、不可變快照、審核／發布／回滾、輪次、評測及成本管理使用 App repo 的 `rag-v1` 與 RAG RPC。本機 CLI 負責解析及文件 embedding，沒有常駐雲端 worker。
- `VITE_RAG_ENABLED=true` 且 `VITE_RAG_PROJECT_REF` 與 Supabase URL 相符才連線。使用者已確認 `hxsrineeirmxpoovcrba` 可用於本次測試；既有 App／推播資料及管理員白名單保留獨立用途。
- 本輪規格為 `openspec/changes/rag-v1-review-ready/`；[使用說明](docs/rag-pilot-user-guide.zh-TW.md) 為操作與流程入口。commit、部署及真實評測以當次收尾證據為準，不由本機功能推定。
- 快照固定來源、profile、模型、QA、人格、提示詞、設定及計算資料。修改影響後續快照，既有版本與請求維持可追溯。模型選原文窗口，伺服器處理引用並驗證數字單位。
- 真實內容核准權留給使用者；ready 不代表人工通過。一般回答服務保持關閉，Flutter 最後接入。合成發布測試必須交易回滾。
- 本輪共用核准的 US$5 campaign；未知結果保留預留且不自動重試，禁止另建 campaign 或清空用量規避上限。舊 pilot 額度及兩筆已用紀錄獨立保留。
- 詳細問答／流程保存 30 天，費用帳本另保留。`reports/` 可能含原文及私人診斷，僅存本機；不提交原檔、API key、JWT 或原始模型回應。

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

- **Orca Terminal 的 computer use：** 先探索並使用已載入的 `windows_desktop` MCP。以 `Snapshot` 取得最新畫面，再依當次元素／座標執行一次 `Click`／`Type` 等操作，立即重新 `Snapshot` 驗證；擷取畫面用 `Screenshot`。2026-10-25 已實測可切換 Chrome 並操作 Supabase。若 `@oai/sky` 回報 native pipe unavailable，不要據此判定整個 computer use 不可用；先測 Windows MCP。診斷與驗證範圍見 [Orca 桌面操作紀錄](reports/rag-gemini-smoke/computer-use-orca.md)。保留當次工具的安全與確認規則。

- 安裝以本分支 `package-lock.json` 為準，使用 `npm ci`；Windows PowerShell 可用 `npm.cmd`。本分支已修復建置依賴的 moderate 弱點並鎖定版本；不代表 main 已同步。
- 驗證指令：`npm run type-check`、`npm test`、`npm run build`、`npm audit --audit-level=moderate`。現行 React 瀏覽器驗證使用 `test/verify-rag-react.py`，後端請求全部 mock；舊 `test/verify-admin-integration.py` 只適用原型，不代表真實登入或推播驗收。
- 本機驗證建置時用的是假的 `VITE_*` 值；`/push-admin` 在瀏覽器執行時需要真的值，缺少會直接報錯（`src/push-admin/lib/supabase.ts`）。
- 本機預覽：`npm run preview` 後開啟 `/push-admin.html`；Vite preview 不套用 Vercel 的 redirect/rewrite。跑完要用實際的 PID 停掉 server。
- 執行 agent 的那台主機上，Playwright 的瀏覽器快取由多個工作區共用。執行 `playwright install` 會自動刪掉其他版本的瀏覽器，必要時先列出現況、裝完再比對。WebKit 在那台主機缺系統函式庫，跑不起來，所以 Safari 一直沒有實測。

## 分支進度（2026-10-24）

本次將本機新版 RAG 後台承接至 `preview/rag-admin-20261024`，以 `preview/rag-phase0` 的 `14937b1` 為起點。只提交並推送新分支；沒有合併或推送 `main`。正式站既有部署紀錄見 README，本次不重新驗證 Production。

### Phase 0 進度快照（2026-10-20）

| 分支 | Commit | 狀態 |
|---|---|---|
| `main` | `cfd6773`（2026-09-09，更新隱私權政策） | Production 部署中。這份 `AGENTS.md`、`CLAUDE.md` 和 `openspec/` 還沒有合併進 `main` |
| `preview/rag-phase0` | `f9a7467` 起 | AI 氣候教練 Phase 0 原型。Preview 部署成功，網址 `https://carbon-guide-pwiyue8bn-fluttermans-projects.vercel.app/rag-preview/`，需要登入 Vercel 或使用分享連結 |

待辦和等待中的事：

- 等業主看完原型的回饋。回饋可能會改到 spec，所以 OpenSpec change 先不歸檔。
- 分享連結要由專案擁有者或 Developer 以上角色的成員在 Vercel 後台產生。
- 桌面版矮螢幕（例如 1440×789）要往下捲才看得到手機框底部。要不要改成自動縮小，等 Ken 決定。
- Safari 還沒實測。
- 上述 Phase 0 待辦是歷史紀錄；目前狀態以本輪收尾及 lockfile 為準。

## 工作規則

- 開始前先跑 `git status --short --branch` 和 `git log -3 --oneline`，分清楚本機 commit、已推送的分支和已部署的版本。
- commit、push、合併 `main`、改 Vercel 設定，都要有當次的明確授權。Ken 的習慣是：問題一題一題確認，等他說開始才改程式。
- 不要提交 secrets、`.env`、`node_modules/`、`dist/` 或 `.vercel/`。
- 非小型的變更先寫 OpenSpec change（`openspec/changes/`），使用 `openspec validate --strict`。
- 回報時附上實際執行過的指令和結果。沒驗證過的項目要明講，例如 Safari、預覽網址是否被保護擋住。
