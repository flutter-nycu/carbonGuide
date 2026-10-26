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

唯一管理入口為 `/push-admin`；`/push-admin#rag` 直接選取 RAG。沿用 Google OAuth、既有帳號白名單及 `admin_users` 角色驗證。推播仍使用原有後端。

RAG 七個畫面已採原生 React。v1 包含私有原始檔上傳、列管 URL 快照、本機解析／OCR、固定 profile 的 Gemini embedding、段落修訂、QA／人格／提示詞／計算草稿、不可變版本、有限輪次、評測、逐步流程及成本、人工審核、發布與回滾。詳細操作、模型及限制見 [RAG 使用說明](docs/rag-pilot-user-guide.zh-TW.md)，開發範圍見 [OpenSpec](openspec/changes/rag-v1-review-ready/)。

內容維持待人工審核，一般回答服務關閉，Flutter 最後接入。ready 代表處理可用，並非人工核准。維護者使用 App repo 的 `scripts/rag/` 執行批次解析／文件 embedding；本階段沒有常駐雲端 worker。

本輪核准的文件準備及評測上限合計 US$5，與舊三題 pilot 額度分開。模型 key 只在伺服器／指定本機環境檔。未知結果保留預留，不重試、不退還配額；Google 帳單另行對帳，預留不等於扣款。

來源原始清單的 45 份已上傳私有 `rag-originals` 並下載驗證 SHA-256；bucket 限制維持 20 MiB。解析與評測結果、尚待修復的來源及線上部署以[本輪驗收紀錄](docs/rag-v1-delivery.zh-TW.md)為準，不能從功能列表推定全部文件已通過。

公開連線值見 `.env.example`。只有 `VITE_RAG_ENABLED=true` 且 `VITE_RAG_PROJECT_REF` 與 `VITE_SUPABASE_URL` 相符才送出 RAG 請求。測試目標 `hxsrineeirmxpoovcrba` 已由使用者確認；既有 App／推播資料與管理員限制維持原範圍。

後端 RAG migrations、Edge Functions、SQL 權限測試及文件 CLI 位於 [`githyoung/carbon-navigation`](https://github.com/githyoung/carbon-navigation)。瀏覽器只持有公開設定，Supabase JWT／角色／RPC／RLS 獨立保護資料及付費端點。

歷史 `rag-pilot` 已完成兩次真實試問，紀錄與有限額度保留；它不是新版 v1 的評測成績。舊 HTML 原型只作設計與回歸來源，不部署獨立公開入口。

## Local development

```powershell
Copy-Item .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Use the committed lockfile with `npm ci`. On Windows PowerShell, use `npm.cmd`
if script execution policy blocks `npm.ps1`. The branch lockfile includes the
patched PostCSS selector parser override; main may have a different lockfile.

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
npm.cmd run type-check
npm.cmd test
npm.cmd run build
npm.cmd audit --audit-level=moderate
```

`test/verify-rag-react.py` uses mocked Supabase authentication and requests to
check the production build at multiple widths. It does not validate real OAuth,
model calls, delivery of push notifications, or content correctness. A normal
authenticated Chrome session is used separately for protected Preview checks;
Deployment Protection remains enabled.

Backend Node tests cover request replay, paid-call journaling, strict model
contracts, source windows, numeric units, exact decimal calculations and
evaluation scoring. Python tests cover ingestion, embedding, segmented page
coverage and safe URL snapshots. SQL fixtures use synthetic data in rollback
transactions; they never approve real content.

The current implementation and acceptance scope are tracked in
[rag-v1-review-ready tasks](openspec/changes/rag-v1-review-ready/tasks.md).
Private source documents, raw model diagnostics, credentials and local reports
are excluded from Git and Vercel uploads. Public documentation records aggregate
results; local evidence remains in `reports/`.

Earlier prototype, sample parsing, pilot and trace experiments remain historical
evidence under `openspec/changes/` and local `reports/`; their sample scores are
not the full-corpus v1 acceptance result. The Orca Windows MCP workflow is
recorded in [AGENTS.md](AGENTS.md).
