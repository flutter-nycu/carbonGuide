## 1. 準備

- [x] 1.1 從 `main`（`cfd6773`）建立本機分支 `preview/rag-phase0`，確認工作樹乾淨
- [x] 1.2 把 zip 內的 `prototype.html` 原樣複製到 `public/rag-preview/index.html`，核對 SHA-256 與 zip 的 `manifest.json` 一致
- [x] 1.3 在 `openspec/changes/rag-coach-phase0-preview/verify/` 寫 Playwright 驗證腳本，涵蓋 spec 全部情境；先對原樣副本執行，確認新需求的檢查會失敗

## 2. 頁面邊界

- [x] 2.1 加上 `noindex, nofollow` meta 與頂部「示範原型，全部為假資料」橫幅
- [x] 2.2 預設落點改為「展示說明」頁

## 3. 移除通勤

- [x] 3.1 移除頂部「通勤日誌」按鈕、`commute()` 與行程編輯、隱私設定、研究同意的對話框和事件處理
- [x] 3.2 移除後台「通勤模型評估」頁與混淆矩陣程式
- [x] 3.3 移除 GPS 那組 QA、通勤建議問題，以及只供通勤使用的 CSS 與圖示；保留「低碳通勤指南.pdf」
- [x] 3.4 執行驗證腳本：通勤相關情境通過，主控台沒有錯誤

## 4. 手機框流程

- [x] 4.1 「氣候教練」頁中間改為 390×844 手機框，加入手機畫面狀態（主頁、選人格、對話）；左欄拿掉人格卡片，只留文字說明
- [x] 4.2 App 主頁：底部 5 個分頁、氣候教練入口卡片、簡化的今日挑戰與當月進度；其他分頁只顯示提示
- [x] 4.3 選人格畫面：列出已啟用人格的名稱、簡介、示範回答，選擇後進入對話
- [x] 4.4 對話畫面：沿用既有訊息、建議問題、輸入框、失敗重試與切換人格；來源改為從手機框底部滑出
- [x] 4.5 手機框內所有按鈕點擊範圍至少 44×44 px
- [x] 4.6 執行驗證腳本：手機框相關情境通過

## 5. 後台新頁面

- [x] 5.1 側欄改為 8 個項目並照 spec 排序，推播 4 個入口顯示「既有功能，本次不變」
- [x] 5.2 RAG 設定頁：7 項參數、預設值、範圍檢查與錯誤訊息、唯讀項目、儲存提示；「查無資料」文字抽成單一常數，手機對話未命中回覆一併改用
- [x] 5.3 測試對話頁：3 段固定對話、使用設定、檢索結果排序與低於門檻標示，沒有輸入框，不寫互動紀錄
- [x] 5.4 執行驗證腳本：後台相關情境通過，既有六頁的操作仍正常

## 6. 展示說明與文字

- [x] 6.1 展示說明頁：刪通勤卡片與研究規格，重寫展示順序與設計假設
- [x] 6.2 依 humanizer-zh-tw 改寫所有原本是中文的文字，英文小標不動；整理標題前後對照表
- [x] 6.3 執行完整驗證腳本，1440px 與 390px 全部情境通過

## 7. 網站建置驗證

- [x] 7.1 `npm ci` 後執行 `npm run type-check`、`npm test`、`npm run build`，記錄 exit code（`main` 既有的 `package-lock.json` 與 `package.json` 不同步，npm 12 的 `npm ci` 拒絕安裝；改用 `npm install --package-lock=false`，lock 檔未變動）
- [x] 7.2 確認 `dist/rag-preview/index.html` 存在，且與 `public/rag-preview/index.html` 相同
- [x] 7.3 用 `vite preview` 在本機開 `/rag-preview/`，跑一次驗證腳本
- [x] 7.4 檢查 `git diff`，只有 `public/rag-preview/` 與 `openspec/` 有變動

## 8. 截圖與備份

- [x] 8.1 輸出新頁面與手機流程的桌面、手機截圖
- [x] 8.2 打包 zip：`index.html`、截圖、README、SHA-256 清單

## 9. 提交與預覽部署

- [ ] 9.1 commit 到 `preview/rag-phase0`（只含本 change 的檔案），推送到 origin，不碰 `main`
- [ ] 9.2 從 GitHub deployments 取得 Vercel 預覽網址與狀態
- [ ] 9.3 用未登入的狀態打開預覽網址，記錄是否導向 Vercel 登入（預期會被擋）；若沒被擋，對預覽網址跑驗證腳本
- [ ] 9.4 確認正式站 `carbon-guide.vercel.app/rag-preview/` 不存在、`origin/main` 仍是 `cfd6773`

## 10. 交付

- [ ] 10.1 回報預覽網址、commit SHA、分支、驗證結果、未驗證項目（Safari）與風險 R1 的實際狀態，附上 zip
- [ ] 10.2 寫一段給 Vercel 團隊成員的操作說明：如何為這個預覽部署產生分享連結
