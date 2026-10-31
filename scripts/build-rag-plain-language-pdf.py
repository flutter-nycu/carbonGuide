"""Build and render the standalone RAG plain-language PDF, without network calls."""
from pathlib import Path
from html import escape
import hashlib
import json
import math

import fitz
from PIL import Image, ImageOps, ImageDraw
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/rag-plain-language-guide.zh-TW.json'
ORIGINAL = ROOT / 'output/pdf/CarbonGuide-RAG-Technical-Reference-zh-TW.pdf'
OUT = ROOT / 'output/pdf/CarbonGuide-RAG-Plain-Language-zh-TW.pdf'
QA = ROOT / 'tmp/pdfs/rag-plain-language'
REPORT = ROOT / 'reports/rag-plain-language/verification.json'
W, H = A4
M = 44
CW = W - M * 2
INK, GREEN, MUTED, PALE, CREAM, GOLD, LINE = [colors.HexColor(s) for s in
    ['#243E3B', '#236B57', '#5F706B', '#EDF4EE', '#FCFAF3', '#E7B35D', '#D6E2D9']]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    sections = json.loads(SOURCE.read_text(encoding='utf-8'))
    original_hash = digest(ORIGINAL)
    font_root = Path('C:/Windows/Fonts')
    for name, file in [('JH', 'msjh.ttc'), ('JHB', 'msjhbd.ttc')]:
        pdfmetrics.registerFont(TTFont(name, str(font_root / file), subfontIndex=0))
    styles = {}
    for name, size, leading, font, color in [
        ('body', 13.2, 23, 'JH', INK), ('lead', 17.5, 29, 'JHB', GREEN),
        ('small', 10, 16, 'JH', MUTED), ('note', 11.5, 19, 'JH', INK),
        ('label', 12.1, 19, 'JHB', GREEN), ('h2', 15.5, 24, 'JHB', GREEN),
        ('title', 27, 38, 'JHB', INK), ('cover', 36, 49, 'JHB', INK),
        ('flow', 12.4, 20, 'JHB', GREEN), ('flowSmall', 10.2, 17, 'JH', MUTED),
    ]:
        styles[name] = ParagraphStyle(name, fontName=font, fontSize=size, leading=leading,
                                      textColor=color, wordWrap='CJK')
    # Check glyph support before layout, including all authored Chinese text.
    authored = ''.join(json.dumps(s, ensure_ascii=False) for s in sections)
    missing = {ch for ch in authored if ord(ch) > 127 and
               ord(ch) not in pdfmetrics.getFont('JH').face.charToGlyph}
    if missing:
        raise ValueError(f'Missing font glyphs: {missing}')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle('AI 教練的小小圖書館 | CarbonGuide RAG 後台白話圖解')
    c.setAuthor('CarbonGuide')
    c.setSubject('用生活例子解釋 RAG 後台；依 2026-10-28 技術文件 1.1 改寫')
    used_heights = []

    def paragraph(text, x, top, width=CW, kind='body', markup=False, draw=True):
        p = Paragraph(text if markup else escape(text).replace('\n', '<br/>'), styles[kind])
        # Reserve one CJK glyph for ReportLab's hanging punctuation behavior.
        _, height = p.wrap(width-14, H)
        if draw:
            p.drawOn(c, x, top-height)
        return height

    def arrow(x1, y1, x2, y2):
        c.setStrokeColor(GREEN)
        c.setLineWidth(1.4)
        c.line(x1, y1, x2, y2)
        a = math.atan2(y2-y1, x2-x1)
        p = c.beginPath()
        p.moveTo(x2, y2)
        p.lineTo(x2-5*math.cos(a-.5), y2-5*math.sin(a-.5))
        p.lineTo(x2-5*math.cos(a+.5), y2-5*math.sin(a+.5))
        p.close()
        c.setFillColor(GREEN)
        c.drawPath(p, fill=1, stroke=0)

    def hero(top):
        # Original vector illustration: book -> search card -> checked response.
        y = top - 154
        c.setFillColor(PALE)
        c.roundRect(M, y, CW, 148, 16, fill=1, stroke=0)
        xs = [M+29, M+211, M+391]
        for i, x in enumerate(xs):
            c.setFillColor(colors.white)
            c.setStrokeColor(GREEN)
            c.setLineWidth(1.6)
            if i == 0:
                for n in range(3):
                    c.setFillColor([colors.white, GOLD, GREEN][n])
                    c.roundRect(x+n*21, y+54, 17, 61+n*5, 3, fill=1, stroke=1)
                c.line(x-3, y+49, x+68, y+49)
            elif i == 1:
                c.roundRect(x, y+54, 61, 67, 5, fill=1, stroke=1)
                for n in range(3):
                    c.line(x+9, y+106-n*12, x+37, y+106-n*12)
                c.setFillColor(CREAM)
                c.circle(x+48, y+69, 15, fill=1, stroke=1)
                c.line(x+59, y+58, x+70, y+47)
            else:
                c.roundRect(x-1, y+58, 64, 63, 9, fill=1, stroke=1)
                c.setLineWidth(3)
                c.line(x+15, y+90, x+26, y+79)
                c.line(x+26, y+79, x+47, y+103)
            paragraph(['指定的書', '找出證據', '檢查回答'][i], x-7, y+37, 100, 'label')
        arrow(M+113, y+88, M+178, y+88)
        arrow(M+295, y+88, M+360, y+88)
        return 173

    for number, section in enumerate(sections, 1):
        c.setFillColor(CREAM)
        c.rect(0, 0, W, H, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont('JHB', 8.5)
        c.drawString(M, H-30, 'CARBONGUIDE / RAG')
        c.setFont('JH', 8.5)
        c.drawRightString(W-M, H-30, '白話圖解  /  2026-10-28')
        c.setStrokeColor(LINE)
        c.line(M, H-40, W-M, H-40)
        c.bookmarkPage(f'page-{number}')
        c.addOutlineEntry(section['title'].replace('\n', ''), f'page-{number}', 0)
        y = H - 63
        y -= paragraph(section['title'], M, y, kind='cover' if number == 1 else 'title') + 9
        y -= paragraph(section['subtitle'], M, y, kind='small') + 21
        start = y
        for block in section['blocks']:
            kind = block['type']
            if kind == 'hero':
                y -= hero(y)
            elif kind in ('body', 'lead', 'small', 'h2'):
                y -= paragraph(block['text'], M, y, kind=kind) + (10 if kind == 'h2' else 15)
            elif kind == 'note':
                height = paragraph(block['text'], 0, 0, CW-30, 'note', draw=False)+28
                c.setFillColor(PALE)
                c.roundRect(M, y-height, CW, height, 9, fill=1, stroke=0)
                c.setFillColor(GOLD)
                c.roundRect(M, y-height, 4, height, 2, fill=1, stroke=0)
                paragraph(block['text'], M+15, y-13, CW-30, 'note')
                y -= height+14
            elif kind == 'flow':
                gap = 23
                width = (CW-gap*2)/3
                height = 82
                for i, (title, text) in enumerate(block['steps']):
                    x = M+i*(width+gap)
                    c.setFillColor(PALE)
                    c.roundRect(x, y-height, width, height, 8, fill=1, stroke=0)
                    paragraph(title, x+10, y-13, width-20, 'flow')
                    paragraph(text, x+10, y-40, width-20, 'flowSmall')
                    if i < 2:
                        arrow(x+width+4, y-41, x+width+gap-4, y-41)
                y -= height+20
            elif kind in ('cards', 'steps'):
                for i, (title, text) in enumerate(block['items'], 1):
                    inset = 34 if kind == 'steps' else 14
                    width = CW-inset-14
                    title_h = paragraph(title, 0, 0, width, 'label', draw=False)
                    body_h = paragraph(text, 0, 0, width, 'body', draw=False)
                    height = title_h+body_h+24
                    c.setFillColor(colors.white)
                    c.setStrokeColor(LINE)
                    c.setLineWidth(.6)
                    c.roundRect(M, y-height, CW, height, 8, fill=1, stroke=1)
                    if kind == 'steps':
                        c.setFillColor(GREEN)
                        c.circle(M+17, y-22, 10, fill=1, stroke=0)
                        c.setFillColor(colors.white)
                        c.setFont('JHB', 10)
                        c.drawCentredString(M+17, y-25, str(i))
                    paragraph(title, M+inset, y-10, width, 'label')
                    paragraph(text, M+inset, y-14-title_h, width, 'body')
                    y -= height+10
                y -= 5
            elif kind == 'rows':
                left_width = 140
                right_width = CW-left_width-25
                for i, (label, text) in enumerate(block['items']):
                    lh = paragraph(label, 0, 0, left_width-18, 'label', draw=False)
                    rh = paragraph(text, 0, 0, right_width, 'note', draw=False)
                    height = max(lh, rh)+20
                    c.setFillColor(PALE if i % 2 == 0 else colors.white)
                    c.roundRect(M, y-height, CW, height, 5, fill=1, stroke=0)
                    paragraph(label, M+10, y-10, left_width-18, 'label')
                    paragraph(text, M+left_width+10, y-10, right_width, 'note')
                    y -= height+3
                y -= 13
            elif kind == 'link':
                markup = f'<link href="{escape(block["url"], quote=True)}" color="#236B57">{escape(block["text"])}</link>'
                y -= paragraph(markup, M, y, kind='small', markup=True)+7
            else:
                raise ValueError(f'Unknown block: {kind}')
        if y < 65:
            raise ValueError(f'Page {number} overflow: content bottom {y:.1f}, minimum 65')
        used_heights.append({'page':number, 'content_bottom':round(y, 2), 'used_height':round(start-y, 2)})
        c.setStrokeColor(LINE)
        c.line(M, 52, W-M, 52)
        c.setFillColor(MUTED)
        c.setFont('JH', 8)
        refs = '、'.join(map(str, section['source_pages']))
        c.drawString(M, 34, f'原文件第 {refs} 頁  |  本頁為白話改寫')
        c.setFont('JHB', 9)
        c.drawRightString(W-M, 33, f'{number:02d} / {len(sections):02d}')
        c.showPage()
    c.save()
    assert digest(ORIGINAL) == original_hash, 'Original PDF changed'

    doc = fitz.open(OUT)
    assert len(doc) == len(sections)
    assert len(doc.get_toc()) == len(sections)
    text = ''.join(page.get_text() for page in doc)
    assert '\ufffd' not in text
    for required in ['公開回答服務關閉', '36／40', 'US$5', '30 天', '還沒部署', '未知']:
        assert required in text, f'Missing expected boundary: {required}'
    bounds_errors = []
    embedded = set()
    for number, page in enumerate(doc, 1):
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    x0, y0, x1, y1 = span['bbox']
                    if x0 < M-1 or x1 > W-M+1 or y0 < 15 or y1 > H-15:
                        bounds_errors.append({'page':number, 'text':span['text'], 'bbox':span['bbox']})
        for font in page.get_fonts():
            if 'JhengHei' in font[3]:
                assert doc.extract_font(font[0])[3], 'CJK font not embedded'
                embedded.add(font[3])
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(QA / f'page-{number:02d}.png')
    assert embedded
    assert not bounds_errors, bounds_errors
    contacts = []
    for start in range(1, len(doc)+1, 4):
        sheet = Image.new('RGB', (960, 1390), '#DDE5DF')
        draw = ImageDraw.Draw(sheet)
        for slot, number in enumerate(range(start, min(start+4, len(doc)+1))):
            img = Image.open(QA / f'page-{number:02d}.png')
            img = ImageOps.contain(img, (458, 650))
            x, y = 11+(slot % 2)*480, 30+(slot//2)*690
            sheet.paste(img, (x, y))
            draw.text((x, y-18), f'PAGE {number:02d}', fill='#243E3B')
        path = QA / f'contact-{start:02d}.png'
        sheet.save(path)
        contacts.append(str(path.relative_to(ROOT)))
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    result = {'output':str(OUT.relative_to(ROOT)), 'pages':len(doc), 'bookmarks':len(doc.get_toc()),
              'links':sum(len(p.get_links()) for p in doc), 'sha256':digest(OUT),
              'source_pdf_sha256':original_hash, 'original_preserved':True,
              'source_json_sha256':digest(SOURCE), 'embedded_cjk_font_subsets':sorted(embedded),
              'text_bounds_errors':bounds_errors, 'missing_glyphs':[], 'layout':used_heights,
              'renderer':'PyMuPDF 1.5x (Poppler unavailable)', 'contact_sheets':contacts,
              'visual_review':'pending human/agent inspection', 'live_system_verified':False}
    REPORT.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'output':str(OUT), 'pages':len(doc), 'report':str(REPORT)}, ensure_ascii=False))


if __name__ == '__main__':
    build()
