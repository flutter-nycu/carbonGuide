## Why

`edead04` 把 RAG 工作台移進 `/push-admin` 的 Shadow DOM 後，在 Multica C-2 的 UI/UX 檢查中發現 4 個明確錯誤（P0）與 6 個動線問題（P1）。使用者已同意依 P0＋P1 修改，P2（字級、對比、重複的假資料提示、兩個工作台的外觀統一）留待下一輪。

## What Changes

- P0：修正 `styles.css` 被取代壞的 `.help-body`、`#dialog-body` selector；側欄改為動態顯示目前發布版本；移除指向不存在的 `./prototype.html` 連結；重繪後保留或移回鍵盤焦點，試問後焦點移到回答。
- P1：第一次使用的引導只在第一次展開，各頁操作說明預設收合，移除 RAG 麵包屑；側欄依「知識內容 → 教練 → 驗證與發布 → 紀錄與設定」重新分組並拿掉編號；側欄上方顯示草稿狀態並連到下一步。
- P1：設定頁改名「RAG 設定」，分成可調整的回答方式與檢索、以及只顯示的索引設定；恢復 Phase 0 決定開放的設定項目，「回答風格」改為提示詞選項，不再對應 temperature。索引設定依網站 repo `rag-v1-implementation-plan.md` 的 OpenAI 候選（2026-10-25 起為 `text-embedding-3-large`、1,536 維）顯示。
- P1：720px 以下的文件列表改成卡片；匯入預檢的資料用途與生活領域改成逐列設定，預設帶入上一次的選擇。
- 同步單元測試與整合工作台的瀏覽器驗證腳本。

## Capabilities

### New Capabilities
- `rag-admin-ux`: RAG 假資料工作台的導覽、狀態提示、設定分層、焦點管理與手機版文件列表。

### Modified Capabilities

（無；`rag-admin-workspace` 仍在未歸檔的 `rag-admin-integration` change 中，本 change 不改它的需求。）

## Impact

- `src/push-admin/rag/`（`index.html`、`app.js`、`styles.css`）、`test/rag-preview.test.ts`、`test/verify-admin-integration.py`、README 與 `AGENTS.md` 的相關描述。
- 仍是記憶體假資料，不呼叫解析、模型、儲存或推播服務；推播工作台的程式不變。
- 推送 `preview/rag-admin-20261024` 會觸發 Vercel Preview；不合併或推送 `main`。
