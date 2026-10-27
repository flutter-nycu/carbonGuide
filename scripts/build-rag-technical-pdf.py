"""Build the versioned Traditional Chinese RAG technical reference (no network)."""
from pathlib import Path
from html import escape
import json
import argparse
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
args = argparse.ArgumentParser(description=__doc__)
args.add_argument('--guide', action='store_true', help='Build the beginner admin guide instead of the technical reference')
options = args.parse_args()
slug = 'rag-admin-guide' if options.guide else 'rag-technical-reference'
TITLE = 'CarbonGuide RAG 後台使用指南' if options.guide else 'CarbonGuide RAG 技術文件'
RUNNING = 'CARBONGUIDE / RAG ADMIN GUIDE' if options.guide else 'CARBONGUIDE / RAG TECHNICAL REFERENCE'
OUT = ROOT / ('output/pdf/CarbonGuide-RAG-Admin-Guide-zh-TW.pdf' if options.guide else 'output/pdf/CarbonGuide-RAG-Technical-Reference-zh-TW.pdf')
SOURCE = ROOT / f'docs/{slug}.zh-TW.json'
FONT_ROOT = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('JH', str(FONT_ROOT / 'msjh.ttc'), subfontIndex=0))
pdfmetrics.registerFont(TTFont('JHB', str(FONT_ROOT / 'msjhbd.ttc'), subfontIndex=0))
pdfmetrics.registerFontFamily('JH', normal='JH', bold='JHB', italic='JH', boldItalic='JHB')
W, H = A4
M = 44
CW = W - 2*M
INK, TEAL, MUTED = map(colors.HexColor, ['#163E44', '#007C80', '#607879'])
PALE, LINE = map(colors.HexColor, ['#EEF6F5', '#D5E3E2'])
styles = {
 'body': ParagraphStyle('body', fontName='JH', fontSize=10, leading=16, textColor=INK, wordWrap='CJK', spaceAfter=9),
 'small': ParagraphStyle('small', fontName='JH', fontSize=8.4, leading=13, textColor=MUTED, wordWrap='CJK', spaceAfter=6),
 'h2': ParagraphStyle('h2', fontName='JHB', fontSize=13, leading=20, textColor=TEAL, spaceBefore=9, spaceAfter=8, keepWithNext=True, wordWrap='CJK'),
 'title': ParagraphStyle('title', fontName='JHB', fontSize=23, leading=33, textColor=INK, spaceAfter=12, wordWrap='CJK'),
 'cover': ParagraphStyle('cover', fontName='JHB', fontSize=33, leading=48, textColor=INK, spaceAfter=20, wordWrap='CJK'),
 'kicker': ParagraphStyle('kicker', fontName='JHB', fontSize=9, leading=14, textColor=TEAL, spaceAfter=12),
 'cell': ParagraphStyle('cell', fontName='JH', fontSize=9.1, leading=14, textColor=INK, wordWrap='CJK'),
 'th': ParagraphStyle('th', fontName='JHB', fontSize=9.1, leading=14, textColor=colors.white, wordWrap='CJK'),
 'code': ParagraphStyle('code', fontName='JH', fontSize=8.5, leading=13.5, textColor=INK, wordWrap='CJK', spaceAfter=8),
 'diagramTitle': ParagraphStyle('diagramTitle', fontName='JHB', fontSize=10.5, leading=16, textColor=TEAL, wordWrap='CJK'),
}

def P(text, kind='body'):
    return Paragraph(escape(text).replace('\n', '<br/>'), styles[kind])

def table(rows, widths=None):
    widths = [CW*w for w in widths] if widths else [CW/len(rows[0])]*len(rows[0])
    data = [[P(v, 'th' if i == 0 else 'cell') for v in row] for i, row in enumerate(rows)]
    t = Table(data, colWidths=widths, hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),TEAL), ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),10), ('RIGHTPADDING',(0,0),(-1,-1),10),
        ('TOPPADDING',(0,0),(-1,-1),8), ('BOTTOMPADDING',(0,0),(-1,-1),8),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),
        ('LINEBELOW',(0,1),(-1,-1),0.4,LINE),
    ]))
    return t

def note(text):
    t = Table([[P(text)]], colWidths=[CW])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('BOX',(0,0),(-1,-1),0.5,LINE),
        ('LEFTPADDING',(0,0),(-1,-1),13),('RIGHTPADDING',(0,0),(-1,-1),13),
        ('TOPPADDING',(0,0),(-1,-1),11),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    return t

class Diagram(Flowable):
    def __init__(self, kind):
        super().__init__(); self.kind=kind; self.width=CW; self.height=266 if kind=='architecture' else 286
    def draw(self):
        c=self.canv
        def box(x,y,w,h,title,body=''):
            c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y,w,h,8,fill=1,stroke=1)
            for txt,kind,top in [(title,'diagramTitle',y+h-9),(body,'small',y+h-(29 if h<=50 else 37))]:
                if txt:
                    p=P(txt,kind);pw,ph=p.wrap(w-20,h);p.drawOn(c,x+10,top-ph)
        def arrow(x1,y1,x2,y2):
            import math
            c.setStrokeColor(TEAL);c.setFillColor(TEAL);c.setLineWidth(1.2);c.line(x1,y1,x2,y2)
            a=math.atan2(y2-y1,x2-x1);p=c.beginPath();p.moveTo(x2,y2)
            p.lineTo(x2-6*math.cos(a-.45),y2-6*math.sin(a-.45));p.lineTo(x2-6*math.cos(a+.45),y2-6*math.sin(a+.45));p.close();c.drawPath(p,fill=1,stroke=0)
        if self.kind=='architecture':
            bw=150; gap=(CW-3*bw)/2
            xs=[0,bw+gap,2*(bw+gap)]
            box(xs[0],180,bw,75,'React 管理前端','Vercel Preview\n只有公開連線值')
            box(xs[1],180,bw,75,'Supabase Auth / Edge','JWT、角色、快照\n配額與請求處理')
            box(xs[2],180,bw,75,'Gemini API','文件／問題向量\n受限回答生成')
            arrow(bw,217,xs[1],217);arrow(xs[1]+bw,217,xs[2],217)
            box(xs[0],65,bw,75,'私有 Storage','原始檔、快照\n下載 hash 核對')
            box(xs[1],65,bw,75,'Postgres / RLS','版本、pgvector\nPGroonga、費用帳')
            box(xs[2],65,bw,75,'受信任本機 CLI','解析、OCR、向量批次\n不由瀏覽器自動啟動')
            arrow(xs[1]+75,180,xs[1]+75,140)
            arrow(xs[2],102,xs[1]+bw,102)
            arrow(xs[2]+75,140,xs[2]+75,180)
            # Separate lower route avoids drawing through the database box.
            c.setStrokeColor(TEAL);c.line(xs[2]+75,65,xs[2]+75,35);c.line(xs[2]+75,35,75,35)
            arrow(75,35,75,65)
            p=P('圖 1 主要元件與呼叫方向；直接資料讀取仍受 RLS 限制。','small');_,ph=p.wrap(CW,30);p.drawOn(c,0,2)
        else:
            labels = [('01  驗證身份、輪次與不可變快照','先占用題數；模型呼叫另行預留費用'),
                ('02  服務範圍、允許計算與 QA 完全命中','有確定結果可直接回覆；否則進檢索'),
                ('03  問題向量與混合檢索','cosine + 中文詞項 + RRF；必要時最多一次改寫'),
                ('04  依門檻選完整證據並呼叫 Gemini','最多 12 份脈絡、80 KB；模型選原文窗口'),
                ('05  引用與數量單位驗證、持久化紀錄','通過才回答；不足、失敗及未知各自保留')]
            for i,(title,body) in enumerate(labels):
                y=236-i*56;box(0,y,CW,48,title,body)
                if i<4:arrow(CW/2,y,CW/2,y-8)

sections=json.loads(SOURCE.read_text(encoding='utf-8'))
total=len(sections)
class Doc(SimpleDocTemplate):
    def afterFlowable(self,flowable):
        if getattr(flowable,'section_key',None):
            self.canv.bookmarkPage(flowable.section_key)
            self.canv.addOutlineEntry(flowable.section_title,flowable.section_key,0,False)

def decorate(c,doc):
    c.saveState();c.setTitle(TITLE + ' | 2026-10-28')
    c.setAuthor('CarbonGuide');c.setSubject('RAG v1 架構、資料管線、模型方法、安全與維運')
    if doc.page>1:
        c.setFillColor(TEAL);c.setFont('JHB',8);c.drawString(M,H-31,RUNNING)
        c.setStrokeColor(LINE);c.line(M,H-40,W-M,H-40)
    c.setStrokeColor(LINE);c.line(M,38,W-M,38);c.setFont('JH',8);c.setFillColor(MUTED)
    c.drawString(M,23,'2026-10-28  |  v1 / protected Preview')
    c.drawRightString(W-M,23,f'{doc.page:02d} / {total:02d}')
    c.restoreState()

story=[]
for index,section in enumerate(sections):
    items=[]
    if index==0: items.append(Spacer(1,38))
    items.append(P(section['kicker'],'kicker'))
    title=P(section['title'],'cover' if index==0 else 'title')
    title.section_key=f'section-{index+1}';title.section_title=section['title'];items.append(title)
    if section.get('subtitle'):items.append(P(section['subtitle'],'small'))
    for block in section['blocks']:
        kind=block['type']
        if kind=='table':items.extend([table(block['rows'],block.get('widths')),Spacer(1,10)])
        elif kind=='note':items.extend([note(block['text']),Spacer(1,10)])
        elif kind=='diagram':items.extend([Diagram(block['kind']),Spacer(1,12)])
        elif kind=='link':
            markup=f'<link href="{escape(block["url"],quote=True)}" color="#007C80">{escape(block["text"])}</link>'
            items.append(Paragraph(markup,styles['small']))
        else:items.append(P(block['text'],kind if kind in styles else 'body'))
    # Refuse overflowing authored pages instead of silently moving headings/page references.
    measured=sum(item.wrap(CW,10000)[1]+item.getSpaceBefore()+item.getSpaceAfter() for item in items)
    if measured>H-120:raise ValueError(f'Page {index+1} too tall: {measured:.1f} > {H-120:.1f}')
    story.extend(items)
    if index<total-1:story.append(PageBreak())

OUT.parent.mkdir(parents=True,exist_ok=True)
doc=Doc(str(OUT),pagesize=A4,rightMargin=M,leftMargin=M,topMargin=58,bottomMargin=50,
    title=TITLE,author='CarbonGuide',pageCompression=1)
doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
# The browser-readable manual and PDF share one authored source.
md = [f'# {TITLE}', '', '更新：2026-10-28。由同名 JSON 來源產生，與 PDF 內容同步。', '', f'[下載 PDF](../output/pdf/{OUT.name})', '']
for i, section in enumerate(sections):
    md.extend(['## ' + section['title'].replace('\n', ' · '), '', section.get('subtitle', ''), ''])
    for block in section['blocks']:
        kind = block['type']
        if kind == 'table':
            rows = block['rows']
            def row(values): return '| ' + ' | '.join(v.replace('|', '\\|').replace('\n', '<br>') for v in values) + ' |'
            md.extend([row(rows[0]), row(['---'] * len(rows[0])), *[row(r) for r in rows[1:]], ''])
        elif kind == 'link': md.extend([f"[{block['text']}]({block['url']})", ''])
        elif kind == 'diagram':
            line = 'A[React 管理前端] --> B[Supabase 身份與權限]\n B --> C[固定版本與資料庫]\n B --> D[Gemini]\n E[本機解析與 OCR] --> C' if block['kind'] == 'architecture' else 'A[身份 輪次 快照] --> B[範圍檢查 QA 或計算]\n B --> C[向量與混合檢索]\n C --> D[選證據及生成]\n D --> E[引用數值驗證]\n E --> F[保存回覆或拒答]'
            md.extend(['```mermaid', 'flowchart TD', ' ' + line, '```', ''])
        else: md.extend([('### ' if kind == 'h2' else '> ' if kind == 'note' else '') + block['text'].replace('\n', '\n> ' if kind == 'note' else '\n'), ''])
(ROOT / f'docs/{slug}.zh-TW.md').write_text('\n'.join(line.rstrip() for line in '\n'.join(md).splitlines()) + '\n', encoding='utf-8')
print(json.dumps({'path':str(OUT),'expected_pages':total,'bytes':OUT.stat().st_size}))
