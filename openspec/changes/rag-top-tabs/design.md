## Context

- 基準：網站 main `c3b2d6a`。上方分頁在 `Dashboard.tsx`（`推播管理`、`RAG 知識工作台` 兩顆按鈕，`aria-current` 標示目前分頁，hash 只認 `#rag`、`#push`）。
- RAG 工作台由 `RagWorkspace.tsx` 建立 Shadow DOM，用 portal 畫 `rag/Workspace.tsx`；資料連線、toast、頁面保持掛載（keep-alive）都在這一個實例裡。正式站 CSP 是 `style-src 'self'`，不能用 inline style。
- 對話使用者（`conversations`）與技術架構導覽（`guide`）目前是 RAG 側欄的 11、12 頁。

## Goals / Non-Goals

**Goals：** 兩頁移到上方分頁、側欄回到 10 頁；切換分頁不重新載入、不丟狀態；網址可直接打開；角色規則不變；手機可用。

**Non-Goals：** 改頁面內容、後端、權限模型、推播功能分頁。

## Decisions

### T1 頁面定義
`pageList.ts` 的頁面加上 `placement: 'sidebar' | 'tab'`。側欄頁 01–10 保留編號；`conversations` 與 `guide` 改為 `tab`、沒有編號。`PageId` 不變，頁面元件與既有測試的 id 都不用改。

### T2 同一個工作台實例
三個 RAG 相關分頁（RAG 知識工作台、對話使用者、技術架構導覽）共用同一個 `RagWorkspace`：同一個 Shadow DOM、資料連線、toast 與保持掛載的頁面。`Workspace` 新增 `view: 'workspace' | 'conversations' | 'guide'` 與 `onView(view)`：
- `workspace`：顯示 RAG 側欄與目前的側欄頁。
- `conversations`、`guide`：只顯示該頁，全寬、不帶側欄。

切換分頁只改顯示，不卸載任何已開過的頁面；隱藏中的頁面照舊停止輪詢、關閉對話框（沿用 `PageActiveContext`）。

替代方案：每個分頁各掛一個 `RagWorkspace`。不採用，因為會重複建立資料連線與 Shadow DOM，切換時也會丟狀態。

### T3 上方分頁與網址
`Dashboard` 的工作台狀態擴充為 `push | rag | conversations | guide`，對應 hash `#push`、`#rag`、`#conversations`、`#guide`。分頁順序固定，技術架構導覽最後。對話使用者只在 owner 顯示；非 owner 開 `#conversations` 時當成不認得的 hash，停在預設的推播管理。舊的 `#rag` 書籤照常可用。

### T4 頁內跳頁
`NavigateContext` 的 `go(id)`：側欄頁 → `onView('workspace')` 並切到該頁；分頁頁 → `onView(該分頁)`。`Dashboard` 收到後更新分頁與 hash。導覽頁「到這一頁看看」的按鈕文字：側欄頁顯示「09 進階檢索設定」，分頁頁顯示「對話使用者」。

### T5 權限的兩層防護
上方不顯示對話使用者分頁只是畫面層。`Workspace` 對 `conversations` 的 owner 檢查與後端 RLS／`rag-v1` 檢查都保留。

### T6 樣式
- 單頁模式：RAG 外框不顯示側欄，內容全寬；新 class 加 `rag-` 或 `single` 前綴，放在 `rag/styles.css`。
- 上方分頁列（`index.css` 的 `.workspace-tabs`）：390 寬時四個分頁排一行；放不下時只在分頁列內左右捲動，不造成整頁水平捲動。

## Risks / Trade-offs

- 書籤或文件寫著「11 對話使用者」「12 技術架構導覽」→ 網站與後端文件同步改成分頁名稱；導覽文字一起改。
- 非 owner 收到 `#conversations` 連結時沒有提示，會停在推播管理 → 接受；這一頁本來就只給 owner。
- 分頁列在更窄的螢幕可能需要捲動 → 由規格保證不造成整頁捲動，並在 390 寬實測。

## Migration Plan

純前端調整。新分支 `preview/rag-top-tabs` 從 main 開出，Preview 驗收後再依授權合併 main、同步 develop。回滾：正式 alias 指回上一個部署，或 revert 後推 main；資料不受影響。
