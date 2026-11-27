## Purpose

讓具有常見問答編輯權限的人員明確設定人工標準答案，無須文件引用即可在新版本中使用，同時保留文件型問答的來源核對、版本凍結、發布審核及歷史內容的可追溯性。

## ADDED Requirements

### Requirement: Explicit manual answers
系統 SHALL 提供預設關閉的「人工標準答案」選項，只有既有編輯權限可儲存；舊資料 MUST 保持文件型規則。

#### Scenario: Save without a document
- **WHEN** 編輯者明確選擇人工標準答案並填寫問題與答案
- **THEN** 可儲存且來源顯示管理者提供，提示建立新版本後生效

#### Scenario: Existing uncited draft
- **WHEN** 舊草稿沒有引用且未選擇人工標準答案
- **THEN** 顯示「不會收進版本」與處理方式（補引用，或勾人工標準答案），且不得納入新版本

### Requirement: Immutable version inclusion
系統 SHALL 收錄啟用的人工答案與引用有效的文件型問答，版本詳情 SHALL 列出實際收錄的問答；既有版本 MUST 不隨草稿變更。

#### Scenario: Manual answer version
- **WHEN** 建立包含啟用人工答案的新版本
- **THEN** 無文件引用仍可收錄，詳情顯示該問題、答案與管理者來源

#### Scenario: Document citation gate
- **WHEN** 文件型問答沒有引用、引用失效或來源不在版本
- **THEN** 不得納入版本，人工選項不得放寬文件型驗證

#### Scenario: Preview before building a version
- **WHEN** 開啟或切回版本頁，而有啟用的問答不會被收錄
- **THEN** 顯示會收錄幾筆，並列出不會收錄的問題與處理方式；預覽與建立版本使用同一條收錄規則

#### Scenario: Count after building a version
- **WHEN** 版本建立成功
- **THEN** 提示訊息顯示該版本實際收錄的問答筆數；讀不到筆數時仍回報版本已建立

#### Scenario: Draft changes after freezing
- **WHEN** 版本建立後草稿改答案、停用或更改來源類型
- **THEN** 舊版本的答案與來源維持凍結內容

### Requirement: Manual answer provenance
系統 SHALL 對所選版本的相同問題直接使用人工答案，標示管理者提供；MUST 不執行文件搜尋或付費模型。文件問答及一般檢索仍保留既有規則。

#### Scenario: Exact manual match
- **WHEN** 問句依既有正規化規則命中版本內人工答案
- **THEN** 原樣回傳答案，模型呼叫為零，試問與歷史紀錄均標示管理者提供

#### Scenario: Old or expired record
- **WHEN** 舊紀錄沒有人工來源標記或內容已過期
- **THEN** 不推測其為人工來源，也不回傳已過期的內容資訊
