(function (window, document) {
  'use strict';
  var SELECTORS = ['article.ax-page .ax-sources li', 'article.ax-page h2', 'article.ax-page h3', 'article.ax-page h4', 'article.ax-page p', 'article.ax-page li:not(:has(h2, h3, h4, p, figure, blockquote))', 'article.ax-page figure', 'article.ax-page figcaption', 'article.ax-page blockquote'];
  var MARK = 'axRevealInit';
  function run() {
    var targets = [];
    Array.prototype.forEach.call(document.querySelectorAll(SELECTORS.join(',')), function (el) {
      if (!el.dataset || el.dataset[MARK]) {
        return;
      }
      el.dataset[MARK] = '1';
      el.classList.add('reveal');
      var group = el.parentElement;
      var index = group ? Array.prototype.indexOf.call(group.children, el) : 0;
      if (index > 0) {
        el.style.transitionDelay = (Math.min(index, 6) * 0.07).toFixed(2) + 's';
      }
      targets.push(el);
    });
    if (!targets.length) {
      return;
    }
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    targets.forEach(function (el) { observer.observe(el); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  }
  else {
    run();
  }
})(window, document);
