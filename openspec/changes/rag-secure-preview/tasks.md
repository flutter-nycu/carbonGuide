## Prepare
- [x] Review release source, secret boundaries, auth, budget controls and dependencies.
- [x] Add upload exclusions, synthetic fixtures and deployment checks.
- [x] Run strict OpenSpec, unit/type/build/browser checks and independent review.
## Deploy
- [x] Configure only approved public frontend values for this Preview branch.
- [x] Commit an explicit reviewed file list and push only the Preview branch (`bef30ad`).
- [x] Verify READY deployment and anonymous Vercel Authentication redirect; inspect HSTS/noindex on that response and scan local build/staged sources for secrets.
- [x] Verify authenticated owner reads through normal Chrome login: documents, pilot quota, seven-step history and generation usage.
- [x] Record deployment evidence, remaining quota and rollback instructions in local `reports/rag-secure-preview/closeout.md`.
- [ ] Independently fetch hosted app CSP/X-Frame-Options and scan hosted JavaScript. Deferred: automatic approval review rejected `vercel curl` because it uses Deployment Protection bypass. Protection remains enabled; normal browser acceptance passed. Local configuration/build checks do not establish hosted response headers or byte-for-byte hosted output.
