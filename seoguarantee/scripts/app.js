/* ============================================================
   SEO Guarantee — interaction layer
   No dependencies. Everything degrades to a working page if this
   file never loads: CSS only hides revealable content under .js,
   which is set here.
   ============================================================ */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var isReduced = function () { return reduced.matches; };

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    /* ---- scroll reveal ----
       Revealable content starts at opacity:0, so anything that stops this
       from running leaves the page blank. Three guards make that impossible:
         1. above-the-fold content is revealed immediately, not on observation;
         2. a failsafe timer reveals everything if the observer never fires
            (IntersectionObserver is suspended in a background tab, so a page
            opened in one and later focused would otherwise stay empty);
         3. becoming visible re-runs the sweep.
       The animation is a bonus; being readable is not. */
    var revealables = document.querySelectorAll('[data-reveal], [data-stagger]');
    var revealAll = function () {
      revealables.forEach(function (el) { el.classList.add('is-in'); });
    };

    if (!('IntersectionObserver' in window) || isReduced()) {
      revealAll();
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

      revealables.forEach(function (el) {
        // 1. anything already on screen is shown without waiting
        var r = el.getBoundingClientRect();
        if (r.top < (window.innerHeight || 0)) { el.classList.add('is-in'); return; }
        io.observe(el);
      });

      // 2. failsafe — never leave content permanently invisible
      setTimeout(revealAll, 2500);

      // 3. a tab that was hidden at load gets a fresh pass when shown
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          requestAnimationFrame(function () {
            revealables.forEach(function (el) {
              if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
            });
          });
        }
      });
    }

    /* ---- sticky header state ---- */
    var header = document.querySelector('.site-header');
    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-stuck', window.scrollY > 24);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ---- mobile nav ---- */
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        nav.classList.toggle('is-open', !open);
      });
      // submenus expand in place on small screens
      nav.querySelectorAll('.nav__item--has-menu > .nav__link').forEach(function (link) {
        link.addEventListener('click', function (e) {
          if (window.innerWidth > 1140) return;
          e.preventDefault();
          link.parentElement.classList.toggle('is-open');
        });
      });
      document.addEventListener('click', function (e) {
        if (window.innerWidth > 1140) return;
        if (nav.contains(e.target) || toggle.contains(e.target)) return;
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    }

    /* ---- pointer spotlight on glass cards ---- */
    if (!isReduced() && window.matchMedia('(hover: hover)').matches) {
      document.querySelectorAll('.glass--spot').forEach(function (card) {
        card.addEventListener('pointermove', function (e) {
          var r = card.getBoundingClientRect();
          card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
      });
    }

    /* ---- parallax orbs ---- */
    var orbs = document.querySelectorAll('.orb');
    if (orbs.length && !isReduced()) {
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          orbs.forEach(function (orb, i) {
            var depth = (i + 1) * 0.045;
            orb.style.transform = 'translate3d(0,' + (y * depth) + 'px,0)';
          });
          ticking = false;
        });
      }, { passive: true });
    }

    /* ---- back to top ---- */
    var toTop = document.querySelector('.to-top');
    if (toTop) {
      var toggleTop = function () { toTop.classList.toggle('is-visible', window.scrollY > 700); };
      toggleTop();
      window.addEventListener('scroll', toggleTop, { passive: true });
      toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: isReduced() ? 'auto' : 'smooth' });
      });
    }



    /* @release-strip:start forms-not-connected
       M14 (plan ruling 12): build/build-release.mjs removes everything from this line to the matching end marker in the
       launch release, where every form posts to /api/contact (the Cloudflare Pages function). The preview keeps it. */
    /* ---- forms without a backend ----
       This is a static build: POSTing to a static host returns 405. Rather
       than ship a button that errors, submission is intercepted and the
       visitor is pointed at the phone number. Wire /api/contact to a real
       handler and delete this block (see docs/DEPLOY.md). */
    document.querySelectorAll('form[data-needs-endpoint]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var note = form.querySelector('[data-endpoint-note]');
        if (!note) {
          note = document.createElement('p');
          note.className = 'form-note';
          note.setAttribute('data-endpoint-note', '');
          note.setAttribute('role', 'status');
          form.appendChild(note);
        }
        // M3 (owner, G2 round 4: "No call to actions for phone calls please."): no call ask, the same answer the
        // programme pages give (src/scripts/starter.js). The launch build switches this interceptor off.
        note.textContent = 'This form is not connected yet, so nothing was sent.';
        note.style.color = 'var(--gold-200)';
      });
    });
    /* @release-strip:end forms-not-connected */

    /* ---- the video FAQ (M3; owner, 2026-09-27: "Yes, use all 17") ----
       Each poster is a <button data-faq-video> holding the site's own MP4 (data-video-src). A click swaps it for ONE
       <video controls autoplay playsinline> of that file in the same frame and starts it; any other FAQ video that is
       playing pauses. Nothing is requested before the click, nothing loads from YouTube and no link leaves the page.
       Without JavaScript the <noscript> <video> of the same file shows instead. */
    var FAQ_SRC = /^\/assets\/media\/[0-9a-f]{8}-[a-z0-9-]+\.mp4$/;
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-faq-video]') : null;
      if (!b || e.defaultPrevented) return;
      var src = b.getAttribute('data-video-src') || '';
      if (!FAQ_SRC.test(src)) return;
      e.preventDefault();
      Array.prototype.forEach.call(document.querySelectorAll('.faqvid__frame video'), function (v) { try { v.pause(); } catch (err) { /* nothing to pause */ } });
      var img = b.querySelector('img');
      var video = document.createElement('video');
      video.src = src;
      if (img && img.getAttribute('src')) video.poster = img.getAttribute('src');
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'auto');
      video.title = (b.getAttribute('aria-label') || 'Video').replace(/^Play the video: /, '');
      b.parentNode.replaceChild(video, b);
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* the controls stay; one more tap plays */ });
      try { video.focus(); } catch (err) { /* focus is a courtesy */ }
    });

    /* ---- reviews: seamless loop, with every review still in the DOM ----
       The track is duplicated so the animation can translate -50% and wrap
       without a visible seam. The duplicate is aria-hidden and its content is
       removed from the accessibility tree, so screen readers and crawlers see
       each review exactly once. "See all reviews" swaps the loop for a grid. */
    document.querySelectorAll('[data-reviews]').forEach(function (box) {
      var track = box.querySelector('.reviews__track');
      if (!track) return;
      var count = track.children.length;
      if (!count) return;

      // pace the loop by content length so it always reads at the same speed
      var seconds = Math.max(40, count * 4.5);
      box.style.setProperty('--reviews-duration', seconds + 's');

      if (!track.dataset.cloned) {
        track.dataset.cloned = '1';
        var clone = track.cloneNode(true);
        Array.prototype.forEach.call(clone.children, function (el) {
          el.setAttribute('aria-hidden', 'true');
        });
        while (clone.firstChild) track.appendChild(clone.firstChild);
      }
      box.classList.add('is-looping');

      var btn = box.parentElement.querySelector('[data-reviews-all]');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var open = box.classList.toggle('is-expanded');
        box.classList.toggle('is-looping', !open);
        btn.setAttribute('aria-expanded', String(open));
        btn.textContent = open ? btn.dataset.labelLess : btn.dataset.labelMore;
        // in the grid the duplicated set would show every review twice
        Array.prototype.forEach.call(track.children, function (el) {
          if (el.getAttribute('aria-hidden') === 'true') el.hidden = open;
        });
      });
    });
    /* ---- marquee: duplicate the track so the loop is seamless ---- */
    document.querySelectorAll('.marquee__track').forEach(function (track) {
      if (track.dataset.cloned) return;
      track.dataset.cloned = '1';
      track.innerHTML += track.innerHTML;
    });
  });
})();
