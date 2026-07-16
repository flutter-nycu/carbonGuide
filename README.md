# CarbonGuide Website

Static CarbonGuide website plus the React push-notification administration UI
served at `/push-admin`.

## Local development

```powershell
Copy-Item .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

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

Subsequent accounts should normally use `editor` or `viewer`. The backend role
matrix and push-delivery implementation remain in
[`githyoung/carbon-navigation`](https://github.com/githyoung/carbon-navigation).

## Verification

```powershell
npm run type-check
npm test
npm run build
npm audit --audit-level=moderate
```
