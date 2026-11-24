# Витягує текст із конспектів (.docx) і презентацій (.pptx) у папках "№N Назва" -> <outdir>/LNN.txt
# Запуск: py -I tools/extract.py "<папка класу з матеріалами>" ../_sources/2-klas
import zipfile, re, sys, os, glob
def xml_text(data, para_tag):
    data = data.decode('utf8', 'ignore')
    paras = re.split(r'</%s>' % para_tag, data)
    out=[]
    for p in paras:
        t=''.join(re.findall(r'<a:t>([^<]*)</a:t>|<w:t(?: [^>]*)?>([^<]*)</w:t>', p) and [a or b for a,b in re.findall(r'<a:t>([^<]*)</a:t>|<w:t(?: [^>]*)?>([^<]*)</w:t>', p)] or [])
        t=t.strip()
        if t: out.append(t)
    return out
def docx(path):
    z=zipfile.ZipFile(path); return xml_text(z.read('word/document.xml'),'w:p')
def pptx(path):
    z=zipfile.ZipFile(path)
    names=sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',n)], key=lambda n:int(re.findall(r'\d+',n)[0]))
    res=[]
    for n in names:
        res.append('--- '+n.split('/')[-1]+' (media: %s)'% ','.join(re.findall(r'Target="\.\./media/([^"]+)"', z.read(n.replace('slides/','slides/_rels/')+'.rels').decode('utf8','ignore')) if (n.replace('slides/','slides/_rels/')+'.rels') in z.namelist() else []))
        res+= xml_text(z.read(n),'a:p')
    return res
root=sys.argv[1]; outdir=sys.argv[2]; os.makedirs(outdir, exist_ok=True)
for d in sorted(os.listdir(root)):
    p=os.path.join(root,d)
    if not os.path.isdir(p): continue
    m=re.search(r'№(\d+)',d)
    if not m: continue
    num=int(m.group(1))
    lines=['##### FOLDER: '+d]+['FILES: '+', '.join(os.listdir(p))]
    for f in sorted(os.listdir(p)):
        fp=os.path.join(p,f)
        try:
            if f.endswith('.docx'): lines+=['=== DOCX '+f]+docx(fp)
            elif f.endswith('.pptx'): lines+=['=== PPTX '+f]+pptx(fp)
            elif f.endswith('.url'): lines+=['=== URL '+f+': '+open(fp,encoding='utf8',errors='ignore').read().replace('\n',' | ')]
        except Exception as e: lines.append('ERR %s %s'%(f,e))
    open(os.path.join(outdir,'L%02d.txt'%num),'w',encoding='utf8').write('\n'.join(lines))
    print(num, len(lines))
