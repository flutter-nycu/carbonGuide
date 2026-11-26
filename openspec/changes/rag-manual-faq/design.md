## Context

見 proposal.md。跨端範圍包含本網站與 githyoung/carbon-navigation；C-4 是唯一 issue。使用者已批准最小方案與實作，不再新增同內容的核准關卡。後端現有分支保留既有 untracked config，不切分支或覆蓋；修改的後端函式與 origin/main 相同。

## Goals / Non-Goals

目標是顯式的人工作答來源、可重現的版本凍結與清楚生效提示。維持單輪、相同問句比對、既有權限及發布 gate；不新增語意 FAQ 比對、無文件知識版本、App 接入、預算或檢索逾時調整。

## Decisions

- qa_entries 新增 manual_answer boolean NOT NULL DEFAULT false，網站對應 manualAnswer。舊資料與缺欄位的舊快照均視為文件型；採顯式欄位，避免把未補引用的舊草稿當成人工答案。
- 人工答案仍有 source_note，表單自動寫入「管理者提供」。文件型仍必填來源說明。人工模式不要求引用，快照中的 citations 固定為空陣列，草稿原有引用保留供切回文件型使用。
- currentSelection 收錄啟用的人工作答，文件型保留所有引用必須在所選文件中的條件。SQL snapshot 的對應檢查同步更新，仍檢查文件型的原文與集合，修改以新 migration 的 guarded function replacement 完成，沿用 repo 已有方式並保留 runtime contract。
- executeAnswer 沿用 verified_qa 的結果分類與版本內答案，output.qa 加 manual_answer。對話詳情 RPC 增加 manual_answer（僅內容未過期時可回傳）；UI 明確標示「來源：管理者提供」。不依賴當前可變草稿推論歷史來源。
- 版本詳情以新的 getVersionQa(id) 讀取 manifest->qa，一次只取該版本問答，顯示問題、答案及來源類型。列表不下載每個完整 manifest。保留既有版本，不追溯更新。
- QA 列表用「已停用／待補引用／下次建立版本時收錄」，caption 明示建立新版本後選取試問。人工模式不是即時發布。

## Risks / Trade-offs

- 人工答案不由文件背書 → 清楚標示來源，只有原有編輯權限可設定；仍經版本凍結與發布審核。
- migration 尚未部署時新欄位不可讀寫 → 部署順序為 migration、Edge、網站；不宣稱本機完成等於已上線。
- 人工問答與文件 QA 的相同問句沿用既有版本排序；本次不新增衝突優先規則或語意匹配。
- 真實檢索錯誤尚無 logs → 不聲稱已修復；人工 FAQ 路徑以無檢索、零模型呼叫驗收。

## Migration Plan

新增 migration，不修改已套用 SQL、舊 snapshot、角色或發布 gate。正式執行需另獲授權，先比對函式定義與目前部署再依序更新 migration、Edge、網站。回退網站可恢復原 UI；人工模式已產生的版本需改回先前已發布版本，欄位與歷史紀錄保留，不以刪欄位回滾。

## Validation

先建立會失敗的 Node／Vitest 情境，再實作。驗證人工無引用收錄、文件無引用拒絕、有效文件引用保留、停用不收錄、舊快照不變、來源從歷史輸出取得、未知或過期內容不標成人工。SQL 使用隔離的嵌入式 PostgreSQL 與合成 fixture 執行真實 snapshot／詳情函式和 migration；不啟動本機 server 或連線正式 DB。網站全套單工測試、type-check、build，後端 Node tests，OpenSpec strict 與完整 diff self-review。

### 2026-11-26 驗證結果

- Red：實作前網站新增情境 6 failed、62 passed；Node 人工來源情境失敗、既有 8 passed；SQL 舊函式拒絕人工答案，回傳 snapshot_citation_missing。切換人工模式立即隱藏引用欄位的追加測試先失敗，再修正。
- Green：`npm test -- --maxWorkers=1` 為 266／266（28 檔）；`npm run type-check` 與 `VITE_RAG_ENABLED=true npm run build` 通過。
- 後端 `node --experimental-strip-types --test --test-concurrency=1 supabase/functions/rag-v1/*.test.ts supabase/functions/rag-pilot/core.test.ts` 為 67／67。未執行 Deno、Flutter 或正式服務驗收。
- PGlite 0.6.0 載入真實 snapshot 與詳情函式：預設值、有效／缺失／錯誤原文／版本外引用、停用、不回寫、歷史來源、過期隱藏與存取門檻通過；函式 ACL、security definer 與 search_path 保持不變。`--drift` 證實定義不符時包含新增欄位在內整筆回滾。fixture 的角色判斷是替身，未宣稱正式 RLS 驗證。
- `openspec validate rag-manual-faq --strict` 通過；後端 `--all --strict` 13／13。網站全量 7／8，既有 rag-plain-ui-refresh 缺少 7 個原有 scenario，該 change 與主 spec 均未被本次修改；本次不補寫其他需求。兩 repo `git diff --check` 通過。
- `npm audit --audit-level=moderate` 回報既有 8 項（4 moderate、4 high）；package.json 與 package-lock.json 沒有變更，未擴大為套件升級。

### Self-review

單一 Agent 自查，沒有宣稱獨立審查。資料流以顯式 boolean 從草稿進入不可變版本，再進入已儲存的回答；只有此來源選項免引用，舊資料不推測類型。快照條件、runtime contract、權限與發布 gate 保留，migration 以精確片段檢查降低定義漂移風險；UI 不額外讀每個版本的完整 manifest。自查發現人工切換後仍顯示文件欄位，已以失敗測試重現並修正。沒有調整檢索、模型、預算或引入執行期依賴。部署順序、回退方式與真實資料未驗證邊界見上文及後端 docs/rag.md。
