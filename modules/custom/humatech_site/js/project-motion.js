/**
 * @file
 * Reveal motion for the project showcase pages.
 *
 * The showcase templates lay their blocks out on a grid and mark them; this
 * behaviour walks them in once the page is scrolled, in Drupal's own attach
 * cycle so it also covers content loaded later (views, AJAX).
 */

(function (Drupal, once) {
  'use strict';

  var SELECTOR = [
    '.sh-reveal',
    '.sh-passage',
    '.sh-plate',
    '.sh-dim',
    '.sh-rose',
    '.doc-layer',
    '.doc-layer-plate',
    '.doc-legend',
    '.pos-piece',
    '.pos-chapter',
    '.pos-band',
    '.pos-billboard',
    '.pos-ticker li'
  ].join(',');

  Drupal.behaviors.hdtpProjectMotion = {
    attach: function (context) {
      if (!('IntersectionObserver' in window)) {
        return;
      }

      once('hdtp-project-motion', '.project-page', context).forEach(function (page) {
        page.setAttribute('data-motion', 'on');

        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in');
              observer.unobserve(entry.target);
            }
          });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });

        Array.prototype.forEach.call(page.querySelectorAll(SELECTOR), function (item, index) {
          item.style.transitionDelay = ((index % 4) * 70) + 'ms';
          observer.observe(item);
        });
      });
    }
  };
})(Drupal, once);
