## Why

業主要先看過 AI 氣候教練（RAG）的畫面與後台，才決定要不要進入實作。2026-10-04 已有一份離線 HTML 互動原型，但它少了 RAG 參數設定頁，還混著這次不做的通勤功能，也只能用 zip 傳給業主。這次把原型整理成 Phase 0 版本，放到 Vercel 預覽網址，業主打開網址就能看，不動 App，也不動正式站。

## What Changes

- 以 `CarbonGuide-RAG-Admin-UI-20261019.zip` 內的 `prototype.html` 為基礎，產出單一靜態頁 `public/rag-preview/index.html`，部署路徑為 `/rag-preview/`。
- 新增後台「RAG 設定」頁：7 項可調參數、幾項唯讀資訊，儲存只在本頁生效。
- 新增後台「測試對話」頁：3 段固定示範對話（命中通用 QA、命中文件段落、查無資料），每段附檢索結果，沒有輸入框。
- 「氣候教練」頁中間改成手機框，流程為 App 主頁入口卡片 → 選人格 → 對話。
- 移除通勤日誌、通勤模型評估、通勤相關假資料與隱私／研究同意視窗。
- 保留並改寫「展示說明」頁：刪通勤內容，展示順序補上手機流程、RAG 設定與測試對話。
- 原本是中文的文字依 humanizer-zh-tw 改寫；英文小標不動。
- 頁面加上 `noindex` 與「示範原型，全部為假資料」橫幅。
- 只推送到新分支 `preview/rag-phase0`，不合併 `main`，不改 `vercel.json` 與既有程式。

## Capabilities

### New Capabilities
- `rag-coach-preview`: 給業主看的 AI 氣候教練靜態原型，包含手機端教練流程、RAG 後台各頁、展示說明與預覽部署邊界。

### Modified Capabilities

（無）

## Impact

- 新增檔案：`public/rag-preview/index.html`（Vite 會原樣複製到 `dist/rag-preview/`）。
- 新增規格：`openspec/`（本 change 與 `config.yaml`）。
- 不修改：`vercel.json`、`vite.config.ts`、`src/`、既有 HTML 頁面、`/push-admin`。
- 不接 Supabase、Gemini 或任何 API；頁面沒有網路請求。
- 不碰 App repo `githyoung/carbon-navigation`。
- 部署：Vercel 只會為新分支建立預覽部署；正式站 `carbon-guide.vercel.app` 仍由 `main` 的 `cfd6773` 提供。
- 風險：預覽網址可能被 Vercel 預覽保護擋住，業主需要登入才看得到；備案是交付 zip。
