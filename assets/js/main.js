/* ============================================================
   Digital Humanities Initiative — HKUST-DHI
   Menu toggle · dark mode · news carousel · scroll reveal
   ============================================================ */

(function () {
  'use strict';

  /* ---------- mobile menu toggle ---------- */
  var menuToggle = document.querySelector('[data-aw-toggle-menu]');
  var nav = document.querySelector('#main-nav');

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- dark / light mode ---------- */
  var themeToggle = document.querySelector('[data-aw-toggle-color-scheme]');
  var root = document.documentElement;

  function setTheme(dark) {
    root.classList.toggle('dark', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(!root.classList.contains('dark'));
    });
  }

  /* ---------- hero news carousel ---------- */
  var carousel = document.querySelector('[data-carousel]');

  if (carousel) {
    var slides = Array.prototype.slice.call(carousel.querySelectorAll('[data-slide]'));
    var dots = Array.prototype.slice.call(carousel.querySelectorAll('[data-carousel-dot]'));
    var prevBtn = carousel.querySelector('[data-carousel-prev]');
    var nextBtn = carousel.querySelector('[data-carousel-next]');
    var index = 0;
    var timer = null;
    var DELAY = 6000;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function goTo(n) {
      if (!slides.length) return;
      index = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        var active = i === index;
        s.classList.toggle('active', active);
        s.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === index);
        d.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
      fillNewsCard(slides[index]);
    }

    // update the static news card from the active slide's data attributes
    function fillNewsCard(slide) {
      var titleEl = document.getElementById('hero-news-title');
      var summaryEl = document.getElementById('hero-news-summary');
      var dateEl = document.getElementById('hero-news-date');
      var linkEl = document.getElementById('hero-news-link');
      var tagRow = document.getElementById('hero-news-tags');
      var href = slide.getAttribute('data-href') || '#';
      var title = slide.getAttribute('data-title') || '';
      var summary = slide.getAttribute('data-summary') || '';
      var date = slide.getAttribute('data-date') || '';
      var tags = (slide.getAttribute('data-tags') || '').split('|').filter(Boolean);

      if (titleEl) { titleEl.textContent = title; titleEl.setAttribute('href', href); }
      if (summaryEl) summaryEl.textContent = summary;
      if (dateEl) { dateEl.textContent = date; dateEl.setAttribute('datetime', date); }
      if (linkEl) linkEl.setAttribute('href', href);
      if (tagRow) {
        tagRow.innerHTML = '';
        tags.forEach(function (t) {
          var s = document.createElement('span');
          s.className = 'tag';
          s.textContent = t;
          tagRow.appendChild(s);
        });
      }
      // replay the card fade each time content swaps
      var news = document.querySelector('.hero-news');
      if (news) {
        news.style.animation = 'none';
        void news.offsetWidth;
        news.style.animation = '';
      }
    }

    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    function start() {
      if (slides.length > 1 && !reducedMotion) {
        stop();
        timer = setInterval(next, DELAY);
      }
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { stop(); prev(); start(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { stop(); next(); start(); });

    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        stop();
        goTo(parseInt(d.getAttribute('data-carousel-dot'), 10));
        start();
      });
    });

    // pause while interacting
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', start);

    // touch swipe
    var touchX = null;
    carousel.addEventListener('touchstart', function (e) {
      touchX = e.touches[0].clientX;
    }, { passive: true });
    carousel.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 48) {
        stop();
        if (dx < 0) next(); else prev();
        start();
      }
      touchX = null;
    }, { passive: true });

    goTo(0);
    start();
  }

  /* ---------- back to top ---------- */
  var backTop = document.querySelector('.back-to-top');
  if (backTop) {
    backTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- scroll reveal ---------- */
  document.querySelectorAll('.card, .news-card, .event-row, .logo-tile, .member, .feature-band, .feature-glass, .conf-entry, .section-head, .facts, .subgroup').forEach(function (el) {
    el.classList.add('reveal');
  });
  var targets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    targets.forEach(function (el) { observer.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('visible'); });
  }
})();
