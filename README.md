# Humanities and Digital Technologies Platform — Website

香港科技大學「人文及數碼科技研究平台」網站 — bilingual (English / 繁體中文) static site,
replicating the design of the [HKUST Media Intelligence Research Center](https://hkust-mirc.github.io/)
(AstroWind-style: sticky navbar with dual logos, news carousel hero, about, latest news,
upcoming events, partner logo wall, dark/light mode).

**News and Events are written in Markdown** — one `.md` file can carry both English and
Traditional Chinese versions; run one command and both language sites update.

## Quick start

```bash
# 1. add/edit markdown files under content/news and content/events
# 2. regenerate both language sites
node build.mjs
# 3. (optional) sanity-check the generated HTML
python validate.py
# 4. preview
python -m http.server 8080
#    → http://localhost:8080        (English)
#    → http://localhost:8080/zh-hant/  (繁體中文)
```

No dependencies, no npm install — `build.mjs` is plain Node (≥ 18).

## How it works

```
site.config.json            bilingual site-wide settings (en + zh blocks)
content/
  news/*.md                 bilingual news posts
  events/*.md               bilingual events
  conferences/*.md          academic conferences (conferences.html)
  teaching/*.md             courses & training (teaching.html)
  publications/*.md         books / articles / outputs (publications.html)
  members.json              bilingual member data
  partners.json             bilingual partner logos
assets/                     static CSS / JS / images / logos
```

`node build.mjs` generates two sites from one content tree:

```
/                    index, news, events, conferences, teaching, publications,
                     members + <kind>/<slug> detail pages          (EN)
/zh-hant/            the same set in Traditional Chinese
```

Stale pages (from removed/renamed MD files) are cleaned up automatically.

## Collection frontmatter

All collections share `title`, `date`, `tags`, `summary`, optional `image`,
and the bilingual `--- 中文 ---` body split.

| Collection | Extra fields |
| --- | --- |
| conferences | `location` (en/zh), `speaker` (organizer) — rendered like events |
| teaching | `term` (en/zh, e.g. "Fall 2026"), `level` (en/zh, e.g. "Postgraduate Course") |
| publications | `authors`, `year`, `venue` (en/zh), `type` (en/zh), `link` (DOI/publisher URL) |

Pages are generated automatically for each collection: a listing page
(`conferences.html` / `teaching.html` / `publications.html`) plus a detail
page per item — just drop an `.md` file in the matching folder and rebuild.

## Writing bilingual content

Frontmatter fields can be nested per language. The body is split by a
`--- 中文 ---` marker: text above it is the English body, text below is the
Traditional Chinese body.

```markdown
---
title:
  en: "Your News Title"
  zh: "新聞標題"
date: 2026-09-01
featured: true                          # optional — show in the homepage hero carousel
image: assets/img/news/your-image.jpg   # optional — carousel background (needs featured)
tags:
  en: [Announcement, Funding]
  zh: [公告, 資助計劃]
summary:
  en: "One-sentence English summary."
  zh: "一句話的中文摘要。"
---

English article body in **Markdown**…

--- 中文 ---

繁體中文正文,支援**粗體**、列表、`代碼`、[連結](url)、引用等。
```

Plain values also work: `title: "Same title for both languages"`. Events add
`time`, `location` (nested `en`/`zh`), and `speaker` fields.

> **News links stay on-site.** News cards and hero slides always link to the
> locally generated detail page (`news/<slug>.html`) — there is no external
> linking. Write the full article directly in the MD body.

> **Homepage carousel.** Only news marked `featured: true` **and** given an
> `image:` appear in the hero carousel (newest first, capped by
> `shared.heroSlides`). If nothing is marked, the latest news with images is
> used as a fallback.

### One-language-only posts

An item appears on a language site only when **both** that language's title and
body are present:

- File with English body only → shown on the English site only
- File with `title.zh` + Chinese body only → shown on the 繁中 site only
- Bilingual file → shown on both

## Homepage layout

1. **Full-screen hero carousel** — keeps the headline, fills the viewport
   (`100svh`), and slides through the latest news that have an `image:` field,
   using that image as a full-bleed background (auto-advance 6 s, pause on
   hover/focus, arrows, dots, touch swipe, `prefers-reduced-motion` aware;
   slide count = `shared.heroSlides`). Scrolling down reveals the About section.
2. **About us**
3. **Latest news**
4. **Upcoming events** (auto-split into Upcoming / Past on the events page)
5. **Industry & Academic Collaborations**

**Members** live on their own page (`members.html` / `zh-hant/members.html`).

## Liquid glass design

The whole site uses a unified frosted-glass ("liquid glass") style: cards,
event rows, member tiles, logo tiles, tags, and article panels are translucent
with `backdrop-filter` blur over decorative colour orbs fixed behind the page
content. Tweak the look via the `--glass-*` CSS variables in
`assets/css/style.css`.

## Logos & branding

- Header/footer show the university logo and the project logo
  (`assets/img/ust-logo.png`, `assets/img/project-logo.png`) — replace these
  files to update the logos.
- Project name: **Humanities and Digital Technologies Platform** / **人文及數碼科技研究平台**.
- Language switcher (EN ⇄ 繁中) in the header keeps your current page.

## Customize

| What | Where |
| --- | --- |
| Brand, hero, about, section titles, contact, social | `site.config.json` (en / zh blocks) |
| News | `content/news/*.md` (`featured: true` controls the hero carousel) |
| Events | `content/events/*.md` |
| Members | `content/members.json` — array of groups (`groups`), HKUST members first; each person is just a name + affiliation (no journal roles); the members page also lists the partners |
| Partner logos | `content/partners.json` — official logos in `assets/img/partners/`, text-tile fallback when no logo |
| Colors / fonts | `assets/css/style.css` (CSS variables at the top) |

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`** → Save.
3. After each edit, run `node build.mjs` and commit the generated HTML
   (including the `zh-hant/` directory).

## Credits

- Design reference: [HKUST-MIRC](https://hkust-mirc.github.io/)
- Content & images: [HKUST Digital Humanities Initiative](https://digitalhumanities.hkust.edu.hk/)
- Contact: dhi@ust.hk
