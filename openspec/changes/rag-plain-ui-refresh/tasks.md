## 1. 準備

- [x] 1.1 在 main 工作樹（基準 `3e43b41`，含未提交的教學面板）建立本 change，不切分支
- [x] 1.2 用本機無頭 Chromium 截改前畫面（1440、1024、390）

## 2. 第一階段：外框

- [x] 2.1 上方列合成一列、拿掉小標籤、分頁改名；手機兩列；推播頁標題樣式比照
- [x] 2.2 `pageList.ts` 新頁名、分組、順序、副標，拿掉編號
- [x] 2.3 頁首：拿掉麵包屑、20px 標題、`PageAction` 按鈕位置；搬移文件、教練人格、常見問答的主要按鈕
- [x] 2.4 側欄：圖示、收合窄條、localStorage、1100px 以下預設收起；拿掉重複資訊
- [x] 2.5 字級與密度：最小 13px、正文 14px、桌面 36px／手機 44px、收緊內距
- [x] 2.6 操作教學：預設收起、浮動面板、進度存 localStorage、收合側欄的小圓點
- [x] 2.7 更新測試與 `test/rag-live-preview.tsx`；type-check、測試、build 通過
- [x] 2.8 截改後畫面，James 在 5173 看過後指示繼續（2026-11-25）

## 3. 第二階段：文字

- [x] 3.1 各頁文字、對話框、空狀態與錯誤的下一步按鈕
- [x] 3.2 `labels.ts`、`api/errors.ts`
- [x] 3.3 教學內容 `tutorialContent.ts`
- [x] 3.4 運作原理頁：白話、技術細節預設收起、名詞辭典
- [x] 3.5 主規格其他提到舊頁名與文字規則的需求（本 change 的 delta：10 個需求改名、17 個改寫、2 個新增；本機沒有 openspec CLI，尚未跑 `openspec validate --strict`）

## 4. 驗收與文件

- [x] 4.1 `npm run type-check`、`npm test`、啟用 RAG 的 `npm run build`
- [x] 4.2 更新並重跑 `test/verify-rag-workspace.py`、`test/verify-admin-integration.py`
- [x] 4.3 1440、1024、390 改前改後截圖
- [x] 4.4 更新 `AGENTS.md`、`README.md`

## 5. 交付（每一步都要另外取得同意）

- [x] 5.1 commit（`6c5d097`，James 2026-11-25 同意）
- [x] 5.2 推送 main 部署正式站（James 2026-11-25 指示；不經 Preview，develop 未同步）
- [ ] 5.3 後端 `docs/rag.md`、歸檔本 change
