#!/usr/bin/env python3
"""把 source/ 組成 public/rag-preview/index.html。

- Logo 內嵌：預設從現有的 index.html 取出 base64，不另外存一份圖檔。
- 依實際 <script> 內容重算 CSP 的 sha256，改了 app.js 一定要重跑這支，否則整段 JS 會被 CSP 擋掉。

用法：
  python3 <這個 change 的目錄>/source/build.py
  （歸檔前在 openspec/changes/rag-coach-phase0-preview/，歸檔後在 openspec/changes/archive/ 底下）
"""
import base64
import hashlib
import pathlib
import re
import sys

src = pathlib.Path(__file__).resolve().parent
# 往上找網站 repo 根目錄（有 package.json 的那層），change 歸檔搬到 openspec/changes/archive/ 之後也能用。
repo = next(p for p in src.parents if (p / "package.json").exists())
out = repo / "public" / "rag-preview" / "index.html"
logo_from = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else out

match = re.search(r'src="data:image/png;base64,([A-Za-z0-9+/=]+)"', logo_from.read_text(encoding="utf-8"))
if not match:
    sys.exit(f"找不到內嵌 Logo：{logo_from}")
script = "\n" + (src / "app.js").read_text(encoding="utf-8")
digest = base64.b64encode(hashlib.sha256(script.encode("utf-8")).digest()).decode()
head = (src / "head.html").read_text(encoding="utf-8").replace("__SCRIPT_HASH__", "sha256-" + digest)
body = (src / "body.html").read_text(encoding="utf-8").replace("__LOGO_B64__", match.group(1))
css = (src / "style.css").read_text(encoding="utf-8")
html = f"{head}<style>\n{css}</style>\n{body}<script>{script}</script>\n</body>\n</html>\n"
out.write_text(html, encoding="utf-8")
print(f"wrote {out.relative_to(repo)} ({len(html.encode())} bytes), script sha256-{digest}")
