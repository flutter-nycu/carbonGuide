## ADDED Requirements

### Requirement: 統一管理入口
系統 SHALL 在既有管理員登入及角色驗證完成後掛載 RAG 工作台，並將舊 `/rag-preview/` 路徑導向 `/push-admin#rag`。建置結果 MUST NOT 包含獨立公開的 RAG HTML 入口。

#### Scenario: 尚未登入的 RAG 連結
- **WHEN** 尚未登入的使用者開啟 `/push-admin#rag`
- **THEN** 顯示登入入口，且不掛載 RAG 工作台

#### Scenario: 登出與切換
- **WHEN** 已授權使用者在推播與 RAG 工作台間切換後登出
- **THEN** 切換期間保留工作台狀態，登出後卸載工作台

### Requirement: 假資料流程邊界
RAG SHALL 清楚標示假資料示範，資料只保留於記憶體。匯入、評測、發布與回滾 MUST NOT 呼叫真實解析、模型、儲存或推播服務。

#### Scenario: 模擬發布
- **WHEN** 使用者準備發布草稿
- **THEN** 目前版本必須通過示範評測及審核，發布後固定 QA 與設定快照

### Requirement: 非 main 分支交付
本次程式 SHALL 從 `preview/rag-phase0` 承接至 `preview/rag-admin-20261024`，只推送新分支。

#### Scenario: 推送完成
- **WHEN** 驗證完成並推送
- **THEN** 新遠端分支與本機提交相同，遠端 `main` 仍為推送前的提交
