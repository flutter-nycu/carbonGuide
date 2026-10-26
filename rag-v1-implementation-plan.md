# AI 氣候教練 RAG v1 實作規劃

**2026-10-27 實作更新：** 本輪依使用者授權完成非 Flutter RAG 管理流程，準備上傳程式、文件及受保護 Preview，最後由使用者人工審閱。實作採 Gemini embedding-001 768 維與 Gemini 3.1 Flash-Lite；下方 OpenAI 比較與採購內容保留為原始規劃，不代表本輪配置。

目前已實作私有上傳、URL 快照、本機批次解析／OCR、profile-bound embedding、段落修訂、QA 引用、人格／提示詞／設定／計算草稿、不可變快照、有限輪次、逐步流程與費用、評測、人工審核、發布／回滾、清理排程及帳單匯入。真實資料仍待人工核准，公開服務關閉，Flutter 最後接入。程式完成、雲端部署與語料驗收是三個分開的狀態，詳見 [OpenSpec tasks](openspec/changes/rag-v1-review-ready/tasks.md) 與本輪驗收紀錄。

使用者已核准 **US$5 總模型費用上限**，文件 embedding 和自動評測共用一個 campaign。既有 pilot 的兩次試問及其預留保持原樣；未知結果不自動重送，不清空用量、不建立替代 campaign。Google 帳單尚需真實資料對帳，不能將預留或新台幣預付款視為使用費用。

本輪調整：解析與文件 embedding 均由有界本機 CLI 執行；管理介面負責登記、進度、品質與操作，沒有常駐 automatic embeddings worker。URL 只允許指定官方網域，固定 IP 連線及 TLS 驗證。新回答契約讓模型逐句選原文窗口 ID，伺服器編引用並檢查數量與單位。原始版本、失敗評測與未知結果保留可追溯紀錄。

完整操作、模型流程、電費適用範圍、保存及人工審閱步驟以 [使用說明](docs/rag-pilot-user-guide.zh-TW.md) 為準。以下為原規劃與歷史決策；有衝突時以上述已授權實作及程式契約為準，未執行項目不得宣稱驗收完成。

本文件接續 App repo `githyoung/carbon-navigation` 的 `docs/roadmap.md`「RAG 後台與文件導入候選規劃」，內容包括模型選擇、文件處理、向量處理、回答流程、評測、硬體與費用。和 roadmap 或 Phase 0 決策不同的地方會標「調整」，實作前再同步 App repo 的文件與 OpenSpec change。

2026-10-24 已確認：使用者有 **OpenAI Platform API key，希望用於產品回答**；保留 **Supabase 託管 PostgreSQL／pgvector**。本次把原 Gemini 候選方案調整為 OpenAI API，並整合[可行性評估](reports/rag-v1-feasibility-review.md)與[基礎設施查核](reports/rag-v1-infrastructure-research.md)。Codex 是開發工具，產品執行時由後端直接呼叫模型 API。

模型、規格與單價已在 2026-10-24 查核官方文件，但尚未驗證帳戶模型權限、API 限額、目標 DB extension 或真實負載。具體模型、worker 平台與硬體均為候選起點，採購或上線前須再確認。

評估結論：方案可行，先用 CPU worker 解析文件、API 執行生成與 embedding，不需先購買 GPU。原規劃引用的 45 份文件、1,120 頁、1,500–3,000 段及係數盤點數字，本次未重新盤點；主要待驗證項目是文件品質、檢索召回、引用與數值正確性，以及發布一致性。

2026-10-25 依合併前的規劃檢討調整，使用者已同意：先用腳本做真實資料驗證；embedding 預設改為 `text-embedding-3-large`（1,536 維）；額度改用每人每日計數加 OpenAI 專案硬上限；QA、人格、提示詞與設定在發布時存成快照；v1 解析以 CLI 批次執行，embedding 用 Supabase automatic embeddings（是否需要上傳後自動處理，待業主確認）；後台以 React 改寫並另計時程；計算工具 v1 收窄；Responses API 設 `store: false`。同日評估 Agentic RAG 後，採用兩項有上限的機制（見 5.1）。相關段落標「調整（10-25）」。

## 1. v1 範圍

v1 等於 roadmap 的 Phase 1，只在測試用 Supabase project 進行。完成後，業主可以在後台上傳文件、檢查段落、發布知識版本、試問，並看到評測結果。App 端的入口卡片、人格選擇與對話畫面屬於 Phase 2，不在 v1。

要做的事：

- 文件匯入：PDF、DOCX、TXT、URL 快照，以及排放係數 JSON 的結構化匯入。
- 解析、清理、分段、embedding、混合檢索（向量加中文關鍵字）。
- 知識版本：草稿、審核、發布、回滾。
- 回答依據分三種：通用 QA、文件段落、計算工具。回答一律附引用。
- 計算工具 v1 只做兩項：已核定係數乘活動量的碳排計算，以及表燈非時間電價（累進級距、夏月／非夏月）的節電前後帳單差；水價、車型油耗與時間電價延到 v1.1（見 3.6）。
- 後台：在推播管理台的 React 架構內改寫，原型只當互動規格。v1 先做 7 個畫面：文件與段落預覽、QA、人格與提示詞、試問、知識版本、互動紀錄、RAG 設定（含用量與總開關）；評測先用 CLI 報表加簡單列表，係數與電價級距先以 migration 或 CSV 匯入（見第 10 節）。
- 安全：RLS、金鑰只在伺服器、每人每日上限、去識別化的執行紀錄。

不做的事：

- App 對話畫面、商店隱私標示與隱私權政策更新（Phase 2）。
- 模型微調。RAG 是回答前先查資料，不會拿文件重新訓練模型。
- 通勤感知、飲食影像。
- 寫入 production Supabase。

程式位置依 repo 指南明列，避免「本 repo」指向錯誤：

- App repo `githyoung/carbon-navigation`：`supabase/migrations/`、RLS、Edge Functions 與後端文件。
- 網站 repo `flutter-nycu/carbonGuide`：推播管理台內的 RAG 後台；本規劃目前位於此 repo。
- 解析 worker：建議隨後端放在 App repo，獨立容器與執行入口；實作時在 OpenSpec 指定實際目錄，執行平台見 3.2。
- 實作前在負責的 repo 建立 OpenSpec change，執行 `openspec validate --strict`。第一階段已建立網站 `rag-react-foundation` 與 App repo `rag-admin-foundation`，兩者嚴格驗證通過；後續階段另開 change。

## 2. 模型建議

| 用途 | 建議 | 理由 | 備選 |
|---|---|---|---|
| 回答生成 | `gpt-6-luna`，Responses API；比較 `reasoning.effort` 的 `none`／`low` | 支援 function calling、structured outputs；先建立低成本基線 | 比較 `gpt-6.1-sol`，依相同題庫的品質與費用決定；不預設所有問題自動升級 |
| 問題改寫、意圖分類、判斷要不要追問 | `gpt-6-luna` | 盡量合併成一次結構化輸出，減少模型往返 | 簡單規則能處理時直接處理，評測是否需要每題呼叫 |
| 掃描頁 OCR、複雜表格轉 Markdown | Docling 主處理；失敗頁再試 OpenAI 視覺輸入 | 以 `gpt-6-luna` 做候選，對照原頁檢查數字、單位與表格欄位 | 品質不足時比較 `gpt-6.1-sol` 或人工修正；費用依實際影像／文件輸入計，不能沿用 Gemini 的每頁 token 假設 |
| Embedding | `text-embedding-3-large`，設 `dimensions=1536`、cosine | 調整（10-25）：OpenAI 公布的多語檢索 MIRACL 分數 large 54.9%、small 44.0%，本案是繁中問題加中英文語料；維持 1,536 維，欄位與索引不變。OpenAI 目前沒有比 `-3` 更新的 embedding 模型 | `text-embedding-3-small` 作對照 profile；Step 0 驗證顯示表現相同時改用 small |
| Rerank | v1 預設關閉 | 語料預估 1,500–3,000 段，先量混合檢索的基線 | 先檢查分段、來源覆蓋與候選召回；候選找得到但排名不足時，再試模型對前 20 筆排序 |
| 離線評測裁判 | `gpt-6.1-sol` 作候選 | 只在評測時執行，另記 token、參數與費用 | 有爭議、核心數字與關鍵權限案例交人工判斷 |

選擇時要注意：

- 以上是待評測候選，不代表已通過氣候教練的品質門檻；API key 已備妥不代表所有模型權限及限額都已驗證。
- 調整：Phase 0 的「回答風格」改為提示詞選項（精簡、標準、詳細）與輸出長度上限。模型參數依實際模型支援設定，不直接沿用 Gemini 的 `thinking_level` 或 temperature 建議。
- 接入 OpenAI 時須一併調整模型參數、tokenizer、文件／查詢格式、structured output 與 tool schema、用量解析、錯誤重試及 OCR 輸入方式，不只是替換模型名稱。
- 生成模型與 embedding 可以分開選；文件和問題的向量必須使用相容的 profile。只換生成模型不重算向量；換 embedding 模型、維度或實際輸入格式則建立新 profile。
- 模型 ID 與參數納入版本設定；有可用固定 snapshot 時優先採用，並記錄 API 回傳的模型資訊。單一模型名稱不保證供應商權重永不變動，仍需定期跑回歸題庫。
- pgvector 維持主索引，讓文件版本、權限、中文關鍵字與逐段稽核由本系統管理；v1 不另加供應商 File Search 主索引。File Search 每 1,000 次呼叫 US$2.50，高於 Luna 回答本身的成本，分段與排名不能自己控制，引用也沒有頁碼。
- 調整（10-25）：Responses API 一律設 `store: false`。預設 `store=true` 會在 OpenAI 端保存回應 30 天；本系統自行保存 `rag_runs`，不使用 `previous_response_id` 串接對話，由伺服器帶入對話摘要。濫用監控的保存另計，是否申請 Zero Data Retention 另議。[資料控制](https://developers.openai.com/api/docs/guides/your-data)
- 真實對話與未公開文件送出前，確認 API 專案的資料保存、分享及存取設定。費用與硬體見第 9 節。模型依據：[OpenAI 模型目錄](https://developers.openai.com/api/docs/models)、[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)、[embeddings](https://developers.openai.com/api/docs/guides/embeddings)。

## 3. 文件處理

### 3.1 處理流程

上傳或登記網址 → 預檢 → 解析 → 清理與正規化 → 分段 → 段落預覽與人工修正 → embedding → 草稿試問與評測 → 審核 → 發布。

每個階段都更新 `ingestion_jobs`，記錄失敗原因，可以從失敗的階段重試。狀態分成兩種，不可混用：

- 處理狀態：排隊、解析中、已解析、向量化中、可用、失敗。
- 內容狀態：草稿、審核中、核准、已發布、停用。

解析完成只代表系統讀得懂這份文件，要人工核准並發布後，教練才能引用。

工作可靠性（調整（10-25））：v1 文件數少、更新不頻繁，解析不做佇列、lease 與 outbox。

- 解析以 CLI 批次執行，處理狀態為「待處理」的文件版本；每個階段以內容雜湊做冪等寫入，重跑不會產生重複段落或向量。
- Embedding 採 Supabase 官方 automatic embeddings 模式（trigger、pgmq、pg_cron、pg_net 與 Edge Function）。後台修改 QA 或段落時自動重算；重試靠 pgmq 的 visibility timeout，另設重試上限與失敗紀錄。[官方說明](https://supabase.com/docs/guides/ai/automatic-embeddings)
- 人工修改已向量化的段落要產生新段落版本，重算受影響的 embedding，並使原評測結果失效；已發布版本保持不可修改。
- 若業主要求上傳後自動解析，或之後改成多個 worker 並行，再加入 job 與 enqueue 同一 transaction（或 outbox）、lease／續租、重試上限與永久失敗佇列，資料提交完成才 ack。

### 3.2 解析工具與執行位置

Supabase Edge Functions 的限制是每個請求 CPU 2 秒、記憶體 256 MB、wall clock Free 150 秒／付費 400 秒，另有 request idle timeout 150 秒，不適合承載 Docling 版面分析與 OCR。非同步等待模型不計入 CPU 時間，仍受時間限制。工作因此拆成兩段：

- 後台負責上傳：經授權後簽發短效上傳網址，把檔案存進私有 Storage，建立文件版本，狀態為「待處理」。
- Python worker 負責解析。主力用 Docling（MIT 授權），輸出標題層級、閱讀順序、頁碼與表格結構；文字層不足或表格解析失敗的頁面才送 OpenAI 視覺模型轉 Markdown，並檢查結果。

調整（10-25）：v1 的 worker 以 CLI 批次執行，由開發者在本機執行，或用 GitHub Actions 手動觸發；後台顯示「待處理」與最近一次處理結果。這省下 Cloud Run、IAM 與觸發機制的設定，代價是業主上傳後不會自動解析。**是否要求上傳後自動處理，待業主確認**；若需要，改用下表的 Cloud Run Jobs，並補上 3.1 最後一項的可靠性機制。

| 選項 | 優點 | 缺點 |
|---|---|---|
| CLI 批次（本機或 GitHub Actions 手動觸發），v1 預設 | 沿用 Step 0 的腳本，不需新增雲端服務 | 上傳後要有人觸發；需固定依賴／容器版本，確認 runner 資源與秘密管理 |
| Google Cloud Run Jobs | 容器按執行時間計費，可建立上傳後自動處理流程 | 需要 GCP、IAM、映像與觸發機制；Queues 不會自行啟動 Job |

Cloud Run Job 可附加 service identity，以 ADC 存取 GCP；外部 GitHub Actions 觸發端可使用 Workload Identity Federation，不必下載長效服務帳號私鑰。OpenAI 與 Supabase 的憑證仍須獨立保管。Cloud Run 預設可寫檔案系統會消耗 RAM 且不持久，原始檔與結果放 Storage，分批處理並清理暫存，不能把本機 SSD 空間當成容器 `/tmp` 預算。硬體配置見 9.1。

依檔案類型處理：

| 類型 | 做法 | 注意 |
|---|---|---|
| 有文字層的 PDF | Docling 版面分析 | 論文的雙欄、註腳、圖說要在預覽中檢查 |
| 掃描頁或文字很少的頁 | 每頁非空白字元少於門檻（原盤點用 80 字）先標記，確認不是封面或空白頁，再試 OpenAI 視覺輸入 | 原盤點有 24 頁符合條件，不代表都要 OCR；逐頁驗證數字與表格 |
| DOCX | Docling 解析標題與表格 | 水價和 IPCC 這兩份 DOCX 只有連結，要另外抓原文 |
| URL | 存一份抓取當下的快照到 Storage，記錄抓取時間、HTTP 狀態與 SHA-256 | 不能把網址字串當成已收錄的內容。重抓後內容有差異，就建新版本草稿 |
| TXT | 直接讀取，先偵測編碼（UTF-8 或 Big5） | 臺灣的舊檔案常用 Big5 |
| 係數 JSON | 不進向量索引，逐欄檢查後匯入 `emission_factors` | 見 3.6 |
| 電價、水價、車型油耗表 | 解析成結構化資料，由計算工具使用 | RAG 只說明適用規則與假設 |

預檢須限制檔案大小、頁數、類型與處理時限。URL 抓取僅允許核准的協定與來源範圍，阻擋內網、loopback 與 metadata 目標，redirect 後重新驗證目的地，並限制下載量與時間。

### 3.3 清理與正規化

- 原文保留給畫面顯示與引用，另存一份正規化文字給檢索用。
- PDF 抽出的中文常在行尾斷開，接回時不要加空格；英文行尾的連字號也要接回。
- 同一行文字在超過一半的頁面重複出現，視為頁首、頁尾或頁碼並移除。預覽時要能還原。
- 全形英文字母與數字轉成半形，中文標點維持全形。不要整段套 NFKC，它會把中文逗號、括號也轉成半形。
- 單位寫法統一，例如 kWh、kgCO2e、公升。
- 檢索用文字把「台」統一成「臺」，查詢也做同樣處理。畫面仍顯示原文。
- 不做簡繁轉換。遇到簡體來源就標記語言。

### 3.4 分段

- 依結構切：先依標題層級分章節，再在章節內依段落和句尾標點（。！？；）組到目標長度。
- 長度先用 400–800 tokens。overlap 只在同一章節內做，約 50–100 tokens。以 embedding 模型對應的 tokenizer 計數，包含標頭與重疊；生成模型的 context 預算另外計算，不以中文字數直接代替 tokens。
- 每段前面加標頭：文件名、章節路徑、適用對象、資料年份，再接段落正文。固定序列化格式與版本，見 4.1；不把 Gemini 特定任務前綴當成 OpenAI 的必要格式。
- 父子段落：檢索時用 400–800 tokens 的子段落比對，選中之後在 token 預算內帶上同章節的前後段。展開時仍須限制在本次 release 與授權範圍內。
- 表格：小表格整張當一段，保留表頭、單位與註腳。大表格逐列改寫成「欄名：值」的句子再分段，數值另存結構化資料表。
- 論文：摘要、結論、主要發現優先，參考文獻與致謝不進索引。每篇標記研究設計、地區、樣本、年份與限制。業主核定的證據摘要作為主要回答依據，原文段落用來追溯。
- 切段時不要拆開數字和單位、條列項目和它的標題，也不要把表格的一列切成兩段。
- 每段保存：文件版本、段落集合版本、頁碼範圍、章節路徑、原文、正規化文字、語言、tokens 數、完整 embedding 輸入雜湊、分段器版本。
- 可以實驗：用 `gpt-6-luna` 替每段產生一兩句「這段在講什麼」放進標頭。評測有改善才保留；摘要也屬於實際輸入，修改須重算向量。

### 3.5 品質把關

- 段落預覽：管理員對照原文頁面，可以合併、拆分或排除段落，例如目錄與版權頁。
- 自動警示：段落太短（少於 50 tokens）或太長、亂碼比例高、重複段落（內容雜湊相同，或向量相似度高於 0.95），以及疑似指令的文字，例如「忽略以上指示」。
- 知識版本要通過評測門檻才能發布，見第 6 節。

### 3.6 係數與費率

- 1,164 筆係數先原樣匯入暫存表，再逐欄檢查：單位能解析、數值是有限數字、公告年與部門都有值。
- 同名但數值不同的 102 筆不刪除，由審核者指定適用的年份與系統邊界。
- 模型不直接讀係數表講數字。計算工具查已核定的係數算出結果，模型只負責說明。
- 係數名稱可以另外建 embedding，用來找候選項目，但最後採用哪一筆由規則決定：單位、年份、地域、邊界。
- 省錢估算要用完整的費率函式算前後帳單差，不能只拿單一每度電價乘上節電量。
- 調整（10-25）：v1 的計算工具只做兩項：已核定係數乘活動量的碳排計算，以及表燈非時間電價（累進級距、夏月／非夏月）的節電前後帳單差。水價、車型油耗與時間電價延到 v1.1；使用者問到時先追問或說明尚未支援。
- 發布時把本次用到的係數與電價級距寫進 release 快照（見 7.1），計算依該快照與工具版本執行，回傳採用的來源 ID、單位、假設與結果。

## 4. 向量處理

### 4.1 Embedding profile

供應商、模型、維度、距離度量、文件／問題格式、tokenizer、分段器版本與正規化規則合起來稱為一個 embedding profile。每個知識版本固定使用一個 profile，問題和文件必須依該 profile 產生相容向量；同維度但不同模型的向量也不能混用。

- v1 基線候選（調整（10-25））：OpenAI `text-embedding-3-large`、`dimensions=1536`、cosine；對照 profile 為 `text-embedding-3-small`（1,536 維）。
- 文件格式：依固定順序組合文件名、章節、適用對象、年份與正規化正文；標頭和正文均算入輸入 hash 與 token 預算。
- 問題格式：正規化後的獨立問題文字。多輪問題先改寫；不預設加 Gemini 的 `task: ... | query: ...` 前綴。
- 畫面與引用顯示原文；profile 與相應的門檻校準結果版本一併保存。

### 4.2 儲存與索引

- v1 基線欄位用 `vector(1536)`。調整：`vector` 本身可存至 16,000 維；2,000 維是一般 vector 的 HNSW／IVFFlat 索引上限，halfvec 的對應上限是 4,000。3,072 維可先存 vector 並精確搜尋；需要近似索引時再比較降維或 halfvec expression index，無須一律改儲存型別。
- 1,500–3,000 段先用精確搜尋作基線，實測 p95 與尖峰負載後再決定是否加 HNSW。不要把「2 萬段」當成固定切換門檻；篩選欄位與 release 關聯仍需適當索引。
- 如需 HNSW，以 `vector_cosine_ops`、m 16、ef_construction 64 作起點，調整 ef_search 並與精確搜尋比較召回。這些不是已驗證的最佳參數。
- HNSW 的篩選可能在近似索引掃描後執行，即使 SQL 有 WHERE 仍可能回傳不足。pgvector 0.8.0 起可用 iterative scan 補掃；若採 `relaxed_order`，在融合排名前重新按距離排序。先確認目標 project 的 `pg_extension` 版本，必要時比較 partial index 或分區。
- 同一搜尋只查指定 profile；若建近似索引，可依 profile／維度分隔。換 profile 不覆寫舊向量，以保留回滾能力。資料型別與索引限制依 [pgvector 官方文件](https://github.com/pgvector/pgvector)。

### 4.3 混合檢索

- 向量檢索取前 20 筆。
- 關鍵字檢索：PostgreSQL 內建的全文搜尋不會切中文詞。Supabase 支援 PGroonga，可以處理中文，用它對正規化文字建索引，也取前 20 筆。
- 兩邊結果用 RRF 合併，常數 k 先用 Supabase 範例的 50，再依評測調整。同一段或同一父段重複出現的只留一次。
- 兩條檢索分支都在 SQL 中限制本次 `release_id`、profile、授權範圍、適用對象、生活領域、有效期間與語言，再形成候選。不能在應用程式取完 top-k 才過濾；WHERE 不保證 ANN 的實體執行順序，召回限制依 4.2 處理。評測與管理員草稿試問使用另外授權的候選版本入口。
- 給模型的段落數預設 5（Phase 0 的「參考段落數」，可調 1–10），另外設總 token 上限，例如 4,000。
- 多輪對話先用 `gpt-6-luna` 把問題改寫成不看上下文也能檢索的句子，可與意圖分類合併呼叫。
- 同義詞表由後台維護，例如冷氣與空調、機車與摩托車。PGroonga 可以用同義詞展開查詢。

### 4.4 門檻

- 調整：Phase 0 的相似度門檻 0.70 和 QA 門檻 0.85 都只能當暫定值。cosine 分數的分布會隨模型和維度改變，換 profile 就要重新校準。
- 校準方法：用評測集裡「有答案」「無答案」「容易混淆」三類題目畫出分數分布，選一個讓無答案題被誤答最少、同時 Recall@5 達標的值。門檻跟著 profile 一起保存。
- 後台的門檻設定旁邊要顯示目前 profile 的校準建議值，以及調整後評測結果的變化。
- RRF 是融合排名分數，不能套用 cosine 的 0.70 或 QA 的 0.85。分別保存向量分數、關鍵字排名與 RRF 分數；拒答條件另外校準，不能只看融合排名。

### 4.5 重建與換模型

- 換 embedding 模型、維度、輸入格式、正規化規則或分段器：建新 profile → 產生新段落集合／重算所需向量 → 跑同一份版本化評測 → 通過後發布。舊版本保留供回滾；大量離線工作再評估 Batch API 的可用性、時限與當時單價。
- 只換回答模型、提示詞或人格：建立新的回答設定／知識版本並重跑評測；embedding 輸入及 profile 未變時可沿用向量。
- 以實際輸入 70 萬–100 萬 tokens 的假設計，small embedding 一般價約 US$0.014–0.020，large 約 US$0.091–0.130。實際 token 數需包含標頭、overlap、表格展開及重試，費用見第 9 節。
- Embedding 冪等鍵用「完整序列化輸入 hash 加 profile」。輸入包括標頭、正文及可選摘要；只 hash 正文會漏掉標頭更新。失敗用指數退避、重試上限並記錄原因。

## 5. 回答流程

1. v1 由後台試問呼叫 Edge Function，Phase 2 再接 App。先驗證登入及權限、檢查總開關，以一次原子 upsert 扣除每人每日題數（Phase 0 預設 30 題，未達上限才加一）；接著固定本次 `release_id`。草稿試問只允許管理員以獨立授權入口指定候選 manifest，不放寬公開回答的版本限制。
2. `gpt-6-luna` 判斷問題是否離題、需不需要計算、缺不缺必要資料（地區、期間、用量），並在需要時改寫問題。缺資料就先追問。
3. 查本次 release 的通用 QA 版本，語意比對達到校準門檻就採用，引用其核定來源。
4. 對同一 release 的段落做混合檢索。需要計算時，由伺服器驗證 function calling 參數，呼叫限定的計算工具，使用該 release 固定的係數、費率與工具版本。檢索不足時可改寫問題再查一次；需要多個依據時，回答模型可在上限內再呼叫工具（見 5.1）。
5. 組合提示，順序為：全域 System Prompt、人格指令、引用規則、證據（每段加編號 S1、S2…）、對話摘要、使用者問題。文件內容放在獨立的資料區塊，並寫明這些是參考資料，不是指令。
6. 用 Responses API（`store: false`）的 structured output 產生回答，欄位包括回答、引用編號、是否資料不足、追問。伺服器檢查引用編號是否都在本次證據、release 與授權範圍內；不符時在預算及重試上限內重試一次，仍不符就回覆資料不足。ID 合法只代表格式與來源範圍正確，是否支持主張仍須評測；工具數字與單位另做確定性驗證。
7. 寫入 `rag_runs`：release／profile／模型與設定版本、工具與資料版本、入選段落與各種分數、耗時、tokens 與費用；以 request ID 冪等寫入，失敗也記錄已發生的 tokens。每日總預算由這些紀錄累計（見第 8 節）。問題文字先去識別化，保存期限依第 8 節。

「只根據知識庫回答」開啟時，沒有證據就回覆後台設定的「查無資料時的回覆」，不讓模型用自己的知識補。

QA 命中時有兩種做法，需要業主決定：一是模型以 QA 標準回答為依據，改寫成人格的語氣，但不能改數字和結論；二是逐字回覆 QA 內容。

整個請求的 QA、檢索、父段展開、計算與引用都使用已固定的 release。即使請求執行途中發布或回滾，也不能把不同版本混在同一則回答。供應商呼叫須有逾時、取消與有限重試，不以 Edge 的 wall clock 上限作使用者等待目標。

### 5.1 有限度的 agentic 機制

調整（10-25）：評估 Agentic RAG（協調代理挑工具、評估代理檢查證據、不合格就改寫或換來源重試）後，只採用以下兩項。兩項都有固定上限，各有開關且預設關閉，評測證明有改善後才開啟（見第 6 節）。

**A. 檢索不足時改寫問題，再查一次**

- 觸發：本次 release 的混合檢索沒有候選，或沒有任何候選達到該 profile 校準過的向量門檻。由程式判斷，不另設評估代理。
- 做法：`gpt-6-luna` 改寫問題一次，補同義詞、去掉口語，必要時加上英文關鍵詞以查英文論文；用同一個 release、profile 與篩選條件再跑一次混合檢索。仍然不足，就回覆「查無資料時的回覆」。
- 上限：每題最多 1 次。
- 理由：問題是繁中口語，語料有一部分是英文論文；第一次查不到多半是用詞不同，這是改寫能救回來的情況。
- 估計代價：只在不足時多一次小呼叫（約 1,000 tokens 輸入、100 tokens 輸出，約 US$0.00015）和一次檢索；延遲每多一輪估計 1–2 秒，以 Step 0 實測為準。

**B. 有限次數的伺服器端工具呼叫**

- 回答模型可以用 function calling 呼叫 `search_knowledge`（只查本次 release 的混合檢索）、`calculate_emission` 與 `estimate_electricity_bill`。每題最多 3 次工具呼叫，工具都在伺服器端執行，參數由伺服器驗證。
- 用途：同一題需要多個依據，例如「每天騎機車 10 公里，改搭捷運一個月少多少碳？」需要建議段落加上碳排計算。
- 引用檢查不變：最終回答的引用必須都來自本題各輪工具實際回傳的證據，並且在本次 release 與授權範圍內。
- 估計代價：最壞情況（改寫重查一次，加上 3 次工具呼叫各多一輪，每輪約 7,000 tokens 輸入）每題約 US$0.004，未啟用時約 US$0.00115；固定的前段提示詞可由 prompt caching 降低重複輸入的費用，上述估算未計入。
- Phase 2 候選：`get_my_footprint`，經 RLS 讀取使用者自己的問卷結果，提供個人化建議。

**紀錄與呈現**：`rag_runs` 記錄每一輪，包括原始與改寫後的問題、每次工具呼叫的名稱、參數與結果摘要、各分支分數、耗時與 tokens；試問台逐輪顯示這段軌跡。

**不採用**：

- Web search：會繞過內容審核與知識版本，違反「只根據知識庫回答」，也會把使用者的問題送給第三方搜尋服務。
- CRM、MCP servers：沒有對應的資料來源。
- 分開的協調代理與評估代理：每題多兩次模型呼叫，而門檻、引用 ID 與計算結果的檢查都可以用程式完成。
- 多次重試迴圈（例如最多 5 次）：手機上的延遲與費用不可預期，評測與稽核也難以重現。
- 每題執行 LLM 答案評估：成本與延遲加倍；維持離線評測，上線後抽查。

### 5.2 每次詢問／測試的流程與成本視覺化（2026-10-25 追加規劃）

使用者要求在管理介面透明呈現「這次經過哪些步驟、為何走這條路、花多久、花多少」。入口放在試問結果、評測每一題與互動紀錄的「查看流程」，共用同一個執行詳情元件；不另造一份與真實執行紀錄不同的展示流程。

預計主路徑：權限與額度 → QA／快取 → 問題向量 → 向量及關鍵字並行檢索 → RRF／來源門檻 → 模型生成 → 引文及規則驗證 → 回答或拒答。問題改寫與工具呼叫依實際分支展開，改寫／工具仍遵守5.1上限。QA直接命中、被額度擋下、檢索不足及模型失敗都應保留可追蹤的終點。

| 區域 | 顯示內容 |
|---|---|
| 執行摘要 | query／test／evaluation來源、request與trace ID、attempt、開始時間、端到端耗時、完成／拒答／失敗、知識版本、模型／提示詞版本 |
| 流程圖／時間軸 | 實際節點與分支、進行中／成功／失敗／略過／重用、耗時與成本狀態；並行節點不把時間相加當成端到端延遲 |
| 節點詳情 | 安全的輸入輸出摘要、入選及排除來源與原因、排名／分數、token用量、錯誤碼、重用來源run、重試原因 |
| 成本明細 | 問題embedding、改寫、生成、工具與其他可歸屬費用；保留provider、模型、價格版本、單位、幣別及估算依據 |
| 比較與匯出 | 同題不同attempt／提示詞／知識版本並排；受權限限制的去識別化JSON／CSV，不公開原始個資或金鑰 |

成本欄位必須區分四件事：provider回報的用量、以版本化單價計算的費用估算、執行前保守預留、供應商對帳確認金額。目前只能可靠取得部分用量與預留，不能把它們標成實際扣款。缺少用量或單價顯示「未取得／尚無法估算」，不能顯示0。USD作主幣別；若顯示TWD，必須標明匯率與時間，不能假裝是帳單匯率。失敗或取消請求也可能計費，未收到用量時保留未知狀態。

共用的文件解析／embedding費用歸到匯入run；多題評測共用準備步驟只計一次，可另顯示明確標示的攤提值。費用帳本以provider request／attempt去重；父span顯示子項加總時不能再次入帳。快取或重用只說明本次沒有重送該步驟，不抹除原run費用。

後端契約採 `trace_id`、`span_id`、`parent_span_id`、`attempt`、`node_type`、狀態、起訖時間、版本、用量、成本來源與錯誤碼。沿用 `rag_runs` 作執行索引，新增明細儲存方案須以migration與RLS另外驗證；一般App使用者不可讀別人的trace。頁面預設只顯示去識別化摘要，限制原始內容大小與保存期限；金鑰、authorization headers、隱藏模型思考內容不進trace。後台不把模型輸出當HTML執行。

分三階段：①本機回答診斷與trace雛形，保存失敗證據並標示重用；②服務端各節點埋點、費用帳本、權限／保存與讀取API；③React流程圖、節點詳情、成本明細及手機直向時間軸。第一階段不代表管理介面已實作。規格與待辦見 `openspec/changes/rag-run-visualization/`。

驗收須覆蓋成功、拒答、403／429／timeout、引文失敗、QA直接命中、重用、手動新attempt、改寫與工具分支；每題有可追蹤終點，圖與實際紀錄一致，未知成本不變成0，共用費用不重複計算。另驗證角色隔離、鍵盤操作、手機版及敏感資訊遮蔽。進行中狀態由事件更新；缺少遙測時明示中斷／未知，不能補畫假成功。

## 6. 評測

- 題庫先用 40–60 題，和 QA 分開維護並版本化，保留不參與調參的驗收題。題型包括：一般建議、換句話問、用中文問英文論文的內容、跨年度費率、單位混淆、缺必要資料、沒有答案、文件內含惡意指令、試圖讀取未發布的內容。
- 每題標記應該找到的文件與頁碼、正確數值，以及應該追問或拒答的情況。
- 檢索指標：Recall@5、MRR@10。
- 回答指標：引用支撐率（每個主張都有引用，而且引用內容確實支持該主張）、數值正確率、應拒答題的拒答率、應追問題的追問率。
- 候選門檻（沿用 roadmap，待業主確認）：Recall@5 至少 90%、引用支撐率至少 95%、核心數值題全部正確、測試集中未發布內容外洩 0 次。零次是該測試集的結果，不是所有情境的安全保證。
- 由 LLM 裁判先評分，人工抽查至少 20%，並核對所有核心數值題、關鍵權限案例與未通過的題目。裁判模型與 prompt 也記版本。
- 要重跑的時機：換生成模型、profile、分段器、System Prompt、人格指令、工具／係數／費率或檢索參數，以及每次發布新知識版本之前。
- 比較精確向量、中文關鍵字、混合檢索，以及 small／large embedding 的基線；紀錄來源覆蓋、Recall、MRR、拒答與引用支撐，避免只看模型裁判總分。
- 量測代表文件的解析峰值 RSS、每頁時間與失敗率；以 1／5／10 並行量檢索 p50／p95、DB 負載與端到端延遲。檢索 p95 300 ms 可作討論目標，尚未實測或承諾。
- 加入匯入重跑、發布途中有請求、回滾後計算數據一致性、並行計數扣除、專案上限與預算耗盡的測試。
- 5.1 的 A、B 開啟前，用同一份題庫比較開關前後的 Recall@5、拒答與追問正確率、引用支撐率、p95 延遲與每題費用；召回或拒答正確率有改善、p95 延遲仍在目標內，才開啟並記入 release 設定。題庫要包含需要改寫才查得到的題目（繁中口語問英文論文、同義詞），以及需要多個依據的題目。

## 7. 資料表（候選）

Migrations 放在 App repo `githyoung/carbon-navigation` 的 `supabase/migrations/`。每張表依用途設定 RLS、policy 與最小權限 GRANT，不假定新表會自動對 Data API 開放。調整（10-25）：QA、人格、提示詞這類小型可編輯內容不另開 `*_versions` 表，改在發布時寫入 release 快照（見 7.1）。一般使用者不能直接查段落、草稿 QA 或別人的紀錄，只能透過 Edge Function 取得回答。

| 表 | 用途 | 重點欄位 |
|---|---|---|
| `documents` | 來源文件 | 標題、類型、資料用途、生活領域、適用對象、可引用範圍 |
| `document_versions` | 每次上傳或重抓的版本 | Storage 路徑、SHA-256、抓取時間、有效期間、處理狀態、內容狀態 |
| `chunk_sets`、`chunks` | 不可修改的段落集合與段落 | 文件版本、集合版本、頁碼、章節路徑、原文、正規化文字、tokens、完整輸入 hash、分段器版本 |
| `embedding_profiles` | 向量設定 | provider、模型、維度、格式、tokenizer、正規化／分段器版本、門檻校準版本 |
| `chunk_embeddings` | 段落向量 | 段落、profile、完整輸入 hash、向量；設定唯一限制 |
| `ingestion_jobs` | 處理工作 | 冪等鍵（內容雜湊）、階段、狀態、失敗原因、重試次數；需要上傳後自動處理時再加 lease 與可重試時間 |
| `qa_entries` | 通用 QA（可編輯草稿） | 問題、其他問法、標準回答、核定來源與段落版本、狀態 |
| `emission_factors`、`tariff_rules` | 結構資料（v1 以 migration 或 CSV 匯入；車型油耗延到 v1.1） | 單位、年份、地域、邊界、來源、核定人；核定列不可覆寫 |
| `personas`、`prompts` | 人格與提示詞（可編輯草稿） | 內容、狀態 |
| `knowledge_releases`、`knowledge_release_items` | 知識版本與 manifest | 固定的文件版本／段落集合與 profile；QA、人格、提示詞、RAG 設定、用到的係數與電價級距、工具版本存成不可修改的 jsonb 快照；評測結果 |
| `rag_service_state` | 服務目前設定 | active release 指標、總開關與預算設定 |
| `rag_runs`、`usage_daily` | 互動紀錄與每人每日題數 | request ID、使用者識別、各項版本、段落與分數、耗時、tokens、費用；改寫後的問題與每次工具呼叫（5.1）；每日計數以原子 upsert 更新 |
| `evaluation_cases`、`evaluation_runs` | 版本化評測 | 題目與題庫版本、預期來源、受測 release、裁判版本、執行結果 |

### 7.1 發布與回滾契約

- Release manifest 連到不可修改的段落集合（以內容雜湊識別）；QA、人格、提示詞、RAG 設定、係數與電價級距在發布時整包寫進 jsonb 快照，之後不可修改。不能只保存「已發布」狀態或指向可被覆寫的資料列。回滾就是切換 active release 指標。調整（10-25）：保證和逐表版本化相同，但少 4–5 張版本表；要查某筆 QA 的歷史時，比對各 release 的快照。
- 草稿可編輯；要試問或評測時先凍結候選 manifest。修改任何會影響回答的內容，建立新版本並重新評測，不能把舊通過結果套到新內容。
- 發布前驗證所有必要向量可用、引用可解析、來源已核准且該 manifest 的評測通過；在 transaction 中切換 active release。回滾同樣只切換到完整、可用的既有 release。
- 以受控 RPC／DB 權限限制寫入及發布操作，避免管理 API 可直接覆寫已發布內容。回滾會還原知識與設定；供應商未提供固定模型 snapshot 時，不承諾回答逐字重現。

## 8. 權限、隱私與費用控制

- OpenAI API key 只放在 Supabase secrets；worker 使用獨立的伺服器端 secret 管理。App、瀏覽器及 `VITE_*` 都不能取得模型 key 或 Supabase service role／secret key。
- Storage 原始檔使用私有 bucket，依角色產生短效下載／預覽權限。列明資料表、Storage、RPC 與 worker 權限；高權限後端仍須顯式驗證使用者、release 與內容範圍，不能假定 RLS 會替 service role 過濾草稿。
- 後台角色：推播後台目前只允許一個管理員 Email，限制寫在三個地方（見 App repo `docs/push-operations.md` 與本 repo `AGENTS.md`）。v1 若要分出編輯者和審核者，就是權限變更，要另外確認。
- 互動紀錄是個資。建議預設保存 90 天、只有 owner 能看全文，刪除帳號時一併刪除（`delete-account` 要擴充）。這幾項需要業主確認。
- 費用控制（調整（10-25））：
  - 每人每日題數用一次原子 upsert 扣除，未達上限才加一。
  - OpenAI 專案設硬性月上限，再加花費警示；達到上限時請求回 429，服務改走下一項的無模型回覆。官方說明上限不是即時生效，可能略為超出。[Spend limits](https://developers.openai.com/api/docs/guides/spend-limits.md)
  - 每日總預算由 `rag_runs` 累計的實際 tokens 計算，超過就切總開關。
  - 每次請求仍限制最大輸出、工具往返與重試次數。
  - 不做呼叫前預留與事後結算：以 Luna 每題約 US$0.00115 計，並行時多跑 1,000 題也只多約 US$1.15。若主力改用 `gpt-6.1-sol`（每題約 US$0.02），再加回預留機制。
- 預算不足時只走無模型呼叫的核定 QA 選單／確定性比對，或回覆服務暫停；不能再花費 embedding、分類與生成成本做 fallback。後台顯示當日用量、OpenAI 專案上限狀態與總開關。
- log 避免保存完整文件與秘密；使用者雜湊仍可能可識別，刪帳與保存期限要涵蓋相關紀錄。正式文件及對話送出前確認 OpenAI API 的資料控制設定；呼叫 Responses API 一律設 `store: false`。
- Phase 2 對外提供 App 對話前，須更新隱私權政策與商店隱私標示，並評估 MAS 標章影響；v1 管理員試問與文件匯入也須先確認內容可提供給 API。

## 9. 硬體、雲端資源與費用

### 9.1 起始配置

前提是 Supabase 託管資料庫、OpenAI 託管模型；以下為工程估算，尚未用真實文件或負載驗證，不是自架 Supabase／LLM 的規格。現有電腦的 CPU、RAM 與可用空間尚未確認。

| 用途 | 建議起點 | 何時調整 |
|---|---|---|
| 開發電腦兼偶爾解析 | 4–8 核 CPU、16 GB RAM、額外 20–50 GB SSD 空間 | 同時執行 Docker、IDE、瀏覽器與解析時，32 GB RAM 較有餘裕；先利用現有電腦試跑 |
| 自動化解析 worker（需要上傳後自動處理時） | Cloud Run Jobs 候選：2 vCPU、8 GiB RAM、一次處理 1 件 | 限制 Docling threads 與頁面緩衝；複雜文件再比較 4 vCPU／16 GiB |
| Supabase 試作 | Free：共享 CPU、最多 0.5 GB RAM | 注意 500 MB DB、1 GB Storage、50 MB 單檔限制與閒置暫停；原檔大小未知，不能保證 Free 足夠 |
| 業主驗收／初期服務 | Pro + Micro：共享 CPU、1 GB RAM | 依 DB CPU、RAM、連線與檢索 p95 判斷是否調為 Small 2 GB |
| GPU | 暫不採購 | 生成及 embedding 都呼叫 API；只有決定自架模型或解析實測顯示必要時才重估 |

原始 PDF、頁面圖片、解析輸出與模型快取通常比向量本體更需要空間。Cloud Run 暫存寫入會消耗 RAM，不套用上表本機 SSD 預算。依據：[Supabase 資源](https://supabase.com/docs/guides/platform/compute-and-disk)、[限制與價格](https://supabase.com/pricing)、[Docling／Cloud Run 查核](reports/rag-v1-infrastructure-research.md)。

### 9.2 模型費用

查核日 2026-10-24，以下均為 USD，採 Standard、未快取價格。每題假設回答輸入 6,000 tokens（提示詞 2,000、證據 3,000、對話 1,000）、計費輸出 800 tokens；另加一次 Luna 改寫／分類，輸入 1,000、計費輸出 100。輸出包含 reasoning；若實際推理更多，成本會增加。

| 回答配置 | 每題約 | 每月 1 萬題 | 每月 9 萬題 |
|---|---:|---:|---:|
| `gpt-6-luna` 回答 + Luna 改寫／分類 | US$0.00115 | US$11.50 | US$103.50 |
| `gpt-6.1-sol` 回答 + Luna 改寫／分類 | US$0.02015 | US$201.50 | US$1,813.50 |

啟用 5.1 的機制後，Luna 配置最壞情況每題約 US$0.004（改寫重查一次加 3 輪工具呼叫，未計 prompt caching）；只有部分題目會觸發，實際平均以評測與上線紀錄為準。

Luna 每百萬 input／output tokens 為 US$0.10／0.50；Sol 為 US$2／10。每題公式為 `(回答輸入 × 回答 input 單價 + 回答輸出 × 回答 output 單價 + 1000 × 0.10 + 100 × 0.50) / 1000000`。[OpenAI 價格](https://developers.openai.com/api/docs/pricing)

「每月 9 萬題」沿用 1,000 位活躍使用者、每人每天 3 題的示例，並非實際需求或通過壓測的容量。表內未含查詢 embedding、OCR、重試、多輪工具、評測、Supabase、worker、超額儲存、傳輸及稅；不能把平均每題成本當成單題最大費用。

初次 embedding 若實際輸入 70 萬–100 萬 tokens，small 約 US$0.014–0.020，large 約 US$0.091–0.130。實際 tokens 須依新 tokenizer 納入標頭、overlap 與表格展開後重算。查詢 embedding 以每月 9 萬題、每題約 50 tokens 計約 450 萬 tokens：large 約 US$0.59／月，small 約 US$0.09／月。[small 單價](https://developers.openai.com/api/docs/models/text-embedding-3-small)、[large 單價](https://developers.openai.com/api/docs/models/text-embedding-3-large)

OCR 費用依實際頁面／影像輸入與輸出量試跑；不再沿用原 Gemini「100 頁不到 US$1」的估算。

### 9.3 基礎設施費用與容量

- Supabase Pro 組織費 US$25／月起，含 US$10 compute credit：單一 Micro 約 US$25／月總額；Small 約 US$30／月。既有 Pro 組織若已用掉 credit，再加一個 Micro 測試 project 通常增加約 US$10／月。額外用量與稅另計。[Supabase 價格](https://supabase.com/pricing)
- Cloud Run Jobs 以 Tier 1 未折扣單價計，2 vCPU／8 GiB 約 US$0.1872／執行小時，4 vCPU／16 GiB 約 US$0.3744。假設前者累計執行 10 小時約 US$1.87；這不是對 1,120 頁處理時間的預測。每次執行最低計費、免費額度、地區與附加服務另依平台規則，建置、映像與傳輸另計。[單價與計算依據](reports/rag-v1-infrastructure-research.md)
- `vector` 儲存公式為 `4 × 維度 + 8` bytes。3,000 段 × 1,536 維約 18.46 MB／17.60 MiB，僅是向量本體，不含資料列、原文、索引、歷史版本、log、WAL、備份或 Storage。保留多個 profile／release 及持續寫入互動紀錄會增加容量。[pgvector 格式](https://github.com/pgvector/pgvector#vector-type)
- 月預算須分列模型、DB、測試 project、worker 與額外用量；先依實測題量及 token 分布確認，不先購買 GPU 或高階常駐 VM。

## 10. 實作順序與驗收

調整（10-25）：先用 2–3 天驗證真實資料，再開始蓋後台與版本機制。最大風險是中文 PDF 解析、檢索召回與引用正確性；資料不合格的話，後面的工作都要重做。

**Step 0 真實資料驗證**：只寫腳本，不做後台、不做版本機制。挑 5 份代表文件（文字 PDF、雙欄論文、複雜表格、掃描頁、最長文件），跑 Docling 解析 → 分段 → embedding（large 與 small 各一份 profile）→ 精確向量與 PGroonga 混合檢索 → `gpt-6-luna` 回答 20 題，人工評分。記錄解析峰值 RAM、每頁時間、Recall@5、引用支撐、端到端延遲與實際費用。結果不合格就先調整解析與分段，不往下做。這些腳本之後沿用為匯入 CLI 與評測執行器。

| 里程碑 | 內容 | 驗收 | 粗估 |
|---|---|---|---|
| Step 0 真實資料驗證 | 如上 | 20 題人工評分與量測完成，決定 embedding profile 與是否繼續 | 2–3 工作天 |
| M1 資料層與匯入 | migrations、GRANT／RLS、私有 Storage；CLI 批次解析（沿用 Step 0 腳本）；Supabase automatic embeddings；居家節電、飲食惜食、日常交通的試點文件；段落預覽 API | 重跑不重複寫入；權限測試通過；後台修改段落會自動重算向量 | 3–4 工作天 |
| M2 檢索與評測 | profile 比較、精確／混合檢索 RPC、版本化評測（沿用 Step 0 執行器）與門檻校準 | Recall@5、MRR@10、篩選後召回與 1／5／10 並行延遲可重測；保留驗收題 | 2–3 工作天 |
| M3a 回答與版本（後端） | 回答 Edge Function（`store: false`、structured output、引用檢查）、QA 優先、兩項計算工具、5.1 的改寫重查與工具上限（預設關閉）、release 快照與發布／回滾、互動紀錄、每人每日計數與總開關 | 評測達標；同一請求版本一致；回滾後引用及計算一致；5.1 開關前後的評測比較完成 | 4–6 工作天 |
| M3b 後台（React） | 在推播管理台內改寫 7 個畫面：文件與段落預覽、QA、人格與提示詞、試問、知識版本、互動紀錄、RAG 設定；評測顯示 CLI 報表結果 | 畫面有 loading、錯誤、空資料與權限狀態；元件測試與瀏覽器驗證通過 | 5–7 工作天 |
| M4 收尾 | 惡意指令與權限測試、計數與上限測試、監控、文件更新 | 必要測試通過；未驗證項目明列；文件與實際行為一致 | 2–3 工作天 |

合計約 18–26 個工作天，比原估 13–19 天多，主要是補上原本沒有算進去的後台 React 改寫，以及 5.1 的兩項機制（約 1–2 天）；計算工具收窄、版本改快照、額度簡化與 v1 不上雲共可省約 3–5 天，已反映在上表。以上是熟悉現有系統、文件品質可控時的工程估計，不是交付承諾；另列資料清理、業主審核、模型比較、部署與權限設定的等待時間。App 對話仍屬 Phase 2。

## 11. 後台畫面要配合的調整

以下是依照上面的資料契約，後台必須調整的功能點。這不是視覺上的 UI/UX 審查。

- 「回答風格」不再對應 temperature（見第 2 節）。
- 生成模型、embedding profile、分段器版本只顯示，不在設定頁直接覆寫。換 profile 走「建立新版本 → 重算 → 評測 → 發布」；只換生成模型則重新評測，無須重算未改變的向量。畫面顯示預估時間與費用。
- 相似度門檻與 QA 門檻旁邊顯示校準建議值，以及調整後評測結果的變化。
- 文件列表把處理狀態和內容狀態分成兩欄。
- 試問台顯示正在測的 release／候選 manifest、改寫後問題、向量與關鍵字各自的候選、合併排名、入選與排除原因、引用、耗時與費用；cosine 與 RRF 分數分開標示。啟用 5.1 的機制時，逐輪顯示改寫後的問題、工具呼叫與結果。
- RAG 設定頁顯示當日用量、OpenAI 專案上限狀態與總開關，並提供「檢索不足時改寫重查」與「工具呼叫（每題最多 3 次）」兩個開關，預設關閉，評測通過後才可開啟；文件列表顯示「待處理」與最近一次處理的結果和失敗原因。

## 12. 需要確認的事

已確認：使用者有 OpenAI Platform API key，產品回答採 OpenAI API 方向；向量資料庫保留 Supabase pgvector。2026-10-25 使用者同意合併前檢討的調整：Step 0 真實資料驗證、embedding 預設 large、每人每日計數加專案硬上限、發布快照、後台 React 改寫、計算工具收窄、`store: false`；同日也同意採用 5.1 的兩項有限 agentic 機制。之後授權先實作 React 與 Supabase 基礎，並確認 hxsrineeirmxpoovcrba 可用於 RAG；再指示繼續本機工作，OpenAI API 設定與 embedding 比較先跳過。採購、付費專案與部署尚未授權。

待決定或驗證：

1. 業主是否要求上傳後自動解析。不需要的話 v1 用 CLI 批次；需要的話改用 Cloud Run Jobs，並補上 3.1 的可靠性機制。
2. OpenAI API 專案可用模型、RPM／TPM 額度、資料控制設定、專案硬上限金額與每月模型／基礎設施預算；不需把 key 寫入文件。
3. Step 0 的結果：large／small embedding、Luna 的繁中回答品質、OCR 品質與最終模型參數；Luna 與 Sol 的比較。
4. 現有電腦規格、文件總大小、更新頻率、預期尖峰同時請求數與端到端延遲目標。
5. 「回答風格」提示詞選項，以及 QA 命中時逐字回覆或依人格改寫。
6. 是否開放多位管理員與審核角色，及對應三處帳號限制的變更範圍。
7. 互動紀錄保存期限、全文可見角色、刪除流程與發布評測門檻。
8. 測試用 Supabase project、可用 extension 版本、方案與配額；正式站和 production Supabase 不在本次範圍。

## 參考資料

以下資料查詢日期皆為 2026-10-24。

- [可行性評估與計算](reports/rag-v1-feasibility-review.md)、[基礎設施官方查核](reports/rag-v1-infrastructure-research.md)（記錄本次整合前的評估與原計畫修正原因）
- [OpenAI 模型目錄](https://developers.openai.com/api/docs/models)、[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)、[價格](https://developers.openai.com/api/docs/pricing)
- [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)、[small](https://developers.openai.com/api/docs/models/text-embedding-3-small)、[large](https://developers.openai.com/api/docs/models/text-embedding-3-large)
- [OpenAI 認證與計費方式](https://learn.chatgpt.com/docs/auth)、[API 資料控制](https://developers.openai.com/api/docs/guides/your-data)
- [pgvector](https://github.com/pgvector/pgvector)（維度上限、HNSW、iterative scan）
- [Supabase PGroonga](https://supabase.com/docs/guides/database/extensions/pgroonga)、[Edge Functions 限制](https://supabase.com/docs/guides/functions/limits)、[Hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)
- [Supabase automatic embeddings](https://supabase.com/docs/guides/ai/automatic-embeddings)、[OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits.md)、[MIRACL 分數整理](https://www.pinecone.io/learn/openai-embeddings-v3/)
- [Supabase Queues](https://supabase.com/docs/guides/queues/pgmq)、[Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)、[價格](https://supabase.com/pricing)
- [Docling](https://github.com/docling-project/docling)、[資源控制](https://github.com/docling-project/docling/blob/main/docs/usage/advanced_options.md#limit-resource-usage)
- [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity)、[WIF](https://docs.cloud.google.com/iam/docs/workload-identity-federation)、[容器檔案系統](https://docs.cloud.google.com/run/docs/container-contract#file_system)、[計費](https://cloud.google.com/run/pricing)
