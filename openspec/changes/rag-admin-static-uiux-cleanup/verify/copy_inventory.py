#!/usr/bin/env python3
"""列出 RAG 工作台的中文字串，並比對改寫前後。

用法（在網站 repo 根目錄）：
  python3 <change>/verify/copy_inventory.py <基準 commit>
輸出：基準版的中文字串總數、改寫後仍原封不動留下的字串清單。
"""
import re
import subprocess
import sys

FILES = ["src/push-admin/rag/app.js", "src/push-admin/rag/index.html"]
CJK = re.compile(r"[㐀-鿿！-～「」『』、。，：；？！（）·…—]+[^`'\"<>{}$]*?(?=[`'\"<>{}$]|$)")


def segments(text):
    out = []
    for m in CJK.finditer(text):
        s = m.group(0).strip()
        if re.search(r"[㐀-鿿]", s) and len(s) >= 2:
            out.append(s)
    return out


def load(ref, path):
    if ref == "WORKTREE":
        return open(path, encoding="utf-8").read()
    return subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True, check=True).stdout


base = sys.argv[1] if len(sys.argv) > 1 else "edead04"
before, after = [], []
for f in FILES:
    before += segments(load(base, f))
    after_text = load("WORKTREE", f)
    after.append(after_text)
after_text = "\n".join(after)
unique = list(dict.fromkeys(before))
kept = [s for s in unique if s in after_text]
print(f"基準 {base}：{len(unique)} 段中文字串；目前原封不動保留 {len(kept)} 段")
for s in kept:
    print("保留：" + s)
