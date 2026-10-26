# Tasks

## 1. Scope and baselines
- [x] Confirm current repository/cloud state and preserve unrelated changes.
- [x] Record the approved model spend cap; user approved US$5 for this corpus embedding and automated evaluation campaign on 2026-10-26. The prior pilot remains separate and unchanged.
- [x] Review and version the backend on `preview/rag-v1-review-20261027`; feature, parser and full-corpus retrieval fixes are pushed. Flutter and main are unchanged.

## 2. Originals and ingestion
- [x] Implement private upload registration, file integrity, processing jobs and bounded worker coordination.
- [x] Upload and verify every original in the source inventory, with no overwrite of existing objects. All 45 private objects passed download SHA-256 verification; receipts are local private evidence.
- [x] Parse the complete corpus with local resource limits; 47 PDF originals (1,834 physical pages), four link/directory DOCX files and one static HTML directory are parsed. JSON remains raw coefficient candidates; three TLS-failed URLs retain explicit failure records. Whole-chunk exclusions and original failed attempts remain visible for human review.
- [x] Implement candidate chunk corrections, profile-bound embedding, idempotent imports and progress/cost traces.
- [x] Complete permitted embedding runs within the approved budget and verify stored coverage. All 47 PDF candidates are ready: 9,271 retained chunks, 193 whole raw chunks quarantined, no content approvals. The final immutable snapshot excludes navigation-only DOCX/HTML and raw unreviewed coefficients.

## 3. Review and versions
- [x] Implement immutable snapshots including QA, persona, prompts, settings and calculation tables.
- [x] Implement explicit owner approval tied to snapshot hash, publication, rollback and audit. Synthetic SQL fixtures roll back; no real approval/publication performed.
- [x] Implement controlled test rounds, per-user quotas, global reservations and stop/expiry behavior.

## 4. Answer and evaluation
- [x] Connect snapshot-bound QA, retrieval, persona/style and citation validation.
- [x] Add deterministic approved-coefficient and supported electricity-tier tools, bounded optional rewrite/tool routing. Candidate historical electricity data is unapproved; rewrite remains off in current test snapshots.
- [x] Add evaluation execution/reporting with version pinning and mechanical-versus-human verdicts. Real full-corpus development is 19/20 and independent acceptance 36/40; failures remain in immutable reports, with human review pending.
- [x] Correct server citation-window boundaries using exact original offsets and complete quantity spans; 37 offline Node tests pass and independent review clears the Important finding. No paid retry or replacement of the original acceptance result.
- [x] Instrument branches, failures, preparation costs and unknown provider outcomes; add billed-cost import/reconciliation. No real Google bill imported.

## 5. Operations and UI
- [x] Implement React upload/progress, candidate editing, review/version, rounds/evaluation and cost controls.
- [x] Add bounded retention jobs, operational health/errors and actionable budget warnings.
- [x] Complete applicable automated dependency/security checks, secret scanning and mock browser acceptance. Latest Preview authenticated browser verification remains pending the user's login; Safari/real mobile/concurrency testing is not claimed.
- [x] Update usage/maintenance docs and original implementation-plan status to the actual final state.
- [x] Review, commit/push protected branches, deploy protected Preview/backend and verify deployment status and unauthenticated denial. Website code `548e23d` has a Ready Preview; backend `65e2f43` is pushed and `rag-v1` v4 is ACTIVE with JWT verification. Final documentation follows on the same Preview branches; authenticated latest-browser acceptance is explicitly pending user login.
- [x] Prepare the human-review checklist and evidence, including an owner-only five-request US$0.15 round within the same US$5 campaign. Real content remains unapproved and public answering disabled; overall delivery is candidate_only.
