# RAG 技術文件 PDF：任務收尾單

**Task:** 提供目前 RAG 實作的繁體中文技術文件 PDF，供技術交接、維運與人工審閱。

**Status:** `complete`。

**Mode:** `real`，已產生並逐頁渲染檢查 PDF；不涉及模型或資料庫執行。

**Changed files:**

- [PDF](../output/pdf/CarbonGuide-RAG-Technical-Reference-zh-TW.pdf)：15 頁 A4，15 個章節書籤，8 個可點選來源連結，嵌入中文字型。
- [內容來源](rag-technical-reference.zh-TW.json)：固定 2026-10-27 版本的架構、管線、模型、API、安全、成本、評測、維運與後續工作。
- [重建工具](../scripts/build-rag-technical-pdf.py)：使用 ReportLab 產生 PDF；超過單頁版面時直接拒絕產出。
- [README](../README.md)：增加文件入口與重建說明；本收尾單記錄交付證據。

**Evidence:** [本機驗證報告](../reports/rag-technical-pdf/verification.json)；[頁面 1-5](../reports/rag-technical-pdf/contact-01.png)、[頁面 6-10](../reports/rag-technical-pdf/contact-06.png)、[頁面 11-15](../reports/rag-technical-pdf/contact-11.png)。這些檢查圖留在忽略的 reports 目錄。

**Verification:**

- `python scripts/build-rag-technical-pdf.py` 成功，PDF 497,267 bytes。
- PyMuPDF 渲染 15 頁；檢查全頁縮圖並放大架構／流程圖，修正圖框標題與文字間距，確認沒有裁切或重疊。主機未提供 Poppler，使用已安裝的 PyMuPDF 渲染。
- pypdf 確認 15 頁、15 個書籤與內嵌 TrueType 字型／ToUnicode；8 個 HTTPS 連結均存在。
- 13,284 個字元可擷取；字型缺字 0、replacement glyph 0、頁面外文字 0，頁尾編號完整。
- PDF 擷取文字未命中 Google key、Supabase secret 或 JWT 格式；來源不含原文全文、私人截圖或實際密鑰。
- SHA-256：`8c81f712900b7136adb49485acea8ad90ab582b07edeea2573d5bc2cf2b8a3b2`。

**Not run:** 沒有重跑應用程式測試、模型評測、資料庫 migrations 或付費試問；本次只產生技術文件。PDF 所列 104 項測試及 36/40 驗收屬已記錄的既有證據，沒有冒充本次重新執行。

**Risk:** 文件是時間點快照，配額與線上狀態可能後續改變。36/40 不代表全面通過，人工內容核准與公開服務仍未完成。重建工具使用 Windows 字型路徑；其他系統需指定等效且允許嵌入的中文字型。

**Next:** 以此 PDF 進行交接與人工審閱；系統契約或評測更新時，同步更新 JSON 來源、版本基準與 PDF，保留舊驗收語意。
