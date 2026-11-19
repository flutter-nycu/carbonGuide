## Why

正式站 `/push-admin#rag` 的 RAG 知識工作台（`9a479c4`）目前全是假資料。Ken 在 2026-11-02 到 2026-11-05 確認：以這個介面為主專案，接上 App repo `rag-backend-live` 提供的真實後端；功能以參考架構（`preview/rag-admin-20261024`，`c34f02c`）已有的為上限；另外新增一個查看對話使用者的選單。

## What Changes

- RAG 工作台改用 React 元件實作，仍然掛在既有的 shadow DOM 裡，沿用 10 頁的版面、樣式與白話文案。靜態示範的 `app.js` 移除。
- 10 頁接上真實資料：

  | 頁面 | 改變 |
  |---|---|
  | 知識庫 | 列表、處理狀態、段落、原檔下載、用途修改、段落修訂與排除 |
  | 匯入 | PDF、DOCX、TXT 可多選並逐一上傳；登記 PDF 網址；顯示自動處理進度 |
  | 試問台 | 選知識版本後試問，顯示回答、引用、處理流程與費用 |
  | 評測、知識版本、人格、System Prompt、QA、檢索設定、互動紀錄 | 改用後端資料 |

- 新增第 11 頁「對話使用者」：使用者列表 → 個人對話 → 單次對話詳情（流程、引用、費用）。
- 拿掉後端沒有的功能：
  - **BREAKING** 試問台的「草稿預覽」改成選擇知識版本。
  - 結果類型「需要追問」拿掉。
  - 進階檢索設定的 Rerank 拿掉。
  - 知識庫逐份核准、示範批次拿掉。
- 新增連線開關：沒有啟用 RAG 後端時，每頁只顯示「尚未連線」，不發出任何 RAG 請求。
- 修正登入流程：token 自動更新或分頁回到前景時，不再卸載整個工作台，避免試問等付費請求重送。
- 推播管理的四個分頁、操作說明與「跳至主要內容」的行為維持不變；工作台切換鈕的「假資料示範」標籤改掉。

## Capabilities

### New Capabilities

- `rag-admin-live-workspace`: 推播管理台裡接上真實後端的 RAG 知識工作台，包含 11 頁的功能、權限、狀態、錯誤訊息與文字風格。

### Modified Capabilities

（無。上一個 change `rag-admin-static-uiux-cleanup` 的 `rag-admin-static-workspace` 尚未歸檔，`openspec/specs/` 沒有可以修改的基準。本 change 的 spec 取代它的內容，兩個 change 歸檔時一起處理。）

## Impact

- 程式：
  - `src/push-admin/rag/`：新的 React 元件、資料層與型別；移除 `app.js`。
  - `src/push-admin/components/RagWorkspace.tsx`、`Dashboard.tsx`、`App.tsx`。
  - `tailwind.config.js`：content 排除 RAG 目錄。
- 測試：
  - `test/rag-preview.test.ts` 改寫成針對 React 版本的跨頁檢查（改名為 `test/rag-workspace.test.tsx`）。
  - 新增元件測試與資料層測試，`Dashboard.test.tsx`、`App.test.tsx` 跟著調整。
  - 新的瀏覽器驗證腳本使用假的資料層（`test/verify-rag-workspace.py`、`test/rag-live-preview.*`）；`test/verify-admin-integration.py` 改成檢查 React 版的 11 頁與未啟用狀態。
- 文件：`README.md`、`AGENTS.md` 的 RAG 工作台段落。
- 設定：新增 `VITE_RAG_ENABLED`，正式站預設不啟用，由 Ken 在 Vercel 設定。
- 相依：`rag-backend-live` 的 migration 與 `rag-v1` 部署完成之前，本 change 只留在 preview 分支，不推 `main`。
