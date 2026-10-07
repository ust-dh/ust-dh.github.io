(function (window, document) {
  'use strict';
  var SELECTORS = ['article.ed-page h2', 'article.ed-page h3', 'article.ed-page h4',
    'article.ed-page p', 'article.ed-page li:not(:has(h2, h3, h4, p, figure, blockquote))',
    'article.ed-page figure', 'article.ed-page figcaption', 'article.ed-page blockquote',
    'article.ed-page .ed-plate', 'article.ed-page .ed-figure'];
  var MARK = 'edRevealInit';
  function run() {
    var targets = [];
    Array.prototype.forEach.call(document.querySelectorAll(SELECTORS.join(',')), function (el) {
      if (!el.dataset || el.dataset[MARK]) { return; }
      el.dataset[MARK] = '1';
      el.classList.add('reveal');
      var group = el.parentElement;
      var index = group ? Array.prototype.indexOf.call(group.children, el) : 0;
      if (index > 0) { el.style.transitionDelay = (Math.min(index, 6) * 0.07).toFixed(2) + 's'; }
      targets.push(el);
    });
    if (!targets.length) { return; }
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
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', run); }
  else { run(); }
})(window, document);
