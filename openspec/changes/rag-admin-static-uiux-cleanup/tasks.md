## 1. 準備

- [x] 1.1 確認分支 `preview/rag-admin-uiux-20261101` 從 `edead04` 開出、工作樹乾淨；用 `npm install --package-lock=false` 安裝後，跑 `npm run type-check`、`npm test`、`npm run build` 記錄基準結果
- [x] 1.2 把 `app.js`、`index.html` 裡所有中文字串列成清單：改用 `verify/copy_inventory.py` 產生（基準 520 段），改寫後列出原封不動保留的字串，結果寫入 `copy-inventory.md`
- [x] 1.3 在 `verify/` 寫 Playwright 驗證腳本和掛載頁，模擬正式站的 shadow DOM 掛載；先對 `edead04` 原樣執行，確認新需求的檢查會失敗

## 2. 先寫會失敗的單元測試

- [x] 2.1 更新 `test/rag-preview.test.ts`：10 頁導覽、不顯示說明區塊、進階設定沒有三個欄位、JSON 被拒絕、示範批次沒有 JSON、四種試問結果與引用、沒有計算相關文字、對話框 selector；調整原本依賴說明區塊、計算示範和係數分流的測試
- [x] 2.2 更新 `src/push-admin/components/Dashboard.test.tsx`：非 `#rag`／`#push` 的 hash 不切換工作台，推播側「跳至主要內容」不切換工作台
- [x] 2.3 執行 `npm test`，確認新測試因為功能還沒改而失敗

## 3. 拿掉頁面與區塊

- [x] 3.1 `tabs` 移除係數與費率、服務連線，刪掉兩個 view、`views` 對照、係數核定對話框與相關 state，確認沒有殘留連結
- [x] 3.2 刪除 `pageHelp`、`helpPanel()`、`introduction()`、`state.helpOpen` 及事件，刪除知識庫底部提示框、進階檢索設定和 System Prompt 頁右側說明卡
- [x] 3.3 進階檢索設定刪除「文件處理與向量（進階）」與 `chunk`、`overlap`、`dimension` 設定，確認儲存與評測失效邏輯照常
- [x] 3.4 清掉不再使用的 CSS，並修好 `#dialog-body` selector

## 4. 匯入與試問改成只走 RAG

- [x] 4.1 匯入只接受 PDF、DOCX、TXT 和網址；移除 JSON 分流；示範批次的 JSON 換成 DOCX；更新匯入頁的步驟與說明文字
- [x] 4.2 `ask()` 拿掉 `calculation`，加入「文件回答」；綠生活指引段落補一句示範數字；回答區、試問 metadata、互動紀錄詳情都不再顯示計算資訊
- [x] 4.3 電價表用途改為「參考數據」；System Prompt 預設內容、評測副標、門檻說明與情境拿掉計算字樣

## 5. 跳至主要內容

- [x] 5.1 `Dashboard.tsx` 的 hashchange 只認 `#rag`、`#push`；推播側的跳過連結改成攔截點擊並聚焦主要內容
- [x] 5.2 RAG 側的跳過連結在 `app.js` 攔截點擊，聚焦 shadow DOM 內的 `#main`

## 6. 文字改寫

- [x] 6.1 依 `copy-inventory.md` 和 humanizer-zh-tw 改寫所有保留的中文文字；英文小標、側欄名稱和 RAG／QA／System Prompt／Rerank 等詞不動
- [x] 6.2 由子代理依 humanizer-zh-tw 獨立審一次文字，修正後在清單標記完成；整理主要句子的前後對照

## 7. 驗證

- [x] 7.1 `npm run type-check`、`npm test`、`npm run build` 全部通過，記錄 exit code
- [x] 7.2 執行 `verify/` 腳本，1440 與 390 寬度的所有檢查通過，輸出截圖；確認沒有對外請求、主控台錯誤和水平溢出
- [x] 7.3 檢查 `git diff`：只動到 design 列出的檔案與本 change 目錄
- [x] 7.4 子代理 code review，Critical／Important 修完後重新驗證
- [x] 7.5 Step 7 審核回饋：試問台拿掉「回覆人格」，互動紀錄不再記人格；先補失敗測試再改，重跑 7.1、7.2

## 8. 交付（Step 7 經 Ken 審核後才執行）

- [x] 8.1 commit 到 `preview/rag-admin-uiux-20261101` 並推送
- [x] 8.2 `develop`、`main` fast-forward 到同一個 commit 並推送
- [x] 8.3 從 GitHub deployments 查 Vercel 是否建立 Production 部署，並用公開網址確認正式站 `/push-admin` 的打包檔已更新；回報結果
