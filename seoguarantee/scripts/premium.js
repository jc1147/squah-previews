/* premium.js: the M7 pages (/results/, /results/<slug>/, /about/, /our-team/), loaded only by them.
   - Count-ups: each [data-count] number is already final in the HTML, so the page is complete without JavaScript. When
     one scrolls into view it counts up from 0 and ends on the exact text it started with. Nothing moves under
     prefers-reduced-motion, and a number that is never seen keeps its final text.
   - Before / after: each [data-compare] figure shows its two images side by side in the HTML; here it becomes one frame
     with a draggable gold handle (a range input, so it works with a mouse, a finger and the arrow keys).
   No network request, no cookie, no storage. */
(function () {
  'use strict';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function countUp(el) {
    var end = parseInt(el.getAttribute('data-count'), 10);
    if (!(end > 0) || el.getAttribute('data-counted')) return;
    el.setAttribute('data-counted', '1');
    var finalText = el.textContent;
    var suffix = finalText.replace(/^[\d,]+/, '');
    var start = null;
    var dur = end > 50 ? 1600 : 1100;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? String(Math.round(end * eased)) + suffix : finalText;
      if (p < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  var counts = document.querySelectorAll('[data-count]');
  if (!reduce && counts.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { io.unobserve(en.target); countUp(en.target); }
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(counts, function (el) { io.observe(el); });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-compare]'), function (fig) {
    var stage = fig.querySelector('.rx-compare__stage');
    var range = fig.querySelector('.rx-compare__range');
    if (!stage || !range) return;
    range.hidden = false;
    fig.classList.add('is-live');
    var set = function () { stage.style.setProperty('--pos', range.value + '%'); };
    range.addEventListener('input', set);
    set();
  });
})();
