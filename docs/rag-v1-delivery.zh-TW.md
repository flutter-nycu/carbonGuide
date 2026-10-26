# RAG v1 人工審閱交接

更新：2026-10-27。此頁只公開去識別的工程結果；原始文件、模型回應、帳號截圖與詳細執行回條留在私有資料庫或本機忽略目錄。

**狀態：candidate_only。** 管理功能已實作並部署至測試 Preview；語料處理與最後固定題庫驗收仍在執行。真實內容尚未核准，公開回答關閉，Flutter 尚未接入。

## 入口與程式版本

- [受保護管理介面](https://carbon-guide-git-preview-rag-admin-f1f550-fluttermans-projects.vercel.app/push-admin#rag)：Vercel 與 CarbonGuide 管理員登入各自生效。
- [操作、模型方法與費用說明](rag-pilot-user-guide.zh-TW.md)。
- [部署與停止方式](rag-preview-deployment.md)。
- [網站分支](https://github.com/flutter-nycu/carbonGuide/tree/preview/rag-admin-20261024)：React 管理介面、瀏覽器驗證與文件。
- [後端分支](https://github.com/githyoung/carbon-navigation/tree/preview/rag-v1-review-20261027)：私有資料結構、RPC、Edge Function、解析 CLI 與測試。

網站功能版本 `548e23d` 的 Vercel Preview 已 Ready；後端 `b14cb09` 已推送，`rag-v1` v3 已部署並啟用 JWT 驗證。兩個 repo 均只更新 Preview 分支。部署程式不等於核准知識或開放一般使用者。

## 已實作的管理流程

| 範圍 | 實際能力 |
|---|---|
| 來源與匯入 | 私有上傳、下載 hash 核對、列管 URL 快照、本機有界解析與 OCR、不可變重處理、候選修訂、品質隔離警示 |
| 知識設定 | 有來源的 QA、人格、提示詞、檢索設定、係數及電價草稿；發布快照固定所有依賴 |
| 問答 | 限定輪次與版本、QA 完全命中、Gemini 768 維混合檢索、逐句原文窗口引用、數值與單位檢查、保守拒答 |
| 計算 | 固定係數乘活動量、完整一／兩月住宅流動電費級距差額；不包含完整帳單、水費或車型油耗 |
| 評測與版本 | development／acceptance 題庫、固定 hash 報告、機械指標、owner 人工審核、發布條件及回滾 |
| 費用與營運 | 每題流程節點、時間、tokens、費用預留、未知結果、準備／試問／評測分類、有限預算、停止、留存與真實帳單 CSV 對帳 |

文件解析與 embedding 由維護者明確執行 CLI。上傳檔案不會自動啟動雲端 worker；這是本輪已採用的執行方式。

## 語料與品質

本機 45 份原始檔（40 PDF、4 DOCX、1 JSON）及成功取得的 8 份網址快照（7 PDF、1 HTML），共 53 份均已存入私有 Storage 並核對下載 SHA-256。單檔限制維持 20 MiB。1,164 筆 JSON 係數仍是待審原始資料。

截至本次中間核對，42 份 PDF 候選共 5,893 段已完成向量化；其他長篇 IPCC PDF 仍在解析。177 個含未解碼字元的原始段落已整段隔離；原檔與解析原文保留，管理介面顯示物理頁及段落序號。數字會在最終驗收後更新，不能以此中間數字宣稱全文驗收完成。

以下仍須人工核對：

- 隔離段落的缺字、負號、上下標與數值；不以刪除單一字元或猜測數字代替修復。
- OCR、分頁表格、圖示及跨頁脈絡；完整物理頁覆蓋不等於語意擷取正確。
- 一份論文的檔名與內文標題不一致；以原文確認書目與研究範圍。
- 4 份 DOCX 的連結／目錄內容及 HTML 導覽頁不列作連結全文證據。
- 3 個官方 URL 遇到 TLS 憑證驗證失敗，未關閉驗證取得內容。
- 歷史電價僅作指定 2025 年 10–12 月測試範圍，不宣稱現在適用或可計完整帳單。

## 驗證證據

| 層級 | 已完成的證據 | 界線 |
|---|---|---|
| 前端 | 17 個測試檔、92 tests PASS；型別檢查及帶完整公開設定的 production build PASS | 不等於真實登入後功能驗收 |
| 後端邏輯 | Node 共用邏輯 35 tests PASS；Python 100 tests PASS，含完整表格上限回歸 | Node 測試不是 Deno runtime 實測 |
| 資料庫 | 已授權測試專案的交易 rollback fixtures 驗證權限、預算、快照、評測、URL、重處理與留存 | 合成核准／發布會回滾，不會核准真實內容 |
| 瀏覽器 | 1440、1024、768、390、375 寬度的合成情境通過，含流程、品質警示、草稿與登出 | mock 後端；Safari、真機未測 |
| 真實雲端 | Preview Ready、Edge 已部署；未登入 Preview／Edge／私有表皆回覆 401；先前版本的 owner 登入、讀取與歷史流程已檢查 | 最新分支網址的登入後複核待完成 |
| 邊界檢查 | npm audit 零漏洞；305 份來源／建置輸出秘密掃描零命中；14 個 build artifacts 通過發布邊界檢查 | 不代表整個既有 Supabase App／推播系統完成稽核 |

完整本機證據位於 `reports/rag-v1-delivery/`：`frontend-final-tests.log`、`backend-final-tests.log`、`browser/results.json`、`negative-http.json`、`secret-scan.json`、匯入／embedding 回條及快照／評測回條。該目錄刻意不推送公開 Git。

原始 20 題 development 與 40 題 acceptance 在付費執行前已固定；不修改答案來迎合模型。先前較小語料 v4 開發結果為 18/20、Recall@5 0.875、引用有效率 1、數值失敗 0、洩漏 0。這是歷史開發結果，不能代替全量候選的獨立驗收。

## 費用與人工審閱

同一 US$5 campaign 已預留 US$2.15350525，累計 359 個模型呼叫紀錄（中間核對值）。這是保守費用預留，不是 Google 實際扣款；尚未取得帳單對帳。舊 pilot 的兩次試問與 US$0.06 預留另存，沒有重設。未知結果保留額度，不自動重送。

最後人工審閱依序檢查「文件與段落」→「QA／人格／提示詞／設定」→「知識版本」→「試問與評測報告」。核對引用、適用範圍、數量、計算與缺漏後，才決定是否核准指定 snapshot hash。未通過機械驗收或未人工核准的版本不能發布。

尚未執行的工作：最後全量候選驗收、新版登入後真實瀏覽器複核、人工內容核准、真實知識發布／回滾、Google 帳單匯入、Safari／真機及 Flutter 接入。前兩項由本輪繼續完成；其餘保留給人工審閱或後續另行授權的接入階段。
