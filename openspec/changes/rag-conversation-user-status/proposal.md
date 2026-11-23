## Why

James 在 Multica C-3 提出：對話使用者分頁現在只看得出「誰問過問題」，看不出這個人目前的狀態。owner 想在同一頁知道每位使用者的帳號是否正常、還有沒有後台權限、今天用掉多少題、有沒有進行中的測試輪次，以及問過的問題各得到什麼結果。

狀態上線後（2026-11-20），James 補充：要列出所有使用者，不只是有對話的人，再從每個人點進去看他的對話細節。

## What Changes

- 對話使用者列表新增「目前狀態」欄：帳號狀態、今日用量（試問與評測合計／每日上限），有進行中的測試輪次時一併標示。
- 「對話次數」欄下方加上結果分布：QA 回答、文件回答、資料不足、沒有完成各幾次。
- 點進一個人之後，在對話列表上方顯示「目前狀態」一區：帳號狀態、後台角色、加入時間、最近登入、今日用量、進行中的測試輪次（知識版本、已問題數／上限、已預留／預算、到期時間）、對話結果分布。
- 角色欄：帳號還在但不是管理員時顯示「一般使用者」，不再只顯示「—」。
- 第二階段（2026-11-20）：列表改成所有帳號。有提問的排前面（最近提問在上），其他帳號依加入時間排列，顯示「0 次」「還沒有對話」；點進去照樣看目前狀態與（空的）對話列表。後端新增 migration `20261120100000_rag_conversation_users_all_accounts.sql`，分頁 cursor 多一個分組鍵，舊 cursor 會被拒絕並請使用者重新整理。
- 第一階段：後端 `conversation_users` 的每一列多一個 `status` 物件（新增 migration 取代 `rag_private.v1_admin_conversation_users`）。當時原有欄位、排序、搜尋、cursor 與權限都不變；舊版網站會忽略新欄位。第二階段改了排序與 cursor，見上一項。
- 網站在後端還沒套用 migration 時照常顯示列表，狀態欄顯示「—」，個人頁註明後端還沒提供狀態。

- 分頁名稱由「對話使用者」改為「使用者」（James 2026-11-20 確認畫面後要求），頁面標題、表格名稱與導覽頁文字一起改；網址仍是 `#conversations`。

- 分頁與字體（James 2026-11-20）：列表每頁 10 位，有上一頁、下一頁、頁碼與總數；這個分頁的表格文字放大到 14px。只改網站，後端仍以 cursor 每次給 50 位。

**不做：** App 使用者的其他資料（問卷、碳足跡、推播訂閱）、「只看有對話的人」篩選（James 確認不需要：列表已顯示最近對話）、停用或修改帳號的操作、新角色或新權限、`rag-v1` Edge Function 的程式變更、即時更新（狀態在載入列表時讀取一次）。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `rag-admin-live-workspace`：「對話使用者」需求加入每位使用者目前狀態、列出所有帳號與後端尚未提供時的行為；「工作台頁面與上方分頁」把分頁名稱改為「使用者」。

## Impact

- 網站程式：`src/push-admin/rag/api/types.ts`、`api/supabase.ts`、`api/fake.ts`、`labels.ts`、`pages/ConversationsPage.tsx`、`styles.css`（若需要）。
- 網站測試：`api/supabase.test.ts`、`api/fake.test.ts`、`pages/HistoryPages.test.tsx`、瀏覽器驗證腳本。
- 後端（`githyoung/carbon-navigation`）：新 migration、`supabase/tests/rag_live_conversations.sql` 的欄位檢查、新的 SQL 測試與本機驗證腳本、`docs/rag.md`。
- 部署：需要分別授權套用 Supabase migration 與推送網站 main。兩者順序不拘，網站可以先上線。
