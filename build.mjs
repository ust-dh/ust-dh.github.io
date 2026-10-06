#!/usr/bin/env node
/* ============================================================
 * Humanities and Digital Technologies Platform — static site generator
 * Zero dependencies (Node >= 18)
 *
 *   node build.mjs
 *
 * Generates TWO language sites from one content tree:
 *   /            English (en)
 *   /zh-hant/    Traditional Chinese (zh-Hant)
 *
 * Reads:
 *   site.config.json         bilingual site meta (en + zh blocks)
 *   content/members.json     bilingual member data
 *   content/partners.json    bilingual partner logos
 *   content/news/*.md        bilingual news posts
 *   content/events/*.md      bilingual events
 *   content/projects/*.md    bilingual project stories
 *
 * MD frontmatter supports per-language fields (nested keys):
 *   title:  { en: "...", zh: "..." }   (or a plain string for both)
 *   summary:{ en: "...", zh: "..." }
 *   tags:   { en: [...], zh: [...] }
 * The body is split by a "--- 中文 ---" marker; text before it is the
 * English body, text after it is the Traditional Chinese body.
 * An item appears on a language site only when that language's title
 * AND body are both present (single-language MD files show on one site).
 * ============================================================ */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join, basename, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CONTENT = join(ROOT, 'content');

/* ---------------- helpers ---------------- */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const formatDate = (iso, lang) => {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (lang === 'zh') return `${d.getFullYear()}年${MONTHS_ZH[d.getMonth()]}${d.getDate()}日`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
const formatRange = (start, end, lang) => {
  if (!end) return formatDate(start, lang);
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const sameYear = s.getFullYear() === e.getFullYear();
  if (lang === 'zh') {
    if (sameMonth) return `${e.getFullYear()}年${MONTHS_ZH[s.getMonth()]}${s.getDate()}–${e.getDate()}日`;
    if (sameYear) return `${s.getFullYear()}年${MONTHS_ZH[s.getMonth()]}${s.getDate()}日 – ${MONTHS_ZH[e.getMonth()]}${e.getDate()}日`;
    return `${formatDate(start, 'zh')} – ${formatDate(end, 'zh')}`;
  }
  if (sameMonth) return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  if (sameYear) return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  return `${formatDate(start, lang)} – ${formatDate(end, lang)}`;
};
const formatMonthDay = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return { month: MONTHS[d.getMonth()], day: String(d.getDate()) };
};

const now = new Date();
const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/* ---------------- frontmatter ---------------- */

function parseVal(val) {
  if (/^\[.*\]$/.test(val)) {
    return val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
  // decode JSON-style escapes such as \u201c
  return val.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  if (m) {
    const lines = m[1].split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const mm = lines[i].match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (!mm) { i++; continue; }
      const key = mm[1];
      const val = mm[2].trim();
      if (val === '') {
        // nested block: "  sub: value" lines and/or YAML lists ("  - item")
        const obj = {};
        const list = [];
        i++;
        while (i < lines.length && /^\s{2,}/.test(lines[i])) {
          const s = lines[i].match(/^\s{2,}([A-Za-z0-9_.-]+):\s*(.*)$/);
          const dash = lines[i].match(/^\s{2,}-\s+(.*)$/);
          if (s) {
            obj[s[1]] = parseVal(s[2].trim());
          } else if (dash) {
            list.push(parseVal(dash[1].trim()));
          } else {
            break;
          }
          i++;
        }
        meta[key] = Object.keys(obj).length ? obj : (list.length ? list : {});
        continue;
      }
      meta[key] = parseVal(val);
      i++;
    }
  }
  return { meta, body: md.slice(m ? m[0].length : 0) };
}

/* resolve a frontmatter field into per-language values */
function resolveLang(meta, key, fallback) {
  const v = meta[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return { en: v.en ?? fallback, zh: v.zh ?? v.en ?? fallback };
  }
  return { en: v ?? fallback, zh: v ?? fallback };
}

/* split body on the Chinese marker */
function splitBody(body) {
  const parts = body.split(/^\s*(?:---\s*中文\s*---|<!--\s*中文\s*-->)\s*$/m);
  return { en: (parts[0] || '').trim(), zh: (parts[1] || '').trim() };
}

/* ---------------- minimal markdown -> html ---------------- */

function inlineMd(src) {
  let s = esc(src);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${esc(u)}">${t}</a>`);
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  return s;
}

function mdToHtml(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let listType = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      closeList();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      out.push(`<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      closeList();
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      closeList();
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote>${inlineMd(buf.join(' '))}</blockquote>`);
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      if (listType !== type) { closeList(); out.push(`<${type}>`); listType = type; }
      out.push(`<li>${inlineMd((ul || ol)[1])}</li>`);
      i++;
      continue;
    }

    if (/^\s*$/.test(line)) { closeList(); i++; continue; }

    closeList();
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^(#{1,6})\s/.test(lines[i]) && !/^\s*```/.test(lines[i]) &&
           !/^\s*[-*+]\s/.test(lines[i]) && !/^\s*\d+\.\s/.test(lines[i]) &&
           !/^\s*>\s?/.test(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${inlineMd(buf.join(' '))}</p>`);
  }
  closeList();
  return out.join('\n');
}

/* body-markdown images carry site-relative paths; resolve them against the page
   that renders them (detail pages sit one or two levels below the site root) */
const resolveBodyImages = (html, prefix) =>
  html.replace(/(<img\b[^>]*\bsrc=")(?![a-zA-Z][a-zA-Z0-9+.-]*:|\/\/|\/|#|data:)/g, `$1${prefix}`);

/* ---------------- content loading ---------------- */

const config = readJson(join(ROOT, 'site.config.json'));
const shared = config.shared;
const LANG = { en: config.en, zh: config.zh };
const members = readJson(join(CONTENT, 'members.json'));
const partners = readJson(join(CONTENT, 'partners.json'));

const slugOf = (f) => basename(f, '.md');

function loadCollection(dir) {
  if (!existsSync(join(CONTENT, dir))) return [];
  return readdirSync(join(CONTENT, dir))
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { meta, body } = parseFrontmatter(readFileSync(join(CONTENT, dir, f), 'utf8'));
      const title = resolveLang(meta, 'title', slugOf(f));
      const summary = resolveLang(meta, 'summary', '');
      const tags = resolveLang(meta, 'tags', []);
      const location = resolveLang(meta, 'location', '');
      const bodies = splitBody(body);
      const html = { en: bodies.en ? mdToHtml(bodies.en) : '', zh: bodies.zh ? mdToHtml(bodies.zh) : '' };
      const lang2 = (k) => resolveLang(meta, k, '');
      return {
        slug: slugOf(f),
        date: meta.date || '',
        endDate: meta.endDate || '',
        image: meta.image || '',
        images: Array.isArray(meta.images) ? meta.images : (meta.image ? [meta.image] : []),
        featured: meta.featured === true || meta.featured === 'true' || meta.featured === 'yes' || meta.featured === '1',
        time: meta.time || '',
        speaker: meta.speaker || '',
        term: lang2('term'),
        level: lang2('level'),
        venue: lang2('venue'),
        type: lang2('type'),
        authors: meta.authors || '',
        year: meta.year || '',
        link: meta.link || '',
        group: meta.group || '',
        order: meta.order ? Number(meta.order) : 0,
        title, summary, tags, location, html,
        body: { en: bodies.en, zh: bodies.zh },
      };
    });
}

const allNews = loadCollection('news');
const allEvents = loadCollection('events');
const allConferences = loadCollection('conferences');
const allTeaching = loadCollection('teaching');
const allPublications = loadCollection('publications');
const allProjects = loadCollection('projects');

const forLang = (items, lang) => items
  .filter((it) => it.title[lang] && it.body[lang])
  .sort((a, b) => (a.date < b.date ? 1 : -1));

const news = { en: forLang(allNews, 'en'), zh: forLang(allNews, 'zh') };
const events = { en: forLang(allEvents, 'en'), zh: forLang(allEvents, 'zh') };
const conferences = { en: forLang(allConferences, 'en'), zh: forLang(allConferences, 'zh') };
const teaching = { en: forLang(allTeaching, 'en'), zh: forLang(allTeaching, 'zh') };
const publications = { en: forLang(allPublications, 'en'), zh: forLang(allPublications, 'zh') };
/* projects keep the order the live site curates them in (front-matter `order`) */
const byOrder = (items) => items.slice().sort((a, b) => a.order - b.order);
const projects = { en: byOrder(forLang(allProjects, 'en')), zh: byOrder(forLang(allProjects, 'zh')) };
const upcoming = { en: events.en.filter((e) => e.date >= todayISO).sort((a, b) => (a.date > b.date ? 1 : -1)), zh: events.zh.filter((e) => e.date >= todayISO).sort((a, b) => (a.date > b.date ? 1 : -1)) };
const past = { en: events.en.filter((e) => e.date < todayISO), zh: events.zh.filter((e) => e.date < todayISO) };

/* ---------------- shared components ---------------- */

const PALETTE = ['#0161ef','#6d28d9','#0d9488','#be185d','#b45309','#2563eb','#7c3aed','#15803d','#c026d3','#0369a1','#a21caf','#4f46e5'];
const colorFor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
const initialsOf = (name) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const logos = (prefix) => `
      <img class="brand-img logo-ust" src="${prefix}${esc(shared.logos.ust)}" alt="HKUST" width="120" height="37">
      <span class="brand-sep" aria-hidden="true"></span>
      <img class="brand-img logo-project" src="${prefix}${esc(shared.logos.project)}" alt="${esc(LANG.en.name)}" width="256" height="79">`;

const switchToUrl = (page) => {
  const { lang, depth, file } = page;
  if (lang === 'en') return '../'.repeat(depth) + shared.zhDir + '/' + file;
  return '../'.repeat(depth) + file.slice(shared.zhDir.length + 1);
};

const header = (page) => {
  const { lang, active, prefix } = page;
  const L = LANG[lang];
  const switchHref = switchToUrl(page);
  const switchLabel = LANG[lang].switchLabel;
  return `
<header class="site-header">
  <div class="header-inner">
    <a href="${prefix}index.html" class="brand" aria-label="${esc(L.name)}">
      ${logos(prefix)}
    </a>
    <nav aria-label="Main navigation" class="main-nav" id="main-nav">
      <ul>${L.nav.map((n) => `<li><a href="${esc(prefix + n.href)}"${(prefix + n.href) === active ? ' class="active"' : ''}>${esc(n.label)}</a></li>`).join('')}</ul>
    </nav>
    <div class="header-actions">
      <a class="lang-switch" href="${esc(switchHref)}" hreflang="${lang === 'en' ? 'zh-Hant' : 'en'}" lang="${lang === 'en' ? 'zh-Hant' : 'en'}">${esc(switchLabel)}</a>
      <button type="button" class="theme-toggle" data-aw-toggle-color-scheme aria-label="Toggle between dark and light mode">
        <svg class="icon-sun" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg>
        <svg class="icon-moon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      </button>
      <button type="button" class="menu-toggle" data-aw-toggle-menu aria-label="Toggle menu" aria-expanded="false" aria-controls="main-nav"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>`;
};

const head = (page, title, description) => `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
<link rel="icon" type="image/png" sizes="512x512" href="${page.prefix}favicon.png">
<link rel="icon" type="image/png" sizes="192x192" href="${page.prefix}favicon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="${page.prefix}apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${page.prefix}assets/css/style.css">
<script>
(function () {
  document.documentElement.classList.add("js");
  var theme = null;
  try { theme = localStorage.getItem("theme"); } catch (e) { /* ignore */ }
  var dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
})();
</script>`;

const topbar = (page) => {
  const { lang } = page;
  const hk = shared.hkust;
  const chevron = '<svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  return `
<div class="hkust-topbar">
  <details class="more-drawer">
    <summary class="toggler" aria-label="${esc(hk.moreAbout[lang])}" title="${esc(hk.moreAbout[lang])}">${chevron}</summary>
    <div class="drawer-content">
      <div class="drawer-title">${esc(hk.moreAbout[lang])}</div>
      <nav class="drawer-links" aria-label="HKUST">
        ${hk.topbarLinks.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noreferrer">${esc(l.label[lang])}</a>`).join('')}
      </nav>
    </div>
  </details>
</div>`;
};

const hkustFooter = (page) => {
  const { lang, prefix } = page;
  const hk = shared.hkust;
  return `
<div class="hkust-footer">
  <a href="#" class="back-to-top" aria-label="Back to top" title="Back to top"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg></a>
  <div class="content-locator">
    <div class="site-col">
      <div class="hkust-logo">
        <a href="https://www.ust.hk" target="_blank" rel="noreferrer"><img src="${prefix}assets/img/hkust/hkust_logo_small.svg" alt="HKUST Logo" width="135" height="36"></a>
      </div>
      <div class="site-pages">
        <a class="page" href="https://dataprivacy.ust.hk/university-data-privacy-policy-statement/" target="_blank" rel="noreferrer">Privacy</a>
        <a class="page" href="https://hkust.edu.hk/sitemap" target="_blank" rel="noreferrer">Sitemap</a>
        <div class="copyright">${esc(hk.copyright)}</div>
      </div>
    </div>
    <div class="social-share-col">
      <div class="text">Follow HKUST on</div>
      <div class="icon-wrapper">
        <a class="page" href="https://www.facebook.com/hkust/" rel="noreferrer"><img src="${prefix}assets/img/hkust/s-icon-fb.svg" alt="Facebook"></a>
        <a class="page" href="https://www.linkedin.com/school/hkust/" rel="noreferrer"><img src="${prefix}assets/img/hkust/s-icon-in.svg" alt="LinkedIn"></a>
        <a class="page" href="https://www.instagram.com/hkust" rel="noreferrer"><img src="${prefix}assets/img/hkust/s-icon-ig.svg" alt="Instagram"></a>
        <a class="page" href="https://www.youtube.com/user/hkust" rel="noreferrer"><img src="${prefix}assets/img/hkust/s-icon-youtube.svg" alt="YouTube"></a>
        <a class="page" href="https://hkust.edu.hk/sites/default/files/menu_icons/mainsite_Wechat_Eng_new.jpg" rel="noreferrer"><img src="${prefix}assets/img/hkust/wechat.png" alt="WeChat"></a>
      </div>
    </div>
  </div>
</div>`;
};

/* site intro footer (above the official HKUST bar) */
const siteFooter = (page) => {
  const { lang, prefix } = page;
  const L = LANG[lang];
  return `
<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <a href="${prefix}index.html" class="brand footer-brand">${logos(prefix)}</a>
      <p class="footer-desc">${esc(L.name)} at The Hong Kong University of Science and Technology — ${esc(L.hero.subtitle)}</p>
    </div>
    <div class="footer-col">
      <h4>${esc(L.footer.contact)}</h4>
      <p class="contact"><a href="mailto:${esc(shared.contact.email)}">${esc(shared.contact.email)}</a></p>
      <p class="contact"><a href="${esc(shared.contact.website)}" target="_blank" rel="noopener">${esc(shared.contact.websiteLabel[lang])}</a></p>
    </div>
    <div class="footer-col">
      <h4>${esc(L.footer.follow)}</h4>
      <ul class="social">${Object.entries(shared.social).map(([k, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${esc(k)}">${esc(k)}</a></li>`).join('')}</ul>
    </div>
  </div>
</footer>`;
};

const layout = (page, title, description, body) => `<!DOCTYPE html>
<html lang="${page.lang === 'zh' ? 'zh-Hant' : 'en'}" dir="ltr">
<head>${head(page, title, description)}</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  ${topbar(page)}
  ${header(page)}
  <main id="main">${body}</main>
  ${siteFooter(page)}
  ${hkustFooter(page)}
  <script src="${page.prefix}assets/js/main.js"></script>
</body>
</html>`;

const tagBadges = (tags) => tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('');

const newsCard = (n, lang, prefix) => {
  const href = `news/${n.slug}.html`;
  const thumbStyle = n.image ? `style="background-image:url('${prefix}${esc(n.image)}')"` : '';
  const thumbClass = n.image ? '' : 'thumb-fallback';
  return `
<article class="news-card reveal">
  <a class="news-thumb ${thumbClass}" href="${esc(href)}" aria-hidden="true" ${thumbStyle}></a>
  <div class="news-body">
    <div class="news-meta"><span class="tag-row">${tagBadges(n.tags[lang])}</span><time datetime="${esc(n.date)}">${formatDate(n.date, lang)}</time></div>
    <h3><a href="${esc(href)}">${esc(n.title[lang])}</a></h3>
    <p>${esc(n.summary[lang])}</p>
    <a class="read-more" href="${esc(href)}">${esc(LANG[lang].pageTitles.readMore)}</a>
  </div>
</article>`;
};

const eventRow = (e, lang, prefix) => {
  const md = formatMonthDay(e.date);
  const href = `events/${e.slug}.html`;
  return `
<article class="event-row reveal">
  <div class="event-date"><span class="event-month">${md.month}</span><span class="event-day">${md.day}</span><span class="event-year">${e.date.slice(0, 4)}</span></div>
  <div class="event-info">
    <div class="news-meta"><span class="tag-row">${tagBadges(e.tags[lang])}</span><time datetime="${esc(e.date)}">${formatDate(e.date, lang)}</time></div>
    <h3><a href="${esc(href)}">${esc(e.title[lang])}</a></h3>
    <p class="event-facts">${e.speaker ? `<span><strong>Speaker:</strong> ${esc(e.speaker)}</span>` : ''}${e.location[lang] ? `<span><strong>Venue:</strong> ${esc(e.location[lang])}</span>` : ''}${e.time ? `<span><strong>Time:</strong> ${esc(e.time)}</span>` : ''}</p>
    <p class="event-summary">${esc(e.summary[lang])}</p>
    <a class="read-more" href="${esc(href)}">${esc(LANG[lang].pageTitles.details)}</a>
  </div>
</article>`;
};

/* conference row — same layout as events */
const conferenceRow = (c, lang, prefix) => {
  const md = formatMonthDay(c.date);
  const href = `conferences/${c.slug}.html`;
  return `
<article class="event-row reveal">
  <div class="event-date"><span class="event-month">${md.month}</span><span class="event-day">${md.day}</span><span class="event-year">${c.date.slice(0, 4)}</span></div>
  <div class="event-info">
    <div class="news-meta"><span class="tag-row">${tagBadges(c.tags[lang])}</span><time datetime="${esc(c.date)}">${formatDate(c.date, lang)}</time></div>
    <h3><a href="${esc(href)}">${esc(c.title[lang])}</a></h3>
    <p class="event-facts">${c.location[lang] ? `<span><strong>Venue:</strong> ${esc(c.location[lang])}</span>` : ''}${c.speaker ? `<span><strong>Organizer:</strong> ${esc(c.speaker)}</span>` : ''}</p>
    <p class="event-summary">${esc(c.summary[lang])}</p>
    <a class="read-more" href="${esc(href)}">${esc(LANG[lang].pageTitles.details)}</a>
  </div>
</article>`;
};

/* teaching card — grid card with optional cover image */
const teachingCard = (t, lang, prefix) => {
  const href = `teaching/${t.slug}.html`;
  const thumbStyle = t.image ? `style="background-image:url('${prefix}${esc(t.image)}')"` : '';
  const thumbClass = t.image ? '' : 'thumb-fallback';
  return `
<article class="news-card reveal">
  <a class="news-thumb ${thumbClass}" href="${esc(href)}" aria-hidden="true" ${thumbStyle}></a>
  <div class="news-body">
    <div class="news-meta"><span class="tag-row">${tagBadges(t.tags[lang])}</span><span class="term-label">${esc(t.term[lang] || t.date)}</span></div>
    <h3><a href="${esc(href)}">${esc(t.title[lang])}</a></h3>
    ${t.level[lang] ? `<p class="event-facts"><span><strong>Level:</strong> ${esc(t.level[lang])}</span></p>` : ''}
    <p>${esc(t.summary[lang])}</p>
    <a class="read-more" href="${esc(href)}">${esc(LANG[lang].pageTitles.readMore)}</a>
  </div>
</article>`;
};

/* publication row — title/authors/venue/year + external link */
const publicationRow = (p, lang, prefix) => {
  const href = `publications/${p.slug}.html`;
  const year = p.year || p.date.slice(0, 4);
  return `
<article class="publication-row reveal">
  <div class="pub-body">
    <div class="news-meta"><span class="tag-row">${tagBadges(p.tags[lang])}</span><time>${esc(year)}</time></div>
    <h3><a href="${esc(href)}">${esc(p.title[lang])}</a></h3>
    ${p.authors ? `<p class="pub-authors">${esc(p.authors)}</p>` : ''}
    <p class="pub-venue">${p.venue[lang] ? esc(p.venue[lang]) : ''}${p.type[lang] ? ` · ${esc(p.type[lang])}` : ''}</p>
    <p class="event-summary">${esc(p.summary[lang])}</p>
    <div class="pub-links">
      <a class="read-more" href="${esc(href)}">${esc(LANG[lang].pageTitles.details)}</a>
      ${p.link ? `<a class="read-more pub-ext" href="${esc(p.link)}" target="_blank" rel="noopener">${esc(LANG[lang].pageTitles.viewPublication)}</a>` : ''}
    </div>
  </div>
</article>`;
};

/* project card — the same card markup as news, with the term chip teaching uses */
const projectCard = (p, lang, prefix) => {
  const href = `projects/${p.slug}.html`;
  const thumbStyle = p.image ? `style="background-image:url('${prefix}${esc(p.image)}')"` : '';
  const thumbClass = p.image ? '' : 'thumb-fallback';
  return `
<article class="news-card reveal">
  <a class="news-thumb ${thumbClass}" href="${esc(href)}" aria-hidden="true" ${thumbStyle}></a>
  <div class="news-body">
    <div class="news-meta"><span class="tag-row">${tagBadges(p.tags[lang])}</span>${p.term[lang] ? `<span class="term-label">${esc(p.term[lang])}</span>` : ''}</div>
    <h3><a href="${esc(href)}">${esc(p.title[lang])}</a></h3>
    <p>${esc(p.summary[lang])}</p>
    <a class="read-more" href="${esc(href)}">${esc(LANG[lang].pageTitles.readMore)}</a>
  </div>
</article>`;
};

/* conference "big area": image gallery + facts + full introduction —
   the main showcase for each conference */
/* conference showcase — text left, image gallery right (in a glass panel),
   on alternating plain/tinted bands */
const hexToRgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
/* pick a glow color from the image's own palette (SVG stop-color) */
const glowColor = (src) => {
  try {
    const xml = readFileSync(join(ROOT, src), 'utf8');
    const m = xml.match(/stop-color="(#[0-9a-fA-F]{6})"/);
    return m ? m[1] : null;
  } catch (e) {
    return null;
  }
};

const conferenceArea = (it, lang, prefix) => {
  const T = LANG[lang].pageTitles;
  const F = T.facts;
  const href = `conferences/${it.slug}.html`;
  const imgs = it.images.length ? it.images : [];
  const dates = formatRange(it.date, it.endDate, lang);
  const year = (it.endDate || it.date).slice(0, 4);
  const cal = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  const pin = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const users = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const tile = (icon, label, value, variant) => `
        <div class="info-tile info-tile--${variant}">
          <span class="info-icon">${icon}</span>
          <span class="info-k">${esc(label)}</span>
          <span class="info-v">${esc(value)}</span>
        </div>`;
  const tiles = [
    it.date ? tile(cal, F.dates, dates, 'blue') : '',
    it.location[lang] ? tile(pin, F.venue, it.location[lang], 'teal') : '',
    it.speaker ? tile(users, F.organizer, it.speaker, 'violet') : '',
  ].filter(Boolean).join('');
  return `
<section class="conf-entry reveal">
  <div class="container">
    <header class="conf-entry-head">
      <span class="conf-year" aria-hidden="true">${esc(year)}</span>
      <p class="conf-label">${esc(T.conference)}</p>
      <h2>${esc(it.title[lang])}</h2>
      ${tiles ? `<div class="conf-infographic">${tiles}</div>` : ''}
    </header>
    <div class="conf-grid">
      <div class="conf-text-col">
        ${it.summary[lang] ? `<p class="conf-lead">${esc(it.summary[lang])}</p>` : ''}
        <div class="conf-text">${it.html[lang]}</div>
      </div>
      ${imgs.length ? `
      <div class="conf-gallery">
        ${imgs.map((src) => {
          const glow = glowColor(src);
          const style = glow ? ` style="box-shadow:0 0 26px ${hexToRgba(glow, 0.45)}"` : '';
          return `<img src="${prefix}${esc(src)}" alt="" loading="lazy"${style}>`;
        }).join('')}
      </div>` : ''}
      <div class="conf-entry-actions">
        <a class="conf-link" href="${esc(href)}">${esc(T.moreDetails)}</a>
        ${it.link ? `<a class="btn" href="${esc(it.link)}" target="_blank" rel="noopener">${esc(T.visitWebsite)}</a>` : ''}
      </div>
    </div>
  </div>
</section>`;
};

/* teaching showcase — same layout as conferences: term / level / instructor
   tiles, 2-image gallery, and a "View syllabus" button (no more details) */
const teachingArea = (it, lang, prefix) => {
  const T = LANG[lang].pageTitles;
  const F = T.facts;
  const imgs = it.images.length ? it.images.slice(0, 2) : [];
  const year = (it.date || '').slice(0, 4);
  const cal = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  const grad = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>';
  const users = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const tile = (icon, label, value, variant) => `
        <div class="info-tile info-tile--${variant}">
          <span class="info-icon">${icon}</span>
          <span class="info-k">${esc(label)}</span>
          <span class="info-v">${esc(value)}</span>
        </div>`;
  const tiles = [
    it.term[lang] ? tile(cal, F.term, it.term[lang], 'blue') : '',
    it.level[lang] ? tile(grad, F.level, it.level[lang], 'teal') : '',
    it.speaker ? tile(users, F.instructor, it.speaker, 'violet') : '',
  ].filter(Boolean).join('');
  return `
<section class="conf-entry reveal">
  <div class="container">
    <header class="conf-entry-head">
      <span class="conf-year" aria-hidden="true">${esc(year)}</span>
      <p class="conf-label">${esc(T.teaching)} · ${esc(year)}</p>
      <h2>${esc(it.title[lang])}</h2>
      ${tiles ? `<div class="conf-infographic">${tiles}</div>` : ''}
    </header>
    <div class="conf-grid">
      <div class="conf-text-col">
        ${it.summary[lang] ? `<p class="conf-lead">${esc(it.summary[lang])}</p>` : ''}
        <div class="conf-text">${it.html[lang]}</div>
      </div>
      ${imgs.length ? `
      <div class="conf-gallery conf-gallery--stack">
        ${imgs.map((src) => {
          const glow = glowColor(src);
          const style = glow ? ` style="box-shadow:0 0 26px ${hexToRgba(glow, 0.45)}"` : '';
          return `<img src="${prefix}${esc(src)}" alt="" loading="lazy"${style}>`;
        }).join('')}
      </div>` : ''}
      ${it.link ? `
      <div class="conf-entry-actions">
        <a class="btn" href="${esc(it.link)}" target="_blank" rel="noopener">${esc(T.viewSyllabus)}</a>
      </div>` : ''}
    </div>
  </div>
</section>`;
};

/* large feature band for conferences / teaching / publications —
   styled like the homepage "About us" section: full-width tinted band,
   centered narrow column. Conferences use the big-area layout above. */
const featureBlock = (kind, it, lang, prefix) => {
  const T = LANG[lang].pageTitles;
  const L = LANG[lang];
  const href = `${kind}/${it.slug}.html`;
  if (kind === 'conferences') {
    return conferenceArea(it, lang, prefix);
  }
  if (kind === 'teaching') {
    return teachingArea(it, lang, prefix);
  }
  const facts = kind === 'teaching'
    ? [it.term[lang] && `Term: ${it.term[lang]}`, it.level[lang] && `Level: ${it.level[lang]}`].filter(Boolean).join(' · ')
    : [it.authors, it.venue[lang], (it.year || it.date.slice(0, 4))].filter(Boolean).join(' · ');
  const metaDate = kind === 'publications' ? (it.year || it.date.slice(0, 4)) : formatDate(it.date, lang);
  const detailLabel = kind === 'publications' ? T.details : T.readMore;
  return `
<section class="feature-band reveal">
  <div class="container narrow">
    ${it.image ? `<img class="feature-band-img" src="${prefix}${esc(it.image)}" alt="" loading="lazy">` : ''}
    <div class="feature-meta"><span class="tag-row">${tagBadges(it.tags[lang])}</span><time datetime="${esc(it.date)}">${esc(metaDate)}</time></div>
    <h2><a href="${esc(href)}">${esc(it.title[lang])}</a></h2>
    ${facts ? `<p class="feature-facts">${esc(facts)}</p>` : ''}
    <p class="lead">${esc(it.summary[lang])}</p>
    <div class="feature-btns">
      <a class="btn ghost" href="${esc(href)}">${esc(detailLabel)}</a>
      ${kind === 'publications' && it.link ? `<a class="btn ghost" href="${esc(it.link)}" target="_blank" rel="noopener">${esc(T.viewPublication)}</a>` : ''}
    </div>
  </div>
</section>`;
};

/* ---------------- hero carousel ---------------- */

const heroCarousel = (lang, prefix) => {
  const L = LANG[lang];
  // news explicitly marked featured: true (and with an image) drive the
  // carousel; if none are marked, fall back to the latest news with images
  const featured = news[lang].filter((n) => n.featured && n.image);
  const slides = (featured.length ? featured : news[lang].filter((n) => n.image))
    .slice(0, shared.heroSlides || 4);
  const isFallback = !slides.length;
  const fallback = [{ slug: '', title: { en: L.name, zh: L.name }, summary: { en: L.hero.subtitle, zh: L.hero.subtitle }, tags: { en: [], zh: [] }, date: '', image: '' }];
  const list = isFallback ? fallback : slides;
  return `
<section class="hero-carousel" data-carousel aria-roledescription="carousel" aria-label="Latest news">
  <div class="hero-slides">
    ${list.map((n, idx) => {
      const href = n.slug ? `news/${n.slug}.html` : '';
      const cls = 'hero-slide' + (idx === 0 ? ' active' : '') + (n.image ? '' : ' slide-fallback');
      const bg = n.image ? `<img class="slide-bg" src="${prefix}${esc(n.image)}" alt="" aria-hidden="true" fetchpriority="${idx === 0 ? 'high' : 'low'}">` : '';
      return `
    <figure class="${cls}" data-slide
      data-title="${esc(n.title[lang])}"
      data-summary="${esc(n.summary[lang])}"
      data-date="${esc(n.date ? formatDate(n.date, lang) : '')}"
      data-href="${esc(href)}"
      data-tags="${esc(n.tags[lang].join('|'))}"
      aria-hidden="${idx !== 0}">
      ${bg}
      <div class="hero-shade" aria-hidden="true"></div>
    </figure>`;
    }).join('')}
  </div>
  <!-- static headline layer: never switches; only the news card updates -->
  <div class="hero-static">
    <div class="container hero-inner">
      <div class="hero-copy">
        <p class="eyebrow">${esc(L.hero.eyebrow)}</p>
        <h1>${esc(L.hero.headline)}</h1>
        <p class="hero-sub">${esc(L.hero.subtitle)}</p>
      </div>
      <div class="hero-news">
        <div class="news-meta"><span class="tag-row" id="hero-news-tags"></span><time id="hero-news-date"></time></div>
        <h2><a id="hero-news-title" href="#"></a></h2>
        <p id="hero-news-summary"></p>
        <a class="btn" id="hero-news-link" href="#">${esc(L.pageTitles.readMore)}</a>
      </div>
    </div>
  </div>
  ${list.length > 1 ? `
  <div class="carousel-controls">
    <button type="button" class="carousel-arrow" data-carousel-prev aria-label="Previous slide">‹</button>
    <div class="carousel-dots">${list.map((_, i) => `<button type="button" data-carousel-dot="${i}" class="${i === 0 ? 'active' : ''}" aria-label="Slide ${i + 1}"></button>`).join('')}</div>
    <button type="button" class="carousel-arrow" data-carousel-next aria-label="Next slide">›</button>
  </div>` : ''}
</section>`;
};

/* ---------------- section builders ---------------- */

const aboutSection = (lang) => {
  const L = LANG[lang].about;
  return `
<section class="band" id="about">
  <div class="container narrow">
    <h2>${esc(L.heading)}</h2>
    ${L.paragraphs.map((p) => `<p class="lead">${esc(p)}</p>`).join('')}
    <div class="facts">
      ${L.facts.map((f) => `<div class="fact"><strong>${esc(f.value)}</strong><span class="fact-label">${esc(f.label)}${f.star ? '<sup class="fact-star" aria-hidden="true">*</sup>' : ''}</span></div>`).join('')}
    </div>
    ${(() => {
      const notes = L.facts.filter((f) => f.note).map((f) => f.note);
      if (!notes.length) return '';
      const starred = L.facts.some((f) => f.star) ? '* ' : '';
      return `<p class="facts-note">${starred}${notes.map((n) => esc(n)).join(' ')}</p>`;
    })()}
  </div>
</section>`;
};

const newsSection = (lang, prefix) => {
  const L = LANG[lang];
  return `
<section id="news">
  <div class="container">
    <div class="section-head row">
      <div><h2>${esc(L.newsSection.heading)}</h2><p>${esc(L.newsSection.subtitle)}</p></div>
      <a class="btn ghost" href="news.html">${esc(L.newsSection.viewAll)}</a>
    </div>
    <div class="news-grid">${news[lang].slice(0, shared.newsCount || 3).map((n) => newsCard(n, lang, prefix)).join('')}</div>
  </div>
</section>`;
};

const eventsSection = (lang, prefix) => {
  const L = LANG[lang];
  if (!upcoming[lang].length) return '';
  return `
<section class="band" id="events">
  <div class="container">
    <div class="section-head row">
      <div><h2>${esc(L.eventsSection.heading)}</h2><p>${esc(L.eventsSection.subtitle)}</p></div>
      <a class="btn ghost" href="events.html">${esc(L.eventsSection.viewAll)}</a>
    </div>
    <div class="events-list">${upcoming[lang].slice(0, shared.eventsCount || 3).map((e) => eventRow(e, lang, prefix)).join('')}</div>
  </div>
</section>`;
};

const partnersWall = (lang, prefix) => `
<div class="logo-wall">
  ${partners.map((p) => p.logo
    ? `<div class="logo-tile logo-img-tile"><img class="partner-logo" src="${prefix}${esc(p.logo)}" alt="${esc(p.name[lang])}" loading="lazy"></div>`
    : `<div class="logo-tile"><span class="logo-mark">${esc(p.mark)}</span><span class="logo-label">${esc(p.name[lang])}</span></div>`).join('')}
</div>
<p class="muted-note">${esc(LANG[lang].partnersSection.note)}</p>`;

const partnersSection = (lang, prefix) => {
  const L = LANG[lang];
  return `
<section id="collaborations">
  <div class="container">
    <div class="section-head">
      <h2>${esc(L.partnersSection.heading)}</h2>
      <p>${esc(L.partnersSection.subtitle)}</p>
    </div>
    ${partnersWall(lang, prefix)}
  </div>
</section>`;
};

const memberGroup = (group, lang) => `
<h3 class="subgroup">${esc(group.heading[lang])}</h3>
<div class="member-grid">
  ${group.members.map((m) => `
  <div class="member">
    <span class="avatar" style="background:${colorFor(m.name)}" aria-hidden="true">${initialsOf(m.name)}</span>
    <div class="member-info"><strong>${esc(m.name)}</strong>${m.affiliation && m.affiliation[lang] ? `<span>${esc(m.affiliation[lang])}</span>` : ''}</div>
  </div>`).join('')}
</div>`;

const pageBanner = (lang, title, subtitle, breadcrumb, slim) => `
<section class="page-banner${slim ? ' slim' : ''}">
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb">${breadcrumb}</nav>
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p class="lead">${esc(subtitle)}</p>` : ''}
  </div>
</section>`;

/* ---------------- page builders (per language) ---------------- */

function buildLang(lang) {
  const L = LANG[lang];
  const sub = lang === 'zh' ? shared.zhDir + '/' : '';
  const depthBase = lang === 'zh' ? 1 : 0;
  const rootPrefix = '../'.repeat(depthBase);
  const detailPrefix = '../'.repeat(depthBase + 1);
  const pages = [];

  const add = (relPath, depth, active, title, description, body) => {
    pages.push({ lang, file: sub + relPath, depth, active, title, description, body });
  };

  /* index */
  add('index.html', depthBase, sub + 'index.html',
    `${L.name} — ${L.brand}`, L.description,
    `${heroCarousel(lang, rootPrefix)}
${aboutSection(lang)}
${newsSection(lang, rootPrefix)}
${eventsSection(lang, rootPrefix)}
${partnersSection(lang, rootPrefix)}`);

  /* news list */
  add('news.html', depthBase, sub + 'news.html',
    `${L.pageTitles.news} — ${L.name}`, L.pageTitles.newsSubtitle,
    `${pageBanner(lang, L.pageTitles.news, L.pageTitles.newsSubtitle, `<a href="index.html">Home</a><span aria-hidden="true">›</span><span>${esc(L.pageTitles.news)}</span>`)}
<section class="page-body">
  <div class="container">
    <div class="news-grid">${news[lang].map((n) => newsCard(n, lang, rootPrefix)).join('')}</div>
  </div>
</section>`);

  /* events list */
  add('events.html', depthBase, sub + 'events.html',
    `${L.pageTitles.events} — ${L.name}`, L.pageTitles.eventsSubtitle,
    `${pageBanner(lang, L.pageTitles.events, L.pageTitles.eventsSubtitle, `<a href="index.html">Home</a><span aria-hidden="true">›</span><span>${esc(L.pageTitles.events)}</span>`)}
<section class="page-body">
  <div class="container">
    <h2 class="subgroup">${esc(L.pageTitles.upcoming)}</h2>
    ${upcoming[lang].length ? `<div class="events-list">${upcoming[lang].map((e) => eventRow(e, lang, '')).join('')}</div>` : `<p class="empty-note">${esc(L.pageTitles.noUpcoming)}</p>`}
    ${past[lang].length ? `<h2 class="subgroup">${esc(L.pageTitles.past)}</h2><div class="events-list">${past[lang].map((e) => eventRow(e, lang, '')).join('')}</div>` : ''}
  </div>
</section>`);

  /* members */
  add('members.html', depthBase, sub + 'members.html',
    `${L.pageTitles.members} — ${L.name}`, L.pageTitles.membersSubtitle,
    `${pageBanner(lang, L.pageTitles.members, L.pageTitles.membersSubtitle, `<a href="index.html">Home</a><span aria-hidden="true">›</span><span>${esc(L.pageTitles.members)}</span>`)}
<section class="page-body">
  <div class="container">
    ${members.groups.map((g) => memberGroup(g, lang)).join('')}
    <h2 class="subgroup">${esc(L.pageTitles.partners)}</h2>
    ${partnersWall(lang, rootPrefix)}
  </div>
</section>`);

  /* detail pages */
  for (const kind of ['news', 'events']) {
    const items = kind === 'news' ? news[lang] : events[lang];
    const label = kind === 'news' ? L.pageTitles.news : L.pageTitles.events;
    const backText = kind === 'news' ? L.pageTitles.backToNews : L.pageTitles.backToEvents;
    for (const item of items) {
      const html = resolveBodyImages(item.html[lang], detailPrefix);
      const facts = kind === 'events'
        ? `<dl class="article-facts">
             ${item.date ? `<div><dt>${esc(L.pageTitles.facts.date)}</dt><dd>${formatDate(item.date, lang)}</dd></div>` : ''}
             ${item.time ? `<div><dt>${esc(L.pageTitles.facts.time)}</dt><dd>${esc(item.time)}</dd></div>` : ''}
             ${item.location[lang] ? `<div><dt>${esc(L.pageTitles.facts.venue)}</dt><dd>${esc(item.location[lang])}</dd></div>` : ''}
             ${item.speaker ? `<div><dt>${esc(L.pageTitles.facts.speaker)}</dt><dd>${esc(item.speaker)}</dd></div>` : ''}
           </dl>` : '';
      const body = `
${pageBanner(lang, item.title[lang], item.summary[lang],
  `<a href="${detailPrefix}index.html">Home</a><span aria-hidden="true">›</span><a href="${detailPrefix}${kind}.html">${esc(label)}</a><span aria-hidden="true">›</span><span>${esc(L.pageTitles.article)}</span>`, true)}
<section class="page-body">
  <div class="container article">
    ${item.image ? `<img class="article-cover" src="${detailPrefix}${esc(item.image)}" alt="" loading="lazy">` : ''}
    ${facts}
    ${html}
    <p class="back-link"><a href="${detailPrefix}${kind}.html">${esc(backText)}</a></p>
  </div>
</section>`;
      add(`${kind}/${item.slug}.html`, depthBase + 1, sub + `${kind}.html`,
        `${item.title[lang]} — ${L.name}`, item.summary[lang] || L.description, body);
    }
  }

  /* generic collections: conferences / teaching / publications */
  const GEN = [
    { kind: 'conferences', items: conferences[lang] },
    { kind: 'teaching', items: teaching[lang] },
    { kind: 'publications', items: publications[lang] },
  ];
  for (const g of GEN) {
    const T = L.pageTitles[g.kind];
    const subtitleKey = `${g.kind}Subtitle`;
    add(`${g.kind}.html`, depthBase, sub + `${g.kind}.html`,
      `${T} — ${L.name}`, L.pageTitles[subtitleKey],
      `${pageBanner(lang, T, L.pageTitles[subtitleKey], `<a href="index.html">Home</a><span aria-hidden="true">›</span><span>${esc(T)}</span>`)}
<section class="page-body features-page ${g.kind}-page">
  ${g.items.map((it) => featureBlock(g.kind, it, lang, rootPrefix)).join('')}
</section>`);
    const backKey = `backTo${g.kind[0].toUpperCase()}${g.kind.slice(1)}`;
    for (const item of g.items) {
      const facts = g.kind === 'conferences'
        ? `<dl class="article-facts">
             ${item.date ? `<div><dt>${esc(L.pageTitles.facts.date)}</dt><dd>${formatRange(item.date, item.endDate, lang)}</dd></div>` : ''}
             ${item.location[lang] ? `<div><dt>${esc(L.pageTitles.facts.venue)}</dt><dd>${esc(item.location[lang])}</dd></div>` : ''}
             ${item.speaker ? `<div><dt>${esc(L.pageTitles.facts.organizer)}</dt><dd>${esc(item.speaker)}</dd></div>` : ''}
           </dl>`
        : g.kind === 'teaching'
          ? `<dl class="article-facts">
               ${item.term[lang] ? `<div><dt>${esc(L.pageTitles.facts.term)}</dt><dd>${esc(item.term[lang])}</dd></div>` : ''}
               ${item.level[lang] ? `<div><dt>${esc(L.pageTitles.facts.level)}</dt><dd>${esc(item.level[lang])}</dd></div>` : ''}
               ${item.date ? `<div><dt>${esc(L.pageTitles.facts.date)}</dt><dd>${formatDate(item.date, lang)}</dd></div>` : ''}
             </dl>`
          : `<dl class="article-facts">
               ${item.authors ? `<div><dt>${esc(L.pageTitles.facts.authors)}</dt><dd>${esc(item.authors)}</dd></div>` : ''}
               ${item.venue[lang] ? `<div><dt>${esc(L.pageTitles.facts.venue)}</dt><dd>${esc(item.venue[lang])}</dd></div>` : ''}
               ${(item.year || item.date) ? `<div><dt>${esc(L.pageTitles.facts.year)}</dt><dd>${esc(item.year || item.date.slice(0, 4))}</dd></div>` : ''}
               ${item.type[lang] ? `<div><dt>${esc(L.pageTitles.facts.type)}</dt><dd>${esc(item.type[lang])}</dd></div>` : ''}
             </dl>`;
      const pubLink = (g.kind === 'publications' && item.link)
        ? `<p class="back-link"><a class="read-more pub-ext" href="${esc(item.link)}" target="_blank" rel="noopener">${esc(L.pageTitles.viewPublication)}</a></p>` : '';
      const confLink = (g.kind === 'conferences' && item.link)
        ? `<p class="back-link"><a class="read-more pub-ext" href="${esc(item.link)}" target="_blank" rel="noopener">${esc(L.pageTitles.visitWebsite)}</a></p>` : '';
      const body = `
${pageBanner(lang, item.title[lang], item.summary[lang],
  `<a href="${detailPrefix}index.html">Home</a><span aria-hidden="true">›</span><a href="${detailPrefix}${g.kind}.html">${esc(T)}</a><span aria-hidden="true">›</span><span>${esc(L.pageTitles.article)}</span>`, true)}
<section class="page-body">
  <div class="container article">
    ${item.image ? `<img class="article-cover" src="${detailPrefix}${esc(item.image)}" alt="" loading="lazy">` : ''}
    ${facts}
    ${item.html[lang]}
    ${pubLink}
    ${confLink}
    <p class="back-link"><a href="${detailPrefix}${g.kind}.html">${esc(L.pageTitles[backKey])}</a></p>
  </div>
</section>`;
      add(`${g.kind}/${item.slug}.html`, depthBase + 1, sub + `${g.kind}.html`,
        `${item.title[lang]} — ${L.name}`, item.summary[lang] || L.description, body);
    }
  }

  /* projects: one list page (grouped as the live site groups them) plus a
     detail page per project, in the same bilingual style as news/events */
  {
    const T = L.pageTitles.projects;
    const list = projects[lang];
    const groups = shared.projectGroups || [];
    const cardGrid = (items) => `<div class="news-grid">${items.map((p) => projectCard(p, lang, rootPrefix)).join('')}</div>`;
    const grouped = groups.map((g) => {
      const items = list.filter((p) => p.group === g.key);
      if (!items.length) return '';
      return `
    <h2 class="subgroup">${esc(g.heading[lang])}</h2>
    ${g.subtitle && g.subtitle[lang] ? `<p class="muted-note">${esc(g.subtitle[lang])}</p>` : ''}
    ${cardGrid(items)}`;
    }).join('');
    const ungrouped = list.filter((p) => !groups.some((g) => g.key === p.group));
    add('projects.html', depthBase, sub + 'projects.html',
      `${T} — ${L.name}`, L.pageTitles.projectsSubtitle,
      `${pageBanner(lang, T, L.pageTitles.projectsSubtitle, `<a href="index.html">Home</a><span aria-hidden="true">›</span><span>${esc(T)}</span>`)}
<section class="page-body projects-page">
  <div class="container">
    ${grouped}
    ${ungrouped.length ? cardGrid(ungrouped) : ''}
  </div>
</section>`);
    for (const item of list) {
      const facts = `<dl class="article-facts">
             ${item.term[lang] ? `<div><dt>${esc(L.pageTitles.facts.term)}</dt><dd>${esc(item.term[lang])}</dd></div>` : ''}
           </dl>`;
      const body = `
${pageBanner(lang, item.title[lang], item.summary[lang],
  `<a href="${detailPrefix}index.html">Home</a><span aria-hidden="true">›</span><a href="${detailPrefix}projects.html">${esc(T)}</a><span aria-hidden="true">›</span><span>${esc(L.pageTitles.article)}</span>`, true)}
<section class="page-body">
  <div class="container article">
    ${item.image ? `<img class="article-cover" src="${detailPrefix}${esc(item.image)}" alt="" loading="lazy">` : ''}
    ${facts}
    ${resolveBodyImages(item.html[lang], detailPrefix)}
    <p class="back-link"><a href="${detailPrefix}projects.html">${esc(L.pageTitles.backToProjects)}</a></p>
  </div>
</section>`;
      add(`projects/${item.slug}.html`, depthBase + 1, sub + 'projects.html',
        `${item.title[lang]} — ${L.name}`, item.summary[lang] || L.description, body);
    }
  }

  return pages;
}

/* ---------------- write ---------------- */

const allPages = [...buildLang('en'), ...buildLang('zh')];

for (const page of allPages) {
  page.prefix = '../'.repeat(page.depth);
  const title = page.title;
  const description = page.description;
  mkdirSync(join(ROOT, dirname(page.file)), { recursive: true });
  writeFileSync(join(ROOT, page.file), layout(page, title, description, page.body));
}

/* clean stale outputs (pages whose source MD was removed/renamed).
   Scoped to this generator's own output: the top-level pages it writes plus the
   section/language directories below them. Scratch trees (page captures,
   screenshots, tooling) are never walked, so they can never be deleted. */
const generated = new Set(allPages.map((p) => p.file.replace(/\//g, sep)));
function walkHtml(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkHtml(p));
    else if (entry.endsWith('.html')) out.push(relative(ROOT, p));
  }
  return out;
}
const OWNED_DIRS = ['news', 'events', 'conferences', 'teaching', 'publications', 'projects', shared.zhDir];
const owned = readdirSync(ROOT).filter((e) => e.endsWith('.html'));
for (const d of OWNED_DIRS) {
  const p = join(ROOT, d);
  if (existsSync(p)) owned.push(...walkHtml(p));
}
for (const rel of owned) {
  if (!generated.has(rel)) {
    rmSync(join(ROOT, rel));
    console.log('  cleaned stale:', rel);
  }
}

console.log(`Built ${allPages.length} pages:`);
for (const lang of ['en', 'zh']) {
  const n = allPages.filter((p) => p.lang === lang);
  console.log(`  ${lang === 'en' ? 'EN  ' : 'ZH  '} ${n.length} pages (${n[0].file.startsWith('zh-hant') ? '' : '/'}${lang === 'zh' ? 'zh-hant/' : ''}…)`);
}
console.log(`news: en=${news.en.length} zh=${news.zh.length} · events: en=${events.en.length} zh=${events.zh.length} (upcoming en=${upcoming.en.length} zh=${upcoming.zh.length})`);
console.log(`conferences: en=${conferences.en.length} zh=${conferences.zh.length} · teaching: en=${teaching.en.length} zh=${teaching.zh.length} · publications: en=${publications.en.length} zh=${publications.zh.length}`);
console.log(`projects: en=${projects.en.length} zh=${projects.zh.length}`);
