# CarbonGuide Website

Static CarbonGuide website plus the React push-notification administration UI
served at `/push-admin`.

AI agents (Codex, Claude, and others) and new contributors: start with
[AGENTS.md](AGENTS.md) (Traditional Chinese). It covers the repo layout, the
Vercel production/preview rules, the AI climate coach Phase 0 prototype, and
current progress. The project-wide documentation hub lives in
[`githyoung/carbon-navigation`](https://github.com/githyoung/carbon-navigation)
(`AGENTS.md` and `docs/README.md`).

Pushing to `main` deploys production (`carbon-guide.vercel.app`). Other branches
get Vercel preview deployments, which require Vercel login or a shareable link.

## 推播與 RAG 整合工作台

唯一管理入口為 `/push-admin`，沿用 Google OAuth、帳號白名單及 `admin_users` 角色驗證。登入後可切換推播管理與 RAG 知識工作台；`/push-admin#rag` 可直接選取 RAG，舊 `/rag-preview/` 路徑由 Vercel 導向同一登入入口。推播功能仍呼叫既有後端，viewer 只可查看紀錄與用量。

RAG 知識工作台在 2026-11 起改成接上 App 的正式 Supabase（`rag-v1` Edge Function 與 `rag_v1_*` 資料表；後端規格在 `githyoung/carbon-navigation` 的 `openspec/changes/rag-backend-live/`）。程式在 `src/push-admin/rag/`，用 React 寫成，掛在 Shadow DOM 裡隔離樣式；通過管理員驗證之後才以 `React.lazy` 載入，沒有獨立公開頁。規格見 `openspec/changes/rag-admin-live-workspace/`。

`VITE_RAG_ENABLED=true` 時才讀寫真實資料。沒有設定時，每一頁只顯示「RAG 後端尚未啟用」，不送出任何 RAG 請求。這是公開的開關，不是金鑰；後端部署並驗收之前，正式站保持關閉。

側欄共 11 頁：

- 管理來源：01 知識庫與文件、02 匯入與預檢
- 驗證回答：03 檢索試問台、04 RAG 評測、05 知識版本
- 教練設定：06 人格設定、07 System Prompt、08 基本通用 QA
- 進階與紀錄：09 進階檢索設定、10 互動紀錄、11 對話使用者

匯入只收 PDF、DOCX、TXT（每個檔案 20 MB 以內）和 https 的 PDF 網址，上傳之後由後端自動解析。owner 可以使用所有功能；editor 可以上傳、修改段落、人格、System Prompt 和 QA，不能試問、評測、審核或發布；viewer 只能看。互動紀錄和對話使用者只有 owner 看得到，對話內容保存 180 天。畫面上的費用是依 Google 公告單價的估計，實際金額以 Google 帳單為準。試問、建立輪次、建立版本、開始評測、登記網址、審核與發布都帶請求鍵，網路中斷後重送不會重複扣款，也不會重複建立。

原有氣候教練與通勤原型保留於 `src/push-admin/rag/prototype.html` 作為設計來源，不部署獨立公開頁面。

驗證方式：

- `npm test`：登入、角色、推播，以及 RAG 各頁的元件測試（`src/push-admin/rag/**/*.test.tsx`）和跨頁檢查（`test/rag-workspace.test.tsx`）。RAG 測試使用記憶體版的資料層 `rag/api/fake.ts`，它不會被打包進正式頁面。
- `test/verify-rag-workspace.py`：先執行 `npx vite --host 127.0.0.1 --port 5199 --strictPort`，再用 Chromium 打開 `test/rag-live-preview.html`（同樣使用記憶體資料層），在 1440、1024、768、390 寬度檢查 11 頁、對話框焦點與 Esc、水平溢出、主控台錯誤和對外請求，並輸出截圖。
- `test/verify-admin-integration.py`：以 `VITE_SUPABASE_URL=https://admin-test.supabase.co`、`VITE_SUPABASE_ANON_KEY=mock-publishable-key` 建置（不設 `VITE_RAG_ENABLED`），在 4185 port 預覽後執行。它套用正式 CSP，檢查登入、推播四個分頁、RAG 11 頁顯示尚未啟用且沒有送出 RAG 請求、兩個跳至主要內容連結、切換工作台保留狀態與登出；所有 Supabase 請求都攔截成 mock，不發送通知。

這些檢查都不代表真實 Google 登入、手機送達、真實知識庫資料或模型回答已驗收；接上真實後端之後要另外逐頁核對。

2026-10-24 既有部署紀錄：整合版曾部署至 `https://carbon-guide.vercel.app/push-admin`，記錄的 Vercel deployment 為 `dpl_Dxz4RAjuMsoHYnxJMTyFcckbUUfR`（READY）。本次工作只將本機版本提交至從 `preview/rag-phase0` 建立的 `preview/rag-admin-20261024`，不推送 `main`，也不執行 Production 部署；上述既有部署狀態未於本次重新驗證。真實 Google 登入及推播送達仍待另外驗收。

## Local development

```powershell
Copy-Item .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

If `npm ci` refuses to install because `package-lock.json` is out of sync
(seen with npm 12), use `npm install --package-lock=false` for local checks and
fix the lock file in a separate change.

Open `http://127.0.0.1:5173/push-admin`. Only the Supabase URL and anon or
publishable key belong in `VITE_*` variables. OneSignal and Supabase
service-role secrets stay in the Supabase Edge Function environment.

## Google OAuth

1. Enable Google in Supabase Auth with a Google Web OAuth client.
2. Add `https://carbon-guide.vercel.app` as the Google authorized JavaScript
   origin.
3. Add the Supabase callback shown by the Google provider page, normally
   `https://<project-ref>.supabase.co/auth/v1/callback`, as the Google
   authorized redirect URI.
4. Add these Supabase Auth redirect URLs:
   - `https://carbon-guide.vercel.app/push-admin`
   - `http://127.0.0.1:5173/push-admin`
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Production.

Do not add a wildcard production redirect. Preview deployments intentionally
cannot sign in until their exact or team-scoped redirect pattern is approved.

## Bootstrap the first administrator

The administrator must sign in with Google once so Supabase creates the Auth
identity. The first attempt is denied. Then add that exact Auth user as owner:

```sql
INSERT INTO public.admin_users (auth_user_id, email, role)
SELECT id, email, 'owner'
FROM auth.users
WHERE lower(email) = lower('OWNER_GOOGLE_EMAIL')
ON CONFLICT (auth_user_id) DO UPDATE
SET email = EXCLUDED.email,
    role = EXCLUDED.role;
```

Only one administrator email is currently allowed. The same address is
hard-coded in `src/push-admin/auth.ts`, in the Edge Functions
(`supabase/functions/_shared/push-admin-roles.ts` in the app repo), and enforced
by the `admin_users_single_email` constraint and the `is_push_*` database
functions. Adding `editor` or `viewer` accounts for other people requires
changing all three. The backend role matrix and push-delivery implementation
remain in
[`githyoung/carbon-navigation`](https://github.com/githyoung/carbon-navigation).

## AI climate coach Phase 0 preview

The original standalone prototype remains in branch `preview/rag-phase0`.
This branch replaces its public HTML entry with the authenticated RAG workspace
described above. The original `openspec/changes/rag-coach-phase0-preview/`
sources and verifier are historical references; do not run their build script
on this branch, because it would restore the retired public entry.
The integrated workspace is documented in
`openspec/changes/rag-admin-integration/`.

## Verification

```powershell
npm run type-check
npm test
npm run build
npm audit --audit-level=moderate
```
