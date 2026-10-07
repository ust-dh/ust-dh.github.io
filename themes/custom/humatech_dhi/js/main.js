(function (window, document, Drupal) {
  'use strict';
  var MARK = 'hdtpInit';
  function markOnce(el) {
    if (!el || !el.dataset || el.dataset[MARK]) {
      return false;
    }
    el.dataset[MARK] = '1';
    return true;
  }
  function each(context, selector, callback) {
    var root = (context && context.querySelectorAll) ? context : document;
    Array.prototype.forEach.call(root.querySelectorAll(selector), callback);
  }
  function initMenuToggle(context) {
    each(context, '[data-aw-toggle-menu]', function (toggle) {
      if (!markOnce(toggle)) {
        return;
      }
      var id = toggle.getAttribute('aria-controls') || 'main-nav';
      var nav = document.getElementById(id) || document.querySelector('#main-nav');
      if (!nav) {
        return;
      }
      // No inline glass is painted on the bars here. It used to walk up from the menu
      // to .site-header / .hkust-topbar and set background + backdrop-filter inline;
      // because the menu then lived inside the header, the header's own backdrop-filter
      // made it a backdrop root, the blur could not reach the page, and all that showed
      // was the white fill -- a flat white bar. The menu is now hosted under the bar
      // group, outside the header, so its own blur works and the bars keep their normal
      // theme styling. Kept as a no-op so the rest of the toggle logic is unchanged.
      var applyGlass = function () {};
      var sync = function () {
        applyGlass(nav.classList.contains('open'));
      };
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        sync();
      });
      window.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('resize', sync, { passive: true });
      Array.prototype.forEach.call(nav.querySelectorAll('a'), function (link) {
        link.addEventListener('click', function () {
          nav.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    });
  }
  function initThemeToggle(context) {
    var root = document.documentElement;
    function setTheme(dark) {
      root.classList.toggle('dark', dark);
      try {
        window.localStorage.setItem('theme', dark ? 'dark' : 'light');
      }
      catch (e) {  }
    }
    each(context, '[data-aw-toggle-color-scheme]', function (toggle) {
      if (!markOnce(toggle)) {
        return;
      }
      toggle.addEventListener('click', function () {
        setTheme(!root.classList.contains('dark'));
      });
    });
  }
  function initCarousel(context) {
    each(context, '[data-carousel]', function (carousel) {
      if (!markOnce(carousel)) {
        return;
      }
      var slides = Array.prototype.slice.call(carousel.querySelectorAll('[data-slide]'));
      var dots = Array.prototype.slice.call(carousel.querySelectorAll('[data-carousel-dot]'));
      var prevBtn = carousel.querySelector('[data-carousel-prev]');
      var nextBtn = carousel.querySelector('[data-carousel-next]');
      var index = 0;
      var timer = null;
      var DELAY = 6000;
      var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function fillSlideContent(slide, direction) {
        var titleEl = document.getElementById('hero-news-title');
        var summaryEl = document.getElementById('hero-news-summary');
        var dateEl = document.getElementById('hero-news-date');
        var linkEl = document.getElementById('hero-news-link');
        var tagRow = document.getElementById('hero-news-tags');
        var headlineEl = document.getElementById('hero-headline');
        var subEl = document.getElementById('hero-sub');
        var href = slide.getAttribute('data-href') || '#';
        var title = slide.getAttribute('data-title') || '';
        var summary = slide.getAttribute('data-summary') || '';
        var date = slide.getAttribute('data-date') || '';
        var tags = (slide.getAttribute('data-tags') || '').split('|').filter(Boolean);
        var headline = slide.getAttribute('data-headline') || '';
        var sub = slide.getAttribute('data-sub') || '';
        if (headlineEl && headline) {
          headlineEl.textContent = headline;
        }
        if (subEl && sub) {
          subEl.textContent = sub;
        }
        if (titleEl) {
          titleEl.textContent = title;
          titleEl.setAttribute('href', href);
        }
        if (summaryEl) {
          summaryEl.textContent = summary;
        }
        if (dateEl) {
          dateEl.textContent = date;
          dateEl.setAttribute('datetime', date);
        }
        if (linkEl) {
          linkEl.setAttribute('href', href);
        }
        if (tagRow) {
          tagRow.innerHTML = '';
          tags.forEach(function (t) {
            var s = document.createElement('span');
            s.className = 'tag';
            s.textContent = t;
            tagRow.appendChild(s);
          });
        }

        var moving = [document.getElementById('hero-copy'), document.querySelector('.hero-news'), document.querySelector('.hero-slides')];
        moving.forEach(function (el) {
          if (!el) {
            return;
          }
          el.classList.remove('fly-right', 'fly-left');
          void el.offsetWidth;
          if (!reducedMotion && direction !== 0) {
            el.classList.add(direction > 0 ? 'fly-right' : 'fly-left');
          }
        });
      }
      function goTo(n) {
        if (!slides.length) {
          return;
        }
        var target = (n + slides.length) % slides.length;

        var direction = 0;
        if (slides.length > 1 && target !== index) {
          var delta = target - index;
          direction = delta > 0 ? 1 : -1;
          if (Math.abs(delta) > slides.length / 2) {
            direction = -direction;
          }
        }
        index = target;
        slides.forEach(function (s, i) {
          var active = i === index;
          s.classList.toggle('active', active);
          s.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
        dots.forEach(function (d, i) {
          d.classList.toggle('active', i === index);
          d.setAttribute('aria-current', i === index ? 'true' : 'false');
        });
        fillSlideContent(slides[index], direction);
      }
      function next() {
        goTo(index + 1);
      }
      function prev() {
        goTo(index - 1);
      }
      function stop() {
        if (timer) {
          window.clearInterval(timer);
          timer = null;
        }
      }
      function start() {
        if (slides.length > 1 && !reducedMotion) {
          stop();
          timer = window.setInterval(next, DELAY);
        }
      }
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          stop();
          prev();
          start();
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          stop();
          next();
          start();
        });
      }
      dots.forEach(function (d) {
        d.addEventListener('click', function () {
          stop();
          goTo(parseInt(d.getAttribute('data-carousel-dot'), 10));
          start();
        });
      });
      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', start);
      carousel.addEventListener('focusin', stop);
      carousel.addEventListener('focusout', start);
      var touchX = null;
      carousel.addEventListener('touchstart', function (e) {
        touchX = e.touches[0].clientX;
      }, { passive: true });
      carousel.addEventListener('touchend', function (e) {
        if (touchX === null) {
          return;
        }
        var dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 48) {
          stop();
          if (dx < 0) {
            next();
          }
          else {
            prev();
          }
          start();
        }
        touchX = null;
      }, { passive: true });
      goTo(0);
      start();
    });
  }
  function initBackToTop(context) {
    each(context, '.back-to-top', function (button) {
      if (!markOnce(button)) {
        return;
      }
      button.addEventListener('click', function (e) {
        e.preventDefault();
        // Own animation instead of behavior:'smooth': the native smooth scroll is dropped
        // when the page settles its layout mid-flight (lazy images on the home page), which
        // left the viewport a few pixels short of the top.
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var startY = window.scrollY || window.pageYOffset || 0;
        if (reduce || startY <= 0 || !window.requestAnimationFrame) {
          window.scrollTo(0, 0);
          return;
        }
        var duration = Math.min(700, 220 + startY * 0.35);
        var t0 = null;
        var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
        var step = function (ts) {
          if (t0 === null) {
            t0 = ts;
          }
          var p = Math.min(1, (ts - t0) / duration);
          window.scrollTo(0, Math.round(startY * (1 - ease(p))));
          if (p < 1) {
            window.requestAnimationFrame(step);
          }
          else {
            window.scrollTo(0, 0);
          }
        };
        window.requestAnimationFrame(step);
      });
      // Visibility is owned here, not by a body scroll class: the button must appear as soon
      // as the page has moved at all, on every page. The inline declarations are flagged
      // important so no stylesheet rule can override them, whatever its order or specificity.
      // The button fades in and out. Only opacity is animated: visibility switches instantly
      // so the button is never on screen but transparent, and its layout is always reserved so
      // the fade has something to animate. These declarations are inline and important, so no
      // stylesheet rule can override them whatever its order or specificity.
      button.style.setProperty('transition', 'opacity 0.28s ease', 'important');
      // Pinned in both states: the theme's hidden rule sets translateY(0.5rem) and its
      // transition list includes transform, which would slide the button as it fades.
      button.style.setProperty('transform', 'none', 'important');
      var hideTimer = null;
      var show = function () {
        window.clearTimeout(hideTimer);
        button.style.setProperty('visibility', 'visible', 'important');
        button.style.setProperty('pointer-events', 'auto', 'important');
        button.style.setProperty('opacity', '1', 'important');
      };
      var hide = function () {
        // The outgoing fade has to be visible, so the element stays visible while opacity
        // animates and is switched to hidden only once the transition has finished. Hiding it
        // in the same tick would make it invisible at once and nothing would be drawn.
        button.style.setProperty('pointer-events', 'none', 'important');
        button.style.setProperty('opacity', '0', 'important');
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(function () {
          button.style.setProperty('visibility', 'hidden', 'important');
        }, 320);
      };
      var sync = function () {
        if (window.scrollY > 8 || (window.pageYOffset || 0) > 8) {
          show();
        }
        else {
          hide();
        }
      };
      sync();
      window.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('resize', sync, { passive: true });
    });
  }


  var REVEAL_SELECTORS = '.card, .news-card, .event-row, .logo-tile, .member, ' +
    'body.path-search .page-body > .container, body.path-search .sq-band .container, ' +
    'body.path-search form.sq-band-row, body.path-search form.sq-band-row .form-item, ' +
    'body.path-search form.sq-band-row .submit-wrapper, ' +
    'body.path-search .sq-results .region-content, body.path-search .pager, ' +
    '.feature-band, .feature-glass, .conf-entry, .section-head, .facts, .subgroup, ' +
    '.hdtp-article-card > *, ' +
    '.pj-slate-copy, .pj-stats li, .pj-plate, .pj-band-title, .pj-story-text, ' +
    '.pj-quote, .pj-step, .pj-objective, .pj-checklist li, .pj-team-list li, ' +
    '.pj-source-list li, .pj-foot, ' +
    '.ed-head-grid, .ed-colophon, .ed-sec-inner > h3, .ed-sec-inner > p, .ed-step, .ed-pair, .ed-plate, ' +
    '.ed-gallery-item, .ed-source-list li, .ed-foot, ' +
    '.ed-figure, .ed-share, .ed-passage-body, .ed-slip, .ed-threads, ' +
    '.ax-entry, .ax-stat, .ax-bleed, .ax-credit, .ax-poster-copy, ' +
    '.ma-specimen, .ma-legend, .ma-station, .ma-plate, .ma-credit';
  function initReveal(context) {
    each(context, REVEAL_SELECTORS, function (el) {
      el.classList.add('reveal');
    });
    var targets = [];
    each(context, '.reveal', function (el) {
      if (markOnce(el)) {

        var group = el.parentElement;
        var index = group ? Array.prototype.indexOf.call(group.children, el) : 0;
        if (index > 0) {
          el.style.transitionDelay = (Math.min(index, 6) * 0.07).toFixed(2) + 's';
        }
        targets.push(el);
      }
    });
    if (!targets.length) {
      return;
    }
    /* Keep `revealing` -- and with it the element's compositor layer -- until the
       reveal transition has really finished. The transition is 0.72s plus the
       staggered transition-delay (up to 0.42s), so the previous fixed 900ms dropped
       the layer ~240ms before the animation ended (measured: a 116ms frame at the
       end of a card whose delay was 0.42s). */
    function revealDone(el) {
      var clear = function (e) {
        if (e && (e.target !== el || (e.propertyName !== 'transform' && e.propertyName !== 'opacity'))) {
          return;
        }
        el.classList.remove('revealing');
        el.removeEventListener('transitionend', clear);
      };
      el.addEventListener('transitionend', clear);
      window.setTimeout(clear, 1600);
    }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealing');entry.target.classList.add('visible');revealDone(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      targets.forEach(function (el) {
        observer.observe(el);
      });
    }
    else {
      targets.forEach(function (el) { el.classList.add('revealing'); el.classList.add('visible'); revealDone(el);
      });
    }
  }
  function initShareCopy(context) {
    each(context, '[data-hdtp-copy]', function (btn) {
      if (!markOnce(btn)) {
        return;
      }
      var label = btn.querySelector('[data-hdtp-copy-label]');
      var original = label ? label.textContent : '';
      var url = btn.getAttribute('data-hdtp-copy') || window.location.href;
      function done() {
        btn.setAttribute('data-copied', '1');
        if (label) {
          label.textContent = btn.getAttribute('data-copied-label') || 'Copied';
        }

        btn.setAttribute('title', btn.getAttribute('data-copied-label') || 'Copied');
        btn.setAttribute('aria-label', btn.getAttribute('data-copied-label') || 'Copied');
        window.setTimeout(function () {
          btn.removeAttribute('data-copied');
          if (label) {
            label.textContent = original;
          }
          btn.setAttribute('title', original);
          btn.setAttribute('aria-label', original);
        }, 2200);
      }
      function fallback() {
        var field = document.createElement('textarea');
        field.value = url;
        field.setAttribute('readonly', 'readonly');
        field.style.position = 'absolute';
        field.style.left = '-9999px';
        document.body.appendChild(field);
        field.select();
        try {
          document.execCommand('copy');
          done();
        }
        catch (e) {
          window.prompt(url, url);
        }
        document.body.removeChild(field);
      }
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, fallback);
        }
        else {
          fallback();
        }
      });
    });
  }
  var attached = false;
  function attach(context) {
    attached = true;
    var root = context || document;
    initMenuToggle(root);
    initThemeToggle(root);
    initCarousel(root);
    initBackToTop(root);
    initReveal(root);
    initShareCopy(root);
  }
  if (Drupal && Drupal.behaviors) {
    Drupal.behaviors.humatechDhi = {
      attach: function (context) {
        attach(context);
      }
    };
  }
  function ready() {
    if (!attached) {
      attach(document);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  }
  else {
    ready();
  }
})(window, document, window.Drupal);
(function (window, document) {
  var body = document.body;
  if (!body) {
    return;
  }
  // Two separate moments:
  //   is-scrolled-any -- as soon as the page moves at all. This is what brings
  //     the bars' background and bottom border back, on the hero as much as
  //     anywhere else: the bars are opaque over the page, transparent only over
  //     the carousel.
  //   is-scrolled -- the collapse and the element change, which on a page with
  //     the hero carousel only happen once the carousel has been scrolled past,
  //     i.e. from the moment the About us band reaches the top. Other pages
  //     keep the original 8px threshold and both switch together.
  // is-scrolled-any -- as soon as the page moves at all; this is what brings the
  //   bars' background, border and shadow in, exactly like every other page.
  // is-scrolled -- the element change. On a page with the hero carousel that is
  //   the moment the About us band reaches the top of the page, i.e. once the
  //   carousel has been scrolled past. Other pages keep the original 8px
  //   threshold.
  // The About us band, by its position in the document. Scrolling does not
  // change that number, and it is the exact line the page has to pass for the
  // carousel to be behind us.
  var aboutThreshold = function () {
    var about = document.querySelector('#about, .band');
    if (!about) {
      return 0;
    }
    var rect = about.getBoundingClientRect();
    var offset = window.pageYOffset !== undefined ? window.pageYOffset : (document.documentElement.scrollTop || 0);
    return Math.round(rect.top + offset);
  };
  var threshold = aboutThreshold();
  var sync = function () {
    var y = window.scrollY;
    body.classList.toggle('is-scrolled-any', y > 8);
    body.classList.toggle('is-scrolled', y > (threshold + 8));
    // The bar group pins itself by the top bar's height, and that height is NOT
    // --topbar-h: the variable is 1.5rem (24px) while the bar renders around 39px. The real
    // height is published here, from the live box, so the offset follows the bar whether the
    // admin toolbar is present or not.
    var barsEl = document.getElementById('hdtp-bars');
    var bar = barsEl ? barsEl.querySelector('.hkust-topbar') : null;
    if (barsEl && bar && bar.offsetHeight > 0) {
      barsEl.style.setProperty('--hdtp-topbar-real', bar.offsetHeight + 'px');
    }
  };
  sync();
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', function () {
    threshold = aboutThreshold();
    sync();
  }, { passive: true });
})(window, document);


// ---------------------------------------------------------------------------
// hdtp-mobile-menu
// Two things on phones, both about the burger menu:
//   1. The panel is moved out of the header and placed directly under the top bar
//      group. Inside the header its backdrop was limited to the header's own
//      contents, so its blur could never reach the page; sitting after the bar
//      group it is in the page's root context and the blur works -- the same
//      reason the top bar and the tab bar blur correctly.
//   2. The language switch and the search button, which the header hides on the
//      narrowest phones, are collected into the menu as its last row.
// Both are confined to phones by a media query; the nodes go back where they
// belong on wider screens.
// ---------------------------------------------------------------------------
(function (window, document) {
  var MOBILE = '(max-width: 767px)';
  var ROW = 'hdtp-menu-actions-row';
  var NARROW = '(max-width: 374px)';
  var HOSTED = 'hdtp-menu-hosted';
  var mq = window.matchMedia(MOBILE);
  // The panel state starts where the theme turns the menu into a burger dropdown
  // (@media max-width: 1100px), not at the phone width: the panel has to leave the
  // header there, otherwise the header's backdrop-filter cancels the panel's own blur.
  var BURGER = '(max-width: 1100px)';
  var burger = window.matchMedia(BURGER);

  var bars = function () {
    return document.getElementById('hdtp-bars');
  };

  var hostMenu = function (on) {
    var nav = document.querySelector('#main-nav');
    var host = bars();
    if (!nav || !host || !host.parentNode) {
      return;
    }
    var header = document.querySelector('.site-header');
    var inner = header && header.querySelector('.header-inner');
    if (on) {
      if (nav.parentNode !== host.parentNode || nav.previousElementSibling !== host) {
        host.parentNode.insertBefore(nav, host.nextSibling);
      }
      nav.classList.add(HOSTED);
    } else {
      nav.classList.remove(HOSTED);
      if (inner && nav.parentNode !== inner) {
        inner.appendChild(nav);
      }
    }
  };

  var collect = function () {
    var nav = document.querySelector('#main-nav');
    var list = nav && nav.querySelector('ul.menu, ul');
    if (!list) {
      return;
    }
    var lang = document.querySelector('.header-actions a.lang-switch');
    var search = document.querySelector('.header-actions a.search-toggle:not(.lang-switch)');
    var wanted = [lang, search].filter(Boolean);
    if (!wanted.length) {
      return;
    }
    var row = list.querySelector('.' + ROW);
    if (window.matchMedia(NARROW).matches) {
      if (!row) {
        row = document.createElement('li');
        row.className = ROW;
        list.appendChild(row);
      }
      wanted.forEach(function (node) {
        if (node.parentElement !== row) {
          row.appendChild(node);
        }
      });
    } else if (row) {
      var actions = document.querySelector('.header-actions');
      if (actions) {
        wanted.forEach(function (node) {
          if (node.parentElement === row) {
            actions.appendChild(node);
          }
        });
      }
      if (row.parentNode) {
        row.parentNode.removeChild(row);
      }
    }
  };

  var sync = function () {
    hostMenu(burger.matches);
    collect();
    follow();
  };

  // Place the panel on the bottom edge of the bar group. An absolutely positioned
  // panel cannot do this: it is the bar group's following sibling, not its
  // descendant, so percentages resolve against the viewport instead. Fixed
  // positioning plus this sync keeps it exactly under the bars as they shrink and
  // as the page scrolls.
  function follow() {
    var nav = document.querySelector('#main-nav');
    var host = bars();
    if (!nav || !host) {
      return;
    }
    if (!nav.classList.contains(HOSTED)) {
      nav.style.removeProperty('top');
      return;
    }
    // Anchor to the tab bar, not to the group: once the group pins it sits one top-bar height
    // higher, so the group's own bottom edge is no longer where the panel belongs.
    var header = host.querySelector('.site-header');
    var edge = (header || host).getBoundingClientRect().bottom;
    nav.style.setProperty('top', Math.round(edge) + 'px', 'important');
    // The panel and its rows carry no side padding of their own: the list holds the side
    // inset, read from the tab bar itself, so the rows sit on the same edge as the HKUST
    // logo and keep following it. These are the home page's own figures, applied on every
    // page so the menu looks and lines up the same everywhere.
    var inner = header && header.querySelector('.header-inner');
    var list = nav.querySelector('ul.menu') || nav.querySelector('ul');
    if (inner && list) {
      var ic = getComputedStyle(inner);
      nav.style.setProperty('padding-inline', '0', 'important');
      list.style.setProperty('padding-left', ic.paddingLeft, 'important');
      list.style.setProperty('padding-right', ic.paddingRight, 'important');
      var links = list.querySelectorAll('a');
      for (var i = 0; i < links.length; i++) {
        links[i].style.setProperty('padding-inline', '0', 'important');
        links[i].style.setProperty('padding-top', '0.72rem', 'important');
        links[i].style.setProperty('padding-bottom', '0.72rem', 'important');
      }
      var row = nav.querySelector('li.hdtp-menu-actions-row');
      if (row) {
        row.style.setProperty('padding-left', ic.paddingLeft, 'important');
        row.style.setProperty('padding-right', ic.paddingRight, 'important');
        row.style.setProperty('--hdtp-row-inset', ic.paddingLeft, 'important');
        var rlinks = row.querySelectorAll('a');
        for (var j = 0; j < rlinks.length; j++) {
          rlinks[j].style.setProperty('padding-inline', '0', 'important');
        }
      }
    }
  }

  if (mq.addEventListener) {
    mq.addEventListener('change', sync);
  } else if (mq.addListener) {
    mq.addListener(sync);
  }
  if (burger.addEventListener) {
    burger.addEventListener('change', sync);
  } else if (burger.addListener) {
    burger.addListener(sync);
  }
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('scroll', follow, { passive: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }
})(window, document);
