# 候選語料持久化與真實管理讀取

## Why
真實 owner session 已能讀取追蹤，但 documents／chunks／embeddings 仍為空。既有 Gemini 768 維實驗與目前只允許 OpenAI 1536 維的 schema 不相容，線上試問無可引用的候選資料。

## What Changes
- 使用 App repo 的離線匯出器，核對已完成的 preparation、來源及既有真實向量，再產生有界、原子、冪等的 SQL 匯入包。
- 保留既有 OpenAI profile，新增 Gemini 候選 profile 支援；每筆向量強制匹配 profile 維度、來源 input hash 及 L2 正規化。
- 匯入兩份文件的 24 個樣本段落及既有向量，狀態為 in_review，段落集合封存；保留輸入文字與匯入證據，無原始 PDF 上傳、模型請求或 release。
- 以持久化語料重跑 20 個已存在的 query vectors，並用真實 Chrome owner session 驗證文件及追蹤讀取。

## Impact
App migrations、CLI、SQL/Python tests 與文件；網站沿用現有文件頁，修正文案以反映 CLI 匯入可用。不變更登入或角色、不開回答服務、不建立公開問答 API、不部署網站。
