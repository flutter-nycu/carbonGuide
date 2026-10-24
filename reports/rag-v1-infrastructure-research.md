# RAG v1 基礎設施查核

查核日期：2026-10-24。狀態：`candidate_only`。依據根目錄 `rag-v1-implementation-plan.md`；本報告沒有部署服務、讀取正式資料或執行效能測試。

後續文件更新（2026-10-24）：本報告的資源建議與修正已整合進[實作規劃](../rag-v1-implementation-plan.md)。以下保留整合前的查核依據，修正清單不表示更新後規劃仍有相同問題。

結論：採用 Supabase 託管 PostgreSQL／pgvector 可行。以計畫中的 45 個檔案、1,120 頁、1,500–3,000 段為假設，先用現有電腦或小型 CPU worker 解析，生成與 embedding 交給 API，不需要購買 GPU。文件數、總容量與尖峰併發尚未獨立盤點，因此以下規格是試跑起點，並非已驗證的容量保證。

## 官方限制與計畫修正

| 項目 | 查核結果與建議 |
|---|---|
| Edge Functions | 官方限制為記憶體 256 MB、每請求 CPU 2 秒；wall clock Free 150 秒、付費 400 秒，另有 request idle timeout 150 秒。計畫把 Docling 搬到 worker 正確；等待模型的非同步 I/O 不計入 CPU 時間，但仍受時間限制。[來源](https://supabase.com/docs/guides/functions/limits) |
| pgvector 維度 | `vector` 可以儲存到 16,000 維；2,000 維是 HNSW／IVFFlat 對 `vector` 的索引上限。3,072 維並非必須改儲存型別，可先精確搜尋，或以 halfvec expression index 建近似索引。計畫的「必須 halfvec」應改為有條件敘述。[來源](https://github.com/pgvector/pgvector#reference) |
| 中文檢索 | Supabase 官方仍提供 PGroonga，適用中文等多語全文檢索；部署前仍須確認目標 project 可用版本。不能把 PostgreSQL 英文全文搜尋範例直接視為中文分詞方案。[來源](https://supabase.com/docs/guides/database/extensions/pgroonga) |
| ANN 與篩選 | HNSW 的篩選可能在近似索引掃描後發生；SQL 寫了 WHERE 不等於索引先做完整篩選。pgvector 0.8.0 起的 iterative scan 可以補掃，仍需量召回率。初期使用精確搜尋合理；「2 萬段才加索引」只能當提醒，應依尖峰負載與 p95 延遲決定。[來源](https://github.com/pgvector/pgvector#iterative-index-scans) |
| Queues | 官方 exactly-once 僅限 visibility window。視窗到期後訊息可再被讀取，因此 worker 要有工作唯一鍵、重試上限、visibility 延長或足夠的 lease、成功提交後再 ack，以及永久失敗記錄。[來源](https://supabase.com/docs/guides/queues/pgmq) |
| Cloud Run 身分 | 不需要為 Cloud Run Job 下載長效服務帳號私鑰。Job 可附加 service identity，透過 ADC 存取 GCP；GitHub Actions 等外部觸發端可用 Workload Identity Federation。Supabase／模型 API 的秘密仍要另行管理。[service identity](https://docs.cloud.google.com/run/docs/securing/service-identity)、[WIF](https://docs.cloud.google.com/iam/docs/workload-identity-federation) |
| Supabase 新表權限 | 官方已公告新 project 預設不自動授予 Data API 權限，既有 project 的全面套用日期是 **2026-10-30，晚於本次查核日期**。新 migration 應明寫需要的 GRANT、RLS 與 policy，不能只寫「每張表啟用 RLS」。這不是要求把原本私有的段落開放給一般使用者。[公告](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) |

## 資源起點

以下為工程估算。Docling 官方說明可限制 CPU threads，預設使用 4 threads；PDF 峰值記憶體與同時解碼、緩衝的頁數相關，可調整 `queue_max_size` 和 `max_concurrent_results`。官方沒有對這批文件承諾統一的最低 RAM 或每頁耗時。[Docling 資源限制](https://github.com/docling-project/docling/blob/main/docs/usage/advanced_options.md#limit-resource-usage)

| 元件 | 建議起點 | 何時增加 |
|---|---|---|
| 現有開發電腦兼解析 | 4–8 核 CPU、16 GB RAM、額外預留 20–50 GB SSD；一次處理一份文件 | 同時開 Docker、IDE、瀏覽器與解析時，32 GB RAM 較有餘裕；先看實際記憶體，不急著換機 |
| 雲端 Docling worker | 2 vCPU、8 GiB RAM、每次 1 個解析工作；模型 threads 配合 CPU 限額 | 複雜表格或高解析掃描先限制頁面緩衝，再比較 4 vCPU／16 GiB；不要用更多並行掩蓋記憶體問題 |
| Supabase 測試 | Free 可試作；Nano 為共享 CPU、最多 0.5 GB RAM。需注意 500 MB DB、1 GB 檔案 Storage、50 MB 單檔上傳上限、閒置暫停 | 超過文件或 DB 配額，或需要穩定業主驗收時改 Pro |
| Supabase 驗收／初期服務 | Pro + Micro（共享 CPU、1 GB RAM）作基線；若與其他工作共享負載或需餘裕，可用 Small（2 GB RAM） | 依 DB CPU、記憶體、連線與查詢 p95 調整，不能只看使用者總數 |
| 模型與 embedding | 呼叫外部 API；本機不載入生成模型 | 只有另行決定自架模型時，才重做 GPU、VRAM、維運估算 |

Supabase 規格來源：[Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)、[Pricing](https://supabase.com/pricing)。Cloud Run 支援 2 vCPU／8 GiB、4 vCPU／16 GiB 配置，但並不保證解析速度。[CPU／記憶體配置](https://docs.cloud.google.com/run/docs/configuring/jobs/cpu)

Cloud Run 預設可寫檔案系統使用記憶體且不持久。不要把「預留 SSD 20–50 GB」照搬成容器 `/tmp` 預算；原始文件與結果放物件儲存，按檔案／頁面分批處理並清理暫存，必要時另評估磁碟掛載。[執行環境](https://docs.cloud.google.com/run/docs/container-contract#file_system)

向量本體很小：官方 `vector` 儲存公式為 `4 × 維度 + 8` bytes。3,000 段 × 768 維約 **9.24 MB**；1,536 維約 **18.46 MB**。這是計算值，**不含**原文、資料列、索引、QA、歷史版本、執行紀錄、WAL 與備份；整體容量須另量測。多個 profile 與 release 保留會增加容量。[pgvector 儲存格式](https://github.com/pgvector/pgvector#vector-type)

## 費用與採購判斷

- Supabase Pro 組織月費由 US$25 起，含 US$10 compute credit；一個 Micro 常駐 project 約抵完 credit，Small 約為 US$30／月總額。若既有 Pro 組織已有一個 Micro 用掉 credit，再加一個測試 Micro，通常增加約 US$10／月，而不是再加一份 US$25。這些都未含額外用量與稅。[價格](https://supabase.com/pricing)
- Cloud Run Jobs 按 instance 存活時間計費，每次最少 1 分鐘。以官方 Tier 1 未折扣單價 CPU US$0.000018／vCPU-second、RAM US$0.000002／GiB-second 計：2 vCPU／8 GiB 約 **US$0.1872／執行小時**；4 vCPU／16 GiB 約 **US$0.3744／執行小時**。例如前者累計 10 小時約 US$1.87，**這是假設執行時數，不是 1,120 頁的耗時預測**。免費額度可能抵扣；地區、Artifact Registry、Cloud Build、傳輸與模型費另計。[單價](https://cloud.google.com/run)、[計費規則](https://cloud.google.com/run/pricing)
- 初期優先使用現有電腦，或預留小額按次 worker 費用；沒有證據支持先買 GPU 工作站或常駐高階 VM。真正可能主導每月費用的是回答 API，而不是這批向量的儲存。

## 開工前的最小量測

抽取文字 PDF、雙欄論文、複雜表格、掃描頁及最長文件各一份，固定 worker 配置與套件版本，記錄峰值 RSS、每頁時間、解析品質及失敗重試。再以真實分段在目標 Supabase project 測量 1／5／10 個並行檢索的 p50／p95、DB 負載，以及已發布版本／權限篩選後的召回率。依結果決定是否加 RAM 或 HNSW。本次沒有執行這些量測。

## 任務收尾單

- Task：查核 RAG v1 基礎設施與硬體起點。
- Status：`candidate_only`；Mode：`candidate_only`。
- Changed files：僅本報告。
- Evidence：上列官方連結與本地實作計畫。
- Verification：讀取計畫、Supabase MCP 文件、官方 changelog 與供應商文件；向量大小和 worker 時價按公式計算。
- Not run：未查目標 DB 已裝 extension、未做 API 呼叫、文件解析、壓測或實際帳單驗證；目前是方案評估。
- Risk：原始檔案大小、文件複雜度、使用尖峰、現有電腦規格及帳戶額度未知。
- Next：先完成上述代表文件與檢索基線量測，再確定配置。
