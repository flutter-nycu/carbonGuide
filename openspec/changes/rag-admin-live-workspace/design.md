## Context

動機見 proposal.md。

- **主專案**：`9a479c4`。`/push-admin` 由 `App.tsx` 驗證登入與 `admin_users.role`，`Dashboard.tsx` 依 hash 切換推播與 RAG。RAG 由 `RagWorkspace.tsx` 建立 open shadow root，放入 `rag/index.html` 的 body 與 `styles.css`，再由 `rag/app.js` 用 `innerHTML` 重繪假資料。
- **參考架構**：`c34f02c`。7 個 React 頁面，不使用 shadow DOM。資料層包含 `repository.ts`、`supabase-v1.ts`（對照約 45 個錯誤碼）、`supabase-evaluation.ts`；畫面元件有 `TrialFlow`、`DetailDialog`。功能上限以它為準；計算、係數、帳單匯入、`PageHelp`、舊試問 pilot 不搬。
- **後端契約**：App repo `rag-backend-live`。
  - 讀取：資料表讀取由 RLS 控管（多數需要 `is_push_admin`，請求與費用需要 owner）。
  - 寫入：一律經 `rag-v1` action，或在 RLS 允許下由 editor 直接寫人格、提示詞、QA。
  - 新增的 action：`conversation_users`、`user_conversations`、`conversation_detail`。
- **已知問題**：`App.tsx` 的 `acceptSession` 在每個 auth 事件都會把 role 清空、loading 設為 true，整個 Dashboard 因此卸載。分頁回到前景與 token 更新都會觸發。
- **限制**：
  - 後端部署前無法連真實資料。
  - Tailwind 只作用在 document，不會進入 shadow root。
  - 主機只能用 Chromium 驗證。

## Goals / Non-Goals

**Goals:**
- 介面與主專案一致，功能與參考架構一致，另外新增對話使用者。
- 不重送付費請求，狀態不因切換或 token 更新而遺失。
- 沒有後端也能用假的資料層完整測試每一頁。

**Non-Goals:**
- 修改後端或資料庫（由 `rag-backend-live` 處理）。
- 新增帳號管理、App 畫面、多管理員。
- 審查報告裡其他沒有列出的問題，例如 logo 大小、對比度。
- 修正 `package-lock.json` 不同步或 Vercel 安裝方式。

## Decisions

### W1 React 元件放進既有的 shadow DOM
`RagWorkspace` 在 shadow root 裡建立容器，再用 React portal 把工作台渲染進去。`styles.css` 照舊用 `<link>` 載入。
- React 17 以後，portal 的容器本身會掛事件監聽，所以 shadow root 裡的事件可以正常運作；用 portal 而不是另一個 `createRoot`，可以共用上層的 React 樹，也不會有卸載順序的警告。
- `tailwind.config.js` 的 content 排除 `src/push-admin/rag/**`，RAG 元件的 class 名稱不會被 Tailwind 產生成全站的 utility。
- 對話框用原生 `<dialog>`；焦點從 `shadowRoot.activeElement` 取得，再還原。
- 沿用主專案的 class：`shell`、`sidebar`、`nav-button`、`page-head`、`panel`、`table-wrap`、`tag`、`source-result`、`metadata` 等。

替代方案：
- 拿掉 shadow DOM，照參考版的做法：Tailwind 的 preflight 與 `.grid`、`.hidden` 等 utility 會和主專案的 class 衝突，要全面改前綴，所以不採用。
- 直接用參考版的 7 頁：頁面結構和主專案不同，要拆的東西更多，所以不採用。

### W2 資料層：一個介面，兩種實作
- `rag/api/types.ts` 定義 `RagApi` 介面與資料型別。
- `rag/api/supabase.ts` 用 `supabase.functions.invoke('rag-v1')` 和資料表讀取實作。
- `rag/api/fake.ts` 是記憶體版本，只供測試與瀏覽器驗證使用，不打包進正式頁面。
- 錯誤碼對照沿用參考版 `supabase-v1.ts`，拿掉計算與帳單相關的碼，加上 `unsupported_format`、`url_not_pdf`、`budget_paused`、`owner_required` 等新碼。

替代方案：元件直接呼叫 supabase。這樣測試要 mock 整個 client，換後端時要改每一頁，所以不採用。

### W3 請求鍵放在元件外
試問、建立輪次、建立版本、評測開始、網址登記這幾種付費或不可重複的操作，請求鍵存在模組層級的 store。key 由「操作類型＋內容指紋」決定，成功後才清掉，所以元件重新掛載也不會遺失。

### W4 修正 App.tsx 的卸載問題
`onAuthStateChange` 收到 `TOKEN_REFRESHED`，或同一個使用者的 `SIGNED_IN` 時，只更新 session，不清 role、不進 loading。換了使用者或登出，維持原本的流程。`Dashboard` 的 key 仍然是 user id。

### W5 頁面保持掛載
第一次進入某一頁之後，那一頁就保持掛載，用 `hidden` 隱藏，切換頁面不會遺失輸入內容。頁面被隱藏時，它開啟的對話框自動關閉，評測迴圈與狀態輪詢也暫停。

### W6 處理狀態輪詢
01、02 頁有待處理或處理中的項目，而且 `document.visibilityState === 'visible'` 時，每 15 秒重新讀取一次；否則停止。

### W7 試問輪次自動管理
選定版本後如果沒有可用輪次，送出問題時先以固定的預設值呼叫 `round_create`，再試問。預設值：

| 項目 | 預設 |
|---|---|
| 題數上限 | 20 題 |
| 每日上限 | 20 題 |
| 費用上限 | US$0.50 |
| 有效期 | 7 天 |

畫面顯示本輪剩餘題數與費用上限，owner 可以停止本輪。預算最後仍受 campaign 上限控制。

替代方案：照參考版要 owner 自己填輪次表單。非技術使用者很難填，所以不採用。

### W8 連線開關
只有 `import.meta.env.VITE_RAG_ENABLED === 'true'` 時，才建立 supabase 實作；否則各頁顯示尚未啟用，不發任何 RAG 請求。正式站要不要開啟，由 Ken 在 Vercel 設定。

### W9 RAG 工作台分開打包
`Dashboard` 用 `React.lazy` 載入 `RagWorkspace`，推播管理不用下載 RAG 的程式。

### W10 移除靜態示範
刪除 `rag/app.js`、`rag/app.d.ts`、`rag/index.html`；保留 `styles.css`、`logo.png`、`prototype.html`。`test/rag-preview.test.ts` 改寫成 React 版本的頁面測試；上一個 change 的 `verify/` 腳本不再適用，另寫新的驗證腳本。

### W11 測試
- **元件與頁面**：Vitest 加 React Testing Library，搭配 `fake.ts`。
- **supabase 實作**：用可鏈式呼叫的 mock client 測請求格式與錯誤對照。
- **`App` 與 `Dashboard`**：補上 token 更新後不會卸載的測試。
- **瀏覽器驗證**：用 Vite dev server 開一個只掛假資料層的驗證頁，以 Python Playwright（Chromium）在 1440、1024、768、390 寬度檢查每一頁、對話框、溢出與主控台錯誤。

## Risks / Trade-offs

- [後端契約在部署前無法實際驗證] → 型別與錯誤碼依 `rag-backend-live` 的 spec 與參考版程式定義；後端部署後，在 preview 用真實資料逐頁核對，再決定推 `main`。
- [自動建立輪次會在每次換版本時預留預算] → 預設上限很小，預算總額仍受 campaign 控制；畫面顯示剩餘額度。
- [shadow DOM 裡的焦點與對話框行為] → 加測試，並用 Playwright 實測 Esc 與焦點還原。
- [修改登入流程可能影響推播管理] → 只改 token 更新與同一使用者重新登入的分支；`App.test.tsx` 既有的案例全部保留。
- [preview 部署若設了 `VITE_RAG_ENABLED`，會產生真實費用] → preview 受 Vercel 驗證與管理員登入保護；開關由 Ken 決定。

## Migration Plan

1. 在 `preview/rag-admin-live-20261105` 完成並驗證；Step 7 交給 Ken 審核。
2. 經 Ken 授權後 commit，並推送 preview 分支。
3. 等 `rag-backend-live` 部署完成，在 preview 啟用 `VITE_RAG_ENABLED`，用真實資料逐頁核對。
4. 經 Ken 授權後合併進 `develop`、`main`，再由 Ken 在 Vercel Production 開啟 `VITE_RAG_ENABLED`。
5. 回滾：Vercel 關掉 `VITE_RAG_ENABLED`（工作台改成顯示尚未啟用），或在 `main` revert。
