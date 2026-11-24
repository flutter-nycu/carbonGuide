## Why

James 在 2026-11-24 看過本機的 `/push-admin#rag` 後提出：文字有 AI 腔、不好懂，最上方太高，側欄不能收，整體操作體驗差。同日逐項確認了改法（見 design.md「決策」）。

## What Changes

- **上方列**：品牌列和分頁列合成一列，桌面版 52px，捲動時固定在頂端；手機版分兩列。拿掉「正式功能」「內部測試」小標籤。分頁改名：RAG 知識工作台 → 知識庫、技術架構導覽 → 運作原理。網址 hash 不變。
- **頁首**：拿掉麵包屑，標題 20px，副標一句 20 字以內，主要按鈕放在標題同一列右側。推播頁的標題樣式一起改，文字不動。
- **側欄**：拿掉 01–10 編號，依實際操作流程重排成「資料／教練／測試與發布／紀錄」四組，頁名改成白話；可以收成 56px 圖示窄條，收合狀態存在瀏覽器；寬度 1100px 以下預設收起；手機維持下拉選單。拿掉側欄頂端的工作台名稱、底部角色說明和頁尾。
- **字級與密度**：最小字 13px、正文 14px；按鈕與輸入框桌面 36px、手機 44px；表格與卡片內距收緊。空狀態和錯誤附上下一步按鈕。
- **操作教學**：保留還沒提交的教學面板，改名「操作教學」，平常收成右下角按鈕，不自動打開、不佔版面；進度存在瀏覽器。
- **文字**：三個 RAG 分頁的所有文字（頁面、對話框、錯誤訊息、教學、運作原理）依新的白話規則改寫；技術細節只留在運作原理頁，且預設收起。

**不做：** 推播頁的文字與推播側欄收合、後端與資料庫、權限、資料契約、計費與重送邏輯。後端 `docs/rag.md` 等決定上線時再更新。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `rag-admin-live-workspace`：上方分頁與側欄的名稱、順序、收合；頁首；操作教學；文字規則；響應式；推播管理的版面。

## Impact

- 程式：`components/Dashboard.tsx`、`index.css`；`rag/pageList.ts`、`Workspace.tsx`、`ui.tsx`、`icons.tsx`（新）、`Tutorial.tsx`、`tutorialContent.ts`、`guideContent.ts`、`labels.ts`、`api/errors.ts`、`styles.css`、`pages/*.tsx`；`test/rag-live-preview.tsx`。
- 測試：元件測試裡依畫面文字找元素的地方；兩支瀏覽器驗證腳本。
- 文件：`AGENTS.md`、`README.md`、主規格。
- 不影響：後端、`rag-v1`、資料表、RLS、Cloud Run、推播功能。commit、推送與部署都另外取得同意。
