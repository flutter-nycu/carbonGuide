# RAG 詳情導覽與問答紀錄：任務收尾單

日期：2026-10-27。

**Task:** 解決長列表底部才展開詳情的問題，並在互動紀錄呈現已保存的問題、回答、來源與流程。

**Status:** `complete`，限本次 UX 與既有問答讀取修正。整體 RAG 內容仍是待人工審閱的候選版本，公開服務未啟用。

**Mode:** `real`。前端已推送、部署並在使用者登入的 Chrome 驗證真實資料；自動化瀏覽器測試使用合成資料，分開記錄。

**Changed files:**

- 導覽與詳情：[RagWorkspace.tsx](../src/push-admin/components/RagWorkspace.tsx)、[DetailDialog.tsx](../src/push-admin/rag/DetailDialog.tsx)、[DocumentsPage.tsx](../src/push-admin/rag/DocumentsPage.tsx)、[DraftsPage.tsx](../src/push-admin/rag/DraftsPage.tsx)、[CalculationPanel.tsx](../src/push-admin/rag/CalculationPanel.tsx)、[VersionsPanel.tsx](../src/push-admin/rag/VersionsPanel.tsx)、[workspace.css](../src/push-admin/rag/workspace.css)。
- 問答與流程：[InteractionHistory.tsx](../src/push-admin/rag/InteractionHistory.tsx)、[OperationsPages.tsx](../src/push-admin/rag/OperationsPages.tsx)、[TrialFlow.tsx](../src/push-admin/rag/TrialFlow.tsx)、[TrialsPanel.tsx](../src/push-admin/rag/TrialsPanel.tsx)、[TraceHistory.tsx](../src/push-admin/rag/TraceHistory.tsx)、[supabase-trials.ts](../src/push-admin/rag/supabase-trials.ts)、[v1.ts](../src/push-admin/rag/v1.ts)。
- 回歸測試：[navigation.test.tsx](../src/push-admin/rag/navigation.test.tsx)、[supabase-trials.test.ts](../src/push-admin/rag/supabase-trials.test.ts)、[traces.test.tsx](../src/push-admin/rag/traces.test.tsx)、[verify-rag-ux.py](../test/verify-rag-ux.py)、[verify-rag-react.py](../test/verify-rag-react.py)、[rag-ux-preview.html](../test/rag-ux-preview.html)、[rag-ux-preview.tsx](../test/rag-ux-preview.tsx)。合成資料入口不在 Vite 正式建置 entries。
- 規格與文件：[proposal](../openspec/changes/rag-ux-navigation/proposal.md)、[spec](../openspec/changes/rag-ux-navigation/specs/rag-navigation/spec.md)、[tasks](../openspec/changes/rag-ux-navigation/tasks.md)、[使用說明](rag-pilot-user-guide.zh-TW.md)及本收尾單。

**Evidence:**

- 實作 commit：[f6adae5](https://github.com/flutter-nycu/carbonGuide/commit/f6adae534881de3f5e62c4d52b2cc158328df2d4)，分支 `preview/rag-admin-20261024`；[Vercel 部署](https://vercel.com/fluttermans-projects/carbon-guide/AfJWeZ65Le161gDJKDXLxnqwF271)狀態 success。
- [受保護 Preview](https://carbon-guide-git-preview-rag-admin-f1f550-fluttermans-projects.vercel.app/push-admin#rag)。Windows desktop MCP 在 Orca 工作階段操作現有 Chrome，實際讀取文件與 `76c16511` 開頭的既有人工試問；可見原問題、完整回答、8 個引用、8 個流程節點及費用欄位。
- 本機私人截圖（不提交 Git）：[修正前文件](../reports/rag-ux-navigation/02-document-before.png)、[修正前紀錄](../reports/rag-ux-navigation/01-history-before.png)、[線上文件詳情](../reports/rag-ux-navigation/04-live-document-dialog.png)、[線上問答列表](../reports/rag-ux-navigation/05-live-history.png)、[線上完整問答](../reports/rag-ux-navigation/06-live-question-answer.png)、[線上流程成本](../reports/rag-ux-navigation/07-live-flow-cost.png)。

**Verification:**

| 驗證 | 結果 |
|---|---|
| `npm.cmd run type-check` | 通過 |
| `npm.cmd test -- --maxWorkers=1` | 19 檔、104 項通過；[本機 log](../reports/rag-ux-navigation/tests.log) |
| `npm.cmd run build` | 通過；合成後端設定建置亦通過 |
| `npm.cmd audit --audit-level=moderate` | 0 vulnerabilities，未改依賴 |
| `openspec.cmd validate --all --strict` | 11 項通過 |
| `python test/verify-rag-ux.py` | 1440／1024／768／390／375 px，15 項通過；Tab、Esc、焦點返回、捲動、分頁、保留期限及篩選；[結果](../reports/rag-ux-navigation/browser/results.json) |
| `python test/verify-rag-react.py http://127.0.0.1:4185 reports/rag-ux-navigation/integration` | 7 組整合檢查通過，包含正式 CSP、登入邊界、七個頁面、草稿 mock 儲存與登出；[結果](../reports/rag-ux-navigation/integration/results.json) |
| `python reports/rag-v1-delivery/scan-secrets.py` | 程式、文件及建置檔無 secret findings；不輸出金鑰 |
| `git diff --check`、獨立複審 | 通過；無 Critical／Important 阻擋項，複審另跑新增 12 項測試通過 |
| 真實 Preview 讀取 | 文件直接開視窗、Esc 回原按鈕；人工問答與來源／流程正確顯示。僅讀既有紀錄，沒有新模型呼叫 |

瀏覽器自動化均阻擋外部非預期請求；合成測試沒有真實 Supabase 寫入或模型呼叫。測試啟動的本機伺服器已停止。

**Not run:** 未測 Safari／Firefox；這次未重送付費試問、未跑全量模型評測，因為改動只涉及導覽及保存紀錄讀取。未改 Supabase migrations、RLS、管理員名單、正式站或 Flutter。

**Risk:** 正文沿用 owner-only 與 30 天保留期限；過期正文及舊版當時未保存的問答不能還原。費用預留不是扣款，缺用量及未對帳仍顯示未知。顯示既有答案不代表已人工核准其內容。瀏覽器測試不等於整個 Supabase 專案安全稽核。

**Next:** 使用者可直接到「互動紀錄」以人工試問／自動評測篩選，逐筆審閱問答與引用；文件及候選內容的人工審閱仍依[本輪驗收紀錄](rag-v1-delivery.zh-TW.md)執行。正式環境與 Flutter 接入留待後續授權。
