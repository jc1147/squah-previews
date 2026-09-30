/* blog.js: the blog pages (M15: the Resources section, /resources/ and /resources/<slug>/), loaded only by them. Every page is complete without it.
   - The reading-progress bar: browsers with CSS scroll timelines fill it in blog.css; elsewhere this sets its width.
   - The table of contents marks the section being read (both the sticky list and the phone drawer), and the phone drawer
     folds again after a link in it is followed.
   No network request, no cookie, no storage. */
(function () {
  'use strict';
  var bar = document.querySelector('.bx-progress__bar');
  var css = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');
  if (bar && !css) {
    var queued = false;
    var paint = function () {
      queued = false;
      var de = document.documentElement;
      var max = de.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.setProperty('--bx-p', p.toFixed(4));
    };
    var ask = function () { if (!queued) { queued = true; window.requestAnimationFrame(paint); } };
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    paint();
  }

  var heads = Array.prototype.slice.call(document.querySelectorAll('.bx-prose h2[id], .bx-prose section[id] > h2'));
  var links = Array.prototype.slice.call(document.querySelectorAll('.bx-toc a[href^="#"]'));
  if (heads.length && links.length && 'IntersectionObserver' in window) {
    var idOf = function (h) { return h.id && !/-h$/.test(h.id) ? h.id : h.parentElement.id; };
    var mark = function (id) {
      links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + id); });
    };
    var io = new IntersectionObserver(function () {
      // the last heading above the reading line wins
      var current = null;
      heads.forEach(function (h) { if (h.getBoundingClientRect().top < window.innerHeight * 0.35) current = idOf(h); });
      if (current) mark(current);
    }, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
    heads.forEach(function (h) { io.observe(h); });
  }

  var drawer = document.querySelector('.bx-toc--drawer');
  if (drawer) drawer.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('a[href^="#"]')) drawer.open = false;
  });
})();
