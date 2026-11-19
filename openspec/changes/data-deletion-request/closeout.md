# 任務收尾單

- Task: 發布保留帳號的 Email 資料刪除流程。
- Status: complete
- Mode: real
- Changed files: support.html、privacy-policy.html、本 change 的 proposal.md、specs/data-deletion-request/spec.md、tasks.md、closeout.md。
- Evidence: 頁面提交 a9f20f0 已推送 origin/main。https://carbon-guide.vercel.app/support.html#delete-data 與 https://carbon-guide.vercel.app/privacy-policy.html 均 HTTP 200；使用 Python urllib 取得正式頁面並與本機 HTML 比較（統一換行），兩頁完全一致。
- Verification: openspec.cmd validate data-deletion-request --strict 通過；npm.cmd run build 通過；npm.cmd run type-check 通過；git diff --check 通過；JSDOM 驗證唯一錨點、客服收件者、解碼後主旨及隱私政策連結通過。npm.cmd test -- --exclude '**/.rag-v1-stage/**'：7 files / 48 tests passed。
- Verification limitation: 原始 npm.cmd test 與 npm.cmd test -- src test 均掃入既有未追蹤 .rag-v1-stage，7 suites 因 No test suite found 失敗；網站 48 項測試通過。未修改該目錄。gh API 因未登入不可用，改以正式頁面內容確認發布。
- Not run: 未做真實客服寄信或資料刪除，不在本次靜態頁面範圍；未做瀏覽器視覺及 Safari 驗證。
- Risk: 30 天處理、客服紀錄結案後 90 天、備份刪除完成後 90 天，以及登入必要資料留至帳號刪除，均由使用者在本次對話確認；實際客服與備份作業需履行。網站不實作自動刪除服務。
- Next: 將支援頁錨點填入 Google Play 對應資料刪除網址欄位，依公布期限受理申請。
- Reference: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en （允許客服 Email 申請，要求明示保留方式）。
