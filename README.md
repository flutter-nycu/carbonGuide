# CarbonGuide 網站與管理工作台

本 repo 維護公開網站、React 推播管理前端與 RAG 知識工作台。管理入口為 `/push-admin`，RAG 直達入口為 `/push-admin#rag`；舊 `/rag-preview/` 由 Vercel 導向同一登入入口。

Codex、Claude 與新開發者先讀 [AGENTS.md](AGENTS.md)，其中包含目錄、角色、資料契約、部署限制及分支現況。全專案文件中心在後端 `githyoung/carbon-navigation` 的 `feature/rag-backend-live`：[文件入口](https://github.com/githyoung/carbon-navigation/blob/feature/rag-backend-live/docs/README.md)、[整體架構](https://github.com/githyoung/carbon-navigation/blob/feature/rag-backend-live/docs/architecture.md)、[RAG 架構與進度](https://github.com/githyoung/carbon-navigation/blob/feature/rag-backend-live/docs/rag.md)。後者是部署、評測、預算與待辦的唯一完整紀錄。

## 最新進度（2026-11-16）

| 範圍 | 已完成 | 尚未完成 |
|---|---|---|
| 網站 | 真實 RAG 11 頁工作台，位於 `preview/rag-admin-live-20261105`；受保護 Preview 已開啟 `VITE_RAG_ENABLED=true` | 合併 develop／main、Production 切換 |
| 後端 | 正式 Supabase 5 個 live migration、`rag-v1` v10、Cloud Run 自動處理、即時觸發與每小時排程 | Git push 不會更新後端部署，之後變更仍須個別驗證 |
| Chrome 驗收 | Google 登入、PDF 網址、原生選檔 signed URL 上傳、自動解析／向量化、問答引用、費用、對話查詢；舊 Gemini 503 文件恢復 | Safari 與本次手機版面 |
| 回答品質 | 原 37／40 與因語意問題退回的首批 40／40 保留；修正後另建候選完整重測 40／40，數字錯誤與版本外來源 0，輔助複核未見重大錯誤 | 業主真人核准；保留兩處非阻擋措辭建議，公開服務仍停用 |
| 程式驗證 | type-check、183 項測試（24 檔）、build、npm ci 通過 | 未重跑 Flutter；本機 mock 測試不代表真實服務驗收 |

已驗收 [Preview 工作台](https://carbon-guide-t1ufi6m6d-fluttermans-projects.vercel.app/push-admin#rag) 的部署 ID 為 `dpl_FCNfU7UyuYeHJtmdK1jNu42Hy5Qu`，需要 Vercel 與唯一管理員登入。該部署以 `a1d5360` 加同輪修正建立；本次將程式與交接文件 commit／push 到現有功能分支。push 若產生新 Preview，須另核對 source SHA 與 READY，不能把既有 Chrome 驗收當成新部署已驗證。正式網站仍是 `main` `88e4c90` 的舊靜態 RAG 示範。

最新候選 `8d90edb7-89f7-49a4-ae89-66ad279b20af` 仍 pending，報告 `fa436ba7-3291-49a1-a839-8297ccdf93ae` 為 40／40。完整證據與追查方式見後端 `docs/rag.md`。應用程式原 US$5 上限及舊費用紀錄保留，最後保守預留剩餘 US$0.38158625；每日 150 題只授權這次輪次至 2026-11-17 14:00（臺灣），最後累計 142 題。新工作前重新查額度，不因 Gemini 預付款或 GCP 試用金而自行提高預算。

## 架構與資料流

| 層 | 位置 | 責任 |
|---|---|---|
| 公開網站 | 5 個 HTML entry、`vite.config.ts`、`public/` | 首頁、隱私政策、支援、密碼重設與 Universal Link／App Links |
| 管理登入 | `src/push-admin/App.tsx`、`auth.ts` | Supabase Google OAuth、唯一帳號白名單、`admin_users` 角色驗證 |
| 推播管理 | `src/push-admin/` | 系統推播、個人化規則、發送紀錄、用量；沿用既有 Edge Functions／RLS |
| RAG 外框 | `components/RagWorkspace.tsx`、`rag/Workspace.tsx` | 登入後 React.lazy 載入，React portal 掛入 Shadow DOM 隔離樣式 |
| RAG 11 頁 | `rag/pages/`、`rag/pageList.ts` | 文件、匯入、試問、評測、版本、人格、Prompt、QA、設定、互動紀錄、對話使用者 |
| RAG 資料層 | `rag/api/supabase.ts`、`types.ts`、`requestKeys.ts` | 讀取受 RLS 保護的資料表，寫入經 `rag-v1`，保存重送鍵與原始請求內容 |
| 後端與 worker | 另一個 repo 的 `supabase/`、`scripts/rag/`、`deploy/cloud-run/` | 權限、snapshot、檢索、模型呼叫、帳本、文件自動處理及排程 |

`VITE_RAG_ENABLED=true` 才讀寫真實 RAG 資料；沒有設定時各頁顯示尚未啟用，不送 RAG 請求。它是公開開關，不能取代後端授權。`rag/api/fake.ts` 只給測試使用，不進入正式 bundle。正式 CSP 限制 `style-src 'self'`，RAG 使用獨立 CSS，不能新增 inline style。

文件流程：管理員取 signed URL、上傳、核對 SHA-256；`rag-v1` 觸發 Cloud Run，worker 完成解析與向量化，管理員再建立不可變的知識候選。只收 PDF／DOCX／TXT，每檔 20 MB 以內；網址僅收公開 https PDF。disabled 文件及引用其段落的 QA 不進入新候選。候選需通過完整評測及 owner 人工核准才可發布，修改工作區不回寫既有 snapshot。

試問、評測、建立版本及其他寫入沿用同一請求鍵重送；回應未確定時不可清鍵或新開付費輪次。評測先計入當日已用題數，進度只計完成終態，離頁停止前端接續；重新進頁沿用同批。對話分頁使用後端回傳的 keyset cursor，換條件即重置列表。未知模型用量另外計數，不顯示為零；估計費用、campaign 預留與 Google 帳單分開解讀。

## 角色與設定

owner 可使用全部功能。editor 可上傳、修正段落、編輯人格／Prompt／QA，不能試問、評測、核准或發布；viewer 只能讀取其允許的頁面。互動紀錄與對話使用者僅 owner 可讀，問答內容保存 180 天，費用帳本保留。完整頁面矩陣見 AGENTS。

瀏覽器只需 `.env.example` 的公開設定 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`，以及 RAG 開關。service role、Gemini key、Google 服務帳號私鑰、OneSignal REST key 只能在後端 secrets，不能放入任何 `VITE_*` 或提交 Git。

Google OAuth 已配置；以下是未來環境遷移的核對點，接手時不要重建帳號或覆寫權限：

1. Supabase Auth Google provider 使用 Google Web OAuth client；Google redirect URI 使用 Supabase provider 頁面提供的 callback。
2. 正式 JavaScript origin 為 `https://carbon-guide.vercel.app`，Supabase redirect URL 為正式 `/push-admin`；Preview 使用已核准的精確或團隊範圍 redirect，不能開任意 Production wildcard。
3. 管理員先登入產生 Auth identity，再由受信任後端建立對應 `admin_users` owner；不能只改前端白名單。
4. 唯一帳號限制同時存在網站 `auth.ts`、後端 `_shared/push-admin-roles.ts` 與 DB `admin_users_single_email`／`is_push_*`。開放其他管理員是獨立權限變更，需新增 migration 與明確授權。

## 開發與驗證

本輪禁止啟動本機瀏覽器、server 或 Docker，禁止新增分支／worktree，最多同時兩個子程序。下列離線檢查可使用；不要直接執行會開 server 或瀏覽器的歷史腳本。

| 檢查 | 指令或位置 | 驗證邊界 |
|---|---|---|
| 安裝 | `npm ci` | lockfile 已同步；不代表 main 同步完成 |
| 型別 | `npm run type-check` | TypeScript 靜態檢查 |
| 測試 | `npm test`；受限環境直接用 `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --pool=threads` | 183 項元件／資料層／整合測試，使用 mock，不收費、不發推播 |
| 建置 | `npm run build` | 用假的公開 Supabase 值可做離線建置；另驗 `VITE_RAG_ENABLED=true` 的 bundle |
| 歷史瀏覽器檢查 | `test/verify-rag-workspace.py`、`test/verify-admin-integration.py` | 2026-11-05 mock 驗證通過，涵蓋 1440／1024／768／390 寬度、11 頁、正式 CSP 及推播回歸；本輪不啟動 |
| 規格 | `openspec validate --all --strict` | 規格一致性，不代替功能或部署驗收 |

未來另獲授權時，本機開發用 `npm run dev`，預覽用 `npm run preview`；Vite preview 不套用 Vercel rewrite，入口用 `/push-admin.html`。實際瀏覽器測試需要正確公開設定，結束後用已記錄 PID 關閉自己啟動的程序。不要關閉使用者既有 Chrome 或其他 App。

## 部署與接手待辦

Vercel 專案為 `carbon-guide`。推 `main` 直接部署正式站，會影響 App 的隱私政策、支援頁與密碼重設；其他分支部署 Preview，保留 Vercel Authentication。本次只授權現有功能分支 commit／push，不合併 main／develop、不切換 Production、不核准知識候選。Git push 不會部署 Supabase 或 Cloud Run。

1. 業主審閱最新候選及兩處措辭意見；機械 40／40 和輔助複核不能代替真人核准。
2. Safari 與本次手機版面驗收；先確認使用者允許的既有瀏覽器，不自動啟動。
3. 另獲授權後整合 main 的隱私政策與資料刪除文件，再處理合併及 Production 開關（OpenSpec 11.3）。後端 main 的 Android 修改也須保留。
4. 決定 OpenSpec 歸檔時機；App 氣候教練、多人管理員、Google 帳單核對均屬另立需求。

目前 `rag-admin-live-workspace` 為 33／34；11.2 真實 Preview 驗收完成，11.3 合併上線未完成。原 Phase 0 保留在 `preview/rag-phase0`；本分支的 `openspec/changes/rag-coach-phase0-preview/`、`rag-admin-integration/`、`rag-admin-static-uiux-cleanup/` 是歷史來源，不可執行舊 build 還原已停用的公開原型入口。
