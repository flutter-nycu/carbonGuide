# 任務收尾單：非 Flutter RAG v1

日期：2026-10-27。

- **Task:** 完成 React RAG 管理功能、測試 Supabase 後端、私有來源導入、有限額真實評測、文件及受保護 Preview，交由使用者人工審閱。
- **Status:** `candidate_only`。工程交付已備妥；真實內容尚未核准，獨立驗收 36/40。最新 Preview 已確認管理員登入與真實資料讀取，新題送出仍待完成。
- **Mode:** `real`；瀏覽器合成情境另外標為 mock，不混同真實 Gemini／Supabase 評測。
- **Changed files:** 網站 `src/push-admin/rag/`、`src/push-admin/components/RagWorkspace.tsx`、相關測試、建置安全設定、OpenSpec、`rag-v1-implementation-plan.md` 與 `docs/rag-*.md`；後端 `scripts/rag/`、`supabase/functions/rag-v1/`、RAG migrations／SQL tests、OpenSpec 與維護文件。完整差異見[網站分支](https://github.com/flutter-nycu/carbonGuide/tree/preview/rag-admin-20261024)及[後端分支](https://github.com/githyoung/carbon-navigation/tree/preview/rag-v1-review-20261027)。未修改 Flutter 原始碼。
- **Evidence:** [交接與驗收紀錄](rag-v1-delivery.zh-TW.md)、[使用／模型流程說明](rag-pilot-user-guide.zh-TW.md)、[部署說明](rag-preview-deployment.md)、[受保護管理入口](https://carbon-guide-git-preview-rag-admin-f1f550-fluttermans-projects.vercel.app/push-admin#rag)。細部回條及原始模型診斷保存在忽略目錄 `reports/rag-v1-delivery/`，不公開上傳。
- **Verification:** `npm run type-check`、`npm test`（92）、`npm run build` 通過；Python unittest 100、Node tests 37 通過；SQL rollback fixtures、排序等價及完整 47 PDF 檢索期限檢查通過；OpenSpec strict 網站 10／後端 12 通過；npm audit、秘密掃描及 14 個建置產物邊界檢查通過。五種寬度 mock UI 通過。真實固定題庫 development 19/20、acceptance 36/40；失敗與未知均保留。Edge v4 ACTIVE、JWT 開啟，Preview 受保護。
- **Not run:** 最新 Preview 新題 HTTP 送出／回應（自動操作核准審查擋下付費送出，已請使用者手動按一次）、Safari／真機／併發測試、Google 帳單對帳、真實內容核准／發布／回滾、Flutter 與 Production。引用窗口修正只做離線回歸，未付費重跑固定驗收題。
- **Risk:** 193 段隔離、OCR／表格／書目待人工核對、三個 URL TLS 失敗、檢索與逐字單位限制。US$3.64471875 是保守預留，US$0.055123 僅是有 usage 的小計，均非完整 Google 帳單。原驗收分數不能因修正而改寫。
- **Next:** 登入管理入口，選「人工審閱：全量 PDF 候選（5 題）」；最多 5 題、US$0.15，含於原 US$5 campaign，截止 2026-11-02 18:35 臺灣時間。逐份確認來源、版本 hash、引用與計算，再決定駁回或核准。公開回答目前關閉；Flutter 最後獨立接入。
