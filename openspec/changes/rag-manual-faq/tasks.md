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
