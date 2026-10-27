"""Validate and render both authored manuals; never print secret matches or PDF text."""
from pathlib import Path
import hashlib, json, re
import fitz
from pypdf import PdfReader
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/rag-guidance/pdf'
RENDER=ROOT/'tmp/pdfs/rag-guidance'
OUT.mkdir(parents=True,exist_ok=True); RENDER.mkdir(parents=True,exist_ok=True)
secrets=[]
for name in ['.env.local','.env.development.local']:
    path=ROOT/name
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            m=re.match(r'([A-Z_][A-Z0-9_]*)=(.*)',line)
            if m and not m[1].startswith('VITE_'):
                value=m[2].strip().strip('\'"')
                if len(value)>=20: secrets.append(value)
report=[]
for name,source in [('Technical-Reference','rag-technical-reference'),('Admin-Guide','rag-admin-guide')]:
    path=ROOT/f'output/pdf/CarbonGuide-RAG-{name}-zh-TW.pdf'
    expected=json.loads((ROOT/f'docs/{source}.zh-TW.json').read_text(encoding='utf-8'))
    reader=PdfReader(path); doc=fitz.open(path); text='\n'.join(p.get_text() for p in doc)
    assert len(doc)==len(expected), 'Page count mismatch'
    assert len(reader.outline)==len(expected), 'Bookmark mismatch'
    assert '\ufffd' not in text and '\x00' not in text, 'Invalid extracted glyph'
    assert not any(s in text for s in secrets), 'Local secret detected'
    assert not re.search(r'AIza[\w-]{30,}|sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY',text), 'Credential pattern detected'
    font_names=set(); violations=[]; links=0; images=[]
    for i,p in enumerate(doc):
        title=expected[i]['title'].replace('\n','').replace(' ','')
        assert title in p.get_text().replace('\n','').replace(' ',''), f'Title missing on page {i+1}'
        for b in p.get_text('blocks'):
            if b[0]<30 or b[2]>p.rect.width-30 or b[1]<15 or b[3]>p.rect.height-12:violations.append(i+1)
        links+=len(p.get_links())
        for f in reader.pages[i]['/Resources']['/Font'].values():
            f=f.get_object(); desc=f.get('/FontDescriptor')
            if desc:
                desc=desc.get_object(); assert any(k in desc for k in ['/FontFile','/FontFile2','/FontFile3'])
                font_names.add(str(f['/BaseFont']))
        pix=p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False)
        image_path=RENDER/f'{source}-{i+1:02d}.png';pix.save(image_path);images.append(image_path)
    assert not violations, f'Out-of-bounds text pages {violations}'
    for start in range(0,len(images),4):
        sheet=Image.new('RGB',(1220,1780),'#dce5e3'); draw=ImageDraw.Draw(sheet)
        for j,im_path in enumerate(images[start:start+4]):
            im=Image.open(im_path);im.thumbnail((590,835))
            x=10+(j%2)*610;y=25+(j//2)*890
            draw.text((x,y-18),f'{name} / {start+j+1:02d}',fill='#163e44')
            sheet.paste(im,(x,y))
        sheet.save(OUT/f'{source}-contact-{start+1:02d}.png')
    report.append({'file':str(path.relative_to(ROOT)),'pages':len(doc),'bookmarks':len(reader.outline),'links':links,'embedded_fonts':sorted(font_names),'bounds':'passed','secret_scan':'passed','sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
