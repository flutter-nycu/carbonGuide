## 1. 準備

- [x] 1.1 從 main `c3b2d6a` 建立分支 `preview/rag-top-tabs`（不追蹤 main），把本 change 放進 repo，`openspec validate --strict` 通過
- [x] 1.2 記錄基準：`npm run type-check`、`npm test`、啟用 RAG 的 `npm run build`

## 2. 頁面與外框（每項先寫測試）

- [x] 2.1 `pageList.ts` 加 `placement`：側欄 01–10，`conversations`、`guide` 改為上方分頁、沒有編號
- [x] 2.2 `Workspace.tsx` 加 `view` 與 `onView`：工作台模式顯示側欄 10 頁；分頁模式全寬單頁；切換不卸載已開過的頁面
- [x] 2.3 頁內跳頁：`go(id)` 依頁面位置切到對應分頁；導覽頁「到這一頁看看」的按鈕文字與跳轉一起更新
- [x] 2.4 `RagWorkspace.tsx` 轉交 `view` 與 `onView`；三個 RAG 相關分頁共用同一個工作台
- [x] 2.5 `Dashboard.tsx` 上方四個分頁、依角色顯示、`#push`／`#rag`／`#conversations`／`#guide` 網址
- [x] 2.6 樣式：單頁全寬模式；390 寬分頁列不造成整頁水平捲動；不用 inline style
- [x] 2.7 導覽文字把「11 對話使用者」改成新位置，依 humanizer-zh-tw 撰寫

## 3. 測試與腳本

- [x] 3.1 更新 `Dashboard.test.tsx`、`rag/Workspace.test.tsx`、`rag/pages/*.test.tsx`、`test/rag-workspace.test.tsx`
- [x] 3.2 更新 `test/rag-live-preview.tsx` 與 `test/verify-rag-workspace.py`：10 頁＋兩個分頁、四種寬度、鍵盤與截圖
- [x] 3.3 更新 `test/verify-admin-integration.py`：四個上方分頁、角色、網址、正式 CSP、未啟用不送請求

## 4. 文件

- [x] 4.1 更新網站 `AGENTS.md`、`README.md`、`CLAUDE.md` 的頁面說明

## 5. 驗證與審查

- [x] 5.1 `npm run type-check`、`npm test`、`npm run build` 全部通過，比對 chunk 大小
- [x] 5.2 瀏覽器驗證腳本通過並輸出截圖
- [x] 5.3 檢查 diff 範圍與敏感資訊；變異測試確認新測試抓得到錯
- [x] 5.4 子代理 code review，修完 Critical／Important 後重新驗證

## 6. 交付（每一步都要 Ken 另外授權）

- [x] 6.1 略過：Ken 2026-11-19 指示不經 Preview，直接合併 main；改為正式站部署後驗證，真實資料由 Ken 登入確認
- [x] 6.2 後端 `docs/rag.md` 更新頁面位置（與本次歸檔同一輪推送）
- [x] 6.3 合併 main 部署正式站、同步 develop，部署後驗證（`b6eb4f5`，Production deployment `7907568568`；正式程式包模擬後端驗證 7 項通過，真實資料待 Ken 登入確認）
- [x] 6.4 歸檔本 change
