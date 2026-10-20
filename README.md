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

`public/rag-preview/index.html` is a static, fake-data prototype for client
review (branch `preview/rag-phase0` only). Do not edit it by hand: change the
sources in `openspec/changes/rag-coach-phase0-preview/source/` and run
`source/build.py`, which also recomputes the CSP script hash. Verify with
`openspec/changes/rag-coach-phase0-preview/verify/verify_preview.py`.

## Verification

```powershell
npm run type-check
npm test
npm run build
npm audit --audit-level=moderate
```
