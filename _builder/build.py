"""Збирає уроки з lessons/*.html у самодостатні index.html (формат CurrentLesson).

Запуск:  py build.py            -> зібрати всі уроки
         py build.py L01 L02    -> лише вказані
Кожен файл уроку має блоки <!--META {...json...} -->, <!--SLIDES--> і <!--SCRIPT-->.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patches import patch_nush3, patch_nush4, patch_run  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))  # CurrentLesson/_builder
REPO = os.path.dirname(HERE)  # корінь репозиторію CurrentLesson


def read(name):
    with open(os.path.join(HERE, name), encoding='utf8') as f:
        return f.read()


def build(path):
    src = open(path, encoding='utf8').read()
    meta = json.loads(re.search(r'<!--META(.*?)-->', src, re.S).group(1))
    slides = src.split('<!--SLIDES-->', 1)[1].split('<!--SCRIPT-->', 1)[0]
    script = src.split('<!--SCRIPT-->', 1)[1]
    n_slides = len(re.findall(r'<section class="slide', slides))
    engine_js = patch_run(patch_nush4(read('engine.js')))
    engine_js = engine_js.replace('__EMOJIS__', json.dumps(meta['emojis'], ensure_ascii=False))
    engine_js = engine_js.replace("'__TOPIC__'", json.dumps(meta['topic']))
    engine_js = engine_js.replace("'__TOPIC___'", json.dumps(meta['topic'].replace('-', '_') + '_'))
    html = read('template.html')
    for key, val in {
        '__TITLE__': meta['title'],
        '__PILL__': meta['pill'],
        '__BRAND__': meta['brand'],
        '__NSLIDES__': str(n_slides),
        '/*__CSS__*/': read('engine.css') + '\n' + read('widgets.css') + '\n' + read('steps.css') + '\n' + read('lessonrun.css'),
        '<!--__SLIDES__-->': slides,
        '/*__JS__*/': read('steps.js') + '\n' + engine_js + '\n' + read('lessonrun.js') + '\n' + read('widgets.js') + '\n' + script
                      + '\n    LessonRun.init();\n    renderSlide(1, true);\n',
    }.items():
        html = html.replace(key, val)
    out = os.path.join(REPO, meta['out'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf8', newline='\n') as f:
        f.write(html)
    print(f'OK  {os.path.basename(path)} -> {meta["out"]}  ({n_slides} слайдів, {len(html)//1024} КБ)')


def build_legacy():
    """Старі уроки (зроблені не збирачем): накладаємо латки на оригінали з legacy/."""
    cfg = json.loads(read('legacy/legacy.json'))
    for item in cfg:
        src = read('legacy/' + item['src']).replace('\r\n', '\n')
        patch = patch_nush4 if item['engine'] == 'nush4' else patch_nush3
        head, sep, rest = src.rpartition('<script>')
        body, sep2, tail = rest.partition('</script>')
        rules = '    window.STEP_RULES = ' + json.dumps(item.get('rules', {}), ensure_ascii=False) + ';\n'
        html = head + sep + '\n' + rules + read('steps.js') + '\n' + patch(body) + sep2 + tail
        html = html.replace('</style>', read('legacy-big.css') + '\n  </style>', 1)
        out = os.path.join(REPO, item['out'])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, 'w', encoding='utf8', newline='\n') as f:
            f.write(html)
        print(f'OK  legacy {item["src"]} -> {item["out"]}')


def build_shell():
    """Головна сторінка репозиторію: каталог для вчителя + екран учня."""
    engine = read('engine.js')
    start = engine.index('const QRCanvas = (() => {')
    end = engine.index('// Teacher Share Modal handlers')
    html = read('shell.html').replace('/*__QR__*/', engine[start:end])
    with open(os.path.join(REPO, 'index.html'), 'w', encoding='utf8', newline='\n') as f:
        f.write(html)
    print('OK  головна сторінка -> index.html')


def clean_title(t):
    t = re.sub(r'^\s*Урок\s*\d+\s*[.•:]\s*', '', t)
    t = re.split(r'\s+—\s+|\s+\(', t)[0]
    return t.strip()


def build_manifest():
    """Сканує CurrentLesson/<N>-klas/urok-<NN>/index.html і пише lessons.json."""
    classes = []
    for cdir in sorted(os.listdir(REPO), key=lambda d: int(re.match(r'(\d+)', d).group(1)) if re.match(r'\d+-klas$', d) else 99):
        m = re.match(r'(\d+)-klas$', cdir)
        if not m:
            continue
        lessons = []
        for ldir in sorted(os.listdir(os.path.join(REPO, cdir))):
            lm = re.match(r'urok-(\d+)', ldir)
            f = os.path.join(REPO, cdir, ldir, 'index.html')
            if not lm or not os.path.isfile(f):
                continue
            src = open(f, encoding='utf8').read()
            title = re.search(r'<title>(.*?)</title>', src, re.S)
            lessons.append({
                'num': int(lm.group(1)),
                'title': clean_title(title.group(1)) if title else ldir,
                'path': f'{cdir}/{ldir}/',
                'slides': len(re.findall(r'<section class="slide', src)),
            })
        lessons.sort(key=lambda l: l['num'])
        classes.append({'id': cdir, 'name': f'{m.group(1)} клас', 'lessons': lessons})
    with open(os.path.join(REPO, 'lessons.json'), 'w', encoding='utf8', newline='\n') as f:
        json.dump({'classes': classes}, f, ensure_ascii=False, indent=2)
    print('OK  lessons.json: ' + ', '.join(f"{c['name']} — {len(c['lessons'])}" for c in classes))


if __name__ == '__main__':
    want = set(sys.argv[1:])
    d = os.path.join(HERE, 'lessons')
    for fn in sorted(os.listdir(d)):
        if fn.endswith('.html') and (not want or fn[:-5] in want):
            build(os.path.join(d, fn))
    if not want:
        build_legacy()
    build_shell()
    build_manifest()
