# 設計

React 元件取代 runtime HTML 注入，沿用既有後台視覺與登入生命週期。切換推播／RAG 保留記憶體，登出清除。七個畫面依功能拆分，資料經型別化 repository 存取。

使用整個後台既有的 Supabase session。明確設定 VITE_RAG_ENABLED=true 並指定 VITE_RAG_PROJECT_REF；URL 的 ref 必須相符。使用者在本次對話確認 hxsrineeirmxpoovcrba 為本階段目標。不同 project 不共用 token，不另建隱性 client 或 auth flow。

資料庫採 public schema 的計畫表名，避免建立另一套帳號。RLS 查既有 is_push_admin/editor/owner（包含單一 Email 限制）。viewer 可讀一般內容；owner 才可讀互動全文與用量。草稿 QA、人格、提示詞可編輯；release／chunks／profiles 只有讀權。service state 只允許 owner 改草稿設定，服務開關及兩項 agentic 能力保持 false，待後續經評測的 RPC 上線。

跨越的信任邊界是瀏覽器到 Supabase Data API 與 Storage。前端不包含 secret，不使用 raw HTML；表級 GRANT、RLS、約束與觸發器同時限制寫入。此階段不處理文件上傳、URL 抓取、模型呼叫、發布或回滾，因此不提供假成功結果。
