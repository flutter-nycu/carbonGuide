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

RAG 是依 `carbon-navigation/docs/roadmap.md`（2026-10-24）製作的假資料示範。來源由 `public/rag-preview/` 移至 `src/push-admin/rag/`，僅在通過管理員驗證後掛載，沒有獨立公開 HTML 頁。以 Shadow DOM 隔離樣式，沿用青綠色票、Logo、側欄及操作說明。示範資料只保存在記憶體；切換工作台保留狀態，登出或重新整理即還原；RAG 未串接 Supabase、Storage、OpenAI 或正式推播。前端程式及假資料仍是靜態資產，不能放入機密資料。

可操作匯入預檢、原文與段落示例、係數核定、檢索試問、RAG 評測、審核／發布／回滾、人格、提示詞、QA、RAG 設定及互動紀錄。檔案選擇只讀取檔名和大小，URL 不會被擷取；所有解析、評測與服務狀態都明確標示為示範。已發布版本固定 QA 與設定快照，草稿需評測、審核後才可模擬發布。側欄上方顯示目前使用的知識版本與草稿狀態；草稿與目前版本相同時不能審核或發布。RAG 設定分成可調整的回答方式與檢索，以及只顯示的索引設定（依 `rag-v1-implementation-plan.md` 的 OpenAI 候選）。2026-10-24 的 UI/UX 修正範圍見 `openspec/changes/rag-admin-ux-fixes/`。

介面保留舊版的操作引導：首頁三步入門、可收合的頁面說明、設定旁的用途解釋，以及試問結果的來源與判斷原因。進階參數預設收合，手機使用功能下拉選單。

原有氣候教練與通勤原型保留於 `src/push-admin/rag/prototype.html` 作為設計來源，不部署獨立公開頁面，未將舊版通勤分類評估混入 RAG 評測。

使用 `npm run dev` 後開啟 `/push-admin.html`。`npm test` 包含登入、角色、過期權限查詢、RAG 狀態與模擬發布邊界檢查。`test/verify-admin-integration.py` 提供 Chromium 整合、正式 CSP、五種寬度、草稿保留與登出驗證；所有 Supabase 請求均攔截為 mock，不發送通知。先以 `VITE_SUPABASE_URL=https://admin-test.supabase.co`、`VITE_SUPABASE_ANON_KEY=mock-publishable-key` 建置並在 4185 port 預覽，再執行該腳本。舊 `test/verify-rag-preview.py` 是獨立原型時期的測試，整合版改以上述腳本驗證。這些檢查不代表真實 Google OAuth、手機送達或模型能力已驗收。

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
