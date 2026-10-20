## Context

動機見 proposal.md。

- 來源原型是單一檔案 `prototype.html`（約 336 KB）：內嵌 CSS 約 21 KB、JS 約 55 KB，Logo 以 base64 PNG 內嵌（約 268 KB）。畫面全由 JS 依 `view`、`tab` 和 `state` 物件重繪，沒有外部依賴，也沒有網路請求。
- 網站 repo 是 Vite + React，`vite.config.ts` 只列出 5 個 HTML entry；`public/` 內的檔案會原樣複製到 `dist/`。`vercel.json` 只對 `/auth/callback`、`/push-admin` 和 AASA 設定 header，沒有全站 CSP。
- Vercel 部署紀錄只有 `main` 的 Production。這個 repo 從沒推過其他分支，預覽部署是否自動建立、是否有預覽保護都還不確定。
- 這次不動 App repo，也沒有 Flutter 畫面；手機版是 HTML 模擬。

## Goals / Non-Goals

**Goals:**
- 業主只靠一個網址就能看完整個 Phase 0 原型。
- 修改範圍限縮在一個新檔案，不碰既有建置、路由與測試。
- 同一份 HTML 可以直接打包成 zip 備份，離線也能開。

**Non-Goals:**
- 不把原型改寫成 React 元件，也不併進 `/push-admin`。
- 不做真實的檢索、模型呼叫、檔案上傳或資料保存。
- 不調整 Vercel 專案設定（預覽保護、網域、環境變數）。

## Decisions

### D1 放在 `public/rag-preview/index.html`，不加 Vite entry
Vite 會原樣複製 `public/`，Vercel 會用 `index.html` 回應 `/rag-preview/`。這樣不用改 `vite.config.ts`、`vercel.json`，既有的 `deployment.test.ts` 與 type-check 都不受影響。
替代方案：加成 Vite entry 讓 Vite 處理資源。要改設定檔，原型本身又不需要打包，所以不採用。

### D2 維持單一檔案，Logo 繼續內嵌
同一個檔案就是 zip 備份的內容，離線雙擊也能開。代價是檔案約 340 KB，對一個展示頁可以接受。
替代方案：把 Logo 拆成 `logo.png`。網址版會小一點，但 zip 版要多管理一個檔案，所以不採用。

### D3 沿用原型的 render 架構，加上手機框畫面狀態
在既有的 `state` 加一個手機畫面狀態，值為主頁、選人格、對話三種，由 `coach()` 依狀態輸出手機框內容。人格、QA、互動紀錄繼續共用同一份 `state`，所以後台停用人格或新增 QA，手機框會跟著變。原型左欄的人格卡片拿掉，選人格只留在手機框內，避免同一件事有兩個入口。
替代方案：重寫成新的頁面結構。工作量大，也會丟掉原型已經驗證過的互動，所以不採用。

### D4 RAG 設定與測試對話用獨立的假資料
RAG 設定是 `state` 裡的一個物件，表單儲存時只做範圍檢查和提示。測試對話是寫死的 3 筆資料，直接輸出，不讀 RAG 設定、不寫互動紀錄。這跟「測試對話只是靜態展示」的決定一致。
「查無資料」的文字只定義一次常數，RAG 設定頁的預設值、測試對話第 3 段、手機對話找不到資料時的回覆都用它，三處不會對不上。RAG 設定頁儲存後的新文字不會回寫這個常數。

### D5 預設落點改為「展示說明」頁
業主多半是自己打開網址，沒有人在旁邊帶。先看到展示說明與展示順序，比較不會迷路。頂部導覽順序維持「氣候教練｜管理後台｜展示說明」。
替代方案：照原型落在氣候教練頁。業主可能不知道後台在哪裡，所以不採用。

### D6 通勤相關程式整段移除
移除 `commute()`、`modelPage()`、行程與隱私相關的對話框、事件處理與 CSS，不只是把按鈕藏起來。這樣頁面上搜不到通勤字樣，程式也比較好讀。

### D7 文字改寫範圍
所有原本是中文的可見文字（標題、說明、按鈕、提示、示範對話、假資料內容）都依 humanizer-zh-tw 檢查。口號式標題改成直接描述，例如「每個好回答，都有好依據。」改為「知識庫文件」。英文小標維持原樣。數字、單位與碳排示範數值不變。

### D7.1 原始碼與建置
可讀的原始碼放在 change 目錄的 `source/`（`app.js`、`style.css`、`head.html`、`body.html`）。`source/build.py` 把它們組成 `public/rag-preview/index.html`，Logo 從現有檔案取出，並依 `<script>` 實際內容重算 CSP 的 sha256。直接改 `index.html` 的 script 而沒有重算 hash，CSP 會擋掉整段 JS，所以修改一律改 `source/` 再跑 `build.py`。

### D8 驗證方式
用 Playwright（Python）寫一支驗證腳本，放在 change 目錄的 `verify/`，不放進網站的 `src/` 或 vitest。腳本在 1440px 與 390px 兩種寬度下逐頁點擊，檢查：spec 每個情境、主控台錯誤、對外網路請求、手機框按鈕尺寸，並輸出截圖。網站本身照常跑 `npm run type-check`、`npm test`、`npm run build`，再確認 `dist/rag-preview/index.html` 存在。
替代方案：寫成 vitest + jsdom 測試。jsdom 無法量測版面與點擊範圍，而且會把測試帶進網站正式的測試套件，所以不採用。

### D9 部署與查證
從 `main`（`cfd6773`）開 `preview/rag-phase0` 分支，commit 只包含 `public/rag-preview/` 和 `openspec/`。推送後從 GitHub deployments API 讀取 Vercel 回報的預覽網址，用未登入的瀏覽器打開；同時確認 `carbon-guide.vercel.app/rag-preview/` 在正式站不存在、`main` 仍是 `cfd6773`。

## Risks / Trade-offs

- [Vercel 預覽保護擋住未登入訪客，已有證據] → 2026-10-19 實測：最新正式部署的專屬網址 `carbon-guide-823nmaoeq-fluttermans-projects.vercel.app` 回 302，導向 `vercel.com/sso-api` 登入；正式網域 `carbon-guide.vercel.app` 回 200。代表專案開著 Vercel Authentication，預覽網址幾乎確定也需要登入。因此 zip 改為主要交付物；預覽網址要給業主用，需要 Vercel 團隊 `fluttermans-projects` 的成員產生分享連結或調整預覽保護。
- [Vercel 不替非 `main` 分支建立預覽] → 推送後若 GitHub deployments 沒有 Preview 紀錄，改交 zip，並說明需要有權限的人檢查 Vercel 的 Git 設定。
- [預覽網址若沒有保護，拿到連結的人都能看] → 內容全為假資料，加上 noindex 與橫幅。
- [Safari 沒有測] → 只用 Chromium 驗證，請 Ken 或業主用 Safari 看一次。
- [文字改寫偏主觀] → 改寫前後的標題對照列在交付說明，讓 Ken 檢查。
- [刪除通勤程式時誤刪共用 CSS 或函式] → 驗證腳本逐頁點擊並檢查主控台錯誤，截圖逐張比對。

## Migration Plan

1. 本機完成修改與驗證，`main` 不動。
2. commit 到 `preview/rag-phase0` 並推送，等 Vercel 建立預覽部署。
3. 查證預覽網址與正式站，交付網址、commit SHA、zip。
4. 撤下方式：刪除遠端分支 `preview/rag-phase0`（須經 Ken 同意）。已建立的 Vercel 部署網址仍可能保留，要完全移除需要有 Vercel 專案權限的人在後台刪除。
