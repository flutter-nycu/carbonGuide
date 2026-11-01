## Context

動機見 proposal.md。

- 正式站 `/push-admin#rag` 跑的是 `edead04`：`App.tsx` 驗證登入後，`Dashboard.tsx` 依網址 hash 切換推播與 RAG 兩個工作台。RAG 這一側由 `RagWorkspace.tsx` 建立 shadow DOM，把 `src/push-admin/rag/index.html` 的 `<body>` 內容放進去，再由 `rag/app.js` 的 `mountRag(root)` 以 `innerHTML` 重繪整頁。所有資料都在記憶體裡。
- `app.js` 是約 52 KB 的單一檔案：`tabs` 陣列定義頁面，`pageHelp`／`helpPanel()`／`introduction()` 產生說明區塊，每一頁是一個函式（`documents`、`importView`、`numbers`、`playground` …），`ask()` 產生試問結果，事件集中在一個 click handler。
- `styles.css` 是壓縮成 24 行的單一檔案，`#dialog-.rag-body`、`.help-.rag-body` 是批次取代時改壞的 selector。
- 既有測試：`test/rag-preview.test.ts` 用 JSDOM 載入 `index.html` 和 `app.js`，共 15 個測試；`Dashboard.test.tsx` 測工作台切換。
- `main` 是 `cfd6773`，`edead04` 的祖先鏈是 `14937b1` → `f9a7467` → `cfd6773`，所以合併進 `main` 是 fast-forward。

## Goals / Non-Goals

**Goals:**
- 照 spec 調整頁面、區塊、匯入、試問與文字，畫面和正式站同一套版型。
- 修兩個看得到的 bug。
- 測試與驗證都能在本機重跑。

**Non-Goals:**
- 不改寫成 React，不處理整頁重繪造成的焦點遺失、對比、點擊目標、bundle 大小等審查找到的其他問題。
- 不改推播管理、登入流程、`vercel.json`、後端、App。
- 不調整側欄名稱和頁面標題不一致的問題（例如「進階檢索設定」對「檢索設定」）。
- 不碰同事的 `preview/rag-admin-20261024` 和 `preview/rag-v1-review-20261027` 分支。

## Decisions

### D1 以 `edead04` 開分支，直接修改既有檔案
分支 `preview/rag-admin-uiux-20261101` 從 `edead04` 開出，沿用 `app.js` 的寫法修改。
替代方案：從 `6c35f14` 或 React 版開始。那兩版和正式站畫面不同，`6c35f14` 還把向量模型改成 OpenAI，所以不採用。

### D2 說明區塊整段刪除，不用開關藏起來
刪掉 `pageHelp`、`helpPanel()`、`introduction()`、`state.helpOpen` 和記錄折疊狀態的事件，以及各頁的呼叫點；知識庫底部提示框和兩個 `guide-side` 側欄也一起刪。相關 CSS 能確定不再使用就移除。
替代方案：保留程式、改成預設收合。Ken 要的是拿掉，留著只會增加維護成本，所以不採用。

### D3 拿掉兩頁時一併清掉所有入口
從 `tabs` 移除 `numbers`、`connection`，刪掉兩個 view 函式、`views` 對照、係數核定對話框（`factor-preview`）和 `state.factorApproved`。側欄編號依 `tabs` 順序重算。

### D4 試問改成只有四種 RAG 結果
- `ask()` 的結果物件拿掉 `calculation` 欄位，回答區、互動紀錄詳情和試問 metadata 都不再顯示計算資訊。
- 「每月少用 20 度電，少多少碳排？」改成「文件回答」：在已發布的「綠生活指引.pdf」段落文字裡補一句示範數字（每度電約 0.5 公斤二氧化碳當量，標明是示範數字），回答引用這一段，附 [1]。
- 「少用 20 度電能省多少錢？」維持需要追問；「量子電池」維持資料不足。
- 電價表的用途從「計算資料」改成「參考數據」，仍是草稿，不納入回答。
- System Prompt 預設內容把「交由計算工具」改成「數字一律引用文件原文」。
- 評測的副標、門檻說明和情境拿掉「計算」：「跨年電價與費率」改成電價資料過期就追問；「人公里／車公里」改成照原文單位回答、不自行換算。

替代方案：新增一份「電力排碳係數」示範文件。這樣會改動文件數量、發布版本內容和多個測試，所以不採用。

### D5 匯入改成只收三種檔案和網址
允許的副檔名改成 PDF、DOCX、TXT；檔案選擇器的 `accept`、預檢判斷、錯誤訊息一起改。建立草稿時不再依 JSON 改用途或處理狀態。示範批次裡的 JSON 換成一份 DOCX。

### D6 hash 只認 `#rag` 和 `#push`
`Dashboard.tsx` 的 hashchange 只在 hash 是 `#rag`、`#push` 或空白時切換（空白代表回到起始網址，切回推播），其他一律忽略。兩個「跳至主要內容」連結改成攔截點擊：阻止預設跳轉，把焦點移到各自的主要內容。RAG 那個連結在 shadow DOM 裡，由 `app.js` 處理。

### D7 修對話框 selector
`styles.css` 裡的 `#dialog-.rag-body` 改回 `#dialog-body`。`.help-.rag-body` 隨說明區塊一起刪除。

### D8 文字改寫的做法
先把 `app.js`、`index.html` 裡所有中文字串列成清單，依 humanizer-zh-tw 改寫：去掉技術說法和公式化句型，英文小標、側欄名稱、RAG／QA／System Prompt／Rerank 等詞不動。改完由子代理獨立審一次文字，再對照清單確認沒有漏改。

### D9 測試與驗證
- 依 TDD 先改 `test/rag-preview.test.ts` 和 `Dashboard.test.tsx`，讓新需求的測試先失敗，再改程式。
- 本 change 的 `verify/` 放一支 Python Playwright 腳本，用本機靜態 server 開一個驗證頁：取 `index.html` 的 `<body>`、建立 shadow DOM、載入 `styles.css` 和 `app.js`，模擬正式站的掛載方式。腳本在 1440 和 390 兩種寬度逐頁檢查 spec 情境、對外請求、主控台錯誤、水平溢出，並輸出截圖。
- 網站照常跑 `npm run type-check`、`npm test`、`npm run build`。
- 既有的 `test/verify-admin-integration.py`（掛 Dashboard、套正式 CSP 標頭、mock 後端）也要跟著改成 10 頁，並補兩個跳過連結不切換工作台的檢查；沒有 `.env.local` 時改讀環境變數，才能在沒有本機設定檔的 checkout 執行。

### D10 交付
Ken 在 Step 7 審核通過後：commit 到 `preview/rag-admin-uiux-20261101`，推送這個分支，把 `main` fast-forward 到同一個 commit 並推送。`develop` 也 fast-forward 到同一個 commit，維持「開發分支 → develop」的慣例。不碰 Vercel 設定。

## Risks / Trade-offs

- [推 `main` 會立刻觸發 Vercel Production 部署] → 網站專案用 Git 整合，推 `main` 通常會自動上正式站，不需要另外到 Vercel 發佈。除非當初把 `edead04` 換上正式站的方式關掉了 Production 自動指派，這點要到 Vercel 後台確認。Step 3 會先和 Ken 確認他是否接受推送就上線。
- [合併 `main` 會帶進 Phase 0 原型和文件] → `public/rag-preview/` 在 `edead04` 已經移除，`/rag-preview/` 由 `vercel.json` 轉到 `/push-admin#rag`，和正式站現況相同；`AGENTS.md`、`CLAUDE.md`、`openspec/` 不會被網站提供。
- [`edead04` 原有的登入流程修改會進 `main`] → 正式站已經在跑這版，行為不會改變；但這段改動沒有經過第二位 reviewer，審查報告建議過要補。
- [整頁重繪的焦點問題還在] → 依 Ken 指示這次不處理。
- [文字改寫偏主觀] → 子代理獨立審一次，交付時附上主要句子的前後對照。
- [Safari 沒有實測] → 主機缺系統函式庫，只能用 Chromium 驗證。

## Migration Plan

1. 本機完成修改與驗證，Step 7 給 Ken 審核。
2. 審核通過後，commit 並推送 `preview/rag-admin-uiux-20261101`、`develop`、`main`。
3. 用 GitHub deployments 查 Vercel 是否建立了 Production 部署，並用公開網址確認正式站 `/push-admin` 的打包檔已更新。
4. 回滾：在 `main` revert 這次的 commit 再推送，或在 Vercel 後台把正式站切回先前的部署。
