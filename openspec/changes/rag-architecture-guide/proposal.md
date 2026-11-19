## Why

業主要一頁能拿來教學的說明，讓不懂技術的人看懂這套 RAG：文件怎麼變成知識、一個問題怎麼被回答、品質與費用怎麼控管。現有 11 頁都是操作頁，規格也禁止在各頁放導引，所以需要一個獨立的介紹頁。2026-11-19 Ken 選定方案 A：獨立一頁，圖解加分步說明（規劃見 Multica 附件「RAG-技術架構導覽頁-實作規劃-20261119」）。

## What Changes

- RAG 工作台新增第 12 頁「技術架構導覽」，側欄新群組「認識系統」，放在最後；手機版選單同步。
- 頁面內容：
  - 架構總覽圖：網站、`rag-v1`、資料庫、自動處理、Gemini 五個區塊，點區塊會跳到對應步驟。
  - 分步說明：「文件怎麼變成知識」7 步、「一個問題怎麼被回答」8 步，每步有白話說明、背後技術與「到這一頁看看」按鈕。
  - 品質與安全怎麼把關：六張小卡。
  - 目前的實際設定：只讀既有資料，預算只有 owner 看得到。
  - 名詞小辭典。
- 三種角色都看得到；RAG 後端未啟用時照常顯示教學內容，只有實際設定一區顯示尚未啟用。
- 規格：工作台由 11 頁改為 12 頁；「各頁不得出現操作說明或導引」明確排除第 12 頁；連線開關、角色、響應式三條需求跟著調整。

不做：跨頁互動導覽（方案 B）、新的後端 API 或資料庫異動、新套件、修改其他 11 頁。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `rag-admin-live-workspace`：新增技術架構導覽頁，並調整頁數、連線開關、角色與響應式需求。

## Impact

- 程式：`src/push-admin/rag/pageList.ts`、`Workspace.tsx`、新增 `pages/ArchitecturePage.tsx` 與 `guideContent.ts`、`styles.css`。
- 測試：新增導覽頁元件測試；更新 `Workspace.test.tsx`、`test/rag-workspace.test.tsx`、`test/verify-rag-workspace.py`。
- 文件：網站 `AGENTS.md`、`README.md` 的 RAG 段落；後端 `docs/rag.md` 另以文件 commit 補充。
- 部署：只在分支 `preview/rag-architecture-guide` 的 Preview 驗收；合併 `main`（正式部署）要 Ken 另外授權。
