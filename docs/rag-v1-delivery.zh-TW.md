# RAG v1 人工審閱交接

更新：2026-10-27。只公開去識別工程結果；原始文件、模型回應、帳號截圖與詳細回條保存在私有資料庫或本機忽略目錄。

**狀態：candidate_only。** 非 Flutter 管理功能、全量 PDF 候選處理及固定題庫評測已完成。獨立驗收 **36/40**，仍有品質限制；真實內容尚未核准，公開回答關閉，Flutter 尚未接入。

## 入口與版本

- [受保護管理介面](https://carbon-guide-git-preview-rag-admin-f1f550-fluttermans-projects.vercel.app/push-admin#rag)：Vercel 與 CarbonGuide 管理員登入各自生效。
- [操作、模型方法與費用說明](rag-pilot-user-guide.zh-TW.md)。
- [部署與停止方式](rag-preview-deployment.md)。
- [網站分支](https://github.com/flutter-nycu/carbonGuide/tree/preview/rag-admin-20261024)：React 管理介面、瀏覽器驗證與文件。
- [後端分支](https://github.com/githyoung/carbon-navigation/tree/preview/rag-v1-review-20261027)：資料結構、RPC、Edge Function、解析 CLI 與測試。

網站功能版本 `548e23d` 的 Vercel Preview 已 Ready，後續提交更新文件；後端功能及解析修訂為 `c1b487a`、`b14cb09`，全量檢索修正為 `faa7cb0`，驗收後引用窗口修正為 `65e2f43`。`rag-v1` v4 已部署為 ACTIVE，JWT 驗證開啟。兩個 repo 均只更新 Preview 分支。部署程式不等於核准知識或開放一般使用者。

## 已實作的管理流程

| 範圍 | 實際能力 |
|---|---|
| 來源與匯入 | 私有上傳、下載 hash 核對、列管 URL 快照、本機有界解析與 OCR、不可變重處理、候選修訂、品質隔離警示 |
| 知識設定 | 有來源的 QA、人格、提示詞、檢索設定、係數及電價草稿；快照固定所有依賴 |
| 問答 | 限定輪次及版本、QA 完全命中、Gemini 768 維混合檢索、逐句原文窗口引用、數值與單位檢查、保守拒答 |
| 計算 | 固定係數乘活動量、完整一／兩月住宅流動電費級距差額；不含完整帳單、水費或車型油耗 |
| 評測與版本 | development／acceptance 題庫、固定 hash 報告、機械指標、owner 人工審核、發布條件及回滾 |
| 費用與營運 | 每題節點、時間、tokens、預留、未知結果、準備／試問／評測分類、有限預算、停止、留存及帳單 CSV 對帳 |

解析與文件 embedding 由維護者明確執行 CLI。上傳檔案不會自動啟動雲端 worker；這是本輪採用的執行方式。

## 語料與品質

本機 45 份原始檔（40 PDF、4 DOCX、1 JSON）及成功取得的 8 份網址快照（7 PDF、1 HTML），共 **53 份**存入私有 Storage，下載 SHA-256 全數核對。單檔限制維持 **20 MiB**，最大原檔約 15.75 MiB。JSON 的 1,164 筆係數仍是待審原始資料。

最終候選含 **47 份 PDF、1,834 個物理頁、9,271 個 ready 段落**。逐份核對來源／artifact hash、完整且不重複的頁碼集合及快照選入集合。另有 **193 個原始段落**含未解碼字元等問題，整段隔離，保留原始解析內容。四份 DOCX 與 HTML 導覽頁已解析保存，但未選入問答快照；原始 JSON 未當成核定係數。

- 候選名稱：**待人工審閱：47 PDF 全量候選 v4**。
- Snapshot：`58576480-56f0-4bbe-9d6a-8c385e259969`。
- Manifest SHA-256：`5b7ebe474d22c8def117eb055e499844b8164a8044b621ce34bb46259929d8c9`。
- Profile：`gemini-embedding-001-768-context-views-v4`；改寫關閉，限定確定性工具開啟。
- 53 份來源已分類；人工核准數 0，啟用版本為空。

仍須人工核對缺字、負號、上下標、OCR、分頁表格、圖示及跨頁脈絡。完整物理頁覆蓋不等於語意擷取正確。一份論文的檔名與內文標題不一致，需確認書目與研究範圍。四份 DOCX 及 HTML 的目錄／連結不代表已取得連結全文。三個官方 URL 明確重試後仍為 TLS 憑證驗證失敗，保留紀錄，不關閉驗證。歷史電價僅限指定 2025 年 10–12 月測試範圍，不宣稱現在適用或可計完整帳單。

## 固定題庫結果

兩組題庫在付費執行前已固定，未為符合模型結果修改 gold、門檻或重跑失敗題。受信任本機 worker 執行同一份後端 TypeScript 邏輯，連接真實 Supabase 與 Gemini；這不是 mock，也不等於新版登入後的瀏覽器 HTTP 全流程驗收。

| 題庫 | 通過 | Recall@5 | 引用有效率 | 確定性計算數值失敗 | 未發布資料洩漏 |
|---|---:|---:|---:|---:|---:|
| Development | 19/20 | 0.875 | 1.0 | 0 | 0 |
| Acceptance | 36/40 | 0.9375 | 1.0 | 0 | 0 |

引用有效率描述已接受回答的機械檢查，不代表全部題目答對。數值失敗欄是確定性計算指標；以下生成回答遭數值檢查拒絕，仍計為失敗。

| 案例 | 保留的失敗與處理 |
|---|---|
| development-01 | 全量檢索超過資料庫 8 秒限制，問題向量已完成。SQL 效能已修正；原失敗保留，不重試、不退額度 |
| acceptance-11 | 回答引用通過檢查，但預期 gold 未進 top 5，也未被引用 |
| acceptance-12 | 英文數量用語改寫成中文，未符合逐字數量／單位契約，拒答 `unsupported_number_or_unit` |
| acceptance-13 | `40 years` 改成 `40 年`，現行逐字單位檢查拒答；不為提高分數加入特例 |
| acceptance-14 | 程式將跨窗口的 PDF 行號去空白後接成數字，造成 `invalid_citation` 誤拒；驗收後修正，原結果不覆寫 |

Development 報告：`395142e4-81fe-45d2-b2f2-0ff764669ade`；Acceptance 報告：`e990391d-6b35-43a0-9dc1-a9c37adb40d7`。兩者均綁定上述 snapshot hash。修正後仍不能把本次報告寫成 37/40 或全部通過；後續完整品質驗收需另行固定新的獨立題庫。

引用修正針對伺服器窗口的原始 start/end、逐字 slice 與數量邊界檢查；任意引文保留原防截數字規則。以合成資料驗證行號分隔、偽造 offset／來源／文字、十進位、指數、貨幣及複合單位截斷；未付費重跑保留題庫。

## 工程驗證

| 層級 | 證據 | 界線 |
|---|---|---|
| 前端 | 17 個檔案、92 tests PASS；型別及帶完整公開設定的 build PASS | 非真實登入後驗收 |
| 後端 | Node 共用邏輯 37 tests PASS；Python 100 tests PASS | Node 測試非 Deno runtime 實測 |
| 資料庫 | 測試專案 rollback fixtures 驗證權限、預算、快照、評測、URL、重處理、排序與留存 | 合成核准／發布回滾，未核准真實內容 |
| 瀏覽器 | 1440、1024、768、390、375 寬度情境通過，含流程、品質警示、草稿及登出 | mock 後端；Safari、真機未測 |
| 真實雲端 | Preview Ready、Edge 部署；未登入 Preview／Edge／私有表皆 401；2026-10-27 已確認 owner 登入及真實資料讀取，並完成使用者手動送出的單題端到端測試；回應、引用、流程與費用帳均可從歷史紀錄開啟 | 單題連線驗證通過；不取代 36/40 的獨立驗收或人工語意審核 |
| 邊界檢查 | npm audit 零漏洞；來源及實際 build 秘密掃描零命中；14 個 build artifacts 通過發布檢查 | 非整個既有 App／推播系統稽核 |

全量檢索只縮小排序前資料投影，先選候選再取完整文字，RRF 維持 `k=50`。20 筆完整結果 JSON 與參考查詢相同；read-only 查詢約 11.154 → 5.677 秒，真實 RPC fixture 約 13.649 → 6.255 秒，排序與權限回歸通過，未增加 8 秒上限。這是單次測量，尚未做併發負載驗收。

DDL 後 security advisors：三項 RLS 無 policy 為刻意封閉的私有控制表；六個既有 authenticated SECURITY DEFINER 入口及密碼外洩保護未啟用仍列為既有專案檢查項目，沒有擴大 RAG 權限。[函式檢查說明](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)、[密碼保護說明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。

本機私有證據在 `reports/rag-v1-delivery/`：`final-corpus-evidence.json`、`retrieval-fix-verification.json`、`frontend-final-tests.log`、`backend-final-tests.log`、`citation-boundary-tests.log`、`browser/results.json`、`authenticated-browser-followup.json`、`live-browser-smoke.json`、`negative-http.json`、`secret-scan.json`、`final-security-advisors.json`、匯入／向量／快照／評測回條。該目錄刻意不推公開 Git。

### 2026-10-27 真實瀏覽器單題驗證

使用者於 07:49（臺灣時間）在受保護 Preview 手動送出 IPCC 需求面減量問題。請求 `76c16511-87e1-4b5c-8e1d-e459bdd47db9` 完成為 `answered / validated`，伺服器執行約 **11.5 秒**。已從歷史紀錄重開結果，展開原文引用、選取流程節點及展開模型費用帳；這些讀取沒有新增模型呼叫。

流程共 **8 個節點**：版本與權限 → 通用 QA（無精確命中，略過）→ 問句向量化 → 混合檢索 → 問句改寫（已有證據，略過）→ 引用內容選擇 → 模型回答 → 引用與數值驗證。混合檢索約 6.601 秒；選入 6 段內容，最後回答附 8 段原文引用。機械驗證通過，回答語意仍待人審。

資料庫確認本輪只有 **1 筆問題、2 次模型呼叫**，均收到 HTTP 200，沒有重送。本題保守預留 **US$0.0130565**；回答生成使用 3,143 input／380 output tokens，用量估算 **US$0.00135575**。問題 embedding 沒有可用 token usage，因此整題用量估算與 Google 實際帳單仍為未知。此單題不修改既有 36/40 驗收報告。

## 費用與人工試問

2026-10-27 07:49 單題完成後核對，同一 **US$5** campaign 共 **571** 個模型呼叫紀錄，保守預留 **US$3.65777525**，尚餘 **US$1.34222475**。其中文件 embedding 427、問題 embedding 89、回答 55；3 個結果不確定，保留預留，不自動重送。04:48 的全量評測回條保留當時的 569 次／US$3.64471875，不覆寫歷史紀錄。

只有 52 個呼叫有可用 provider token usage，按本次價格版本可算小計 **US$0.05647875**；另 519 個缺可用 usage，包含全部 embedding 及部分不確定結果。**這個小計不是整輪總成本，預留也不是 Google 扣款。** 帳單尚未匯入。舊 pilot 的兩次試問、US$0.06 預留另存，沒有重設。

已建立 owner 輪次 **「人工審閱：全量 PDF 候選（5 題）」**，固定上述 snapshot：最多 5 題、US$0.15，仍計入同一 US$5 campaign；截止 **2026-11-02 18:35（臺灣時間）**。建立輪次沒有模型呼叫。輪次 ID：`a2cc1c3f-ac22-413a-a2a1-f00eaf91fae2`。

上述單題已使用 **1/5 題**，還可送出 **4 題**；輪次預留 US$0.0130565／US$0.15。這是現況，與建立輪次時的零用量回條分開保存。

1. 登入後，在「文件與段落」查看品質隔離、原文、頁碼及範圍。
2. 到「知識版本」確認 **47 PDF 全量候選 v4** 與上述 hash，閱讀兩份評測及失敗案例。
3. 到「試問」選 **人工審閱：全量 PDF 候選（5 題）**。送出一次問題後查看原文引用及各流程節點；未知結果不要重送。
4. 到「RAG 設定」核對預留、可計算小計、帳單未知。若不再試問，可停止輪次。
5. 核對 QA、人格、提示詞、係數／電價及回答語意後，決定駁回或核准指定 hash。來源修正須建新候選，不改舊快照。

## 尚未完成

- 人工內容核准、缺字／OCR／標題修正及三個 TLS 失敗來源：保持待審／失敗狀態。
- 真實知識發布／回滾及公開服務啟用：本輪僅驗證 rollback fixtures，未對真實內容操作。
- Google 帳單對帳、Safari／真機、併發負載：缺少帳單或尚未安排測試。
- Flutter、一般使用者對話及相關隱私／刪除帳號政策：依要求留到最後獨立接入。

目前適合**受限額度的 owner 線上人工審閱**，不代表一般使用者上線驗收通過。
