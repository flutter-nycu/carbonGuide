## 1. P0 錯誤

- [x] 1.1 修正 `styles.css` 的 `.help-body`、`#dialog-body` selector，並加測試防止再出現 `-.rag-body`
- [x] 1.2 側欄狀態卡動態顯示目前使用版本
- [x] 1.3 移除服務連線頁的 `prototype.html` 連結，改為 repo 路徑說明
- [x] 1.4 重繪與彈窗關閉後還原焦點，試問後聚焦回答

## 2. P1 結構與動線

- [x] 2.1 移除 RAG 麵包屑；「第一次使用」只在第一次展開；各頁操作說明預設收合
- [x] 2.2 側欄重新分組、拿掉編號；手機選單使用相同分組
- [x] 2.3 側欄顯示草稿狀態與下一步入口；發布與回滾不遞增草稿修訂號；沒有修改時停用審核與發布
- [x] 2.4 設定頁改為「RAG 設定」，分成回答方式、檢索、唯讀索引設定；查無資料回覆用於試問
- [x] 2.5 720px 以下文件列表改為卡片
- [x] 2.6 匯入預檢逐列設定資料用途與生活領域

## 3. 驗證與交付

- [x] 3.1 更新 `test/rag-preview.test.ts` 與 `test/verify-admin-integration.py`
- [x] 3.2 `npm run type-check`、`npm test`、`npm run build`、mock 瀏覽器整合驗證、OpenSpec strict validation、`git diff --check`
- [x] 3.3 更新 README、`AGENTS.md` 的 RAG 工作台描述
- [x] 3.4 commit 並推送 `preview/rag-admin-20261024`，核對遠端 SHA 與 `main` 未變
