## Why

正式站 `/push-admin#rag` 的 RAG 知識工作台（commit `edead04`，全部假資料）給業主看之前，Ken 在 2026-11-01 提出修改：說明區塊太多、文字太技術，還有幾頁不該出現。係數與費率不應該另外處理，應該和其他資料一樣，透過匯入檔案或網址走 RAG。這次只改靜態 UI/UX，不接後端。

## What Changes

- 拿掉知識庫首頁的「第一次使用，從這裡開始」導引，以及 8 頁的「操作說明」折疊區。
- 拿掉知識庫表格下方的「文件何時會用在回答裡？」提示框、進階檢索設定右側的兩張說明卡，以及同性質的 System Prompt 頁右側兩張說明卡、人格設定頁底部提示框、試問台尚未試問時的三點說明。其中還有用的規則（至少要留一個人格啟用、套用提示詞後先用草稿預覽試問）改成一句註解保留。
- 拿掉「係數與費率」和「服務連線」兩頁；側欄從 12 頁變成 10 頁並重新編號。
- 進階檢索設定拿掉「文件處理與向量（進階）」整塊（每段大小、前後重疊、向量維度）。
- 匯入只收 PDF、DOCX、TXT 和網址，不再收 JSON，也不再把資料分流到係數核對。
- 拿掉獨立的計算流程：試問台不再有「計算資訊」欄位和「合成計算示例」，所有回答都靠 RAG 找文件並附引用，資料不夠就先追問。
- 試問台拿掉「回覆人格」下拉選單（Ken 在 Step 7 審核時提出）：人格只在人格設定頁管理，試問結果不套用人格語氣，互動紀錄也不再記人格。
- 工作台所有中文文字依 humanizer-zh-tw 改寫成白話，RAG、QA、System Prompt、Rerank 這類英文詞保留。
- 修兩個正式站看得到的 bug：文件彈窗內容貼齊外框、「跳至主要內容」會跳回推播管理。
- 完成並經 Ken 審核後，合併進 `main` 並推送。

## Capabilities

### New Capabilities
- `rag-admin-static-workspace`: 推播管理台裡的 RAG 知識工作台靜態示範，規範要顯示的頁面、不顯示的區塊、匯入格式、試問回答方式和文字風格。

### Modified Capabilities

（無。既有的 `rag-admin-integration` 與 `rag-coach-phase0-preview` 兩個 change 都還沒歸檔，`openspec/specs/` 沒有可以修改的基準。）

## Impact

- 程式：`src/push-admin/rag/app.js`、`src/push-admin/rag/index.html`、`src/push-admin/rag/styles.css`、`src/push-admin/components/Dashboard.tsx`。
- 測試：`test/rag-preview.test.ts`、`src/push-admin/components/Dashboard.test.tsx`、既有的整合驗證腳本 `test/verify-admin-integration.py`（改成 10 頁並補跳過連結檢查），以及本 change 的 `verify/` 瀏覽器驗證腳本。
- 文件：`README.md`、`AGENTS.md` 裡描述 RAG 工作台功能的段落。
- 不改：推播管理的四個分頁和它們的操作說明、登入流程、`vercel.json`、後端、App。
- 部署：網站 repo 推 `main` 就會觸發 Vercel Production 部署。正式站目前跑的就是 `edead04`，合併後 git 和正式站會重新一致；`main` 也會一併帶進 Phase 0 原型與文件（`f9a7467`、`14937b1`）以及 `edead04` 原有的修改。
