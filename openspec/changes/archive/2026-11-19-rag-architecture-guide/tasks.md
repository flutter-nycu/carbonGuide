## 1. 準備

- [x] 1.1 從 `origin/main` `a831af7` 建立分支 `preview/rag-architecture-guide`（不追蹤 main）
- [x] 1.2 歸檔已完成的 `rag-admin-live-workspace`，同步成主規格 `openspec/specs/rag-admin-live-workspace/spec.md`
- [x] 1.3 建立本 change 的 proposal、design、spec、tasks，`openspec validate --strict` 通過
- [x] 1.4 記錄基準：`npm run type-check`、`npm test`、`npm run build`

## 2. 頁面與外框

- [x] 2.1 先寫測試，再在 `pageList.ts` 新增第 12 頁與「認識系統」群組，`Workspace.tsx` 在後端未啟用時也渲染導覽頁
- [x] 2.2 先寫測試，再建立 `guideContent.ts`：五個架構區塊、兩條路線（7 步、8 步）、六張把關小卡、名詞辭典，每一步都有說明、技術與區塊
- [x] 2.3 先寫測試，再實作 `ArchitecturePage.tsx`：架構圖、路線切換、上一步／下一步、圓點、區塊跳步驟、「到這一頁看看」、鍵盤操作與 `aria-live`
- [x] 2.4 先寫測試，再實作「目前的實際設定」：依角色決定要不要查詢，後端未啟用時不送請求
- [x] 2.5 `styles.css` 加上 `guide-` 樣式，架構圖桌機橫排、1000px 以下直排，不用 inline style

## 3. 既有測試與腳本

- [x] 3.1 更新 `Workspace.test.tsx`、`test/rag-workspace.test.tsx`：12 頁、導引例外只限第 12 頁、各角色可見頁面
- [x] 3.2 更新 `test/verify-rag-workspace.py`：加入第 12 頁，在四種寬度檢查水平捲動、鍵盤操作與截圖

## 4. 文字與文件

- [x] 4.1 新文字依 humanizer-zh-tw 撰寫，由子代理獨立審一次並修正；技術事實與後端 `docs/rag.md` 對照
- [x] 4.2 更新網站 `AGENTS.md`、`README.md` 的 RAG 段落（12 頁、導覽頁）

## 5. 驗證與審查

- [x] 5.1 `npm run type-check`、`npm test`、`npm run build` 全部通過，比對 RAG chunk 大小
- [x] 5.2 瀏覽器驗證腳本通過並輸出截圖
- [x] 5.3 檢查 diff 範圍與敏感資訊
- [x] 5.4 子代理 code review，修完 Critical／Important 後重新驗證

## 6. 交付（每一步都要 Ken 另外授權）

- [x] 6.1 commit 並推送 `preview/rag-architecture-guide`，在 Preview 用真實資料看一次（`386f26e`，Preview 由 Ken 檢查）
- [x] 6.2 後端 `docs/rag.md` 補上導覽頁的說明（後端 `d08bfb7`）
- [x] 6.3 合併 `main` 部署正式站並驗證（`8ab7394`，Production deployment `7903374158`；Ken 以真實資料驗證）
