import re, os, sys, glob, html as H

base = r'D:\Harness_Workspace\Website'
files = []
for root, _, fs in os.walk(base):
    for f in fs:
        if f.endswith('.html'):
            files.append(os.path.join(root, f))

print('HTML FILES:', len(files))
errors = []

for path in sorted(files):
    rel = os.path.relpath(path, base)
    html = open(path, encoding='utf-8').read()

    for tag in ['section','div','article','ul','li','header','footer','main','nav','h1','h2','h3','h4','h5','span','p','a','button','time','figure','dl','dt','dd','pre','code','blockquote']:
        o = len(re.findall(r'<%s[\s>]' % tag, html))
        c = len(re.findall(r'</%s>' % tag, html))
        if o != c:
            errors.append('%s: <%s> open=%d close=%d' % (rel, tag, o, c))

    for m in re.finditer(r'(?:src|href)="([^"]+)"', html):
        ref = m.group(1)
        if ref.startswith(('http:', 'https:', '//', 'mailto:', 'tel:', '#', 'data:')):
            continue
        target = ref.split('#')[0]  # strip fragment
        if not target:
            continue
        p = os.path.normpath(os.path.join(os.path.dirname(path), target))
        if not os.path.exists(p):
            errors.append('%s: missing asset %s' % (rel, ref))

    for pat in ['{{', '}}', 'undefined']:
        if pat in html:
            errors.append('%s: found %r' % (rel, pat))

idx = open(os.path.join(base, 'index.html'), encoding='utf-8').read()
slides = re.findall(r'data-slide', idx)
print('hero slides in index.html:', len(slides))
print('headline present:', 'Explore the potential within humanities and digital innovation' in idx)
print('carousel controls:', 'data-carousel-prev' in idx and 'data-carousel-next' in idx and 'data-carousel-dot' in idx)

art = open(os.path.join(base, 'news', '2026-05-04-akha-deep-learning.html'), encoding='utf-8').read()
for probe in ['<blockquote>', '<strong>', '<ul>', '<li>', '<p>', 'Read more']:
    print('article has', probe, ':', probe in art)
print('article css prefix ok:', '../assets/css/style.css' in art)
print('article favicon prefix ok:', '../favicon.svg' in art)

evt = open(os.path.join(base, 'events.html'), encoding='utf-8').read()
print('events upcoming section:', 'Upcoming events' in evt)
print('events past section:', 'Past events' in evt)

# --- bilingual / structural spot checks ---
zh = open(os.path.join(base, 'zh-hant', 'index.html'), encoding='utf-8').read()
print('zh headline:', '探索人文與數碼創新的無限可能' in zh)
print('zh lang attr:', '<html lang="zh-Hant"' in zh)
print('zh nav:', '關於' in zh and '新聞' in zh and '活動' in zh and '成員' in zh)
print('zh lang-switch to EN:', '../index.html' in zh and 'lang-switch' in zh)
print('zh logos:', '../assets/img/ust-logo.png' in zh and '../assets/img/project-logo.png' in zh)

zhart = open(os.path.join(base, 'zh-hant', 'news', '2026-05-04-akha-deep-learning.html'), encoding='utf-8').read()
print('zh article prefixes:', '../../assets/css/style.css' in zhart and '../../assets/img/news/akha.jpg' in zhart)
print('zh article body:', '阿卡語' in zhart and '科大研究團隊' in zhart)
print('zh article switcher:', '../../news/2026-05-04-akha-deep-learning.html' in zhart)

print('index has no research directions:', 'Research Directions' not in idx)
print('index has no member cards:', 'member-grid' not in idx)
members = open(os.path.join(base, 'members.html'), encoding='utf-8').read()
print('members page has grids:', members.count('member-grid') == 2 and 'James Simpson' in members)
print('logos on index:', 'assets/img/ust-logo.png' in idx and 'assets/img/project-logo.png' in idx)
print('lang switch on en index:', 'zh-hant/index.html' in idx and 'lang-switch' in idx)

# --- featured carousel / members groups / partner logos ---
print('carousel has 4 featured slides:', idx.count('data-slide') == 4)
print('non-featured news not in carousel:', 'chung-schmidt-grant.html' not in idx)
print('partner logo images on index:', idx.count('partner-logo') == 19)
zhidx = open(os.path.join(base, 'zh-hant', 'index.html'), encoding='utf-8').read()
print('zh partner logos:', zhidx.count('partner-logo') == 19)
mem = open(os.path.join(base, 'members.html'), encoding='utf-8').read()
print('members two groups:', mem.count('member-grid') == 2 and 'HKUST Members' in mem and 'Other Members' in mem)
print('members page has partners wall:', mem.count('logo-tile') == 19 and 'Partners' in mem)
zhmem = open(os.path.join(base, 'zh-hant', 'members.html'), encoding='utf-8').read()
print('zh members headings:', '科大成員' in zhmem and '其他成員' in zhmem)
print('zh members page has partners wall:', zhmem.count('logo-tile') == 19 and '合作機構' in zhmem)
print('no journal roles on members page:', all(r not in mem for r in ['Editor-in-Chief', 'Associate Editor', 'Editorial Board']))
print('new partners present:', 'Hong Kong Baptist University' in idx and 'BNU-HKBU' in idx)
print('no labels under logos:', 'logo-img-tile' in idx)
print('topbar drawer:', 'more-drawer' in idx and 'More about HKUST' in idx)
zhidx2 = open(os.path.join(base, 'zh-hant', 'index.html'), encoding='utf-8').read()
print('zh topbar trigger:', '更多關於科大' in zhidx2)
print('site footer + official footer:', 'site-footer' in idx and 'hkust-footer' in idx and 'Follow HKUST on' in idx and 'Privacy' in idx)
print('official footer zh site:', 'hkust-footer' in zhidx2 and 'site-footer' in zhidx2)
print('back-to-top:', 'back-to-top' in idx)

# --- new collections: conferences / teaching / publications ---
for page in ['conferences.html', 'teaching.html', 'publications.html', 'zh-hant/conferences.html', 'zh-hant/teaching.html', 'zh-hant/publications.html']:
    p = os.path.join(base, page)
    ok = os.path.exists(p)
    if ok:
        h = open(p, encoding='utf-8').read()
        ok = 'page-banner' in h
    print('page exists:', page, ok)
conf = open(os.path.join(base, 'conferences.html'), encoding='utf-8').read()
print('conference rows:', conf.count('event-row'))
pub = open(os.path.join(base, 'publications.html'), encoding='utf-8').read()
print('publication rows:', pub.count('publication-row') and 'View publication' in pub)
tea = open(os.path.join(base, 'teaching.html'), encoding='utf-8').read()
print('teaching cards:', tea.count('news-card') == 3)
zhnav = open(os.path.join(base, 'zh-hant', 'index.html'), encoding='utf-8').read()
print('zh nav new tabs:', '學術會議' in zhnav and '教學' in zhnav and '出版物' in zhnav)
print('en nav new tabs:', 'Conferences' in idx and 'Teaching' in idx and 'Publications' in idx)
zhconf = open(os.path.join(base, 'zh-hant', 'conferences.html'), encoding='utf-8').read()
print('zh conference detail links:', '學術會議' in zhconf and 'conferences/' in zhconf)

if errors:
    print('\nERRORS (%d):' % len(errors))
    for e in errors[:40]:
        print(' -', e)
    sys.exit(1)
print('\nALL CHECKS PASSED')
