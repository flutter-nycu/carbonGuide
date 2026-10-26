# RAG v1 ready for owner review

## Why
The deployed owner pilot has a fixed two-document corpus and a three-request lifetime cap. The user now requests all remaining non-Flutter functionality and all source files uploaded, leaving final content review to the owner.

## What Changes
- Private original-file ingestion with a manifest, integrity verification, visible processing stages, editable candidate versions and resumable local batch processing.
- Complete source inventory import and candidate preparation; every unsupported, failed or uncertain source remains visible and unapproved.
- Versioned candidate/release snapshots of corpus, QA, persona, prompt, retrieval settings and calculation data; explicit human approval, publication and rollback controls.
- Bounded test rounds, shared spend accounting, daily quotas, cancellation/expiry, idempotency, retention jobs, evaluation runs and cost reconciliation imports.
- Gemini answer pipeline using snapshot-bound QA, retrieval, optional bounded rewrite/tools, citations, deterministic supported calculations and complete trace metadata.
- React controls and operational views, documentation, reviewed backend version handoff, protected Preview deployment and acceptance evidence.

## Scope and authorization
Use only the user-approved hxsrineeirmxpoovcrba project and existing protected Preview. All 45 files in C:/Users/User/App/rag_doc are authorized for private upload. Model execution beyond the old pilot waits for the user's explicit new spend cap. No Flutter integration, main/Production release, new administrator grants, public answering activation or content approval is performed by the agent. Preserve existing budgets/history; add new rounds rather than resetting old records. Implement administrative review/publication mechanisms but leave real candidate content awaiting the owner's review.

## Impact
Website: src/push-admin/rag, tests, release checks and docs. Backend source remains in the adjacent carbon-navigation repo under supabase and scripts/rag. Existing App/push data and authorization remain isolated. No raw documents, private reports or secrets enter Git/Vercel artifacts.
