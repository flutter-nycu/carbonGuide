# Protected RAG Preview

Updated 2026-10-27. The native React administration workspace is served at
`/push-admin#rag`. RAG v1 supports private ingestion, immutable candidate versions,
bounded administrator trials/evaluations, review, publication controls and cost
traces. Real content approval and public answering remain disabled. Flutter is
outside this release. See the [user guide](rag-pilot-user-guide.zh-TW.md).

Deploy only `preview/rag-admin-20261024` through Git integration. The backend lives
on `preview/rag-v1-review-20261027` in `githyoung/carbon-navigation`; migrations and
Edge Functions belong there. Neither branch is main. Vercel Authentication
must remain enabled. Supabase independently checks the existing administrator account,
current owner role, request ownership and budget before any paid model invocation.
Hosting protection does not replace these backend checks.

Only these public build values are needed: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` (anon/publishable only), `VITE_RAG_ENABLED` and
`VITE_RAG_PROJECT_REF`. Scope RAG values to the Preview branch. Model keys and
service-role keys belong exclusively in the backend secret store, never `VITE_*`.
A local production build does not automatically load `.env.development.local`:
explicitly supply all four public values without printing their contents.

Use `npm ci`, `npm run type-check`, `npm test`, `npm run build`, then
`node scripts/check-release.mjs` and `node scripts/check-release.mjs --staged`.
Also run `npm audit --audit-level=moderate`. The lock file is synchronized on this
branch. Browser regression uses synthetic fixtures in `test/fixtures/` and is
distinct from real login/backend verification.
Local reports, screenshots, raw documents and environment files are excluded from
Git and CLI uploads. `dist` contains only the five HTML entries, built assets and
the mobile association files; no development server or test harness is deployed.

After deployment, verify the exact commit/URL, unauthenticated protection, security
headers, final JS assets and allowed redirect URL. Complete login using the owner's
normal browser session; do not export tokens or weaken protection for testing.
Use read-only status/history to inspect quota. Each newly submitted question
uses another request allocation, including refusal or failure.

Dependency review (2026-10-27): the current branch audit returned zero
vulnerabilities. The earlier Tailwind dependency exception no longer describes
this branch. Re-run audit before each release.

Use the stable branch URL for subsequent deployments:

https://carbon-guide-git-preview-rag-admin-f1f550-fluttermans-projects.vercel.app/push-admin#rag

## Paid calls and stop controls

The approved corpus/evaluation campaign has one total US$5 cap. Document embedding,
development and acceptance share it. Each call needs a durable reservation and
start record before Google is contacted. Unknown outcomes retain their
reservation; never reset the ledger, automatically retry, or create a replacement
campaign. Reservations are conservative ceilings, not Google bills.

Each trial allows at most 100 requests. The separate per-user daily limit permits
up to 200 across trials/evaluations in a UTC day, still bounded by the campaign.
Read-only status/history does not call the model. The old three-request pilot
remains unchanged; its original requests and reservations are historical.

Stop the campaign to prevent further model calls, or stop an individual trial.
Already-started calls may complete. Public answering and the active knowledge
release remain separate controls; Preview deployment does not turn them on.

Rollback the website by redeploying the preceding Preview commit. Stop model access
through the v1 campaign/trial stop controls (or the separate pilot controls for
the old endpoint). Neither action should
delete usage records, reset budget or change Production. Deployment-specific private
evidence stays in local `reports/rag-v1-delivery/`. Backend schema recovery must
preserve snapshots, histories and ledgers. Knowledge rollback selects an already
published, still-approved version whose sources remain enabled. No real content
is approved or published as an automated deployment step.

Long PDFs are parsed locally in bounded page segments. Complete verified physical
page coverage is required before merging. Undecoded content is rejected by
default; explicit whole-chunk quarantine creates a separate candidate with visible
missing-page/chunk warnings. It does not repair missing numbers or signs. Backend
CLI details are in the backend repo's `docs/development-and-testing.md`.

Publish only sanitized delivery summaries and source code, not raw model responses,
document extracts or account screenshots.
