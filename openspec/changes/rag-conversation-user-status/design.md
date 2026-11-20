## Context

對話使用者分頁由 `rag-v1` 的 `conversation_users` action 提供資料；Edge Function 驗證 owner 後原樣回傳 `public.rag_v1_admin_conversation_users` 的 JSON，實際查詢在 `rag_private.v1_admin_conversation_users`（後端 migration `20261105120200_rag_live_conversations.sql`）。這個函式以 `rag_v1_requests` 中 `origin='query'` 的紀錄依 actor 分組，左接 `auth.users` 與 `admin_users`，用綁定 cutoff 的 keyset cursor 分頁，每頁 50 人。

狀態需要的資料都在同一個資料庫：`auth.users`（`created_at`、`last_sign_in_at`、`email_confirmed_at`、`banned_until`）、`rag_v1_user_days`（每人每 UTC 日的題數，試問與評測共用）、`rag_v1_rounds`（`allowed_users`、題數、預算、到期）、`rag_v1_requests` 的 `state` 與 `reason`。這些表對 authenticated 角色多半沒有讀取權限（`rag_v1_user_days` 只給 service_role），前端不能自己讀。

## Goals / Non-Goals

**Goals:**
- 一次查詢就帶回每列的狀態，不增加請求數，不改分頁、搜尋與 cursor 契約。
- 舊網站遇到新後端、新網站遇到舊後端，兩種組合都能正常使用。

**Non-Goals:**
- 不改 Edge Function，不新增 action。
- 不讀 App 的業務資料表。
- 不做狀態的定時刷新。

## Decisions

1. **在原函式加一個 `status` 物件，而不是新增 action。** 列表本來就要讀這些人，每列多幾個彙總只多幾個 lateral 子查詢；另開 action 要多一次往返，也要另外處理權限與 Edge 部署。用 `create or replace` 保留函式簽名，Edge 不用重新部署。原本的九個欄位不動，只多一個 `status` key。

2. **`status` 的內容：**
   ```json
   {
     "account": "active | disabled | unverified | deleted",
     "joined_at": "timestamptz | null",
     "last_sign_in_at": "timestamptz | null",
     "today_requests": "integer | null",
     "outcomes": { "qa": 0, "document": 0, "insufficient": 0, "incomplete": 0 },
     "active_rounds": [{ "release_name": "", "request_count": 0, "request_limit": 0,
       "reserved_usd": 0, "budget_usd": 0, "expires_at": "" }]
   }
   ```
   - `account`：actor 為 NULL 或 `auth.users` 找不到 → `deleted`；`banned_until > now` → `disabled`；`email_confirmed_at is null` → `unverified`；其餘 `active`。帳號刪除走 `auth.admin.deleteUser`（硬刪除，`rag_v1_requests.actor_id` 會變 NULL），所以不讀 `deleted_at`。
   - `outcomes`：與前端 `answerKind` 同一套分類。`answered` 且 `reason='verified_qa'` → qa；其他 `answered` → document；`abstained` → insufficient；其餘（failed、uncertain、reserved、running）→ incomplete。只算 `origin='query'` 且 `created_at <= cutoff`，所以四項合計等於同一列的 `count`。
   - `today_requests`：`rag_v1_user_days` 在 `(clock_timestamp() at time zone 'utc')::date` 的題數，與 `v1_begin_request` 判斷每日上限用同一個日期；沒有紀錄回 0；已刪除帳號回 NULL。
   - `active_rounds`：`state='active'`、`expires_at > now` 且 actor 在 `allowed_users` 的輪次，依到期時間排序，最多 5 筆；已刪除帳號回空陣列。
   - 每日上限沿用前端 `LIMITS.round.dailyLimit`（150，與 DB 的硬上限一致），後端不另外回傳。

3. **狀態以「現在」計算，結果分布以 cutoff 計算。** 結果分布要和同一列的對話次數對得起來，所以跟著 cutoff；帳號、今日用量與輪次是「目前狀態」，用查詢當下的時間。翻頁時同一人不會出現兩次，狀態值可能比第一頁新幾秒，可以接受。

4. **前端把 `status` 當成可有可無。** `ConversationUser.status` 型別為 `ConversationUserStatus | null`；後端回傳缺少或格式不對時為 null，畫面顯示「—」並在個人頁說明後端還沒提供，不用 0 或「正常」補值。

5. **畫面配置。** 列表新增「目前狀態」欄（帳號狀態 tag、今日用量；有輪次時加「N 個測試輪次進行中」），「對話次數」下方用 small 文字列出結果分布。個人頁把既有的 metadata 區塊包成「目前狀態」一區，依序是 Email、角色、帳號狀態、加入時間、最近登入、今日用量、測試輪次、對話次數、對話結果、累計估計費用。沿用 `dl.metadata`、`tag` 等既有樣式，只加一個 `.nowrap` class 讓角色欄在窄螢幕不被拆字；不用 inline style（正式站 CSP 是 `style-src 'self'`），也不新增說明卡。

6. **第二階段：列出所有帳號（2026-11-20）。** `20261119100000` 已套用到正式庫，所以另開 migration `20261120100000` 重新定義同一個函式，而不是改舊檔。
   - 以 `auth.users`（`created_at <= cutoff`）與提問彙總做 full join：沒有提問的帳號次數為 0、`last_at` 為 null、費用 0／null；「已刪除帳號」這一組仍只在有提問時出現。
   - 排序是 `(tier, sort_at desc, actor_id nulls last)`：tier 0 是有提問的帳號，`sort_at` 為最近提問；tier 1 是其他帳號，`sort_at` 為加入時間（缺值時用 epoch，只影響排序）。cursor 沿用 `v1_cursor` 的格式再加 `tier`，filter 雜湊改用 `users-all`，舊列表的 cursor 一律回 `invalid_cursor`，前端已有「列表已經變動，請重新整理頁面」的提示。
   - cutoff 限制提問時間，也限制沒有提問的帳號的建立時間（有提問的帳號一律保留，因為 GoTrue 與資料庫的時鐘可能有些微差距），所以翻頁中途有人加入或第一次提問，都不會讓後面的頁重複或漏掉。翻頁中途有人刪除帳號時，他的提問併入「已刪除帳號」組、時間往前跳，這一組可能要重新整理才看得到；舊版也有同樣的情況。加入時間缺值或不是有限值時用 epoch 排在最後，cursor 只會帶有限的時間。
   - 每頁仍 50 筆；沒有提問的帳號不跑費用子查詢。搜尋比對所有帳號的 email 與顯示名稱。
   - 網站不需要和 migration 同時上線：舊後端只回有提問的人，新網站照常顯示；新後端搭配舊網站，沒有提問的帳號會顯示「0 次」、最近對話「—」、費用「尚無資料」，可以用但文字較粗。

## Risks / Trade-offs

- [每頁都掃一次 `auth.users` 並和提問彙總 full join] → 數千個帳號沒有問題；到數萬、數十萬筆時單次查詢可能接近 Edge 或 PostgREST 的逾時，屆時再加索引或改成先取帳號頁、再補彙總。
- [列出所有 App 使用者的 email、登入時間] → 這是個資可見範圍的擴大：原本只有提問過的管理員帳號，現在是所有 App 帳號。仍只給 owner、只經 `rag-v1` 的 owner 檢查與 service_role 函式，不新增 authenticated 可讀的資料；後端 `docs/security-and-privacy.md` 同步更新。上線前需要人工確認這個範圍。

- [正式環境 `auth.users` 欄位與本機替身不同] → 只用 GoTrue 長期存在的四個欄位；套用前用後端 `openspec/changes/rag-backend-live/verify/sql_dry_run.sh`，在正式環境的同一個 transaction 裡先跑 migration 內容、再跑測試，最後 rollback，失敗就不套用。plpgsql 在執行時才檢查欄位，所以這一步不能省。測試本身要求 `status` 欄位，單獨在套用前跑一定失敗，必須用這支腳本。
- [dry run 期間的鎖] → 測試建立的輪次以外鍵指向 campaign，會短暫擋住同時間的試問（最多到 30 秒 statement timeout），挑沒有人試問時執行，跑完就結束連線。
- [每頁 50 人多四個 lateral 子查詢] → 都走既有索引（`rag_v1_user_days` 主鍵、`rag_v1_requests(actor_id, created_at)`）；輪次表很小。管理後台目前只有一位 owner，負擔可以忽略。
- [狀態顯示 `last_sign_in_at` 等帳號資料] → 函式維持 owner 檢查與 service_role 專用的 grant；不新增 authenticated 可讀的欄位或 policy。
- [`rag_live_conversations.sql` 檢查列的欄位集合] → 同一個後端變更更新該檢查，避免正式環境重跑時誤判。

## Migration Plan

1. 後端：新 migration 以 `create or replace` 重新定義 `rag_private.v1_admin_conversation_users`，並重新執行原本的 revoke／grant。先在本機臨時 Postgres 跑（`sql_local.sh` 先做 dry run、確認函式沒被改，再套用並跑 7 份測試）；正式環境套用前以 `sql_dry_run.sh <migration> rag_live_conversations.sql rag_conversation_user_status.sql` 試跑（每份測試一個 transaction，全部 rollback），通過後才套用，套用後再跑一次兩份測試。
2. 網站：推送 main 部署 Production。網站與 migration 誰先上線都可以。
3. 回滾：網站 revert 後推 main；後端以新 migration 把函式改回 `20261105120200` 的定義（不刪資料、不改表）。只回滾後端時，新網站會顯示「—」。
