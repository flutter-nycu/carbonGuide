# RAG 操作說明、技術文件與版面改善：任務收尾單

更新：2026-10-28。基準提交 `028db7d`，範圍限 `preview/rag-admin-20261024`。

- **Task**：把使用者提出的技術名詞整合進技術文件，提供獨立後台使用指南，並改善按鈕後果、拒答顯示與版面。
- **Status**：`mock_verified`（本機實作與文件完成；此版記錄上傳前驗證，部署結果於後續補記）。
- **Mode**：真實檔案／PDF 產出；瀏覽器為合成資料及 mock 驗證，沒有真實資料修改或付費呼叫。

## Changed files

- [技術文件 JSON](rag-technical-reference.zh-TW.json)、[Markdown](rag-technical-reference.zh-TW.md)、[26 頁 PDF](../output/pdf/CarbonGuide-RAG-Technical-Reference-zh-TW.pdf)：加入白話名詞、資料關係、不可變性、RLS／RPC、公開 key、預留／留存、20／6／0.72 及 50／12／80 KB、OCR／Docling、模型與評測原理、尚未部署的雲端背景解析方案。
- [使用指南 JSON](rag-admin-guide.zh-TW.json)、[Markdown](rag-admin-guide.zh-TW.md)、[18 頁 PDF](../output/pdf/CarbonGuide-RAG-Admin-Guide-zh-TW.pdf)：逐頁列按鈕效果、何時寫入／付費、撤銷方式、拒答／失敗／不明／過期處理與人工審查順序。
- [EditorialForms.tsx](../src/push-admin/rag/EditorialForms.tsx)、[DraftsPage.tsx](../src/push-admin/rag/DraftsPage.tsx)：引用未存提示、清空引用限制、列表重載後保留成功訊息；排除／修訂建立新集合與新段落 ID 的說明。
- [TrialFlow.tsx](../src/push-admin/rag/TrialFlow.tsx)、[response-guidance.ts](../src/push-admin/rag/response-guidance.ts)、[InteractionHistory.tsx](../src/push-admin/rag/InteractionHistory.tsx)、[TrialsPanel.tsx](../src/push-admin/rag/TrialsPanel.tsx)：標示保存的拒答、分離管理員原因說明、不補造未完成答案；額度滿時提供歷史讀取路徑；技術 JSON 按需展開。
- [PageHelp.tsx](../src/push-admin/rag/PageHelp.tsx)、[ui.tsx](../src/push-admin/rag/ui.tsx)、[OperationsPages.tsx](../src/push-admin/rag/OperationsPages.tsx)、[workspace.css](../src/push-admin/rag/workspace.css)：七頁短指南、保留設定欄位的真實作用、表格短按鈕不拆字、checkbox 不縮小、長 ID 換行、費用表捲動與表單層次。
- [PDF builder](../scripts/build-rag-technical-pdf.py)、[PDF verifier](../scripts/verify-rag-pdfs.py)、[release checker](../scripts/check-release.mjs)、`.gitattributes`、`.gitignore`：同步 PDF／Markdown、嵌入中文字型、驗證／渲染；僅兩份明確授權 PDF 可入 Git，其他原始文件仍被擋；PDF 不做文字換行轉換，暫存渲染不提交。
- [guidance.test.tsx](../src/push-admin/rag/guidance.test.tsx)、[合成 fixture](../test/rag-ux-preview.tsx)、[操作驗證](../test/verify-rag-guidance.py)、[原導覽驗證](../test/verify-rag-ux.py)、README、舊使用說明與 [OpenSpec](../openspec/changes/rag-admin-guidance/proposal.md) 同步更新。

## Evidence / Verification

| 驗證 | 實際結果與本機證據 |
|---|---|
| 紅綠回歸 | 新增 6 個初始情境，修改前 5 個失敗；修正後加入真實列表重載情境，7 個皆過 |
| `npm.cmd run type-check` | 通過 |
| `npm.cmd test -- --reporter=json --outputFile=reports/rag-guidance/vitest.json` | 20 個檔案、111 tests 通過；[JSON](../reports/rag-guidance/vitest.json) |
| `npm.cmd run build` | 通過；另以假公開值啟用 RAG 建置 `.release-check/rag-guidance-dist` 做完整 mock 整合測試 |
| `npm.cmd audit --audit-level=moderate` | 沙箱無法存取 registry；經核准網路執行後 0 vulnerabilities |
| `node scripts/check-release.mjs` | 14 個正式 build artifacts 通過；不含 docs、來源檔或測試入口 |
| `openspec.cmd validate rag-admin-guidance --strict` | 通過 |
| `python -X utf8 test/verify-rag-ux.py http://127.0.0.1:4186 reports/rag-guidance/after` | 5 寬度、15 組導覽／焦點／分頁情境通過，0 外部請求／付費呼叫；[結果](../reports/rag-guidance/after/results.json) |
| `python -X utf8 test/verify-rag-guidance.py` | 1440／1024／768／390／375px 的操作提示、短按鈕、排除、未存引用撤銷、拒答／未知及無水平溢位皆通過；0 外部請求、0 saves、0 模型呼叫；[結果](../reports/rag-guidance/guidance-browser/results.json) |
| `python -X utf8 test/verify-rag-react.py http://127.0.0.1:4187 reports/rag-guidance/integration` | 7 組整合檢查通過；登出深連結、七頁、CSP、歷史、草稿、登出清理；唯一寫入是 mock QA，沒有真實請求 |
| PDF 建置／驗證 | 兩個 builder 指令及 `verify-rag-pdfs.py` 通過；26＋18 頁、同數書籤、14＋1 外部連結、CJK 字型嵌入、範圍及抽出文字敏感資料檢查通過；[結果與 SHA-256](../reports/rag-guidance/pdf/verification.json) |
| 視覺檢查 | 全 44 頁渲染為圖並以 12 張 contact sheets 檢視；先前「≥」缺字已改成「至少」，重新建置驗證通過。Poppler 不在環境，使用既有 PyMuPDF 渲染 |
| 獨立程式／文件複核 | 核對後端回答、QA、段落修訂與快照 SQL。發現並修正空引用成功訊息在 reload 消失、拒答原因過度推定，以及舊 Chrome 證據日期不清楚 |

本機截圖：[修改前文件詳情](../reports/rag-guidance/before/1440-document-detail.png)、[引用未存提示](../reports/rag-guidance/guidance-browser/1440-citation-draft.png)、[手機排除說明](../reports/rag-guidance/guidance-browser/390-exclusion-draft.png)、[手機保存拒答](../reports/rag-guidance/guidance-browser/390-saved-refusal.png)。`reports/` 不提交；這些都是合成資料，不是線上帳戶內容。

## Not run

- 本輪未重驗真實登入或線上私有歷史：Windows desktop MCP 三次回報 RPC server unavailable，CUA inventory 無 app／browser。已告知使用者；2026-10-27 真實 Chrome 證據明確標為前一輪。
- 未送新 Gemini 試問、embedding 或付費評測；未改 Supabase 資料／權限、真實審核／發布、Production／main 或 Flutter。
- 未建置雲端解析資源；Cloud Run Jobs 部分是建議方案。
- Safari、Firefox、實機、負載與新一輪內容語意驗收未執行。

## Risk / Next

設定頁仍保留不控制 v1 的 QA 門檻、fallback_reply 和一般日額度欄位，現在已明示。短段落修訂仍有 1,800-byte 後端限制，長內容需維護者批次處理。歷史 acceptance 36/40 沒有重跑或被改寫。完成 Preview 上傳後，建議管理員先閱讀指南第 5／7／10／15 頁，核對排除、引用、拒答與設定；連線恢復後補一次只讀的真實瀏覽器檢查。
