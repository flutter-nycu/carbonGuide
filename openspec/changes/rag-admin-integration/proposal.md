## Why

本機新版 RAG 工作台尚未提交。需要從 `preview/rag-phase0` 建立獨立分支保存、驗證與推送，避免推送 `main` 觸發正式部署。這份 change 記錄既有本機實作與分支整合範圍。

## What Changes

- 在既有 `/push-admin` 登入及角色驗證後提供推播與 RAG 工作台切換。
- 納入本機 RAG 假資料的匯入、試問、評測、審核、發布、回滾及相關設定介面。
- 移除原分支的 `public/rag-preview/index.html`，以既有本機 Vercel redirects 導向 `/push-admin#rag`。
- 納入本機登入競態修正、樣式、測試與瀏覽器驗證工具；同步 README 和 Agent 指南。
- 只推送 `preview/rag-admin-20261024`；真實後端串接、正式部署與權限設定變更不在範圍內。

## Capabilities

### New Capabilities
- `rag-admin-workspace`: 通過既有驗證後使用的 RAG 假資料管理工作台。

### Modified Capabilities

（無；舊 Phase 0 change 保留為原分支歷史紀錄。）

## Impact

- `src/push-admin/`、`test/`、`vercel.json`、`vite.config.ts` 與文件。
- RAG 仍為記憶體假資料，推播仍呼叫既有真實後端。
- 新分支可能觸發 Vercel Preview；預覽保護與 OAuth redirect 仍受既有設定限制。
