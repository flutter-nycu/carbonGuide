## Why

James 看過正式站後提出：對話使用者和技術架構導覽是常用的兩頁，放在 RAG 側欄最下面不好找，希望改成管理後台最上方的分頁，技術架構導覽放最後。Ken 在 2026-11-19 選擇方案 A：從 RAG 側欄移出，只保留在上方分頁。

## What Changes

- 管理後台上方分頁從兩個變四個：推播管理（正式功能）、RAG 知識工作台（內部測試）、對話使用者、技術架構導覽。技術架構導覽排最後。
- 對話使用者分頁只顯示給 owner；技術架構導覽三種角色都看得到。新分頁不加小標籤。
- RAG 知識工作台的側欄與手機選單回到 01–10 共 10 頁，不再列出這兩頁。
- 兩個新分頁以全寬單頁顯示，不帶 RAG 側欄；頁面內容與功能不變。
- 網址可以直接打開分頁：`#push`、`#rag`、`#conversations`、`#guide`。角色看不到的分頁，網址也打不開。
- 導覽頁「到這一頁看看」改為先切到對應的上方分頁，再打開該頁；導覽文字裡的「11 對話使用者」改成新位置。

**不做：** 頁面內容或功能調整、後端與資料庫、新角色或新權限、推播管理四個功能分頁的改動、其他頁面的版面。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `rag-admin-live-workspace`：頁面清單改為「RAG 側欄 10 頁＋兩個上方分頁」，連線開關、角色、對話使用者、狀態保留、推播管理、響應式與技術架構導覽的相關文字一起更新。

## Impact

- 程式：`src/push-admin/components/Dashboard.tsx`、`RagWorkspace.tsx`、`index.css`（分頁列）；`src/push-admin/rag/pageList.ts`、`Workspace.tsx`、`styles.css`、`guideContent.ts`、`pages/ArchitecturePage.tsx`。
- 測試：`Dashboard.test.tsx`、`rag/Workspace.test.tsx`、`rag/pages/*.test.tsx` 的開頁方式、`test/rag-workspace.test.tsx`、`test/rag-live-preview.tsx`、兩支瀏覽器驗證腳本。
- 文件：網站 `AGENTS.md`、`README.md`、`CLAUDE.md`；後端 `docs/rag.md`。
- 不影響：後端、資料庫、`rag-v1`、Cloud Run、推播功能。正式站合併前維持現狀。
