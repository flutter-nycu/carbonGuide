# CarbonGuide 網站與管理工作台

本 repo 維護公開網站、React 推播管理前端與 RAG 知識工作台。管理入口為 `/push-admin`，RAG 直達入口為 `/push-admin#rag`（上方分頁另有 `#conversations` 對話使用者、`#guide` 技術架構導覽）；舊 `/rag-preview/` 由 Vercel 導向同一登入入口。

Codex、Claude 與新開發者先讀 [AGENTS.md](AGENTS.md)，其中包含目錄、角色、資料契約、部署限制及分支現況。全專案文件中心在後端 `githyoung/carbon-navigation` 的 main：[文件入口](https://github.com/githyoung/carbon-navigation/blob/main/docs/README.md)、[整體架構](https://github.com/githyoung/carbon-navigation/blob/main/docs/architecture.md)、[RAG 架構與進度](https://github.com/githyoung/carbon-navigation/blob/main/docs/rag.md)。後者是部署、評測、預算與待辦的唯一完整紀錄。

## 最新進度（2026-11-20）

一句話：管理員 RAG 工作台已在正式站營運，main 的程式基線是 `e92e010`（對話使用者狀態），後端 migration `20261119100000` 已於 2026-11-20 套用到正式庫；兩個 repo 的 main 與 develop 相同。App 端未接入，Safari／手機未驗。下列為歷次經過，最新狀態與核對方式以後端 [docs/rag.md](https://github.com/githyoung/carbon-navigation/blob/main/docs/rag.md) 的「目前狀態總表」為準。

2026-11-19：使用者已核准兩個 repo 整合 main／develop、正式網站切換及最新候選發布。Production 已設定 RAG 開關；正式入口 https://carbon-guide.vercel.app/push-admin#rag 。兩個 repo 的 main／develop 已完成推送，Production READY；正式入口、靜態資產及匿名拒絕驗證通過，完整收據以後端 [docs/rag.md](https://github.com/githyoung/carbon-navigation/blob/main/docs/rag.md) 為準。

- 正式後端：原五個 live migration、rag-v1 v10、Cloud Run 即時觸發與排程；11/19 新增每日 150 題硬上限並通過 SQL rollback 驗證。
- 配額：每位使用者每日 150 題持續有效；試問／評測共用 UTC 當日計數（臺灣 08:00 換日）。原 US$5 與歷史帳本保留，目前保守預留餘額 US$0.38158625；用完停止付費呼叫，不自動加值。
- 工作輪次仍最多 20 題、7 天、US$0.50，預算依實際餘額縮小；低於 US$0.01 不開新輪次。這不代表整體服務到期。
- 候選 `8d90edb7-89f7-49a4-ae89-66ad279b20af` 已依使用者授權核准發布，沿用既有 40／40 報告；App 公開問答未接入，現行試問仍只有 owner。
- 本輪 TypeScript、188 項測試（24 檔）、啟用 RAG 的 build 與獨立複審通過。11/16 Chrome PDF、網址、自動處理、503 恢復及完整問答驗收保留原日期；Safari／手機未驗。
- 第 12 頁「技術架構導覽」2026-11-19 依使用者授權合併 main 並部署正式站，使用者已用真實資料驗證；規格已歸檔，需求併入 `openspec/specs/rag-admin-live-workspace/spec.md`，收據見後端 docs/rag.md；之後依使用者授權把 develop fast-forward 到 main。
- 上方分頁調整（James 提出，2026-11-19 Ken 選方案 A）：對話使用者與技術架構導覽移出 RAG 側欄，改成管理後台上方分頁，技術架構導覽排最後。在 `preview/rag-top-tabs`（基準 main `c3b2d6a`）完成，2026-11-19 依使用者指示不經 Preview、直接 fast-forward 合併 main 部署正式站並同步 develop；部署收據與驗證見後端 `docs/rag.md`。規格已歸檔到 `openspec/changes/archive/2026-11-19-rag-top-tabs/`，需求併入主規格 `openspec/specs/rag-admin-live-workspace/spec.md`；正式站的真實資料畫面待使用者登入確認。
- 對話使用者狀態（James 在 Multica C-3 提出，2026-11-19）：列表加「目前狀態」欄與結果分布，個人頁在對話列表上方顯示帳號狀態、角色、加入與最近登入、今日用量、進行中的測試輪次及結果分布。後端 `conversation_users` 每列多一個 `status`（後端 migration `20261119100000_rag_conversation_user_status.sql`，Edge Function 不變）。規格在 `openspec/changes/rag-conversation-user-status/`。2026-11-20 依 James 指示部署網站正式站，同日依 Ken 授權在正式庫套用 migration（前後 SQL 測試通過並 rollback），後端分支合併 main。管理員登入確認狀態欄的真實畫面後再歸檔規格。收據見後端 `docs/rag.md`。
- 對話使用者列出所有帳號（James 2026-11-20 補充，PR 審查中）：有提問的排前面，其他帳號依加入時間排列，顯示「0 次」「還沒有對話」。後端新 migration `20261120100000_rag_conversation_users_all_accounts.sql`；owner 會看到所有 App 帳號的 email 與登入時間，合併與套用前需要人工確認。細節見 AGENTS 與後端 `docs/rag.md`。

## 架構與資料流

| 層 | 位置 | 責任 |
|---|---|---|
| 公開網站 | 5 個 HTML entry、`vite.config.ts`、`public/` | 首頁、隱私政策、支援、密碼重設與 Universal Link／App Links |
| 管理登入 | `src/push-admin/App.tsx`、`auth.ts` | Supabase Google OAuth、唯一帳號白名單、`admin_users` 角色驗證 |
| 推播管理 | `src/push-admin/` | 系統推播、個人化規則、發送紀錄、用量；沿用既有 Edge Functions／RLS |
| RAG 外框 | `components/RagWorkspace.tsx`、`rag/Workspace.tsx` | 登入後 React.lazy 載入，React portal 掛入 Shadow DOM 隔離樣式 |
| RAG 側欄 10 頁＋上方 2 個分頁 | `rag/pages/`、`rag/pageList.ts`、`rag/guideContent.ts`、`components/Dashboard.tsx` | 側欄：文件、匯入、試問、評測、版本、人格、Prompt、QA、設定、互動紀錄；上方分頁：對話使用者（只給 owner）、技術架構導覽 |
| RAG 資料層 | `rag/api/supabase.ts`、`types.ts`、`requestKeys.ts` | 讀取受 RLS 保護的資料表，寫入經 `rag-v1`，保存重送鍵與原始請求內容 |
| 後端與 worker | 另一個 repo 的 `supabase/`、`scripts/rag/`、`deploy/cloud-run/` | 權限、snapshot、檢索、模型呼叫、帳本、文件自動處理及排程 |

`VITE_RAG_ENABLED=true` 才讀寫真實 RAG 資料；沒有設定時 01–10 頁與對話使用者顯示尚未啟用，技術架構導覽照常顯示教學內容，都不送 RAG 請求。它是公開開關，不能取代後端授權。`rag/api/fake.ts` 只給測試使用，不進入正式 bundle。正式 CSP 限制 `style-src 'self'`，RAG 使用獨立 CSS，不能新增 inline style。

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

2026-11-19 正式切換那一輪禁止啟動本機瀏覽器、server 或 Docker；之後每一輪是否可以啟動，依當次授權。下列離線檢查隨時可用。

| 檢查 | 指令或位置 | 驗證邊界 |
|---|---|---|
| 安裝 | `npm ci` | lockfile 已同步；不代表 main 同步完成 |
| 型別 | `npm run type-check` | TypeScript 靜態檢查 |
| 測試 | `npm test`；受限環境直接用 `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --pool=threads` | 228 項（27 檔，`e92e010` 推送前紀錄）元件／資料層／整合測試，使用 mock，不收費、不發推播 |
| 建置 | `npm run build` | 用假的公開 Supabase 值可做離線建置；另驗 `VITE_RAG_ENABLED=true` 的 bundle |
| 瀏覽器檢查 | `test/verify-rag-workspace.py`、`test/verify-admin-integration.py` | 需要本機 server 與 Chromium，依當次授權執行。2026-11-19 導覽頁分支以 headless Chromium 通過：1440／1024／768／390 寬度、12 頁、導覽頁鍵盤操作、正式 CSP 與推播回歸；同日上方分頁分支重跑通過，另驗上方分頁網址、角色與 editor 權限；後端全部 mock |
| 規格 | `openspec validate --all --strict` | 規格一致性，不代替功能或部署驗收 |

未來另獲授權時，本機開發用 `npm run dev`，預覽用 `npm run preview`；Vite preview 不套用 Vercel rewrite，入口用 `/push-admin.html`。實際瀏覽器測試需要正確公開設定，結束後用已記錄 PID 關閉自己啟動的程序。不要關閉使用者既有 Chrome 或其他 App。

## 部署與接手待辦

Vercel 專案為 carbon-guide；推 main 會直接部署正式站並影響首頁、隱私政策、支援與密碼重設。已整合原 main 的隱私政策與資料刪除文件。其他分支是受 Vercel Authentication 保護的 Preview；Git push 不部署 Supabase／Cloud Run。

本次正式切換已獲明確授權；下一輪仍依當次任務範圍執行，不把本次授權當成永久部署或加預算授權。候選已核准發布，後續新候選仍需人工核准。

剩餘事項為管理員確認對話使用者狀態欄真實畫面後歸檔 `rag-conversation-user-status`、Safari／手機驗收、其餘歷史 OpenSpec change 的歸檔時機；App、多管理員與 Google 帳單整合另立需求。試問回應遺失且跨輪次到期時，先查互動紀錄，不盲目重問；此既有恢復邊界尚未擴充。

舊 Phase 0、靜態工作台與參考分支保留歷史用途，不執行舊 build 還原公開原型。完整進度只在後端 docs/rag.md 維護。

2026-11-19 正式程式部署：來源 `65b4da7ec7a49aaf20eb79fd956a0746b7294ba0`，Vercel `dpl_FtxQRmB7TC1RqasKtWmG42qDcmwV` READY，正式 alias 為 carbon-guide.vercel.app。七個公開入口 HTTP 200，RAG 真實資料層含每日 150／infinity 邏輯，匿名 rag-v1 回 401。這些是 HTTP／部署證據，不等於新正式站的瀏覽器端驗收；Computer Use 未找到既有 Chrome，未自行啟動。後續純文件提交的最新部署收據以後端 docs/rag.md 為準。
