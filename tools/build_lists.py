#!/usr/bin/env python3
"""Rebuild the listing pages from the published article pages.

The site is static HTML: index.html, news/index.html and events/index.html carry hard-coded
cards. This script reads the metadata out of the article pages themselves (title, date, summary,
tags, image) and rewrites only the card containers, so:

  * adding or editing an article page updates the home carousel, the latest-news cards and the
    news list;
  * the events page is re-bucketed into upcoming / past against today's date.

Article bodies and every other part of the pages are left untouched. Standard library only.
"""
from __future__ import annotations

import datetime as dt
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
MONTHS_ZH = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月']

# The four headline/subtitle pairs the hero panel rotates through.
PANELS = {
    'en': [
        ('Empowering technology and everyday life through the humanities',
         'The Humanities and Digital Technologies Platform bridges the humanities and technology, '
         'leading collaborative research and innovative projects that shape the future of '
         'scholarship, culture and society.'),
        ("Asia's digital humanities hub",
         "The platform is Hong Kong's only digital humanities platform holding board membership in "
         'local, regional, national and Asian digital humanities organisations. It is an organiser '
         'and founding member of several regional digital humanities bodies and international '
         'conferences, with the broadest digital humanities collaboration network.'),
        ('Top-tier humanities general education',
         'The platform runs Asia\u2019s largest digital humanities summer school and offers more than '
         'ten courses that combine the humanities with digital technology. Its teaching is ranked '
         'first in the university by independent sites such as UST Rankings, with several courses '
         'at the top of the general education ranking.'),
        ('Awarded the National Key-Field Language Technology Empowerment Innovation Project Case',
         "The National Key-Field Language Technology Empowerment Innovation Project Case is the "
         "highest honour in China's language technology field, recognising projects that have made "
         'outstanding contributions to national priorities such as Digital China, "AI+" and '
         'building a strong education nation. The project jointly submitted by HKUST received the '
         "award, demonstrating the University's outstanding contribution and influence in language "
         'technology, digital humanities and artificial intelligence.'),
    ],
    'zh': [
        ('\u7528\u4eba\u6587\u5b78\u8ce6\u80fd\u79d1\u6280\u8207\u751f\u6d3b',
         '\u4eba\u6587\u53ca\u6578\u78bc\u79d1\u6280\u7814\u7a76\u5e73\u53f0\u81f4\u529b\u65bc\u878d\u5408\u4eba\u6587\u8207\u79d1\u6280\u7684\u908a\u754c\uff0c\u5f15\u9818\u5354\u4f5c\u7814\u7a76\u8207\u5275\u65b0\u9805\u76ee\uff0c\u4e26\u5851\u9020\u5b78\u8853\u3001\u6587\u5316\u548c\u793e\u6703\u7684\u672a\u4f86'),
        ('\u4e9e\u6d32\u7684\u6578\u78bc\u4eba\u6587\u6a1e\u7d10',
         '\u4eba\u6587\u53ca\u6578\u78bc\u79d1\u6280\u7814\u7a76\u5e73\u53f0\u662f\u9999\u6e2f\u552f\u4e00\u5177\u672c\u5730\u3001\u5340\u57df\u3001\u5168\u570b\u53ca\u4e9e\u6d32\u6578\u78bc\u4eba\u6587\u7d44\u7e54\u7406\u4e8b\u8cc7\u683c\u7684\u6578\u78bc\u4eba\u6587\u5e73\u53f0\uff0c\u662f\u591a\u500b\u6578\u78bc\u4eba\u6587\u5340\u57df\u7d44\u7e54\u548c\u570b\u969b\u5b78\u8853\u6703\u8b70\u7684\u7d44\u7e54\u8005\u548c\u5275\u59cb\u6210\u54e1\uff0c\u64c1\u6709\u6700\u5ee3\u6cdb\u7684\u6578\u78bc\u4eba\u6587\u5354\u4f5c\u7db2\u7d61'),
        ('\u9802\u5c16\u7684\u4eba\u6587\u901a\u8b58\u6559\u80b2',
         '\u4eba\u6587\u53ca\u6578\u78bc\u79d1\u6280\u7814\u7a76\u5e73\u53f0\u4e0d\u50c5\u7d44\u7e54\u4e9e\u6d32\u6700\u5927\u7684\u6578\u78bc\u4eba\u6587\u6691\u671f\u5b78\u6821\uff0c\u9084\u63d0\u4f9b\u5341\u4f59\u9580\u4eba\u6587\u8207\u6578\u78bc\u79d1\u6280\u7d50\u5408\u7684\u8ab2\u7a0b\uff0c\u6559\u5b78\u88abUST Rankings\u7b49\u7368\u7acb\u7db2\u7ad9\u6392\u540d\u5168\u5927\u5b78\u7b2c\u4e00\u540d\uff0c\u591a\u9580\u8ab2\u7a0b\u6392\u540d\u901a\u8b58\u6559\u80b2\u8ab2\u7a0b\u6700\u524d\u5217'),
        ('\u69ae\u7372\u300c\u570b\u5bb6\u95dc\u9375\u9818\u57df\u8a9e\u8a00\u79d1\u6280\u8ce6\u80fd\u5275\u65b0\u9805\u76ee\u6848\u4f8b\u300d',
         '\u300c\u570b\u5bb6\u95dc\u9375\u9818\u57df\u8a9e\u8a00\u79d1\u6280\u8ce6\u80fd\u5275\u65b0\u9805\u76ee\u6848\u4f8b\u300d\u662f\u4e2d\u570b\u8a9e\u8a00\u79d1\u6280\u9818\u57df\u7684\u6700\u9ad8\u5609\u734e\uff0c\u65e8\u5728\u8868\u5f70\u901a\u904e\u8a9e\u8a00\u79d1\u6280\uff0c\u70ba\u300c\u6578\u5b57\u4e2d\u570b\u5efa\u8a2d\u300d\u3001\u300c\u4eba\u5de5\u667a\u80fd+\u300d\u3001\u300c\u6559\u80b2\u5f37\u570b\u5efa\u8a2d\u300d\u7b49\u570b\u5bb6\u95dc\u9375\u9818\u57df\u767c\u5c55\u4f5c\u51fa\u7a81\u51fa\u8ca2\u737b\u7684\u91cd\u8981\u9805\u76ee\u3002\u672c\u6b21\u7531\u79d1\u5927\u806f\u5408\u7533\u5831\u7684\u9805\u76ee\u7372\u5f97\u8868\u5f70\uff0c\u5145\u5206\u5c55\u73fe\u4e86\u79d1\u5927\u5728\u8a9e\u8a00\u79d1\u6280\u3001\u6578\u78bc\u4eba\u6587\u53ca\u4eba\u5de5\u667a\u80fd\u9818\u57df\u7684\u5091\u51fa\u8ca2\u737b\u8207\u5353\u8d8a\u5f71\u97ff\u529b\u3002'),
    ],
}

HERO_COUNT = 4
HOME_NEWS_COUNT = 3
HOME_EVENT_COUNT = 3


# ---------------------------------------------------------------- helpers
def read(rel):
    with open(os.path.join(ROOT, rel.replace('/', os.sep)), encoding='utf-8') as fh:
        return fh.read()


def write(rel, text):
    with open(os.path.join(ROOT, rel.replace('/', os.sep)), 'w', encoding='utf-8') as fh:
        fh.write(text)


def element_bounds(text, start_index, tag):
    """Bounds of the element whose opening tag contains start_index."""
    depth = 0
    for m in re.finditer(r'<(/?)%s\b[^>]*>' % tag, text[start_index:], re.S):
        if m.group(1) == '/':
            depth -= 1
            if depth == 0:
                return start_index, start_index + m.end()
        else:
            depth += 1
    return start_index, len(text)


def container(text, needle, occurrence=1):
    """Return (inner_start, inner_end) of the nth element whose class matches needle."""
    pos = -1
    for _ in range(occurrence):
        pos = text.find(needle, pos + 1)
        if pos < 0:
            return None
    s = text.rfind('<', 0, pos)
    tag = re.match(r'<(\w+)', text[s:]).group(1)
    _, end = element_bounds(text, s, tag)
    open_end = text.index('>', s) + 1
    close_start = len(text[:end]) - len('</%s>' % tag)
    return open_end, close_start


def strip_tags(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment)).strip()


def fmt_date(d, lang):
    if lang == 'en':
        return '%s %d, %d' % (MONTHS_EN[d.month - 1], d.day, d.year)
    return '%d 月 %d, %d' % (d.month, d.day, d.year)


# ---------------------------------------------------------------- extraction
TITLE_RE = re.compile(r'<span class="field field--name-title field--type-string">(.*?)</span>', re.S)
TIME_RE = re.compile(r'<time datetime="(\d{4})-(\d{2})-(\d{2})"')
SUMMARY_RE = re.compile(r'lead hdtp-summary.*?field--name-field-summary[^>]*>\s*<div class="field__item">(.*?)</div>', re.S)
TAG_RE = re.compile(r'<span class="tag">(.*?)</span>', re.S)


def article_meta(rel, lang):
    h = read(rel)
    t = TITLE_RE.search(h) or re.search(r'<h1>(?:<span[^>]*>)?(.*?)(?:</span>)?</h1>', h, re.S)
    tm = TIME_RE.search(h)
    slug = os.path.basename(os.path.dirname(rel))
    if not (t and tm):
        # event pages carry the date in the slug and in chips rather than a <time> element
        m = re.match(r'(\d{4})-(\d{2})-(\d{2})-', slug)
        if not (t and m):
            return None
        d = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    else:
        d = dt.date(int(tm.group(1)), int(tm.group(2)), int(tm.group(3)))
    sm = SUMMARY_RE.search(h)
    img = ''
    fig = re.search(r'<figure class="article-cover">(.*?)</figure>', h, re.S)
    if fig:
        m = re.search(r'<img[^>]+src="([^"]+)"', fig.group(1))
        if m:
            img = m.group(1)
    tags = [strip_tags(x) for x in TAG_RE.findall(h)[:2]]
    return dict(slug=os.path.basename(os.path.dirname(rel)), date=d, title=strip_tags(t.group(1)),
                summary=strip_tags(sm.group(1)) if sm else '', image=img, tags=tags, html=h)


def collect(kind, lang):
    base = 'news' if kind == 'news' else 'events'
    prefix = '' if lang == 'en' else 'zh-hant/'
    d = os.path.join(ROOT, (prefix + base).replace('/', os.sep))
    if not os.path.isdir(d):
        return []
    items = []
    for name in sorted(os.listdir(d)):
        rel = '%s%s/%s/index.html' % (prefix, base, name)
        if not os.path.isfile(os.path.join(ROOT, rel.replace('/', os.sep))):
            continue
        meta = article_meta(rel, lang)
        if meta:
            meta['href'] = '/%s%s/%s' % (prefix, base, name)
            meta['rel'] = rel
            items.append(meta)
    return items


def event_facts(rel, lang):
    h = read(rel)
    out = {}
    v = re.search(r'field--name-field-venue[^>]*>\s*<div class="field__item">(.*?)</div>', h, re.S)
    if v:
        out['venue'] = strip_tags(v.group(1))
    s = re.search(r'chip--speaker[^>]*>(?:<span[^>]*>[^<]*</span>)?(.*?)</li>', h, re.S)
    if s:
        out['speaker'] = strip_tags(s.group(1))
    chips = re.findall(r'<li class="chip">(.*?)</li>', h, re.S)
    for c in chips:
        txt = strip_tags(c)
        if re.search(r'\d{1,2}:\d{2}', txt):
            out['time'] = txt
            break
    return out


# ---------------------------------------------------------------- rendering
def tag_items(tags):
    return ''.join('<div class="field__item"><span class="tag">%s</span></div>' % html.escape(t) for t in tags)


def news_card(item, lang, read_more, langattr):
    src = ' src="%s"' % item['image'] if item.get('image') else ''
    return ('<article about="%s" class="news-card hdtp-news-card">\n'
            '<a class="news-thumb" href="%s" aria-hidden="true" tabindex="-1">\n'
            '<img loading="lazy"%s width="800" height="450" alt="%s" decoding="async">\n'
            '</a>\n<div class="news-body">\n<div class="news-meta">\n'
            '<div class="tag-row" lang="%s"><div class="field__items">%s</div></div>\n'
            '<time datetime="%s">%s</time>\n</div>\n'
            '<h3><a href="%s" rel="bookmark"><span class="field field--name-title field--type-string">%s</span></a></h3>\n'
            '<div class="field field--name-field-summary field--type-string-long"><div class="field__item">%s</div></div>\n'
            '<a class="read-more" href="%s">%s<svg viewBox="0 0 24 24" width="15" height="15" fill="none" '
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
            'aria-hidden="true" focusable="false"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></a>\n'
            '</div>\n</article>') % (
        item['href'], item['href'], src, html.escape(item['title'], quote=True), langattr,
        tag_items(item['tags']), item['date'].isoformat(), fmt_date(item['date'], lang),
        item['href'], html.escape(item['title']), html.escape(item['summary']), item['href'], read_more)


def hero_slide(item, lang, panel, active):
    headline, sub = panel
    tags = '|'.join(item['tags'])
    src = ' src="%s"' % item['image'] if item.get('image') else ''
    return ('<figure class="hero-slide%s" data-slide data-title="%s" data-summary="%s" data-date="%s" '
            'data-href="%s" data-tags="%s" data-headline="%s" data-sub="%s" aria-hidden="%s">'
            '<img class="slide-bg"%s aria-hidden="true"%s><div class="hero-shade" aria-hidden="true"></div>'
            '</figure>') % (
        ' active' if active else '',
        html.escape(item['title'], quote=True), html.escape(item['summary'], quote=True),
        html.escape(fmt_date(item['date'], lang), quote=True), item['href'], html.escape(tags, quote=True),
        html.escape(headline, quote=True), html.escape(sub, quote=True),
        'false' if active else 'true', src,
        ' fetchpriority="high"' if active else '')


def event_labels(page):
    """The localized Speaker / Venue / Time labels, taken from an existing row."""
    out = {}
    strongs = re.findall(r'<strong>(.*?)</strong>', page, re.S)
    if len(strongs) >= 3:
        out['speaker'], out['venue'], out['time'] = (strip_tags(s) for s in strongs[:3])
    else:
        out = {'speaker': 'Speaker:', 'venue': 'Venue:', 'time': 'Time:'}
    return out


def details_label(page):
    """The link label used on an event row ('Details' / '詳情')."""
    m = re.search(r'class="read-more"[^>]*>(.*?)<svg', page, re.S)
    return strip_tags(m.group(1)) if m else 'Details'


def event_row(item, lang, facts, labels, details):
    months = MONTHS_EN if lang == 'en' else MONTHS_ZH
    bits = []
    if facts.get('speaker'):
        bits.append('<div class="event-fact"><strong>%s</strong>%s</div>' % (
            labels['speaker'], html.escape(facts['speaker'])))
    if facts.get('venue'):
        bits.append('<div class="event-fact"><strong>%s</strong>\n'
                    '<div class="field field--name-field-venue field--type-string">\n'
                    '          <div class="field__item">%s</div>\n'
                    '    </div>\n</div>' % (labels['venue'], html.escape(facts['venue'])))
    if facts.get('time'):
        bits.append('<div class="event-fact"><strong>%s</strong>\n'
                    '<div class="field field--name-field-time field--type-string">\n'
                    '          <div class="field__item">%s</div>\n'
                    '    </div>\n</div>' % (labels['time'], html.escape(facts['time'])))
    arrow = ('<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" '
             'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" '
             'focusable="false"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>')
    row = ('<article about="%s" class="event-row hdtp-event-row">\n'
           '    <div class="event-date" aria-hidden="true">\n'
           '      <span class="event-month">%s</span>\n'
           '      <span class="event-day">%d</span>\n'
           '      <span class="event-year">%d</span>\n'
           '    </div>\n'
           '    <div class="event-info">\n'
           '      <div class="news-meta">\n'
           '        <div class="tag-row">\n'
           '<div class="field field--name-field-tags field--type-entity-reference">\n'
           '        <div class="field__items">%s</div>\n'
           '  </div>\n</div>\n'
           '                <time datetime="%s">%s</time>\n'
           '      </div>\n'
           '      <h3><a href="%s" rel="bookmark"><span class="field field--name-title field--type-string">%s</span></a></h3>\n'
           '              <div class="event-facts">%s</div>\n'
           '              <div class="event-summary">\n'
           '<div class="field field--name-field-summary field--type-string-long">\n'
           '          <div class="field__item">%s</div>\n'
           '    </div>\n</div>\n'
           '            <a class="read-more" href="%s">%s%s</a>\n'
           '    </div>\n'
           '  </article>') % (
        item['href'], months[item['date'].month - 1], item['date'].day, item['date'].year,
        tag_items(item['tags']), item['date'].isoformat(), fmt_date(item['date'], lang),
        item['href'], html.escape(item['title']), ''.join(bits), html.escape(item['summary']),
        item['href'], html.escape(details), arrow)
    assert row.count('<div') == row.count('</div>'), 'event row is unbalanced: %s' % item['href']
    return row


ROW_RE = re.compile(r'<article[^>]*class="event-row hdtp-event-row">.*?</article>', re.S)


def replace_inner(text, bounds, inner):
    return text[:bounds[0]] + inner + text[bounds[1]:]


def read_more_label(text):
    m = re.search(r'class="read-more"[^>]*>(.*?)<svg', text, re.S)
    return strip_tags(m.group(1)) if m else 'Read more'


# ---------------------------------------------------------------- main
def set_events_heading(page, lang, has_upcoming):
    """The home events band heading follows whether anything is still to come."""
    if lang == 'en':
        label = 'Upcoming events' if has_upcoming else 'Past events'
    else:
        label = '即將舉行的活動' if has_upcoming else '已舉辦的活動'
    i = page.find('id="events"')
    if i < 0:
        return page
    j = page.find('<h2>', i)
    k = page.find('</h2>', j)
    if j < 0 or k < 0:
        return page
    return page[:j] + '<h2>' + label + '</h2>' + page[k + 5:]


def main():
    today = dt.date.today()
    log = []

    for lang in ('en', 'zh'):
        prefix = '' if lang == 'en' else 'zh-hant/'
        news = sorted(collect('news', lang), key=lambda x: x['date'], reverse=True)
        events = collect('events', lang)
        upcoming = sorted([e for e in events if e['date'] >= today], key=lambda x: x['date'])
        past = sorted([e for e in events if e['date'] < today], key=lambda x: x['date'], reverse=True)

        # --- news list page
        page = read(prefix + 'news/index.html')
        rm = read_more_label(page)
        b = container(page, 'class="news-grid"')
        if b:
            write(prefix + 'news/index.html',
                  replace_inner(page, b, '\n'.join(news_card(i, lang, rm, 'en' if lang == 'en' else 'zh-hant') for i in news)))
            log.append('%snews/index.html: %d cards' % (prefix, len(news)))

        # --- events page: first container upcoming, second past
        page = read(prefix + 'events/index.html')
        rows = ROW_RE.findall(page)
        labels = event_labels(page) if rows else None
        details = details_label(page)
        if labels:
            blocks = []
            for occ in (1, 2):
                bb = container(page, 'class="events-list"', occ)
                if bb:
                    blocks.append(bb)
            if len(blocks) == 2:
                def rows_for(items):
                    out = []
                    for e in items:
                        f = event_facts(e['rel'], lang)
                        out.append(event_row(e, lang, f, labels, details))
                    return '\n'.join(out)
                page = replace_inner(page, blocks[1], '\n' + rows_for(past) + '\n')
                up_html = rows_for(upcoming)
                if not upcoming:
                    up_html = '\n<p class="muted-note">%s</p>\n' % (
                        'No upcoming events at the moment.' if lang == 'en' else '暫無即將舉行的活動。')
                page = replace_inner(page, blocks[0], '\n' + up_html + '\n')
                write(prefix + 'events/index.html', page)
                log.append('%sevents/index.html: %d upcoming, %d past' % (prefix, len(upcoming), len(past)))

        # --- home page: hero, latest news, next events
        page = read(prefix + 'index.html')
        hb = container(page, 'class="hero-slides"')
        if hb:
            pairs = PANELS[lang]
            slides = '\n'.join(hero_slide(i, lang, pairs[k % len(pairs)], k == 0)
                              for k, i in enumerate(news[:HERO_COUNT]))
            page = replace_inner(page, hb, slides)
        nb = container(page, 'class="news-grid"')
        if nb:
            rm = read_more_label(page)
            cards = '\n'.join(news_card(i, lang, rm, 'en' if lang == 'en' else 'zh-hant')
                              for i in news[:HOME_NEWS_COUNT])
            page = replace_inner(page, nb, '\n' + cards + '\n')
        eb = container(page, 'class="events-list"')
        if eb and labels:
            feed = (upcoming or past)[:HOME_EVENT_COUNT]
            rows_home = []
            for e in feed:
                f = event_facts(e['rel'], lang)
                rows_home.append(event_row(e, lang, f, labels, details))
            page = replace_inner(page, eb, '\n\n' + '\n\n'.join(rows_home) + '\n\n')
        write(prefix + 'index.html', page)
        log.append('%sindex.html: %d slides, %d cards, %d events' % (
            prefix, min(HERO_COUNT, len(news)), min(HOME_NEWS_COUNT, len(news)), len(feed) if labels else 0))

    print('today:', today.isoformat())
    for line in log:
        print(' ', line)
    print('  sitemap.xml: %d urls' % write_sitemap())




def write_sitemap():
    """Write sitemap.xml for every published page."""
    base = 'https://ust-dh.github.io'
    skip = {'sites', 'themes', 'assets', 'core', 'profiles', 'modules', 'content', 'vendor',
            'node_modules'}
    urls = []
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in skip and not x.startswith('.')]
        for f in files:
            if not f.endswith('.html'):
                continue
            rel = os.path.relpath(os.path.join(root, f), ROOT).replace(os.sep, '/')
            path = rel[:-len('index.html')] if rel.endswith('index.html') else rel
            urls.append(base + '/' + path)
    urls.sort()
    body = '\n'.join('  <url><loc>%s</loc></url>' % u for u in urls)
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + body + '\n</urlset>\n')
    with open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8') as fh:
        fh.write(xml)
    return len(urls)

if __name__ == '__main__':
    sys.exit(main())

