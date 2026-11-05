## 參考架構盤點（task 1.2，2026-11-05）

來源：`origin/preview/rag-admin-20261024`（`c34f02c`）的 `src/push-admin/rag/`。

### 沿用（改寫成主專案的資料層）

| 參考檔案 | 沿用內容 | 落在哪裡 |
|---|---|---|
| `repository.ts`、`v1.ts` | 資料表欄位與 `rag-v1` action 的輸入輸出格式：文件、版本、段落、原始檔、工作、網址、快照、審核、發布、評測、輪次、請求、模型呼叫 | `rag/api/types.ts`（改成前端用的型別，欄位轉成 camelCase） |
| `supabase-v1.ts` 的 `errors` 與 `action()` | 錯誤碼對照、從 `error.context` 讀出錯誤碼的做法 | `rag/api/errors.ts`（文案依 humanizer-zh-tw 重寫） |
| `supabase-v1.ts` 的 `upload()` | SHA-256 → `upload_begin` → signed URL 上傳 → `upload_verify`；已存在的檔案直接回報 | `rag/api/supabase.ts`（task 2.3） |
| `TrialFlow.tsx` | 流程步驟名稱、狀態名稱、預留／估算／帳單三層費用的語意 | 共用的單次對話詳情（task 5.1）；估算改由伺服器計算 |
| `response-guidance.ts` | 結果原因的說明 | `rag/api/errors.ts` 的原因說明，拿掉計算相關的原因 |
| `DetailDialog.tsx` | 原生 `<dialog>`、焦點移入與還原 | 工作台外框的 `Dialog`（task 3.2），焦點改從 `shadowRoot.activeElement` 取得 |

### 排除

- 計算與係數：`CalculationPanel`、`calculations`、`coefficients`、`saveCalculation`、`CalculationDraft`、`CoefficientRow`、快照的 `calculation_ids` 與 `tools_enabled`、`deterministic_tools` 步驟、`deterministic_calculation` 與 `full_bill_unsupported` 原因。
- 帳單：`billing.ts`、`operations.recordBill`、`CostPanel` 的帳單匯入、`bill_*` 錯誤碼。
- 說明區塊：`PageHelp`。
- 舊試問：`pilot.ts`、`PilotPage` 的 OwnerPilot、`rag-pilot` function。
- 舊紀錄：`traces.ts` 的本機評測 trace（`rag_runs`、`rag_list_traces`）。主專案的互動紀錄改用 `rag_v1_requests`。
- 設定：回答風格、每日題數、相似度門檻、QA 門檻、資料不足回覆這幾個欄位不放進 09 頁，只保留候選數與參考段落數。
- 檔案格式：`validateFile` 允許 JSON，主專案不允許。
- 錯誤碼 `url_source_not_allowed` 的「只接受四個網域」文案：後端改成任何 https 網址後不再適用，改成 https 與 PDF 的說明。

### 參考版沒有、這次新增

- 對話使用者的三個查詢（`conversation_users`、`user_conversations`、`conversation_detail`）。
- 處理狀態「預算不足暫停」（embed 工作 `pending` 且 `failure_reason='campaign_unavailable'`）。
- 試問台自動建立輪次（設計 W7）。
- 請求鍵存在元件外（設計 W3）。
