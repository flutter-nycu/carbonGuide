## 1. Plan
- [x] 1.1 Specify nodes, cost semantics, security boundaries, rollout and acceptance criteria.
## 2. Trace foundation
- [x] 2.0 Store completed local evaluation metadata with owner-only RPCs, expiry and nonduplicated request reservations (App change `rag-trace-store`).
- [ ] 2.1 Complete the shared server trace contract, ingestion, storage, retention and authorization API.
- [ ] 2.2 Instrument every runtime branch, attempt and shared preparation charge.
## 3. React workspace
- [x] 3.0 Add the historical evaluation RPC viewer in interaction history (bounded change `rag-trace-viewer`; real recorded metadata, mock browser authentication).
- [ ] 3.1 Add execution detail to manual tests, evaluation rows and interaction history.
- [ ] 3.2 Add flow, node inspector, cost breakdown and accessible mobile timeline.
- [ ] 3.3 Verify with real successful, rejected, failed and reused executions; validate role restrictions and reconciliation.

已完成 App repo 的 `rag-answer-diagnostics`、`rag-trace-store`，以及網站 `rag-trace-viewer` 歷史流程介面。3.1–3.3 保留未完成，因為即時試問／評測入口、完整 runtime 分支、真實 owner OAuth 與帳單對帳仍未驗收；重播驗證不等於完整端到端完成。
