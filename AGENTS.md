# carbonGuide 網站 repo：Agent 指南

最後核對：2026-11-27（C-4 已部署；補上常見問答收錄提示）。此文件提供 Codex、Claude 與其他 Agent 共用規則；網站架構、程式地圖、角色與測試在 [README.md](README.md)，完整跨端進度在後端 repo 的 docs/rag.md。

## 接手先做

1. 讀本檔及 README 的「目前進度」，再讀後端 docs/README.md、docs/architecture.md、docs/rag.md。兩個 repo 的 main 都是正式來源，GitHub main 上的文件就是最新版本。
2. 查 `git status --short --branch`、`git log -5 --oneline`，有網路時 fetch 並比對 origin/main／origin/develop。保留既有 staged、unstaged、untracked；不直接 pull、reset、切分支或自行建立工作樹。
3. main 是正式來源，develop 與 main 相同（11/26 同步到 `3c7e1eb` 之後）；`agent/cto/336ff7935d6a`、`agent/cto/f26ad673dc53` 都已合併，只作歷史追查。新工作從 main 開始。
4. 推 main 會直接部署正式站；commit、push、合併、部署與知識版本核准都要使用者當次授權，不因先前授權自動推送或部署。

## Repo 邊界

- 本 repo：公開網站、推播管理、RAG 知識庫／使用者／運作原理。
- githyoung/carbon-navigation：Flutter App、Supabase schema／Functions、Cloud Run worker、全專案文件中心。
- `lib/admin_main.dart` 不是目前部署的管理前端；新後台功能在本 repo。
- 網站只持有公開 Supabase URL／anon key；service role、Gemini／OneSignal REST key、服務帳號 JSON 不進瀏覽器、VITE_*、Git、log 或文件。

## 實作規則

- RAG 入口 `src/push-admin/components/RagWorkspace.tsx`，React.lazy 載入，以 portal 放進 Shadow DOM；樣式放 rag/styles.css。CSP 為 style-src self，不能加 inline style。
- `rag/api/types.ts` 是 RagApi 契約，supabase.ts 是真實資料層，fake.ts 只給測試。直接讀表受 RLS 保護，RAG 寫入經 rag-v1；功能開關及 UI 隱藏不等於授權。
- 保持 owner／editor／viewer 的頁面與寫入權限。單一管理員限制有網站、Edge、DB 三層，改權限須完整契約與明確授權。
- 非冪等操作保留原 request key／body，確定成功才清除；不因逾時、pending 或未知模型結果就再扣款。跨輪次到期先查既有紀錄。
- 草稿、immutable snapshot、試問輪次、評測、人工核准、發布分開。人工 FAQ 只在明確標記時免文件引用，不能改舊 snapshot 或弱化文件型來源門檻。
- 白話文案沿用 rag-plain-ui-refresh design；按鈕改名同步 tutorialContent.ts，後端模型／門檻改變同步 guideContent.ts／LIMITS。
- 不自行延伸到 App、多管理員、加預算、計算流程或 Google 帳單。

## 驗證與交付

- 依 README 執行 `npm run type-check`、單工 `npm test`、啟用 RAG 的 build；本輪純文件以連結、路徑、版本、diff 及敏感資訊核對。
- 沒有獨立 lint script。OpenSpec 本次 change 與全量結果分開；已知 rag-plain-ui-refresh scenario 缺口不能說成全綠。
- mock、build、HTTP、真實登入、資料操作、Safari／手機各自記錄，舊結果附原日期；HTTP 200 不等於功能驗收。
- 本輪不啟動本機 server、Docker 或新瀏覽器，同時最多兩個子程序、測試單工；不要關閉使用者既有程式或雲端排程。
- 完整 diff self-review 後精確 stage／commit；commit 只含本次範圍，回報 SHA、branch、驗證與未驗項目。單一 Agent self-review 不稱為獨立審查。
- push、merge、正式資料修改與部署依使用者授權範圍；main push 直接觸發 Production，功能分支也可能觸發 Preview。Preview 使用正式 Supabase，不能視為隔離測試。
- 維護同一套 README／後端文件；CLAUDE.md 只做導引。回報使用自然、直接的臺灣繁體中文。
