/* =============================================================================
 * site.js — CANONICAL shared motion + chrome behavior for every client page.
 * Single source of truth: mobile-drawer toggle + scroll-reveal/stagger
 * (toggles .in-view) + count-up stats + subtle parallax.
 * Loaded via <script src="design-system/site.js" defer> on every page.
 * Null-safe: the drawer block is skipped on pages with no hamburger/drawer.
 * Targets the CANONICAL shared-chrome classes (.site-header__hamburger /
 * #mobile-drawer / .site-drawer-backdrop / .site-drawer__close) injected
 * identically on every page from _chrome.html.
 * All motion respects prefers-reduced-motion.
 *
 * ABOVE-THE-FOLD FIX (canonical): an IntersectionObserver does NOT reliably
 * (and on some loads does not at all) emit an entry for an element that is
 * ALREADY intersecting at first paint on a no-scroll load. structural.css
 * defaults .wow-reveal / .wow-stagger > * to opacity:0, un-hidden only when
 * .in-view is added, and .stat__num count-ups start at 0. So on a normal
 * (no-scroll) load the hero / first band could stay invisible and the stats
 * stay 0. This file does a MANUAL initial intersection check on init: any
 * reveal/stagger/count target already in OR above the viewport is revealed /
 * counted immediately, and only the rest is left to the observer. Belt-and-
 * braces: a requestAnimationFrame-deferred re-check after first layout.
 * ============================================================================= */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // True when the element's top is above the bottom of the viewport at first
  // paint — i.e. it is already in OR above the fold and must be shown on a
  // no-scroll load. Tolerant +1px so an element flush at the fold counts.
  function inOrAboveFold(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh + 1;
  }

  // ---- mobile drawer toggle (aria-expanded on hamburger + aria-hidden on drawer) ----
  // Skip when a page already wired the drawer inline (homepage carries its own
  // inline drawer script; this guard prevents a double-bind that would toggle twice).
  var alreadyWired = document.documentElement.getAttribute('data-drawer-wired') === '1';
  var hamburger = alreadyWired ? null : document.querySelector('.site-header__hamburger');
  var drawer = document.getElementById('mobile-drawer');
  var backdrop = document.querySelector('.site-drawer-backdrop');
  var closeBtn = document.querySelector('.site-drawer__close');
  function setDrawer(open) {
    hamburger.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
    if (backdrop) backdrop.setAttribute('data-open', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (hamburger && drawer) {
    hamburger.addEventListener('click', function () {
      var open = hamburger.getAttribute('aria-expanded') === 'true';
      setDrawer(!open);
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
    if (backdrop) backdrop.addEventListener('click', function () { setDrawer(false); });
    drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });
  }

  // ---- scroll-reveal + stagger (toggles .in-view) ----
  var revealTargets = document.querySelectorAll('.wow-reveal, .wow-stagger');
  if (reduce || !hasIO) {
    // Reduced-motion or no IO support: reveal everything immediately.
    revealTargets.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in-view'); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    // (a) MANUAL initial intersection: reveal anything already in/above the
    //     viewport at first paint so a no-scroll load is never blank above fold.
    // (b) observe the rest for on-scroll reveal.
    revealTargets.forEach(function (el) {
      if (inOrAboveFold(el)) { el.classList.add('in-view'); }
      else { io.observe(el); }
    });
    // Belt-and-braces: re-run the initial check after first layout settles,
    // in case fonts/images shifted an element into the fold post-paint.
    requestAnimationFrame(function () {
      revealTargets.forEach(function (el) {
        if (!el.classList.contains('in-view') && inOrAboveFold(el)) {
          el.classList.add('in-view'); io.unobserve(el);
        }
      });
    });
  }

  // ---- count-up stats ----
  function animateCount(el) {
    if (el.getAttribute('data-counted') === '1') return;
    el.setAttribute('data-counted', '1');
    var raw = el.getAttribute('data-count');
    var target = parseFloat(raw) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (String(raw).split('.')[1] || '').length;
    // EXACT final string the animation MUST land on (snap target). Computed
    // once so the last frame is value-identical to data-count, never a rounded
    // intermediate (fixes 184≠183 / 4000≠3973: the final frame == data-count).
    var finalText = target.toFixed(decimals) + suffix;
    if (reduce) { el.textContent = finalText; return; }
    var dur = 1500, start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      if (p >= 1) { el.textContent = finalText; return; } // snap to exact target; do NOT schedule another frame
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counts = document.querySelectorAll('.stat__num[data-count]');
  if (reduce || !hasIO) {
    counts.forEach(animateCount);
  } else {
    // SCROLLED-PAST FIX: a count IO that only fires while the element is
    // intersecting freezes any stat the viewport jumps PAST without settling on
    // (a fast user scroll, OR a multi-band page where a programmatic scroll to a
    // later band leaves an earlier band scrolled far above the fold). On every IO
    // callback animate the target if it is intersecting OR has already been
    // reached/passed (its top is above the bottom of the viewport). threshold:0
    // so the callback fires the instant any pixel enters AND when it leaves the
    // top — either delivery animates it. Belt-and-braces with the initial check.
    var cio = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting || inOrAboveFold(entry.target)) {
          animateCount(entry.target); obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0 });
    // MANUAL initial check: any count already in/above the fold animates now
    // (otherwise above-the-fold stats stay frozen at 0 on a no-scroll load).
    counts.forEach(function (el) {
      if (inOrAboveFold(el)) { animateCount(el); }
      else { cio.observe(el); }
    });
    // Belt-and-braces (mirrors the reveal re-check): after first layout settles,
    // animate any not-yet-counted stat that is now in/above the fold.
    requestAnimationFrame(function () {
      counts.forEach(function (el) {
        if (el.getAttribute('data-counted') !== '1' && inOrAboveFold(el)) {
          animateCount(el); cio.unobserve(el);
        }
      });
    });
    // SCROLL-DRIVEN SWEEP: an IntersectionObserver does NOT deliver a callback for
    // an element the viewport JUMPS PAST in a single frame (an instant scrollIntoView
    // to a later band, or a flung scroll), so a stat scrolled far above the fold can
    // stay observed-but-never-fired (frozen at 0). On every scroll, animate any
    // not-yet-counted stat now in OR above the fold — the reliable catch the IO
    // can't guarantee. rAF-throttled; self-removes once all counts have fired.
    var countTick = false;
    function sweepCounts() {
      countTick = false;
      var remaining = 0;
      counts.forEach(function (el) {
        if (el.getAttribute('data-counted') === '1') return;
        if (inOrAboveFold(el)) { animateCount(el); cio.unobserve(el); }
        else remaining++;
      });
      if (remaining === 0) window.removeEventListener('scroll', onCountScroll);
    }
    function onCountScroll() {
      if (countTick) return;
      countTick = true;
      requestAnimationFrame(sweepCounts);
    }
    window.addEventListener('scroll', onCountScroll, { passive: true });
  }

  // ---- subtle parallax (transform on .wow-parallax; rAF-throttled) ----
  if (!reduce) {
    var px = document.querySelectorAll('.wow-parallax');
    if (px.length) {
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          px.forEach(function (el) {
            var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
            el.style.transform = 'translateY(' + (y * speed) + 'px)';
          });
          ticking = false;
        });
      }, { passive: true });
    }
  }
})();
