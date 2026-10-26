# Design

## Boundaries
The browser is untrusted. Every paid or write action is validated by an owner/editor-aware server endpoint/RPC. The local parser handles untrusted PDFs/DOCX under size, decompression, time and memory caps, without executing embedded content. URL snapshots require HTTPS allowlists, public-IP validation, bounded responses and redirect checks. Provider responses are data; no generated SQL, commands or executable HTML.

## Durable data
Keep existing immutable chunk sets and pilot history. Original files have deterministic hash-addressed paths and metadata. Processing jobs are durable and claimable with a lease; a retry creates trace evidence but never silently repeats paid work. Candidate changes create new sets. Publication snapshots freeze selected versions plus configuration and draft content. A review receipt references the exact snapshot hash; later edits invalidate approval. Activation/rollback is atomic and separately audited. No agent-generated approval for real content.

## Budget and retention
Paid work must reserve against an explicitly configured finite campaign/round budget before the request. Separate reservations, provider usage estimates and imported billed amounts. Unknown outcomes retain reservations. Existing pilot amounts are not refunded or reset. Retention deletes expired detail in bounded batches while keeping durable accounting aggregates so cleanup cannot recreate spending capacity. Jobs run only dedicated RAG functions.

## Execution
Use Gemini 768-dimensional document/query embeddings with profile/hash/norm guards. Retrieval is version-filtered cosine plus PGroonga/RRF; sizes and thresholds are validated. Prompt/persona/QA/calculation rules come from one immutable snapshot. Optional rewrite is at most one; allowed deterministic tools are bounded to three calls. Both default off until evaluated. Structured answers must cite provided verified evidence, preserve units and refuse unsupported requests.

## Review gates
Automated tests establish contracts, access isolation, idempotency, quotas, lifecycle, citations and calculation arithmetic. They do not establish factual correctness or legal/current tariff validity. Full corpus can remain in_review even when processing succeeds. Real publication and public service activation await the user.

## Delivery
An explicit trusted-worker quarantine option excludes entire chunks containing undecoded control or replacement glyphs. It never edits a character or infers a numeric sign. Original artifacts remain unchanged; candidate quality records original parser fingerprint, excluded chunk ordinals and physical pages. The quarantine policy produces a separate immutable candidate identity, leaves clean evidence bytes unchanged, and requires human review. Default imports reject undecoded evidence. Navigation-only snapshots remain source records outside answer snapshots.

Split implementation and review by data ingestion, versioning/rounds, answer/evaluation, and UI/operations. Save precise machine-readable progress and evidence under ignored reports. Preserve unrelated work. Use protected branches for code handoff; do not weaken hosting protection to automate checks.
