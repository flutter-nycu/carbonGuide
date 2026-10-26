# Owner-only bounded live RAG pilot

## Why
Persisted candidate content and historical traces exist, but the browser cannot submit a real question. Build a narrow internal pilot before publication.

## What changes
- Existing owner authentication guards a new test-project Edge Function, with no public service enablement.
- Pin each request to one immutable 2-document/24-chunk import receipt. One query embedding, exact vector + PGroonga RRF retrieval, one tool-free Gemini answer and source-quote validation.
- Atomically reserve USD 0.03 per request, at most 3 requests / USD 0.09 for the expiring pilot. No automatic retry/refund; same UUID cannot trigger model calls twice. Provider billing remains unknown.
- Journal each actual step before external calls, retaining only bounded metadata for 30 days. Raw question/answer stays in request/response memory. Interrupted calls keep their reservation and uncertain cost.
- React owner-only form, live step reads, evidence citations, request history and distinct reserved/estimated/billed costs.
- No changes to existing public service switch, releases, historical trace contract, other admins, push services or Vercel deployment.

## Impact
App repo owns migration, Edge Function and tests. Website owns client and operator evidence. Reuse Gemini key only on server. Explicitly warn that candidates are not human-approved and this is not a published knowledge release.
