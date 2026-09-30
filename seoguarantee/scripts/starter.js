/* ============================================================
   Starter-test programme pages: Step-1 qualifier behaviour.
   Loaded only by pages build/gen-starter.mjs writes. No dependencies.
   Without JS the forms stay rendered; the site's noscript style hides
   their controls and a short "turn on JavaScript" note shows.
   ============================================================ */
(function () {
  'use strict';

  // G2 round 4 fixer (audits L-06 / D1 and D2): the phone sticky START HERE bar is parked (.is-parked,
  // starter.css) while the hero's own START HERE is at least half on screen (on the first phone screen the two
  // identical gold buttons stacked 40px apart) and while the playing video is on screen (the fixed bar covered
  // the player's controls). Without IntersectionObserver the bar behaves as before.
  // G2 round 5 (programme chrome): the footer's own Start Here button (the repo footer's button slot) parks the
  // bar too while any of it is on screen, so the two identical asks never stack at the foot of the page.
  // G2 round 5 fixer (audit D6): the WANT OUR SEO GUARANTEES? band's own START HERE parks the bar too while any of it
  // is on screen, and so does the open phone menu (its own full-width START HERE sat above the still-visible bar).
  // H2 gate work (render-pilots R26, 360-768px, where the bar is one compact floating button with no background of
  // its own): the floating button also parks while the hero video is on screen AT REST (on the
  // first phone screen it sat on the poster and its play button: render-pilots R26 found it at 360, 390, 414 and 768)
  // and while any other Start Here of the page body is on screen (the "Still deciding?" card's Start here, which it
  // overlapped at 360, 390 and 768), so the button never covers the video and never stacks on another Start Here.
  // M15 (audit Y1): the button also parks while a Step 1 form (form.step1: the page's own and its closing band's) is on
  // screen, or within FORM_MARGIN below it so the button is gone before the form scrolls up under it, and while focus is
  // inside one, so it never covers the form's fields or its Submit button. The bar is hidden above 768px (starter.css),
  // so none of this changes a wider screen.
  var FORM_MARGIN = '0px 0px 120px 0px';
  var park = { hero: false, video: false, foot: false, band: false, menu: false, form: false, focus: false, bar: null, videoObs: null, videoSeen: null };
  function applyPark() { if (park.bar) park.bar.classList.toggle('is-parked', park.hero || park.video || park.foot || park.band || park.menu || park.form || park.focus); }
  function syncFormFocus() {
    var a = document.activeElement;
    park.focus = Boolean(a && a.closest && a.closest('form.step1'));
    applyPark();
  }
  function setupPark() {
    park.bar = document.querySelector('.sticky-cta');
    if (!park.bar) return;
    var toggle = document.querySelector('.nav-toggle');
    if (toggle && 'MutationObserver' in window) {
      var syncMenu = function () { park.menu = toggle.getAttribute('aria-expanded') === 'true'; applyPark(); };
      new MutationObserver(syncMenu).observe(toggle, { attributes: true, attributeFilter: ['aria-expanded'] });
      syncMenu();
    }
    // Focus inside a Step 1 form (read once the focus change is complete, so a move between two fields never shows the bar).
    document.addEventListener('focusin', syncFormFocus);
    document.addEventListener('focusout', function () { setTimeout(syncFormFocus, 0); });
    syncFormFocus();
    if (!('IntersectionObserver' in window)) return;
    var steps = document.querySelectorAll('form.step1');
    if (steps.length) {
      var stepSeen = new Map();
      var stepObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { stepSeen.set(e.target, e.isIntersecting); });
        park.form = false;
        stepSeen.forEach(function (v) { if (v) park.form = true; });
        applyPark();
      }, { rootMargin: FORM_MARGIN });
      Array.prototype.forEach.call(steps, function (f) { stepObs.observe(f); });
    }
    // Every Start Here of the page body except the hero's (the hero's own rule is below): the band's and the FAQ card's.
    var bandBtns = Array.prototype.filter.call(document.querySelectorAll('main a[data-qualify-open]'), function (a) { return !a.closest('.hero__actions'); });
    if (bandBtns.length) {
      var bandSeen = new Map();
      var bandObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { bandSeen.set(e.target, e.isIntersecting); });
        park.band = false;
        bandSeen.forEach(function (v) { if (v) park.band = true; });
        applyPark();
      });
      Array.prototype.forEach.call(bandBtns, function (b) { bandObs.observe(b); });
    }
    var heroBtn = document.querySelector('.hero__actions a[href="#step-1"]');
    if (heroBtn) {
      new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        park.hero = e.isIntersecting && e.intersectionRatio >= 0.5;
        applyPark();
      }, { threshold: [0, 0.5, 1] }).observe(heroBtn);
    }
    var footBtn = document.querySelector('.site-footer a[href="#step-1"]');
    if (footBtn) {
      new IntersectionObserver(function (entries) {
        park.foot = entries[entries.length - 1].isIntersecting;
        applyPark();
      }).observe(footBtn);
    }
    // The video frame: the poster facade at rest, then the player that replaces it (one state per observed element).
    park.videoSeen = new Map();
    park.videoObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (park.videoSeen.has(e.target)) park.videoSeen.set(e.target, e.isIntersecting); });
      park.video = false;
      park.videoSeen.forEach(function (v) { if (v) park.video = true; });
      applyPark();
    });
    var facade = document.querySelector('main button[data-video-facade]');
    if (facade) { park.videoSeen.set(facade, false); park.videoObs.observe(facade); }
  }

  // G2 round 5 fixer (the video plays in the page, never through an outside link): the hero
  // poster is a <button> (data-video-src = the site's own video file). A click swaps it for ONE
  // <video controls autoplay playsinline> of that file in the same frame and starts it; no link leaves the page and
  // nothing is requested before the click. Without JavaScript the page's <noscript> <video> plays the same file.
  var VIDEO_SRC = /^\/assets\/media\/[0-9a-f]{8}-[a-z0-9-]+\.mp4$/;
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button[data-video-facade]') : null;
    if (!b || e.defaultPrevented) return;
    var src = b.getAttribute('data-video-src') || '';
    if (!VIDEO_SRC.test(src)) return;
    e.preventDefault();
    var img = b.querySelector('img');
    var video = document.createElement('video');
    video.src = src;
    if (img && img.getAttribute('src')) video.poster = img.getAttribute('src');
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.title = b.getAttribute('data-embed-title') || 'Video';
    var box = document.createElement('div');
    box.className = 'video-embed';
    box.setAttribute('data-video-embed', '');
    box.appendChild(video);
    // Below 1081px the hero visual is a centred, shrink-to-fit box (components.css: max-width 520px,
    // margin-inline auto); the poster gave it its width, the player box does not, so it is set explicitly.
    var visual = b.closest ? b.closest('.hero__visual') : null;
    if (visual) visual.classList.add('is-playing');
    b.parentNode.replaceChild(box, b);
    // G2 round 4 fixer (audit D2): park the sticky bar at once and for as long as the player is on screen.
    if (park.bar) {
      park.video = true; applyPark();
      if (park.videoObs) { park.videoObs.unobserve(b); park.videoSeen.delete(b); park.videoSeen.set(box, true); park.videoObs.observe(box); }
    }
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* the controls stay; one more tap plays */ });
    try { video.focus(); } catch (err) { /* focus is a courtesy */ }
  });

  /* @release-strip:start forms-not-connected
     M14 (plan ruling 12): build/build-release.mjs removes everything from this line to the matching end marker in the
     launch release, where every form posts to /api/contact (the Cloudflare Pages function). The preview keeps it. */
  // G2 round 4: the shared app.js answers a submit on forms without a backend as well; on these pages this
  // capture-phase handler answers first and stops the event before app.js's own listener on the form runs.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.hasAttribute || !form.hasAttribute('data-step1')) return;
    e.preventDefault();
    e.stopPropagation();
    var note = form.querySelector('[data-endpoint-note]');
    if (!note) {
      note = document.createElement('p');
      note.className = 'form-note';
      note.setAttribute('data-endpoint-note', '');
      note.setAttribute('role', 'status');
      form.appendChild(note);
    }
    note.textContent = 'This preview form is not connected yet, so nothing was sent.';
    note.style.color = 'var(--gold-200)';
  }, true);
  /* @release-strip:end forms-not-connected */

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // "What is your Website Address?" shows, and is required, only after "Yes"
  // (the live form's conditional logic).
  function sync(form) {
    var yes = form.querySelector('input[name="has_website"][value="yes"]');
    var box = form.querySelector('[data-if-website]');
    if (!yes || !box) return;
    box.hidden = !yes.checked;
    var input = box.querySelector('input');
    if (input) input.required = yes.checked;
  }

  function open(form, answer) {
    if (answer) {
      var radio = form.querySelector('input[name="has_website"][value="' + answer + '"]');
      if (radio) radio.checked = true;
    }
    sync(form);
    form.classList.add('is-active');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    var first = form.querySelector('input[name="name"]');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  }

  // M15 (audit Y2): a Start Here inside the open phone menu closes the menu first (as app.js closes it on a tap
  // outside it or on Escape), so the form it opens is not left under the menu panel.
  function closeMenu() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.nav');
    if (!toggle || !(toggle.getAttribute('aria-expanded') === 'true' || (nav && nav.classList.contains('is-open')))) return;
    toggle.setAttribute('aria-expanded', 'false');
    if (nav) nav.classList.remove('is-open');
  }

  // M15 (audit Y2): arriving at #step-1, the browser's own jump to the fragment runs after open() and takes focus
  // back off the name field (the form element itself cannot take focus, so the focus is cleared). Once the page has
  // loaded and the scroll has come to rest (SETTLE_FRAMES frames at one position, at most SETTLE_MAX_MS), the name
  // field takes focus again, unless focus is already on something other than the page itself.
  var SETTLE_FRAMES = 10, SETTLE_MAX_MS = 4000;
  function focusWhenSettled(form) {
    var first = form.querySelector('input[name="name"]');
    if (!first || !window.requestAnimationFrame) return;
    var start = function () {
      var lastY = null, still = 0, t0 = Date.now();
      var tick = function () {
        var y = window.pageYOffset;
        still = y === lastY ? still + 1 : 0;
        lastY = y;
        if (still < SETTLE_FRAMES && Date.now() - t0 < SETTLE_MAX_MS) { window.requestAnimationFrame(tick); return; }
        var a = document.activeElement;
        if (a && a !== document.body && a !== document.documentElement) return;
        try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      };
      window.requestAnimationFrame(tick);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
  }

  ready(function () {
    setupPark();

    // On phones the breadcrumb is one scrollable row that starts at "Home"; a CSS
    // fade on its right edge shows there is more. It is not auto-scrolled to its
    // end: that left the first crumb cut mid-word at rest (G2 review).

    var forms = document.querySelectorAll('form[data-step1]');
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener('change', function (e) {
        if (e.target && e.target.name === 'has_website') sync(form);
      });
      sync(form);
    });

    // YES I DO / NO I DON'T, the hero START HERE and the sticky bar all open the
    // Step-1 form in place.
    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a[href^="#step-1"]') : null;
      if (!link) return;
      var form = document.getElementById(link.getAttribute('href').slice(1));
      if (!form || !form.hasAttribute('data-step1')) return;
      e.preventDefault();
      closeMenu();
      open(form, link.getAttribute('data-qualify'));
    });

    // Arriving on the page with #step-1 in the address opens the form too, and its name field takes focus once the
    // page has settled.
    if (location.hash === '#step-1') {
      var f = document.getElementById('step-1');
      if (f) { open(f, null); focusWhenSettled(f); }
    }

    // G2 round 2: a derived-figure marker (dagger) links to #sources, a collapsed
    // <details>. Following one opens the block so the method is readable at once;
    // without JS the link still lands on the block and its summary opens it.
    var sources = document.getElementById('sources');
    function openSources() {
      if (sources && sources.tagName === 'DETAILS' && !sources.open) sources.open = true;
    }
    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a[href="#sources"]') : null;
      if (link) openSources();
    });
    window.addEventListener('hashchange', function () { if (location.hash === '#sources') openSources(); });
    if (location.hash === '#sources') openSources();

    // G2 round 3 fixer (audits N-15, V09): on phones the proof list folds after four cards (CSS,
    // .js .pcards.is-folded); "Show N more results" unfolds it and moves focus to the first card it
    // revealed. Without JS nothing is folded and the button stays hidden. G2 round 4 (R4): the
    // A-SPECIALTIES list folds the same way behind its "Show all ..." button (data-fold-more).
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-proof-more], [data-fold-more]') : null;
      if (!btn) return;
      var list = document.getElementById(btn.getAttribute('aria-controls') || '');
      if (!list) return;
      var n = parseInt(list.getAttribute('data-phone-show') || '0', 10);
      list.classList.remove('is-folded');
      btn.setAttribute('aria-expanded', 'true');
      var next = list.children[n];
      if (next) {
        next.setAttribute('tabindex', '-1');
        try { next.focus({ preventScroll: true }); } catch (err) { next.focus(); }
      }
    });
  });
})();
