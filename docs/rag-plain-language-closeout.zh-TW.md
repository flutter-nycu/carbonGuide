# RAG 白話圖解任務收尾單

日期：2026-10-28

- **Task:** 根據現有 RAG 技術 PDF 與本機後台規劃，另製一份用生活例子解釋的繁體中文 PDF。
- **Status:** `complete`（文件交付）。
- **Mode:** `real`（已產生實際 PDF，非線上系統驗收）。

## Changed files

- [18 頁白話圖解 PDF](../output/pdf/CarbonGuide-RAG-Plain-Language-zh-TW.pdf)
- [內容來源 JSON](rag-plain-language-guide.zh-TW.json)
- [可重建文件的 Python 工具](../scripts/build-rag-plain-language-pdf.py)
- OpenSpec：[proposal](../openspec/changes/rag-plain-language-guide/proposal.md)、[spec](../openspec/changes/rag-plain-language-guide/specs/rag-plain-language-guide/spec.md)、[tasks](../openspec/changes/rag-plain-language-guide/tasks.md)
- 本收尾紀錄。另產生忽略的本機驗證報告與渲染圖；既有技術 PDF、後台使用指南及應用程式未修改。

## Evidence

- [驗證結果、字型與 SHA-256](../reports/rag-plain-language/verification.json)
- 全頁縮圖：[1-4](../tmp/pdfs/rag-plain-language/contact-01.png)、[5-8](../tmp/pdfs/rag-plain-language/contact-05.png)、[9-12](../tmp/pdfs/rag-plain-language/contact-09.png)、[13-16](../tmp/pdfs/rag-plain-language/contact-13.png)、[17-18](../tmp/pdfs/rag-plain-language/contact-17.png)
- 最終 PDF SHA-256：`20ab5612cbea3afff1106905433c9c4da2d4d2e67c2bbc79ae755916b1e7a7ae`。
- 原技術 PDF SHA-256：`5ca794efbd8345d2efdcbafe47fd729239232e1abce2e272c7bd22d4853d1a7f`；建置前後相同。
- 起始分支 `preview/rag-admin-20261024`，HEAD `c1fe70d`；開始時工作樹乾淨。本次沒有 commit、push 或部署。

## Verification

| 實際執行 | 結果 |
| --- | --- |
| `python scripts/build-rag-plain-language-pdf.py` | 通過；18 頁、18 書籤、2 個外部連結；中文缺字與文字越界皆為 0，中文字型已嵌入 |
| PyMuPDF 1.5 倍渲染與人工逐頁檢視 | 全 18 頁已檢視；密集頁另看大圖；修正換行後重新建置並檢視最終 5 張全頁縮圖 |
| 獨立 `pypdf.PdfReader` 檢查 | 18 頁均可抽取非空文字、18 書籤；Google key、JWT、PEM 私鑰模式掃描無命中 |
| `C:/Users/User/AppData/Roaming/npm/openspec.cmd validate rag-plain-language-guide --strict` | 通過 |
| `git diff --exit-code -- output/pdf/CarbonGuide-RAG-Technical-Reference-zh-TW.pdf output/pdf/CarbonGuide-RAG-Admin-Guide-zh-TW.pdf` | 通過；兩份原 PDF 均未修改 |
| `git cat-file -t` 核對兩個 PDF 內的 GitHub 連結版本與文件 | 兩個目標皆為存在的 Git blob；沒有宣稱實際網路存取成功 |

內容核對保留 ready／人工核准／發布／公開服務的分別；將預留、估算與帳單分開；歷史評測及 US$5 標示為原文件紀錄；Cloud Run Jobs 明示尚未部署。故事例子標為解說用途。

## Not run

- 未執行網站型別、單元、瀏覽器或建置測試：本次僅新增文件與文件工具，未改動網站。
- 未重跑線上登入、模型、付費評測、資料審核或部署：不屬於這次改寫範圍。
- Poppler 不在環境，改用既有 PyMuPDF 渲染，另以 pypdf 獨立驗證結構。
- 未做五歲兒童實際閱讀測試或紙本列印測試；「五歲也懂」採生活比喻、短句與大人共讀方式呈現。

## Risk

文件記錄的是原技術文件 1.1 與本機文件的狀態，並非即時線上查核。比喻不能取代工程契約；完整操作與技術數值需回查原文件。GitHub 連結仍受專案權限限制。重建工具沿用 Windows 微軟正黑體，其他主機需要對應字型與 Python 依賴。

## Next

直接閱讀或分享新版 PDF。若用來向小朋友解說，可先讀第 1-9 頁；最後兩頁名詞與數字供成人查閱。後續系統狀態改變時，同步更新來源 JSON 後重建並重新檢查排版。
