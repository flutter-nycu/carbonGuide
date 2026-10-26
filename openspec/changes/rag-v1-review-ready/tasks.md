# Tasks

## 1. Scope and baselines
- [x] Confirm current repository/cloud state and preserve unrelated changes.
- [x] Record the approved model spend cap; user approved US$5 for this corpus embedding and automated evaluation campaign on 2026-10-26. The prior pilot remains separate and unchanged.
- [x] Review and version the backend on `preview/rag-v1-review-20261027`; `c1b487a` plus reviewed parser/quality fixes `b14cb09` are pushed. Flutter and main are unchanged.

## 2. Originals and ingestion
- [x] Implement private upload registration, file integrity, processing jobs and bounded worker coordination.
- [x] Upload and verify every original in the source inventory, with no overwrite of existing objects. All 45 private objects passed download SHA-256 verification; receipts are local private evidence.
- [ ] Parse the complete corpus with local resource limits; retain failed/uncertain sources and quality findings.
- [x] Implement candidate chunk corrections, profile-bound embedding, idempotent imports and progress/cost traces.
- [ ] Complete permitted embedding runs within the approved budget and verify stored coverage.

## 3. Review and versions
- [x] Implement immutable snapshots including QA, persona, prompts, settings and calculation tables.
- [x] Implement explicit owner approval tied to snapshot hash, publication, rollback and audit. Synthetic SQL fixtures roll back; no real approval/publication performed.
- [x] Implement controlled test rounds, per-user quotas, global reservations and stop/expiry behavior.

## 4. Answer and evaluation
- [x] Connect snapshot-bound QA, retrieval, persona/style and citation validation.
- [x] Add deterministic approved-coefficient and supported electricity-tier tools, bounded optional rewrite/tool routing. Candidate historical electricity data is unapproved; rewrite remains off in current test snapshots.
- [x] Add evaluation execution/reporting with version pinning and mechanical-versus-human verdicts. Full-corpus acceptance run remains part of delivery verification.
- [x] Instrument branches, failures, preparation costs and unknown provider outcomes; add billed-cost import/reconciliation. No real Google bill imported.

## 5. Operations and UI
- [x] Implement React upload/progress, candidate editing, review/version, rounds/evaluation and cost controls.
- [x] Add bounded retention jobs, operational health/errors and actionable budget warnings.
- [ ] Complete applicable dependency/security checks, secret scanning and browser acceptance.
- [ ] Update usage/maintenance docs and original implementation-plan status to the actual final state.
- [ ] Review, commit/push protected branches, deploy protected Preview/backend and verify.
- [ ] Deliver a human-review checklist and evidence; real content remains unapproved and public answering disabled.
