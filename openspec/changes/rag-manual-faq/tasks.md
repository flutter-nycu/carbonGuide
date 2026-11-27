## 1. 契約與失敗測試
- [x] 1.1 記錄 C-4、兩個 repo 基準、相容性與部署順序，完成規格自查與 strict validation。
- [x] 1.2 增加 API 收錄／儲存／來源、編輯表單、版本詳情與直接回答測試，確認實作前失敗。
- [x] 1.3 建立隔離 SQL fixture，驗證真實 snapshot 與來源投影 migration。

## 2. 實作
- [x] 2.1 後端新增 manual_answer migration，保留文件型驗證與舊快照，回答與對話詳情輸出人工來源。
- [x] 2.2 網站更新 QaInput、資料層、人工選項、狀態提示與 ConversationView 來源；測試 fake 保留版本凍結。
- [x] 2.3 加入 getVersionQa 與版本詳情收錄清單，更新操作教學及來源說明。

## 3. 驗證與交付
- [x] 3.1 執行單工前端全套測試、type-check、build，後端 Node tests、SQL migration 測試與 OpenSpec strict。
- [x] 3.2 完整 diff self-review，更新測試證據、已知限制與部署／rollback 說明。
- [x] 3.3 建立本 issue 的 candidate commits，回報兩個 exact SHA 與部署未執行狀態（SHA 記於 C-4 交付紀錄）。

## 4. 部署與驗收（2026-11-26 依 Ken 授權）
- [x] 4.1 兩個 repo 合併 main 並同步 develop：網站 `3c7e1eb`（fast-forward）、後端 merge `825526c`。
- [x] 4.2 正式庫以 rollback 試跑後套用 `20261126033000`，套用後再測；紀錄在後端 docs/rag.md。
- [x] 4.3 部署 `rag-v1` v11（保持 verify_jwt），再部署網站：Preview `8086334896`、Production `8086794018`；入口、標頭、bundle 與匿名 401 驗證通過。
- [ ] 4.4 管理員真實畫面驗收：勾選人工答案、建立新版本、試問回 `verified_qa` 且來源「管理者提供」、沒有模型呼叫。
- [ ] 4.5 新知識版本經 owner 核准發布後，歸檔本 change。

## 5. 收錄提示（2026-11-27，依第一次驗收結果）
- [x] 5.1 查明驗收失敗原因：問答在上線前儲存、未勾人工標準答案；版本也在上線前建立、未收錄該問答。功能本身正常（以該筆真實資料在正式庫 rollback 模擬確認）。
- [x] 5.2 先寫失敗測試：問答列表標籤、previewVersionQa（真實層與測試層）、版本頁預告與建立後筆數、切回頁面重讀。
- [x] 5.3 實作：列表標籤改為「不會收進版本」「補引用，或勾人工標準答案」；版本頁顯示會收錄幾筆與不會收錄的問題；建立後提示實際收錄筆數。
- [x] 5.4 type-check、單工全套測試 272／272（28 檔）、啟用 RAG 的 build。
- [ ] 5.5 commit、推送 main 部署並驗證正式站。

