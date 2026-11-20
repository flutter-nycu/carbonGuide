## 1. 準備

- [x] 1.1 記錄兩個 repo 的基準 SHA 與乾淨的工作樹；`openspec validate --strict` 通過
- [x] 1.2 記錄網站基準：`npm run type-check`、`npm test`

## 2. 後端（githyoung/carbon-navigation，先寫測試）

- [x] 2.1 新 SQL 測試 `supabase/tests/rag_conversation_user_status.sql`：帳號四種狀態、今日用量、輪次、結果分布合計等於次數、已刪除帳號、owner 限制與 grant
- [x] 2.2 更新 `rag_live_conversations.sql` 的列欄位檢查
- [x] 2.3 新 migration 以 `create or replace` 重新定義 `rag_private.v1_admin_conversation_users`，加上 `status`
- [x] 2.4 本機臨時 Postgres 驗證：`sql_local.sh` 補上狀態用的替身欄位（含正式環境的 check）、先 dry run 再套用新 migration，7 份 SQL 測試通過；新增 `sql_dry_run.sh` 供正式環境套用前試跑

## 3. 網站（先寫測試）

- [x] 3.1 `types.ts` 新增 `ConversationUserStatus`；`supabase.ts` 對應後端欄位，缺少時為 null
- [x] 3.2 `fake.ts` 依記憶體資料算出狀態
- [x] 3.3 `labels.ts` 帳號狀態文字與色調
- [x] 3.4 `ConversationsPage.tsx`：列表「目前狀態」欄、結果分布、個人頁「目前狀態」區塊、沒有後台權限的角色文字、後端未提供時的顯示
- [x] 3.5 頁面測試、資料層測試與瀏覽器驗證腳本

## 4. 文件

- [x] 4.1 網站 `AGENTS.md`／`README.md`、後端 `docs/rag.md` 記錄新欄位與部署狀態

## 5. 驗證與審查

- [x] 5.1 `npm run type-check`、`npm test`、啟用 RAG 的 `npm run build`
- [x] 5.2 本機 SQL 驗證、瀏覽器腳本（mock）
- [x] 5.3 檢查 diff 範圍與敏感資訊；嚴格 self-review，另請子代理審查（無 Critical；Important 1 項與 Minor 已修）

## 6. 交付（每一步都要另外授權）

- [x] 6.1 commit 與推送兩個 repo（網站 `e92e010` 推 main；後端 `b8c9334` 推 `agent/cto/f26ad673dc53`，2026-11-20 合併後端 main／develop）
- [x] 6.2 正式環境以 `sql_dry_run.sh` 試跑 migration 與兩份測試（rollback），通過後套用 migration，套用後再跑一次測試（2026-11-20 依 Ken 授權完成；環境沒有 `psql`，用 Supabase MCP 執行等效流程，紀錄見後端 `docs/rag.md`）
- [x] 6.3 推送網站 main 部署 Production，部署後驗證（deployment `7931096289`，HTTP 與 mock 驗證見後端 `docs/rag.md`；真實資料畫面待管理員登入確認）
- [ ] 6.4 歸檔本 change

## 7. 第二階段：列出所有帳號（2026-11-20，James 補充需求）

- [x] 7.1 同步兩個 repo 到 origin/main（網站 `6b3017a`、後端 `b2b06c5`）；確認 `20261119100000` 已由 Ken 套用到正式庫
- [x] 7.2 新 SQL 測試 `rag_conversation_users_all_accounts.sql`（沒有提問的帳號、排序、同加入時間以 id 排、跨分組翻頁、翻頁中途加入或提問不影響），先失敗
- [x] 7.3 新 migration `20261120100000_rag_conversation_users_all_accounts.sql`；`sql_local.sh` 先 dry run 再套用，8 份 SQL 測試通過
- [x] 7.4 網站：`lastAt` 可為 null、fake 加入沒有提問的帳號、列表與個人頁的「還沒有對話」、角色「一般使用者」、今日用量只在有題數時顯示、副標與說明文字
- [x] 7.5 驗證：type-check、231 項測試、啟用 RAG 的 build、兩支瀏覽器腳本（mock）、SQL 變異 10 個（9 個抓到、1 個等價）與前端變異 5 個、子代理審查（無 Critical／Important，Minor 已修）
- [x] 7.6 開 PR（個資可見範圍擴大，需要人工確認）；正式庫以 dry run 試跑後套用 migration；合併網站 PR 部署並驗證（2026-11-20：James 與 Ken 確認可見範圍；Ken 用 Supabase MCP 試跑三份測試後套用 `20261120100000`，套用後再跑通過；兩個 PR fast-forward 合併 main 並同步 develop；部署與驗證收據見後端 `docs/rag.md`）
- [x] 7.7 James 確認畫面（不需要篩選），分頁名稱改為「使用者」：分頁列、頁面標題、表格名稱、導覽頁文字、測試與瀏覽器腳本；規格補上「工作台頁面與上方分頁」的修改
