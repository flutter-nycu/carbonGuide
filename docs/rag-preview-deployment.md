# Protected RAG Preview

This release serves the native React administration workspace at `/push-admin#rag`.
The Supabase backend remains the existing bounded owner pilot: a pinned candidate
corpus, three total requests, USD 0.03 reserved per request, expiry, and no automatic
model retry. The public answer service and knowledge publication remain disabled.

Deploy only the reviewed Preview branch through Git integration. Vercel Authentication
must remain enabled. Supabase independently checks the existing administrator account,
current owner role, request ownership and budget before any paid model invocation.
Hosting protection does not replace these backend checks.

Only these public build values are needed: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` (anon/publishable only), `VITE_RAG_ENABLED` and
`VITE_RAG_PROJECT_REF`. Scope RAG values to the Preview branch. Model keys and
service-role keys belong exclusively in the backend secret store, never `VITE_*`.

Use `npm ci`, `npm run type-check`, `npm test`, `npm run build`, then
`node scripts/check-release.mjs` and `node scripts/check-release.mjs --staged`.
The browser regression scripts use synthetic fixtures in `test/fixtures/`.
Local reports, screenshots, raw documents and environment files are excluded from
Git and CLI uploads. `dist` contains only the five HTML entries, built assets and
the mobile association files; no development server or test harness is deployed.

After deployment, verify the exact commit/URL, unauthenticated protection, security
headers, final JS assets and allowed redirect URL. Complete login using the owner's
normal browser session; do not export tokens or weaken protection for testing.
Use read-only pilot status/history to inspect quota. Each newly submitted question
uses another request allocation, including refusal or failure.

Dependency review (2026-10-26): Vite and Vitest were updated within compatible major
versions. Remaining moderate PostCSS selector parser/Tailwind advisories affect
build-time parsing of trusted repository CSS; they are not shipped as a public
server. A Tailwind major migration is deferred for separate validation, review due
2026-11-02. Re-run audit before each release; this exception does not cover runtime
dependencies or any high/critical finding.

Rollback the website by redeploying the preceding Preview commit. Stop model access
through the pilot's server-side enable/expiry configuration. Neither action should
delete usage records, reset budget or change Production. Deployment-specific private
evidence stays in local `reports/rag-secure-preview/`.
