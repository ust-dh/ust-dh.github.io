/* ============================================================
 * Home page feed: keeps the front page honest without hand edits.
 *
 *   1. The "Latest news" grid mirrors the first six cards of the
 *      language's own news listing (/news/ or /zh-hant/news/), so a
 *      news item added to the listing appears on the home page by
 *      itself.
 *   2. The "Upcoming events" list mirrors the events of /events/ (or
 *      /zh-hant/events/) whose date has not passed, judged against
 *      the visitor's clock, soonest first.
 *
 * Both steps are progressive: the static HTML already holds the
 * current state, and if a fetch fails the markup is left alone.
 * Loaded only on pages that mark their slots with data-home-feed.
 * ============================================================ */
(function (window, document) {
  'use strict';
  if (window.__hdtpHomeFeed) {
    return;
  }
  window.__hdtpHomeFeed = true;

  var NEWS_LIMIT = 6;
  var EVENT_LIMIT = 3;
  var isZh = (document.documentElement.getAttribute('lang') || 'en').toLowerCase().indexOf('zh') === 0;
  var prefix = isZh ? '/zh-hant' : '';
  var newsGrid = document.querySelector('[data-home-feed="news"]');
  var eventsList = document.querySelector('[data-home-feed="events"]');
  var emptyNote = document.querySelector('[data-home-empty]');

  function toArray(list) {
    return Array.prototype.slice.call(list);
  }

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

  /* ---- events: only what is still ahead, soonest first ---- */
  function upcomingEvents(root) {
    var cutoff = today();
    return toArray(root.querySelectorAll('.event-row')).filter(function (row) {
      var date = dateOf(row);
      return date && date >= cutoff;
    }).sort(function (a, b) {
      var left = dateOf(a);
      var right = dateOf(b);
      return left < right ? -1 : (left > right ? 1 : 0);
    }).slice(0, EVENT_LIMIT);
  }

  function renderEvents(upcoming) {
    while (eventsList.firstChild) {
      eventsList.removeChild(eventsList.firstChild);
    }
    upcoming.forEach(function (row) {
      var node = document.importNode(row, true);
      // main.js has already wired its scroll reveal, so the cards arrive
      // in their finished state instead of waiting for an observer.
      node.classList.add('reveal', 'visible');
      eventsList.appendChild(node);
    });
    if (emptyNote) {
      emptyNote.hidden = upcoming.length > 0;
    }
  }

  function syncEvents() {
    if (!eventsList) {
      return;
    }
    // Trim the static markup first, so a slow or failed fetch never leaves
    // an expired event on screen.
    renderEvents(upcomingEvents(eventsList));
    if (!window.fetch || !window.DOMParser) {
      return;
    }
    fetchPage(prefix + '/events/').then(function (page) {
      renderEvents(upcomingEvents(page));
    }).catch(function () { /* keep the static list */ });
  }

  /* ---- news: mirror the top cards of the news listing ---- */
  function syncNews() {
    if (!newsGrid || !window.fetch || !window.DOMParser) {
      return;
    }
    fetchPage(prefix + '/news/').then(function (page) {
      var cards = toArray(page.querySelectorAll('.news-grid > .news-card')).slice(0, NEWS_LIMIT);
      if (!cards.length) {
        return;
      }
      var fresh = cards.map(hrefOf).join('|');
      var current = toArray(newsGrid.querySelectorAll('.news-card')).map(hrefOf).join('|');
      if (fresh === current) {
        return;
      }
      while (newsGrid.firstChild) {
        newsGrid.removeChild(newsGrid.firstChild);
      }
      cards.forEach(function (card) {
        var node = document.importNode(card, true);
        node.classList.add('reveal', 'visible');
        newsGrid.appendChild(node);
      });
    }).catch(function () { /* keep the static cards */ });
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
