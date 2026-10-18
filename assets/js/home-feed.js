/* ============================================================
 * Home page feed: keeps the front page honest without hand edits.
 *
 *   1. The hero carousel takes the newest stories: the first slides
 *      get the first news items of the language's own news listing,
 *      so the banner follows the news list by itself.
 *   2. The "Latest news" grid mirrors the first three cards of the
 *      same listing.
 *   3. The events band shows the next three events. When nothing is
 *      still to come, it shows the three most recent past events
 *      under the "Past events" heading instead.
 *
 * Progressive: the static HTML already holds the current state, and
 * a failed fetch leaves the markup alone. Loaded only on pages that
 * mark their slots with data-home-feed.
 * ============================================================ */
(function (window, document) {
  'use strict';
  if (window.__hdtpHomeFeed) {
    return;
  }
  window.__hdtpHomeFeed = true;

  var NEWS_LIMIT = 3;
  var EVENT_LIMIT = 3;
  var isZh = (document.documentElement.getAttribute('lang') || 'en').toLowerCase().indexOf('zh') === 0;
  var prefix = isZh ? '/zh-hant' : '';
  var LABEL = isZh
    ? { upcoming: '即將舉行的活動', past: '已舉辦的活動' }
    : { upcoming: 'Upcoming events', past: 'Past events' };

  var newsGrid = document.querySelector('[data-home-feed="news"]');
  var eventsList = document.querySelector('[data-home-feed="events"]');
  var eventsHeading = document.querySelector('#events .section-head h2');
  var emptyNote = document.querySelector('[data-home-empty]');

  function toArray(list) {
    return Array.prototype.slice.call(list);
  }

  var heroSlides = toArray(document.querySelectorAll('.hero-slide'));

  function today() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    return now.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' +
      (day < 10 ? '0' + day : day);
  }

  function dateOf(node) {
    var time = node.querySelector('time[datetime]');
    return time ? String(time.getAttribute('datetime') || '').slice(0, 10) : '';
  }

  function hrefOf(card) {
    var link = card.querySelector('h3 a');
    return link ? link.getAttribute('href') : '';
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function fetchPage(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.text();
    }).then(function (html) {
      return new DOMParser().parseFromString(html, 'text/html');
    });
  }

  /* ---- news cards and the hero carousel ---- */
  function cardData(card) {
    var link = card.querySelector('h3 a');
    var title = card.querySelector('.field--name-title');
    var summary = card.querySelector('.field--name-field-summary .field__item');
    var time = card.querySelector('time');
    var img = card.querySelector('.news-thumb img');
    return {
      href: link ? link.getAttribute('href') : '',
      title: title ? title.textContent.trim() : '',
      summary: summary ? summary.textContent.trim() : '',
      date: time ? time.textContent.trim() : '',
      tags: toArray(card.querySelectorAll('.tag-row .tag')).map(function (tag) {
        return tag.textContent.trim();
      }),
      img: img ? img.getAttribute('src') : ''
    };
  }

  function paintHeroCard() {
    var slide = document.querySelector('.hero-slide.active') || heroSlides[0];
    if (!slide) {
      return;
    }
    var href = slide.getAttribute('data-href') || '#';
    var tags = (slide.getAttribute('data-tags') || '').split('|').filter(Boolean);
    var title = document.getElementById('hero-news-title');
    if (title) {
      title.textContent = slide.getAttribute('data-title') || '';
      title.setAttribute('href', href);
    }
    var summary = document.getElementById('hero-news-summary');
    if (summary) {
      summary.textContent = slide.getAttribute('data-summary') || '';
    }
    var date = document.getElementById('hero-news-date');
    if (date) {
      var dateText = slide.getAttribute('data-date') || '';
      date.textContent = dateText;
      date.setAttribute('datetime', dateText);
    }
    var link = document.getElementById('hero-news-link');
    if (link) {
      link.setAttribute('href', href);
    }
    var tagRow = document.getElementById('hero-news-tags');
    if (tagRow) {
      clear(tagRow);
      tags.forEach(function (tag) {
        var span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        tagRow.appendChild(span);
      });
    }
  }

  function applyHero(cards) {
    if (!heroSlides.length || cards.length < heroSlides.length) {
      return;
    }
    var fresh = cards.slice(0, heroSlides.length);
    var current = heroSlides.map(function (slide) {
      return slide.getAttribute('data-href') || '';
    });
    if (fresh.map(hrefOf).join('|') === current.join('|')) {
      return;
    }
    heroSlides.forEach(function (slide, index) {
      var data = cardData(fresh[index]);
      slide.setAttribute('data-title', data.title);
      slide.setAttribute('data-summary', data.summary);
      slide.setAttribute('data-date', data.date);
      slide.setAttribute('data-href', data.href);
      slide.setAttribute('data-tags', data.tags.join('|'));
      var img = slide.querySelector('.slide-bg');
      if (img && data.img) {
        img.setAttribute('src', data.img);
      }
    });
    paintHeroCard();
  }

  function applyNewsGrid(cards) {
    if (!newsGrid) {
      return;
    }
    var fresh = cards.slice(0, NEWS_LIMIT);
    var current = toArray(newsGrid.querySelectorAll('.news-card')).map(hrefOf);
    if (fresh.map(hrefOf).join('|') === current.join('|')) {
      return;
    }
    clear(newsGrid);
    fresh.forEach(function (card) {
      var node = document.importNode(card, true);
      // main.js has already wired its scroll reveal, so the cards arrive in
      // their finished state instead of waiting for an observer.
      node.classList.add('reveal', 'visible');
      newsGrid.appendChild(node);
    });
  }

  function syncNews() {
    if (!window.fetch || !window.DOMParser || (!newsGrid && !heroSlides.length)) {
      return;
    }
    fetchPage(prefix + '/news/').then(function (page) {
      var cards = toArray(page.querySelectorAll('.news-grid > .news-card'));
      if (!cards.length) {
        return;
      }
      applyHero(cards);
      applyNewsGrid(cards);
    }).catch(function () { /* keep the static markup */ });
  }

  /* ---- events: next three, or the three most recent past ones ---- */
  function pickEvents(root) {
    var cutoff = today();
    var upcoming = [];
    var past = [];
    toArray(root.querySelectorAll('.event-row')).forEach(function (row) {
      var date = dateOf(row);
      if (!date) {
        return;
      }
      if (date >= cutoff) {
        upcoming.push(row);
      } else {
        past.push(row);
      }
    });
    upcoming.sort(function (a, b) {
      return dateOf(a) < dateOf(b) ? -1 : 1;
    });
    past.sort(function (a, b) {
      return dateOf(a) > dateOf(b) ? -1 : 1;
    });
    if (upcoming.length) {
      return { rows: upcoming.slice(0, EVENT_LIMIT), past: false };
    }
    return { rows: past.slice(0, EVENT_LIMIT), past: true };
  }

  function renderEvents(pick) {
    if (!eventsList) {
      return;
    }
    clear(eventsList);
    pick.rows.forEach(function (row) {
      var node = document.importNode(row, true);
      node.classList.add('reveal', 'visible');
      eventsList.appendChild(node);
    });
    if (eventsHeading) {
      eventsHeading.textContent = pick.past ? LABEL.past : LABEL.upcoming;
    }
    if (emptyNote) {
      emptyNote.hidden = pick.rows.length > 0;
    }
  }

  function syncEvents() {
    if (!eventsList) {
      return;
    }
    // Order the static markup first, so a slow or failed fetch never leaves
    // an out-of-date event on screen.
    renderEvents(pickEvents(eventsList));
    if (!window.fetch || !window.DOMParser) {
      return;
    }
    fetchPage(prefix + '/events/').then(function (page) {
      renderEvents(pickEvents(page));
    }).catch(function () { /* keep the static list */ });
  }

  function start() {
    syncNews();
    syncEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}(window, document));
