# RAG 第一階段：React 與 Supabase 基礎

## Why
現有 RAG 是以 Shadow DOM 掛載的字串模板示範，無法作為可維護的正式資料介面。本階段依使用者要求先做 React 與 Supabase 基礎；Step 0 模型驗證及後續 pipeline 另行實作。

## What Changes
- 在既有登入後台內，以 React 重寫文件與段落、QA、人格與提示詞、試問、知識版本、紀錄、設定七個畫面。
- 使用 repository 隔離 Supabase，預設未設定時顯示連線說明，絕不自動連到既有正式專案。
- 提供草稿內容儲存、真實 loading／error／empty／permission 狀態；未實作的模型、解析與發布操作明確停用。
- App repo 新增基礎 migration：資料表、最小 GRANT／RLS、私有 Storage、向量 profile；不開啟排程或模型呼叫。

## Impact
- 網站：src/push-admin/components/RagWorkspace.tsx、src/push-admin/rag、環境設定與測試。
- 後端：carbon-navigation/supabase/migrations 與對應 OpenSpec。
- 使用者在本次對話確認 hxsrineeirmxpoovcrba 可用於 RAG；本階段只新增 RAG 資源，保留已有 App／推播資料。
