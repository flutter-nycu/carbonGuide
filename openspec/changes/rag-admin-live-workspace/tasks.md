## 1. 準備

- [x] 1.1 確認分支 `preview/rag-admin-live-20261105` 從 `9a479c4` 開出；`npm install --package-lock=false` 後執行 `npm run type-check`、`npm test`、`npm run build`，記錄基準結果與 pushAdmin bundle 大小
- [x] 1.2 從參考分支 `c34f02c` 讀出要參考的資料層與元件（`supabase-v1.ts`、`repository.ts`、`supabase-evaluation.ts`、`TrialFlow`、`DetailDialog`），列出要沿用與要排除的部分（計算、帳單、PageHelp、pilot）

## 2. 資料層

- [x] 2.1 先寫測試，再定義 `rag/api/types.ts`：文件、版本、段落、原始檔、網址、處理狀態、知識版本、評測、人格、提示詞、QA、設定、輪次、試問結果、對話使用者、對話詳情、錯誤
- [x] 2.2 先寫測試，再實作 `rag/api/errors.ts`：錯誤碼轉白話訊息，不認得的碼附上錯誤碼
- [x] 2.3 先寫測試（mock supabase client），再實作 `rag/api/supabase.ts`：所有讀取、`rag-v1` action、上傳 signed URL 流程、樂觀鎖衝突處理
- [x] 2.4 實作 `rag/api/fake.ts`：記憶體資料，涵蓋各種狀態與錯誤，供測試與瀏覽器驗證使用
- [x] 2.5 實作請求鍵 store（元件外保存，成功後才清掉），並寫測試

## 3. 工作台外框

- [x] 3.1 先寫測試：11 頁導覽與手機選單、頁面保持掛載、被隱藏時關閉對話框、未啟用時顯示尚未連線且沒有請求、跳至主要內容只移動焦點
- [x] 3.2 改寫 `RagWorkspace.tsx`：在 shadow root 裡用 React 掛上工作台；建立 `Shell`、`Sidebar`、`PageHeader`、`Dialog`、`Toast` 元件，沿用 `styles.css`
- [x] 3.3 `Dashboard.tsx` 改用 `React.lazy` 載入 RAG 工作台，並改掉切換鈕的「假資料示範」標籤
- [x] 3.4 先寫失敗的測試（token 更新、同一使用者 `SIGNED_IN` 都不卸載），再修正 `App.tsx`

## 4. 知識庫與匯入（01、02）

- [x] 4.1 先寫測試，再實作 01 知識庫：列表、搜尋、用途與領域篩選、狀態標籤、文件詳情（段落、原檔下載、修改用途、修訂或排除段落）、依角色停用操作
- [x] 4.2 先寫測試，再實作 02 匯入：多檔依序上傳與逐一結果、格式和大小的前端檢查、https PDF 網址登記
- [x] 4.3 先寫測試，再實作處理狀態輪詢：只在有待處理項目且頁面可見時，每 15 秒更新一次

## 5. 試問台與單次對話詳情（03）

- [x] 5.1 先寫測試，再實作共用的單次對話詳情：流程步驟的白話名稱、引用、逐筆費用與單價版本、過期內容的說明
- [x] 5.2 先寫測試，再實作 03 試問台：選版本、自動建立輪次並顯示剩餘額度、試問、四種結果、引用、重送時使用同一個請求鍵、停止本輪

## 6. 評測與知識版本（04、05）

- [x] 6.1 先寫測試，再實作 04 評測：登記題組、開始、逐題執行、離頁暫停與接續、報告
- [x] 6.2 先寫測試，再實作 05 知識版本：建立、審核、發布條件清單、發布、退回、停用

## 7. 教練設定與檢索設定（06–09）

- [x] 7.1 先寫測試，再實作 06 人格：新增、編輯、啟用或停用（至少留一個）、衝突提示
- [x] 7.2 先寫測試，再實作 07 System Prompt：存草稿、歷次版本、下次建立版本才生效的說明
- [x] 7.3 先寫測試，再實作 08 QA：新增、編輯、停用、引用核對（最多 5 筆）
- [x] 7.4 先寫測試，再實作 09 檢索設定：兩個欄位、範圍與大小關係的檢查、儲存後的說明

## 8. 紀錄與對話使用者（10、11）

- [x] 8.1 先寫測試，再實作 10 互動紀錄：依來源篩選、分頁、打開詳情
- [x] 8.2 先寫測試，再實作 11 對話使用者：列表搜尋與分頁、個人對話列表、單次詳情、已刪除帳號、非 owner 時顯示無權限

## 9. 移除靜態示範與文字

- [x] 9.1 刪除 `rag/app.js`、`rag/app.d.ts`、`rag/index.html`，把 `test/rag-preview.test.ts` 改寫成跨頁檢查 `test/rag-workspace.test.tsx`；確認沒有殘留引用
- [x] 9.2 所有新的中文文字依 humanizer-zh-tw 撰寫；由子代理獨立審一次並修正
- [x] 9.3 更新 `README.md`、`AGENTS.md` 的 RAG 工作台段落：接上真實後端、11 頁、`VITE_RAG_ENABLED` 開關、驗證方式

## 10. 驗證與審查

- [x] 10.1 `npm run type-check`、`npm test`、`npm run build` 全部通過，記錄 exit code；比對 pushAdmin 與 RAG chunk 的大小（2026-11-05：三項 exit 0，23 檔 177 個測試；以 mock 的 `VITE_SUPABASE_*` 建置，pushAdmin 384.26 kB 與改動前相同，RAG 延遲載入 chunk 81.42 kB）
- [x] 10.2 新寫瀏覽器驗證腳本（Vite dev server 搭配假資料層），在 1440、1024、768、390 寬度檢查 11 頁、對話框焦點、Esc、水平溢出、主控台錯誤，並輸出截圖（`test/verify-rag-workspace.py` 13 項；`test/verify-admin-integration.py` 改寫成 React 版 7 項；另以 `VITE_RAG_ENABLED=true` 建置，在正式 CSP 下確認資料層載入、沒有主控台錯誤）
- [x] 10.3 檢查 diff：只動到 design 列出的檔案與本 change 目錄；沒有金鑰或連線資訊（範圍外只有上一個 change 未提交的 tasks.md 勾選；新測試改用 `PUSH_ADMIN_EMAIL` 常數，沒有新增寫死的 Email）
- [x] 10.4 子代理 code review，修完 Critical／Important 後重新驗證（Critical 1：試問重送遇到「仍在處理」時清掉請求鍵；Important 7：輪次重送內容不同、瀏覽器時鐘偏快、段落重新編號與修訂基準、只改文字的段落不會向量化、試問中可換版本、角色可讀頁面、對話框 id 重複。全部修正並補測試，Minor 也修了 M1–M9；另修自我審查發現的發布／版本建立重送內容問題與評測離頁時卡住）

## 11. 交付（Step 7 之後，每一步都要 Ken 另外授權）

- [ ] 11.1 commit 並推送 `preview/rag-admin-live-20261105`
- [ ] 11.2 `rag-backend-live` 部署後，在 preview 啟用 `VITE_RAG_ENABLED`，用真實資料逐頁核對並回報
- [ ] 11.3 經授權後合併 `develop`、`main`；正式站的 `VITE_RAG_ENABLED` 由 Ken 在 Vercel 開啟
