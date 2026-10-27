# RAG detail navigation and readable interaction history

## Why
Document inspection renders after a long table, leaving the user at the clicked row with no visible detail. Similar separated list/detail flows make review difficult. The interaction log still prioritizes legacy evaluation metadata and does not show the new versioned requests or their saved questions and answers.

## What Changes
- Open document and selected history details in an accessible viewport dialog with independent scrolling, a persistent close control and focus restoration.
- Keep lists bounded and make common review actions visible before optional import/setup controls.
- Show saved v1 requests in the interaction log with question/answer details, citations, trace and costs; clearly separate metadata-only legacy traces.
- Display unavailable/expired details honestly, reject stale async results and preserve owner authorization and retention.
- Apply the same visible-detail behavior to related existing editors/history views where appropriate; preserve drafts and existing mutation safeguards.

## Scope
Existing React admin and its read contracts only. No paid test, corpus mutation, role expansion, retention extension, Flutter or Production release. Reuse the user-authorized protected Preview deployment workflow.
