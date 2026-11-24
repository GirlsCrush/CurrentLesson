# Показує структуру слайдів зібраного уроку (для перевірки / написання STEP_RULES).
# Запуск: py -I tools/outline.py ../2-klas/urok-08/index.html
import sys
sys.stdout.reconfigure(encoding='utf-8')
from html.parser import HTMLParser
VOID={'br','img','input','meta','link','hr','source','area','col','embed','param','track','wbr'}
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.root={'tag':'root','attrs':{},'ch':[],'text':''}; s.cur=s.root
    def handle_starttag(s,t,a):
        n={'tag':t,'attrs':dict(a),'ch':[],'text':'','par':s.cur}; s.cur['ch'].append(n)
        if t not in VOID: s.cur=n
    def handle_endtag(s,t):
        n=s.cur
        while n is not s.root and n['tag']!=t: n=n['par']
        if n is not s.root: s.cur=n['par']
    def handle_data(s,d):
        n=s.cur
        while n is not s.root: n['text']+=d; n=n['par']
p=P(); p.feed(open(sys.argv[1],encoding='utf8').read())
def walk(n):
    yield n
    for c in n['ch']: yield from walk(c)
slides=[n for n in walk(p.root) if n['tag']=='section' and 'slide' in (n['attrs'].get('class') or '').split()]
for i,s in enumerate(slides,1):
    print(f'## {i}')
    for c in s['ch']:
        print('  ', c['tag'], c['attrs'].get('class',''), '|', ' '.join(c['text'].split())[:90])
        for g in c['ch']:
            print('      >', g['tag'], g['attrs'].get('class',''), g['attrs'].get('id',''), '|', ' '.join(g['text'].split())[:90])
            for h in g['ch'][:7]:
                print('          >>', h['tag'], h['attrs'].get('class',''), '|', ' '.join(h['text'].split())[:60])
