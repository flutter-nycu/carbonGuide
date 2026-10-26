# 設計

沿用 CarbonGuide 工作台：墨綠 #173d3d、次要文字 #597570、青綠 #116b68、底色 #f7fcfb、失敗 #982f28。介面沿用系統中文字型，數字及識別碼使用 Consolas/monospace。以真正的 ordinal 作為序號；節點之間的連線代表記錄順序，不宣稱資料依賴。選中節點在下方顯示詳情，手機改為同一組按鈕的垂直時間軸。

列表每頁最多 25 筆，使用 started_at + id 游標；進入詳情才請求 spans 與 charges，避免逐列請求。owner 才掛載查詢元件；取消、換 repo、卸載時 abort 並忽略晚到回應。已讀頁只存在元件記憶體，不寫入 localStorage。

RPC 回傳在邊界驗證 enum、非負數、UUID、陣列上限及 trace/span/charge 關聯。未授權、過期、已清除的 detail RPC 均可能回傳 null，介面使用合併說明。費用只讀 server ledger；reserved 是請求前預留、estimated 是依用量估算、billed 是帳單，三者不互相替代。

本批資料只有測試題識別碼，無題目或回答正文。不得臆造問句。歷史文件／問題向量與檢索標成重用，不補造計時或費用。總耗時註明僅生成及本機檢查範圍，並顯示舊版推定範圍及保留期限。

瀏覽器測試重播伺服器匯出的真實追蹤 metadata，使用假的 Supabase transport/auth；明確區分真實資料與 mock 登入驗證。
