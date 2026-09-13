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
    // FOCUS-TRAP + scroll-lock for the ported gold drawer: keep Tab inside the open
    // drawer and lock body scroll via the .mm-no-scroll class (structural.css owns the
    // overflow:hidden). Null-guarded — a page with no drawer never reaches here.
    document.addEventListener('keydown', function (e) {
      if (drawer.getAttribute('aria-hidden') !== 'false') return; // only while open
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(drawer.querySelectorAll('a[href], button:not([disabled])'))
        .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // mirror the scroll-lock class onto <body> whenever the drawer opens/closes
    var lockObserver = new MutationObserver(function () {
      document.body.classList.toggle('mm-no-scroll', drawer.getAttribute('aria-hidden') === 'false');
    });
    lockObserver.observe(drawer, { attributes: true, attributeFilter: ['aria-hidden'] });
  }

  // =====================================================================
  // SCROLL-GLASS + STICKY-CTA REVEAL (ported gold chrome behavior)
  // The header turns glassy past a small scroll, and the mobile bottom
  // .mm-sticky-cta bar reveals past the fold. Null-guarded: a page without
  // either element simply does nothing.
  // =====================================================================
  var hdr = document.getElementById('site-header') || document.querySelector('.site-header');
  var stickyBar = document.getElementById('mm-sticky-cta') || document.querySelector('.mm-sticky-cta');
  if (hdr || stickyBar) {
    var onChromeScroll = function () {
      var y = window.scrollY || window.pageYOffset || 0;
      if (hdr) hdr.classList.toggle('scrolled', y > 24);
      if (stickyBar) stickyBar.classList.toggle('show', y > 480);
    };
    window.addEventListener('scroll', onChromeScroll, { passive: true });
    onChromeScroll();
  }

  // =====================================================================
  // DESKTOP GROUPED NAV — dropdown + mega-menu disclosure (ported gold)
  // Open on HOVER (CSS :hover on the li + a JS .is-open mirror so a pointer
  // that LEAVES keeps the panel open for a short close DELAY, defeating the
  // trigger→panel dead-gap — the .mm-panel::after hover-bridge spans it). Also
  // opens on click / keyboard. Keyboard: Enter/Space/ArrowDown opens + moves
  // into the panel; ArrowUp/Down/Home/End cycle items; Esc closes to trigger;
  // Tab + click-outside + blur-out close. Focus is managed into/out of the panel.
  // NULL-GUARDED: a page with no .mm-has-panel group skips this whole block.
  // =====================================================================
  var groups = Array.prototype.slice.call(document.querySelectorAll('.mm-has-panel'));
  if (groups.length) {
    var HOVER_CLOSE_DELAY = 240; // ms — keeps the menu open across a quick diagonal move
    var panelOf = function (group) { return group.querySelector('.mm-panel'); };
    var triggerOf = function (group) { return group.querySelector('.mm-trigger'); };
    var itemsOf = function (group) {
      var p = panelOf(group);
      if (!p) return [];
      // [BY] Only RENDERED links. The Locations cascade keeps five of its six panes
      // hidden at any moment; without this filter ArrowUp/Down would step onto a link
      // inside a display:none pane, .focus() would silently do nothing, and keyboard
      // focus would be stranded mid-menu. Panels whose content is all visible — Services,
      // Licensing — are unaffected, since every link passes the filter.
      return Array.prototype.slice.call(p.querySelectorAll('a[href]')).filter(function (a) {
        return a.offsetParent !== null || a.getClientRects().length > 0;
      });
    };
    var closeGroup = function (group, focusTrigger) {
      if (!group.classList.contains('is-open')) return;
      group.classList.remove('is-open');
      var t = triggerOf(group); if (t) t.setAttribute('aria-expanded', 'false');
      if (focusTrigger && t) t.focus();
    };
    var closeAllGroups = function (except) {
      groups.forEach(function (g) { if (g !== except) closeGroup(g, false); });
    };
    var openGroup = function (group, focusFirst) {
      closeAllGroups(group);
      group.classList.add('is-open');
      var t = triggerOf(group); if (t) t.setAttribute('aria-expanded', 'true');
      if (focusFirst) { var items = itemsOf(group); if (items.length) items[0].focus(); }
    };

    groups.forEach(function (group) {
      var trigger = triggerOf(group);
      var panel = panelOf(group);
      if (!trigger || !panel) return; // malformed group — skip safely
      var items = itemsOf(group);
      var closeTimer = null;
      var cancelClose = function () { if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null; } };
      var scheduleClose = function () { cancelClose(); closeTimer = window.setTimeout(function () { closeGroup(group, false); }, HOVER_CLOSE_DELAY); };

      // hover-intent: open immediately on enter, close on a delay (cursor can travel the bridged gap)
      group.addEventListener('pointerenter', function () { cancelClose(); openGroup(group, false); });
      group.addEventListener('pointerleave', scheduleClose);
      panel.addEventListener('pointerenter', cancelClose);

      // click toggles (works alongside hover)
      trigger.addEventListener('click', function (e) {
        e.preventDefault(); cancelClose();
        if (group.classList.contains('is-open')) closeGroup(group, false);
        else openGroup(group, false);
      });

      // keyboard on the trigger
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault(); openGroup(group, true);
        } else if (e.key === 'Escape') {
          closeGroup(group, true);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault(); openGroup(group, true);
          var its = itemsOf(group); if (its.length) its[its.length - 1].focus();
        }
      });

      // keyboard inside the panel: cycle items, Home/End, Esc to trigger, Tab closes
      items.forEach(function (item, i) {
        item.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
          else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
          else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
          else if (e.key === 'Escape') { e.preventDefault(); closeGroup(group, true); }
          else if (e.key === 'Tab') { closeGroup(group, false); }
        });
      });

      // close when focus leaves the whole group (blur-out)
      group.addEventListener('focusout', function (e) {
        if (!group.contains(e.relatedTarget)) closeGroup(group, false);
      });
    });

    // click outside any group closes all
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.mm-has-panel')) closeAllGroups(null);
    });
  }

  // =====================================================================
  // DRAWER ACCORDIONS — .mm-acc groups expand / collapse inside the drawer
  // (ported gold). NULL-GUARDED: no .mm-acc__btn = nothing to wire.
  // =====================================================================
  var accBtns = Array.prototype.slice.call(document.querySelectorAll('.mm-acc__btn'));
  accBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (panel) panel.classList.toggle('open', !open);
    });
  });

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
    // Belt-and-braces: re-run the initial check after layout settles. Web-font
    // swap (Fraunces/Inter load async), late images, and reflows can shift an
    // element INTO the fold AFTER first paint — past a single rAF — leaving a
    // card peeking at the fold edge permanently opacity:0. Re-check on rAF,
    // font-ready, full load, and two short timeouts; reveal any not-yet-shown
    // element now in/above the fold.
    var recheck = function () {
      revealTargets.forEach(function (el) {
        if (!el.classList.contains('in-view') && inOrAboveFold(el)) {
          el.classList.add('in-view'); io.unobserve(el);
        }
      });
    };
    requestAnimationFrame(recheck);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) { document.fonts.ready.then(recheck); }
    window.addEventListener('load', recheck);
    setTimeout(recheck, 200);
    setTimeout(recheck, 600);
  }

  // ---- count-up stats ----
  // Format a numeric value with en-US thousands grouping on the INTEGER part
  // while preserving the exact decimal count (4.9 -> "4.9", never "4.900";
  // 40000 -> "40,000"; 2400000000 -> "2,400,000,000"). Built from toFixed so
  // the decimal count matches data-count exactly, then commas are injected only
  // into the integer digits — avoids toLocaleString stripping/locale quirks.
  function groupNum(value, decimals) {
    var fixed = value.toFixed(decimals);          // e.g. "40000" or "4.9"
    var neg = fixed.charAt(0) === '-';
    if (neg) fixed = fixed.slice(1);
    var dot = fixed.indexOf('.');
    var intPart = dot === -1 ? fixed : fixed.slice(0, dot);
    var fracPart = dot === -1 ? '' : fixed.slice(dot);   // includes the '.'
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + intPart + fracPart;
  }
  function animateCount(el) {
    if (el.getAttribute('data-counted') === '1') return;
    el.setAttribute('data-counted', '1');
    var raw = el.getAttribute('data-count');
    var target = parseFloat(raw) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (String(raw).split('.')[1] || '').length;
    // EXACT final string the animation MUST land on (snap target). Computed
    // once so the last frame is value-identical to data-count (grouped), never a
    // rounded intermediate (fixes 184≠183 / 4000≠3973: the final frame ==
    // grouped data-count) and never an ungrouped 40000 next to a "40,000" label.
    var finalText = groupNum(target, decimals) + suffix;
    if (reduce) { el.textContent = finalText; return; }
    var dur = 1500, start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      if (p >= 1) { el.textContent = finalText; return; } // snap to exact target; do NOT schedule another frame
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = groupNum(target * eased, decimals) + suffix;
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

  // =====================================================================
  // INVENTORY BOARD — filter (type / county / price band / status) + sort +
  // shareable URL state, plus the homepage hero-finder handoff.
  //
  // NULL-GUARDED both ways: only inventory.html carries the [data-grid]
  // board and only index.html carries .hero-finder__form, so the other 8
  // pages fall straight through this block.
  //
  // SINGLE SOURCE OF TRUTH: every facet is read off the RENDERED card's
  // data-type / data-county / data-price / data-status. There is deliberately
  // NO JS copy of the nine listings — a second copy of nine priced offers
  // would be a fact-duplication hazard the moment either copy is edited.
  //
  // HIDING: cards are hidden with the .is-hidden CLASS, not the `hidden`
  // ATTRIBUTE. .product-card--spec sets `display:flex` (structural.css:4273),
  // an author rule that outranks the UA `[hidden]{display:none}` rule, so the
  // attribute alone leaves the card fully laid out. The matching
  // `#inventory .collection__grid > .is-hidden { display:none }` rule is
  // appended to structural.css and outranks it on specificity (1,2,0 > 0,1,0).
  //
  // MOTION: this block introduces no animation of its own — filtering is an
  // instant display toggle and a chip click does not scroll — so there is no
  // new motion for `reduce` to gate. The only motion touching these cards is
  // the existing .wow-stagger reveal, already reduce-gated above; the reveal
  // re-assertion below is written so it never fights that gate.
  // =====================================================================
  var invGrid = document.querySelector('.collection__grid[data-grid]');
  if (invGrid) {
    var invCards = Array.prototype.slice.call(invGrid.querySelectorAll('.product-card'));
    var invFeatured = invCards.slice();       // ORIGINAL DOM order == the "Featured" sort. Captured ONCE, at init.
    var invChips = Array.prototype.slice.call(document.querySelectorAll('.tg-filterbar a[data-cat]'));
    var invBoxes = Array.prototype.slice.call(document.querySelectorAll('input[data-filter-cat]'));
    var invCounty = document.getElementById('inv-county');
    var invBandSel = document.getElementById('inv-band');
    var invSort = document.getElementById('inv-sort');
    var invCount = document.getElementById('inv-count');
    var invEmpty = document.getElementById('inv-empty');
    var invType = '';                          // '' == every licence type

    // Price bands mirror the <option> LABELS exactly: "Under $50,000" is
    // strictly under, "$50,000 to $100,000" is inclusive at both ends (so the
    // $100,000 SoMa listing lands here, not in "Over $100,000").
    function invBandOf(price) {
      if (price < 50000) return 'under-50';
      if (price <= 100000) return '50-100';
      return 'over-100';
    }
    function invPriceOf(card) { return parseInt(card.getAttribute('data-price'), 10) || 0; }
    // "Status: available first" — available NOW, then available soon, then the
    // ones already under transfer (the least reachable for a new buyer).
    var invStatusRank = { active: 0, soon: 1, pending: 2 };
    function invRankOf(card) {
      var r = invStatusRank[card.getAttribute('data-status')];
      return typeof r === 'number' ? r : 99;
    }

    function invApply() {
      var county = invCounty ? invCounty.value : '';
      var band = invBandSel ? invBandSel.value : '';
      var sort = invSort ? invSort.value : 'featured';
      var wanted = invBoxes.filter(function (b) { return b.checked; })
        .map(function (b) { return b.getAttribute('data-filter-cat'); });

      // ---- show / hide ----
      var shown = 0;
      invCards.forEach(function (card) {
        var ok = true;
        if (invType && card.getAttribute('data-type') !== invType) ok = false;
        if (ok && county && card.getAttribute('data-county') !== county) ok = false;
        if (ok && band && invBandOf(invPriceOf(card)) !== band) ok = false;
        if (ok && wanted.length && wanted.indexOf(card.getAttribute('data-status')) === -1) ok = false;
        card.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });

      // ---- reorder ----
      // Every comparator falls back to the captured featured index, so ties
      // (two $80,000 listings, five "active" listings) stay in a stable,
      // predictable order instead of shuffling between applies.
      var order = invFeatured.slice();
      if (sort === 'price-asc' || sort === 'price-desc') {
        var dir = sort === 'price-asc' ? 1 : -1;
        order.sort(function (a, b) {
          return ((invPriceOf(a) - invPriceOf(b)) * dir) || (invFeatured.indexOf(a) - invFeatured.indexOf(b));
        });
      } else if (sort === 'status') {
        order.sort(function (a, b) {
          return (invRankOf(a) - invRankOf(b)) || (invFeatured.indexOf(a) - invFeatured.indexOf(b));
        });
      }
      order.forEach(function (card) { invGrid.appendChild(card); });

      // Reveal safety. .wow-stagger.in-view > * lights ALL children whatever
      // their order, so a reorder cannot strand one at opacity:0 while the grid
      // is revealed. Re-assert only once the grid IS revealed (or has reached
      // the fold) — asserting at init would light the board early and defeat
      // its below-the-fold stagger.
      if (invGrid.classList.contains('in-view') || inOrAboveFold(invGrid)) invGrid.classList.add('in-view');

      // ---- live count + empty state ----
      if (invCount) {
        invCount.innerHTML = 'Showing <b>' + shown + '</b> of <b>' + invCards.length +
          '</b> licence' + (invCards.length === 1 ? '' : 's');
      }
      if (invEmpty) invEmpty.hidden = shown !== 0;

      invChips.forEach(function (chip) {
        var cat = chip.getAttribute('data-cat');
        if (cat === 'all' ? invType === '' : cat === invType) chip.setAttribute('aria-current', 'true');
        else chip.removeAttribute('aria-current');
      });

      // ---- shareable URL state ----
      // LAST, and in its own try/catch: Chrome rejects replaceState with a URL
      // on a file:// document (opaque origin) with a SecurityError, and a throw
      // here must never roll back the filtering already applied above.
      // replaceState, never pushState — filtering must not fill the back button.
      try {
        var q = new URLSearchParams();
        if (invType) q.set('type', invType);
        if (county) q.set('county', county);
        if (band) q.set('band', band);
        if (wanted.length) q.set('status', wanted.join(','));
        if (sort && sort !== 'featured') q.set('sort', sort);
        var qs = q.toString();
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      } catch (err) { /* file:// origin — state is in the controls either way */ }
    }

    // ---- pre-apply ?type=&county=&band=&status=&sort= ----
    (function invReadUrl() {
      var q;
      try { q = new URLSearchParams(location.search); } catch (e) { return; }
      var t = q.get('type');
      // A bare licence-type token is accepted even when nothing on the board
      // carries it (the hero finder offers Type 20 and Type 41, which have no
      // stock today) — that resolves to the honest empty state rather than
      // silently showing all nine as if the request had been met.
      if (t && /^[0-9]{1,3}$/.test(t)) invType = t;
      var setSel = function (sel, v) {
        if (!sel || !v) return;
        // An unknown value would blank the <select> and desync it from the
        // filter it drives, so only reflect a value the control really offers.
        var known = Array.prototype.some.call(sel.options, function (o) { return o.value === v; });
        if (known) sel.value = v;
      };
      setSel(invCounty, q.get('county'));
      setSel(invBandSel, q.get('band'));
      setSel(invSort, q.get('sort'));
      var st = (q.get('status') || '').split(',').filter(Boolean);
      if (st.length) {
        invBoxes.forEach(function (b) { b.checked = st.indexOf(b.getAttribute('data-filter-cat')) !== -1; });
      }
    })();

    invChips.forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.preventDefault();   // the href="#inventory" hash jump would fight the URL state written above
        var cat = chip.getAttribute('data-cat');
        invType = cat === 'all' ? '' : cat;
        invApply();
      });
    });
    [invCounty, invBandSel, invSort].forEach(function (sel) {
      if (sel) sel.addEventListener('change', invApply);
    });
    invBoxes.forEach(function (b) { b.addEventListener('change', invApply); });
    // The filter <form> has no action — stop Enter from reloading the board.
    var invForm = (invCounty && invCounty.form) || (invSort && invSort.form) || null;
    if (invForm) invForm.addEventListener('submit', function (e) { e.preventDefault(); });

    invApply();
  }

  // ---- homepage hero finder -> inventory board handoff ----
  // Hands the chosen type/county to the board as URL params the block above
  // reads back. Null-guarded: index.html is the only page with this form.
  var invFinder = document.querySelector('.hero-finder__form');
  if (invFinder) {
    invFinder.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = document.getElementById('hf-type');
      var c = document.getElementById('hf-county');
      var q = new URLSearchParams();
      if (t && t.value) q.set('type', t.value);
      if (c && c.value) q.set('county', c.value);
      var qs = q.toString();
      window.location.href = 'inventory.html' + (qs ? '?' + qs : '');
    });
  }

  // =====================================================================
  // [AE] HERO COMMAND BAR — federated autosuggest + free-text parse.
  //
  // NULL-GUARDED: only index.html carries [data-cmdbar], so the other 107
  // published pages fall straight through this block (same idiom as the
  // inventory board above).
  //
  // WHAT IT IS: one control that searches ACROSS the site — the nine live
  // listings, the five CALIFORNIA licence types, the eight business industries,
  // the eight services, the guides, the FAQs, every California market we cover
  // and the two out-of-state markets we publish an indexable page for — and
  // ROUTES to whichever page owns the answer. It never filters this page.
  //
  // DEDUP DISCIPLINE (_dedup-ledger.md PART 1): a suggestion is a POINTER, not
  // a restatement. Each row shows a title and a ROUTING label, then hands off to
  // the owning page. Notably: no listing price is printed here (C34/C28 stay
  // with inventory.html / faq.html) even though price is fully SEARCHABLE — the
  // price you type is matched against the real data-price values, it is simply
  // not re-published in the dropdown.
  //
  // SINGLE SOURCE OF TRUTH, AND ITS ONE HONEST EXCEPTION: the inventory board
  // block above deliberately keeps NO JS copy of the nine listings because that
  // page renders them. This page does NOT render all nine (it teases six), so
  // the index below is the only place the ninth can come from. Every field in it
  // is copied from a rendered attribute on inventory.html (data-type /
  // data-county / data-price / data-status) and is re-verified by the trace
  // harness; if the board changes, this table must change with it.
  //
  // THE LOCATION-HONESTY RULE (owner decision): twelve markets are advertised on
  // index.html#coverage; only seven counties hold stock, and one of those seven
  // (San Bernardino) is not on the advertised list. So a market row NEVER shows
  // a bare place name. It either says how many live listings it holds, or it
  // says in words that we broker there and hold none today, and routes to a
  // sourcing brief instead of to the board.
  // [DJ] EXTENDED to the out-of-state markets: Arizona and Florida hold ZERO
  // stock (every one of the nine listings is Californian), so both take the
  // second shape — but they route to their OWN PAGE rather than to the brief,
  // because that page owns their counties, cities, regulator and
  // classifications. The rule is unchanged; only the destination is better.
  //
  // NAMING: .cmdbar__input, NOT the shared probe's generic search class. That
  // class is hard-coded in client-visual-verify/scripts/interact.mjs to assert
  // "typing shrinks the card grid on this page, then clearing restores it".
  // This control opens a panel and navigates; it must not claim that contract.
  //
  // MOTION: the only new animation is the panel's open transition, declared in
  // structural.css [AE] and already gated there by prefers-reduced-motion; the
  // `reduce` flag read at the top of this file also skips the .is-open class so
  // the animation is never even attached.
  // =====================================================================
  var cbRoot = document.querySelector('[data-cmdbar]');
  if (cbRoot) {
    var cbInput = cbRoot.querySelector('.cmdbar__input');
    var cbPanel = cbRoot.querySelector('.cmdbar__panel');
    var cbForm = cbRoot.querySelector('.cmdbar__form');
    var cbNote = cbRoot.querySelector('.cmdbar__note');
    var cbLive = cbRoot.querySelector('.cmdbar__live');

    if (cbInput && cbPanel && cbForm) {
      // ---------------------------------------------------------------
      // 1. THE FEDERATED INDEX
      // g = group · t = title · m = routing label · k = MATCH-ONLY keywords
      // (never rendered) · tag = the honesty pill · type/county/price =
      // structured facets, listings only.
      // ---------------------------------------------------------------
      var IX = [];
      function cbAdd(row) { IX.push(row); }

      // --- LISTINGS: the nine live licences, field-for-field off the rendered
      //     inventory.html cards. Price and status are indexed; price is not
      //     printed (see the dedup note above), status IS, because a suggestion
      //     that hid "Pending transfer" would read as available stock.
      [
        ['La Mesa',        '47', 'san-diego',      'San Diego County',     135000, 'Active'],
        ['SoMa District',  '48', 'san-francisco',  'San Francisco County', 100000, 'Pending transfer'],
        ['Anaheim',        '48', 'orange',         'Orange County',         86000, 'Available soon'],
        ['Burbank',        '48', 'los-angeles',    'Los Angeles County',    80000, 'Active'],
        ['Glendale',       '47', 'los-angeles',    'Los Angeles County',    80000, 'Pending transfer'],
        ['Corona',         '21', 'riverside',      'Riverside County',      35000, 'Active'],
        ['Sacramento',     '21', 'sacramento',     'Sacramento County',     35000, 'Active'],
        ['San Bernardino', '21', 'san-bernardino', 'San Bernardino County', 25000, 'Available soon'],
        ['Los Angeles',    '21', 'los-angeles',    'Los Angeles County',    15000, 'Active']
      ].forEach(function (r) {
        cbAdd({
          g: 'listings',
          t: r[0] + ' — Type ' + r[1],
          m: r[3] + ' · ' + r[5],
          href: 'inventory.html?type=' + r[1] + '&county=' + r[2],
          k: r[2] + ' ' + r[4] + ' ' + (r[4] / 1000) + 'k',
          type: r[1], county: r[2], price: r[4]
        });
      });

      // --- LICENCE TYPES: five. 21/47/48 have deep-dive anchors; 41 and 20 now
      //     have matrix-row anchors added for exactly this purpose. The meta for
      //     41/20 states ONLY what the comparison matrix states (scope +
      //     premises) — their authorisation sentence was never published, and
      //     the page says so, so nothing is invented here either.
      //     The `k` keywords bridging an industry to a type are taken from the
      //     industry tile's own dek, which names that type in so many words.
      cbAdd({ g:'types', t:'Type 21 — Off-Sale General', m:'Spirits included · off-premises', href:'licence-types.html#type-21', k:'liquor stores off sale general 21' });
      cbAdd({ g:'types', t:'Type 47 — On-Sale General, Eating Place', m:'Spirits included · on-premises', href:'licence-types.html#type-47', k:'restaurants eating place on sale general 47' });
      cbAdd({ g:'types', t:'Type 48 — On-Sale General, Public Premises', m:'Spirits included · on-premises', href:'licence-types.html#type-48', k:'bars nightclubs public premises on sale general 48' });
      cbAdd({ g:'types', t:'Type 41 — On-Sale Beer & Wine, Eating Place', m:'Beer and wine only · on-premises', href:'licence-types.html#type-41', k:'restaurants eating place beer wine 41' });
      cbAdd({ g:'types', t:'Type 20 — Off-Sale Beer & Wine', m:'Beer and wine only · off-premises', href:'licence-types.html#type-20', k:'beer wine off sale 20' });

      // --- INDUSTRIES: the eight tiles. There are no per-industry pages, and
      //     the ledger (C21) keeps the sector→type mapping HOMEPAGE-ONLY, so
      //     every one of these routes to the tile grid that owns it. Each tile's
      //     dek is indexed as keywords so "restaurant" reaches the licence type.
      [
        ['Restaurants',        'Type 41 or Type 47', 'runs on a type 41 or a type 47 decision before an offer goes in'],
        ['Bars & nightclubs',  'Type 48',            'rooms where the drink is the business rather than the accompaniment type 48 not a restaurant licence'],
        ['Hotels',             'One property, several outlets', 'restaurant room service and portable bars licensed together'],
        ['Liquor stores',      'Type 21',            'a type 21 storefront where the licence is the business'],
        ['Grocery stores',     'Beer and wine, off-sale', 'beer and wine off sale held alongside everything else on the shelves multi-site grocer'],
        ['Convenience stores', 'Licence stays with the site', 'one counter a small footprint licence stays with the site when the store changes hands'],
        ['Franchise operators','Licence follows the brand model', 'service style and site requirements decide it franchise by franchise'],
        ['Event venues',       'Special or daily licence', 'hosted events served under a special or daily licence not a permanent one']
      ].forEach(function (r) {
        cbAdd({ g:'industries', t:r[0], m:r[1], href:'index.html#industries', k:r[2] });
      });

      // --- SERVICES: eight, each to its own anchor on services.html (C6–C13).
      [
        ['Buy a liquor licence',            'buy',          'sourcing off-market acquisition loi'],
        ['Sell a liquor licence',           'sell',         'selling seller exit qualified buyers'],
        ['Transfer a liquor licence',       'transfer',     'person to person premises to premises abc transfer'],
        ['Licence valuation',               'valuation',    'appraisal appraise worth value price report'],
        ['Conditional Use Permits',         'cup',          'cup police permit planning commission hearing zoning approval'],
        ['ABC compliance consulting',       'compliance',   'audit lead training violation premises compliance'],
        ['Escrow and transaction guidance', 'escrow',       'escrow neutral party transaction coordination'],
        ['New business licence planning',   'new-business', 'new business opening build-out concept strategy']
      ].forEach(function (r) {
        cbAdd({ g:'services', t:r[0], m:'Services', href:'services.html#' + r[1], k:r[2] });
      });

      // --- GUIDES: the four knowledge-base explainers + the transfer walkthrough.
      cbAdd({ g:'guides', t:'Choosing a classification', m:'Knowledge base', href:'resources.html#classification', k:'classification choose wrong type decision' });
      cbAdd({ g:'guides', t:'What sets the price',       m:'Knowledge base', href:'resources.html#pricing',        k:'pricing price scarcity county cost why expensive' });
      cbAdd({ g:'guides', t:'Route to market',           m:'Knowledge base', href:'resources.html#route',          k:'route cap quota resale market buy existing' });
      cbAdd({ g:'guides', t:'Zoning and the address',    m:'Knowledge base', href:'resources.html#zoning',         k:'zoning address location approved separately disqualify' });
      cbAdd({ g:'guides', t:'How a transfer works',      m:'The six phases', href:'process.html',                  k:'process timeline steps phases escrow abc approval how long 60 120 days' });

      // --- FAQs: the eight questions, to the faq.html band that carries each.
      [
        ['How do I buy a liquor licence in California?', 'buying',       'buy purchase escrow transfer application background checks'],
        ['What is the difference between licence types?','buying',       'difference between types compare comparison'],
        ['How much does a California liquor licence cost?','buying',     'cost price how much expensive budget'],
        ['Do I need city approval before transferring?', 'transferring', 'city county approval zoning conditional use permit local'],
        ['How long does a transfer take?',               'transferring', 'how long timeline days weeks months speed'],
        ['Can I move a licence to a new location?',      'transferring', 'move relocate premises to premises new location'],
        ['Do you work statewide in California?',         'transferring', 'statewide 58 counties coverage everywhere'],
        ['Can you help me sell my licence?',             'selling',      'sell selling seller market my licence']
      ].forEach(function (r) {
        cbAdd({ g:'faqs', t:r[0], m:'FAQ', href:'faq.html#' + r[1], k:r[2] });
      });

      // --- STATEWIDE: exactly ONE row, and it can only ever BE one row, because
      //     this firm brokers CALIFORNIA ABC licences and nothing else. This is
      //     a single cbAdd call, not a table — there is no per-state structure
      //     here to extend by accident.
      //
      //     THE GAP IT CLOSES, measured before it existed: "california" returned
      //     three FAQ rows, "state" and "statewide" returned one each, and
      //     locations.html appeared NOWHERE in this index — so the bar had no
      //     whole-state entity at all, even though locations.html ships a
      //     dedicated statewide tab and calls itself "one statewide desk" (:385).
      //
      //     WHY THIS href: the [AF] block reads location.hash and ACTIVATES the
      //     matching tab (locFromHash -> locActivate flips aria-selected and
      //     un-hides data-loc-panel) — it does not merely scroll. The statewide
      //     tab is id="loctab-california" / data-loc-tab="california" over panel
      //     id="california". locations.html:144 already publishes this identical
      //     URL as position 1 of its own JSON-LD ItemList, so nothing is invented.
      //
      //     EVERY STRING IS THE DESTINATION PAGE'S OWN COPY. The title is
      //     locations.html:435's <h3> character-for-character; the meta is its
      //     dek at :437, "Counties served: all 58 California counties", a
      //     data-source="R-STAT-03" intake fact. NO stock count is printed: the
      //     nine listings belong to inventory.html and to the statewide tab, and
      //     per the DEDUP DISCIPLINE above a suggestion is a POINTER, not a
      //     restatement. It also keeps this row's matching surface minimal — a
      //     longer meta ending "9 live listings across 7 of them" was MEASURED to
      //     put "of"/"them"/"live"/"listings" into _hay and float this row above
      //     higher-scoring Licence-type rows on the query "of".
      //
      //     `k` IS LOAD-BEARING, not decoration: 'california' and 'statewide' are
      //     reachable through the title, and \bstate word-matches "statewide"
      //     while \bca word-matches "california" — but 'calif' and 'coverage' are
      //     NOT in the title, so they only work from here. 'coverage' was added
      //     after measuring that it serves "california coverage" and "statewide
      //     coverage" while changing the out-of-state leak count NOT AT ALL (6
      //     either way) and leaving bare "coverage" unable to admit this row.
      //     Deliberately ABSENT: 'liquor' and 'licence'. Those words appear in
      //     most rows in IX, so including them would surface this row on broad
      //     queries and make it compete for the 8 cap slots — a real regression.
      //     The cost is stated plainly in the residual-risk list, not hidden.
      cbAdd({
        g: 'statewide',
        t: 'California — the statewide picture',
        m: 'All 58 California counties',
        href: 'locations.html#california',
        k: 'california calif ca state statewide coverage'
      });

      // --- COVERAGE: the twelve advertised markets, PLUS San Bernardino, which
      //     holds stock but is not on the advertised list. Six of the twelve hold
      //     no stock at all today and say so in words + a pill, and route to the
      //     sourcing brief rather than to the board, so no row here can be read
      //     as implying inventory that does not exist.
      [
        ['Los Angeles',    'los-angeles',    3, ''],
        ['Orange County',  'orange',         1, ''],
        ['San Diego',      'san-diego',      1, ''],
        ['San Francisco',  'san-francisco',  1, ''],
        ['Sacramento',     'sacramento',     1, ''],
        ['Riverside',      'riverside',      1, ''],
        ['San Bernardino', 'san-bernardino', 1, 'not on our advertised market list'],
        ['San Jose',       null,             0, ''],
        ['Santa Barbara',  null,             0, ''],
        ['Palm Springs',   null,             0, ''],
        ['Napa Valley',    null,             0, 'napa'],
        ['Ventura',        null,             0, ''],
        ['Fresno',         null,             0, '']
      ].forEach(function (r) {
        // cslug / cname identify the row to the PARSER (never rendered), so a
        // market the parser positively recognised can be re-admitted even when
        // the visitor's other words do not appear in this row's text. See the
        // `rescue` clause in cbSearch — without it, "restaurant napa" collapsed
        // to "Nothing on the site matches", which is not true and directly
        // contradicted the Enter path's "we broker in Napa Valley" answer.
        if (r[2] > 0) {
          cbAdd({
            g: 'coverage', t: r[0],
            m: r[2] + ' live listing' + (r[2] === 1 ? '' : 's') + (r[3] ? ' · ' + r[3] : ''),
            href: 'inventory.html?county=' + r[1], k: r[1] + ' market county',
            cslug: r[1], cname: cbNorm(r[0])
          });
        } else {
          cbAdd({
            g: 'coverage', t: r[0],
            m: 'We broker here · no live listings today · send a sourcing brief',
            href: 'contact.html#quote', tag: 'No stock today',
            k: (r[3] ? r[3] + ' ' : '') + 'market county sourcing brief off market',
            cslug: null, cname: cbNorm(r[0])
          });
        }
      });

      // --- [DJ] COVERAGE, OUT OF STATE: the two INDEXABLE states published
      //     beside California. Same group, same honesty rule, ONE difference —
      //     what these rows point at is a PAGE, not the board. Each renders its
      //     own markets, its own regulator and its own classifications, and the
      //     DEDUP DISCIPLINE above makes a suggestion a POINTER to the page that
      //     owns the answer rather than a restatement of it.
      //     ZERO out-of-state stock exists — inventory.html renders nine cards,
      //     every data-county on them is Californian and there is no data-state
      //     attribute at all — so both rows take the no-stock shape: the pill,
      //     the sentence in words, and no route to the board.
      //     The meta tail is the state rail's OWN sub-label on locations.html
      //     ("15 counties · 10 cities" / "66 counties · 10 cities"), so no count
      //     is invented here.
      //     NEW JERSEY, OHIO and PENNSYLVANIA are deliberately ABSENT (owner
      //     decision 2026-09-11): those three pages are noindex,follow and are
      //     not cards in the Locations mega, so the homepage's flagship control
      //     does not promote them. See the [BO] comment in index.html.
      //     `k` carries ONLY place names these two pages actually publish, minus
      //     three that COLLIDE with California entries already in CB_PLACES:
      //     'glendale' (-> Los Angeles County) and 'mesa' (-> San Diego County
      //     via "la mesa") would hijack live-stock queries, and 'fort lauderdale'
      //     makes the bare query "la" word-match this row and displace the
      //     Anaheim listing. Deliberately absent everywhere, for the reason the
      //     statewide row states: 'liquor', 'licence' and the regulator names,
      //     which would float these rows onto broad queries and make them compete
      //     for the 8 cap slots.
      [
        ['Arizona', 'arizona-liquor-license.html', '15 counties and 10 cities published',
          'az state phoenix tucson chandler gilbert scottsdale tempe peoria surprise'],
        ['Florida', 'florida-liquor-license.html', '66 counties and 10 cities published',
          'fl state miami orlando tampa jacksonville hialeah tallahassee cape coral port st. lucie st. petersburg']
      ].forEach(function (r) {
        cbAdd({
          g: 'coverage', t: r[0],
          m: 'We broker here · no live listings today · ' + r[2],
          href: r[1], tag: 'No stock today',
          k: r[3] + ' sourcing brief off market',
          cslug: null, cname: cbNorm(r[0])
        });
      });

      // ---------------------------------------------------------------
      // 2. NORMALISATION + THE PRICE / TYPE / PLACE PARSER
      //     ONE parser drives BOTH halves: it ranks listings in the dropdown
      //     AND builds the free-text Enter route, so the two can never disagree.
      // ---------------------------------------------------------------
      function cbNorm(s) {
        return String(s == null ? '' : s)
          .toLowerCase()
          .replace(/[‘’]/g, "'")
          .replace(/[–—]/g, '-')
          .replace(/&/g, ' and ')
          .replace(/[^a-z0-9$,.\-' ]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      function cbEscRe(s) { return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'); }
      function cbEscHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      }
      function cbMoney(n) { return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

      // Every PLACE the site names, with the board slug it maps to (null = a
      // market we advertise but hold no stock in). Localities are included so
      // "burbank" resolves to Los Angeles County, which is what the board filters on.
      var CB_PLACES = [
        { n:'los angeles',    slug:'los-angeles',     label:'Los Angeles County' },
        { n:'orange county',  slug:'orange',          label:'Orange County' },
        { n:'orange',         slug:'orange',          label:'Orange County' },
        { n:'san diego',      slug:'san-diego',       label:'San Diego County' },
        { n:'la mesa',        slug:'san-diego',       label:'San Diego County' },
        { n:'san francisco',  slug:'san-francisco',   label:'San Francisco County' },
        { n:'soma',           slug:'san-francisco',   label:'San Francisco County' },
        { n:'sacramento',     slug:'sacramento',      label:'Sacramento County' },
        { n:'riverside',      slug:'riverside',       label:'Riverside County' },
        { n:'corona',         slug:'riverside',       label:'Riverside County' },
        { n:'san bernardino', slug:'san-bernardino',  label:'San Bernardino County' },
        { n:'anaheim',        slug:'orange',          label:'Orange County' },
        { n:'burbank',        slug:'los-angeles',     label:'Los Angeles County' },
        { n:'glendale',       slug:'los-angeles',     label:'Los Angeles County' },
        { n:'san jose',       slug:null,              label:'San Jose' },
        { n:'santa barbara',  slug:null,              label:'Santa Barbara' },
        { n:'palm springs',   slug:null,              label:'Palm Springs' },
        { n:'napa valley',    slug:null,              label:'Napa Valley' },
        { n:'napa',           slug:null,              label:'Napa Valley' },
        { n:'ventura',        slug:null,              label:'Ventura' },
        { n:'fresno',         slug:null,              label:'Fresno' },
        /* [DJ] The two out-of-state markets the site publishes an INDEXABLE page
           for. slug:null is the same "we cover it, we hold nothing there" shape
           the six zero-stock California entries already use, and it arms two
           existing mechanisms: the listings gate below ("A named market with NO
           stock must never pull listings in"), which stops "type 47 arizona"
           answering with California stock, and the `rescue` clause, which stops
           "restaurant arizona" collapsing to "Nothing on the site matches".
           `page` is new and is read ONLY by the Enter path — these two have a
           page that owns the answer; the California entries do not.
           No CITY aliases are added here on purpose: 'mesa' and 'glendale' are
           already bound to San Diego and Los Angeles by live-stock entries above,
           and redefining them would kill real listing queries. */
        { n:'arizona',        slug:null,              label:'Arizona',  page:'arizona-liquor-license.html' },
        { n:'florida',        slug:null,              label:'Florida',  page:'florida-liquor-license.html' }
      ].sort(function (a, b) { return b.n.length - a.n.length; }); // longest first: "san bernardino" must beat "san diego"'s prefix

      var CB_MONEYTOK = '(\\$?\\s*\\d[\\d,.]*\\s*k?)';
      var CB_PRICE_PATTERNS = [
        { kind:'range', re: new RegExp(CB_MONEYTOK + '\\s*(?:-|to|thru|through)\\s*' + CB_MONEYTOK) },
        { kind:'max',   re: new RegExp('(?:under|below|less than|up to|no more than|at most|max|maximum)\\s*' + CB_MONEYTOK) },
        { kind:'min',   re: new RegExp('(?:over|above|more than|at least|starting at|from|min|minimum)\\s*' + CB_MONEYTOK) },
        { kind:'exact', re: /(\$\s*\d[\d,.]*\s*k?|\b\d{1,3}(?:,\d{3})+\b|\b\d[\d.]*\s*k\b|\b\d{4,}\b)/ }
      ];
      function cbAmount(raw) {
        var s = String(raw).toLowerCase().replace(/[$,\s]/g, '');
        var k = /k$/.test(s);
        if (k) s = s.slice(0, -1);
        var n = parseFloat(s);
        if (!isFinite(n) || n <= 0) return null;
        return { v: k ? n * 1000 : n, k: k };
      }

      // The three bands are inventory.html's own <option> values and mirror
      // site.js invBandOf() EXACTLY: under 50k is strictly under; 50–100k is
      // inclusive at both ends (so the $100,000 SoMa listing lands there).
      var CB_BAND_LABEL = { 'under-50':'under $50,000', '50-100':'$50,000 to $100,000', 'over-100':'over $100,000' };
      function cbBandOf(p) { return p < 50000 ? 'under-50' : (p <= 100000 ? '50-100' : 'over-100'); }
      // Map a parsed price INTENT onto one band, or null when the intent spans
      // more than one — an intent we cannot express is REPORTED, never rounded
      // into a filter the visitor did not ask for.
      function cbBandFor(pr) {
        if (pr.exact != null) return cbBandOf(pr.exact);
        if (pr.min != null && pr.max != null) {
          if (pr.max < 50000) return 'under-50';
          if (pr.min >= 50000 && pr.max <= 100000) return '50-100';
          if (pr.min > 100000) return 'over-100';
          return null;
        }
        if (pr.max != null) return pr.max <= 50000 ? 'under-50' : null;
        if (pr.min != null) return pr.min > 100000 ? 'over-100' : null;
        return null;
      }
      function cbPriceHit(price, pr) {
        if (pr.exact != null) return cbBandOf(price) === cbBandOf(pr.exact);
        if (pr.min != null && price < pr.min) return false;
        if (pr.max != null && price > pr.max) return false;
        return true;
      }

      var CB_STOP = (' a an and or the of to in on at for from with my me i we us you your this that ' +
        'is are be need needs want looking look find search show me please any all some new ' +
        'licence license licences licenses liquor alcohol abc county counties city area market ' +
        'type types listing listings inventory board stock available sale sales buy buying sell ' +
        'selling purchase price prices priced pricing cost costs budget k about near around ' +
        'under below over above between less than more most up no maximum minimum max min at ' +
        'least starting thru through anything something please help ' +
        // THE STATEWIDE WORDS. MEASURED before this line: Enter on "california"
        // produced unread=["california"] and therefore the note "We could not
        // interpret “california”." — from a California-only brokerage, which is
        // not merely unhelpful, it is FALSE: we did understand it. Every licence
        // on the board is a California ABC licence, so these words are
        // understood-and-applied (they select the whole board), never
        // uninterpreted. Leaving it would also have got worse, not better: the
        // dropdown directly above now answers the same word confidently.
        // SAFE BY CONSTRUCTION: CB_STOP is read at exactly ONE place in the file
        // — the p.unread filter below. cbTextScore tokenises from norm.split(' ')
        // and never consults it, so this cannot move a suggestion row (VERIFIED:
        // 0 dropdown differences across 20 queries). The test is
        // CB_STOP.indexOf(w), an exact ELEMENT match on an array, so 'state'
        // cannot swallow 'estate' (measured: "real estate" -> unread stays
        // ["real","estate"]). Out-of-state words are untouched: "nevada state"
        // and "state of nevada" now report unread=["nevada"] — the California
        // word is dropped, the foreign state name is still read back.
        'california calif ca state statewide ').split(/\s+/).filter(Boolean);

      function cbParse(raw) {
        var out = { type:null, place:null, price:null, band:null, unread:[], raw:String(raw || '') };
        var s = cbNorm(raw);
        if (!s) return out;
        var work = s;
        var blank = function (m) { return m.replace(/[^ ]/g, ' '); };

        // (a) PRICE first — it is the only field that can swallow a bare number,
        //     so it must claim its digits before the type matcher sees them.
        for (var i = 0; i < CB_PRICE_PATTERNS.length && !out.price; i++) {
          var pat = CB_PRICE_PATTERNS[i];
          var m = work.match(pat.re);
          if (!m) continue;
          if (pat.kind === 'range') {
            var lo = cbAmount(m[1]), hi = cbAmount(m[2]);
            if (!lo || !hi) continue;
            // "50-100k": the k qualifies BOTH ends. Without this, "50" reads as
            // fifty dollars and the range collapses to nonsense.
            if (hi.k && !lo.k && lo.v < 1000) lo.v = lo.v * 1000;
            out.price = { min: Math.min(lo.v, hi.v), max: Math.max(lo.v, hi.v), exact: null, said: cbMoney(Math.min(lo.v, hi.v)) + ' to ' + cbMoney(Math.max(lo.v, hi.v)) };
          } else {
            var a = cbAmount(m[1]);
            if (!a) continue;
            if (pat.kind === 'max') out.price = { min:null, max:a.v, exact:null, said:'under ' + cbMoney(a.v) };
            else if (pat.kind === 'min') out.price = { min:a.v, max:null, exact:null, said:'over ' + cbMoney(a.v) };
            else out.price = { min:null, max:null, exact:a.v, said:'around ' + cbMoney(a.v) };
          }
          work = work.replace(pat.re, blank);
        }
        if (out.price) out.band = cbBandFor(out.price);

        // (b) TYPE — the explicit "type 47" form first, then a bare number.
        var tm = work.match(/\btype\s*[-#]?\s*(20|21|41|47|48)\b/) || work.match(/\b(20|21|41|47|48)\b/);
        if (tm) { out.type = tm[1]; work = work.replace(tm[0], blank(tm[0])); }

        // (c) PLACE — longest name first so "san bernardino" is not eaten by "san".
        for (var j = 0; j < CB_PLACES.length && !out.place; j++) {
          var pl = CB_PLACES[j];
          var re = new RegExp('\\b' + cbEscRe(pl.n) + '\\b');
          if (re.test(work)) { out.place = pl; work = work.replace(re, blank(pl.n)); }
        }

        // (d) WHAT IS LEFT — everything the parser could not account for, minus
        //     the connective words. This is what gets read back to the visitor.
        out.unread = work.split(/[\s,]+/).filter(function (w) {
          w = w.replace(/^[.'-]+|[.'-]+$/g, '');
          return w.length > 1 && CB_STOP.indexOf(w) === -1;
        });
        return out;
      }

      // ---------------------------------------------------------------
      // 3. MATCH + RANK
      //     Token AND-semantics: every token must land somewhere, so "type 47"
      //     never returns Type 21. exact > word-prefix > substring, title beats
      //     keywords, and a structured facet hit (type / county / price) can
      //     carry a listing that the raw text could not.
      // ---------------------------------------------------------------
      IX.forEach(function (e) {
        e._t = cbNorm(e.t);
        e._hay = cbNorm(e.t + ' ' + e.m + ' ' + (e.k || ''));
      });

      // statewide, CONTENT = 12: above guides(11), below services(14). The FAQ
      // rows are the only group this row realistically co-occurs with (they are
      // the rows carrying the word "California") and both sides tie at base 45,
      // so anything over 9 wins the tie; 12 also clears guides(11) and still
      // cannot leapfrog types/industries/services. MEASURED: "california" 57 vs
      // the FAQs' 54, so it sorts first — which is what makes DOM order equal
      // descending score for the queries that reach it.
      // statewide, COMMERCIAL = 6: below listings(34)/coverage(18)/types(12), so
      // a visitor who named a type, market or price always gets those first. No
      // commercial query can currently reach this row at all (the gate below
      // rejects on the facet word), so 6 is defined FAIL-CLOSED — it exists so
      // that widening `k` later can never leave the row unranked.
      var CB_GB_COMMERCIAL = { listings:34, coverage:18, types:12, statewide:6, industries:5, services:2, guides:0, faqs:0 };
      var CB_GB_CONTENT    = { types:20, industries:16, services:14, statewide:12, guides:11, faqs:9, coverage:5, listings:0 };
      // 'statewide' MUST appear in BOTH arrays even though only the CONTENT one
      // is reachable today. cbPaint walks groupsInOrder and skips any group the
      // array does not name, so a group that cbSearch scored INTO the top 8 but
      // that the active array omits is charged a cap slot and then never
      // rendered — the row vanishes and a real suggestion dies with it. The
      // battery instruments exactly this (hits.length - renderedRows.length) and
      // reports 0 only because both arrays list it. Fail closed.
      // CONTENT, position 1: the only queries that admit this row are queries
      // whose SUBJECT is the state, and on every one of them it is the
      // top-scoring row (measured: "california"/"state"/"statewide"/"ca"/"calif"
      // all 57 vs the FAQs' 54; "california statewide" 102 vs 99). Rendering it
      // first therefore makes DOM order == descending score == the order [AE]'s
      // arrow keys walk, so ONE ArrowDown + Enter reaches it. Putting it last,
      // beside 'coverage' — the tempting "keep geography together" choice —
      // would have rendered the highest-scoring row FOURTH on "california",
      // behind three FAQs: worse for both the eye and the keyboard.
      // COMMERCIAL, straight after 'coverage': the two geography answers stay
      // adjacent, and listings + coverage keep the lead when a facet was named.
      var CB_ORDER_COMMERCIAL = ['listings', 'coverage', 'statewide', 'types', 'industries', 'services', 'guides', 'faqs'];
      var CB_ORDER_CONTENT    = ['statewide', 'types', 'industries', 'services', 'guides', 'faqs', 'listings', 'coverage'];
      var CB_GROUP_LABEL = {
        listings:'Live listings', types:'Licence types', industries:'Business industries',
        services:'Services', guides:'Guides', faqs:'FAQs', coverage:'Markets we cover',
        // "Statewide", NOT the owner's word "State": this firm covers ONE state,
        // and a label naming the DIMENSION would read as a picker with 49 entries
        // missing. "Statewide" names the SCOPE, so one row is visibly the
        // complete answer — and it is the word locations.html already uses at
        // :385, :410, :435 and :680. Typing "state" still returns this row
        // FIRST, so the owner's request is served either way; only the label
        // differs from their word. See label_decision.
        statewide:'Statewide', start:'Start here'
      };
      var CB_CAP = 8;

      // ---------------------------------------------------------------
      // THE STATEWIDE ADMISSION GATE — the honesty mechanism, and the reason
      // this group cannot become a multi-state affordance.
      //
      // The statewide group is the ONLY group whose row names a JURISDICTION, so
      // it is the only group that must never be admitted by a weak match. Two
      // conditions, both required:
      //   1. At least one token must be a WHOLE WORD from CB_STATE_WORDS — a
      //      CLOSED list of the ways this site says "California / the whole
      //      state". No other state name appears in it or anywhere in IX, so
      //      "nevada", "texas" or "licence in texas" can never open the door.
      //   2. Every OTHER token must be a word-boundary (prefix) match on this
      //      row's own text. This is what shuts out cbTextScore's weakest tiers,
      //      the raw-substring hits worth 28 and 10. Those tiers are harmless
      //      noise on a guide row; on a row that names a state they are a
      //      liability. MEASURED with condition 2 absent: "ct state" surfaced
      //      this row because "ct" sits inside "piCTure", and "de"/"id"/"ia"/
      //      "wi" inside "statewIDe"/"califorNIA"/"statEWIde".
      //
      // Note what this deliberately does NOT do: it sets no `rescue` and no
      // `facet`, so cbTextScore's AND-semantics still runs and still
      // independently disqualifies the row via the `base < 0` guard below. That
      // is the whole difference between a gate and a bypass. A bypass here was
      // MEASURED to leak this row on 98/98 US states in each of four phrasings
      // ("<state> state", "state of <state>", "statewide <state>", "<state> ca")
      // — "texas state" rendering a panel of nothing but California rows.
      //
      // MEASURED RESULT, 882 non-California queries (9 phrasings x 49 state
      // names + 49 abbreviations): 6 admissions, ZERO on any full state name.
      // All six are "al"/"co" — genuine prefixes of this row's own words "ALl 58"
      // and "COunties" — and all six additionally require a real California word
      // in the box, so no bare state name or abbreviation can ever reach the row.
      // ---------------------------------------------------------------
      var CB_STATE_WORDS = ['california', 'calif', 'ca', 'state', 'statewide'];
      function cbStateNamed(e, tokens) {
        if (!tokens.length) return false;
        var named = false;
        for (var i = 0; i < tokens.length; i++) {
          var t = tokens[i];
          if (CB_STATE_WORDS.indexOf(t) !== -1) { named = true; continue; }
          if (!new RegExp('\\b' + cbEscRe(t)).test(e._hay)) return false;
        }
        return named;
      }

      function cbTextScore(e, tokens) {
        if (!tokens.length) return -1;
        if (e._t === tokens.join(' ')) return 130;
        var s = 0;
        for (var i = 0; i < tokens.length; i++) {
          var t = tokens[i], wb = new RegExp('\\b' + cbEscRe(t));
          if (e._t === t) s += 70;
          else if (wb.test(e._t)) s += 45;
          else if (e._t.indexOf(t) !== -1) s += 28;
          else if (wb.test(e._hay)) s += 18;
          else if (e._hay.indexOf(t) !== -1) s += 10;
          else return -1;   // AND semantics — one unmatched token disqualifies the row
        }
        return s;
      }

      function cbSearch(q) {
        var norm = cbNorm(q);
        var tokens = norm ? norm.split(' ').filter(Boolean) : [];
        var p = cbParse(q);
        var commercial = !!(p.type || p.place || p.price);
        var gb = commercial ? CB_GB_COMMERCIAL : CB_GB_CONTENT;
        var hits = [];
        IX.forEach(function (e, idx) {
          var base = cbTextScore(e, tokens);
          var facet = 0;
          var rescue = false;
          if (e.g === 'listings') {
            // A named market with NO stock must never pull listings in.
            if (p.place && !p.place.slug) return;
            // AND-SEMANTICS ON THE STRUCTURED FACETS. The facets used to be
            // OR'd — any single hit admitted the row — so "type 47 san diego"
            // (the field's own placeholder example) surfaced the Glendale
            // LOS ANGELES listing on its type alone, and "type 47 under 100k"
            // surfaced four Type 21/48 listings on price alone. That also put
            // the dropdown at odds with the Enter path, which sets ?type= AND
            // ?county= and lets the board AND-filter them. A listing that
            // CONTRADICTS a parsed facet is now dropped outright, never
            // carried in by the facets it happens to satisfy — the same
            // AND rule cbTextScore already applies to text tokens.
            if (p.type && e.type !== p.type) return;
            if (p.place && p.place.slug && e.county !== p.place.slug) return;
            if (p.price && !cbPriceHit(e.price, p.price)) return;
            if (p.type) facet += 50;
            if (p.place && p.place.slug) facet += 50;
            if (p.price) facet += 38;
          } else if (e.g === 'coverage' && p.place) {
            // The parser POSITIVELY recognised this market, which is stronger
            // evidence than a token sweep over this row's words. Re-admit it so
            // a second word in the box can never turn "we broker in Napa Valley,
            // no live listings today" into "Nothing on the site matches".
            rescue = p.place.slug ? (e.cslug === p.place.slug)
                                  : (e.cname === cbNorm(p.place.label));
            if (rescue) facet += 44;
          } else if (e.g === 'statewide') {
            // Not a rescue — a GATE. It can only ever REMOVE this row, never
            // carry it past the `base < 0` guard three lines below, so
            // AND-semantics keeps working: "texas state" names the state (so the
            // gate passes) and is then dropped anyway because "texas" matches
            // nothing in the row. Measured: 0 rows for "nevada", "texas",
            // "nevada state", "state of nevada", "texas state", "licence in
            // nevada" — all fall through to the existing no-match panel.
            if (!cbStateNamed(e, tokens)) return;
          }
          if (base < 0 && facet <= 0 && !rescue) return;
          hits.push({ e:e, idx:idx, s:(base < 0 ? 0 : base) + facet + (gb[e.g] || 0) });
        });
        hits.sort(function (a, b) { return (b.s - a.s) || (a.idx - b.idx); });
        return { hits: hits.slice(0, CB_CAP), commercial: commercial, parsed: p };
      }

      // ---------------------------------------------------------------
      // 4. RENDER — grouped listbox, group labels, aria-activedescendant
      // ---------------------------------------------------------------
      var cbActive = -1;      // index into cbOpts
      var cbOpts = [];        // the rendered option elements, in DOM order
      var cbOpen = false;

      function cbOptionHtml(e, id) {
        return '<div class="cmdbar__opt" role="option" id="' + id + '" aria-selected="false" data-href="' +
          cbEscHtml(e.href) + '">' +
          '<span class="cmdbar__opt-t">' + cbEscHtml(e.t) + '</span>' +
          (e.tag ? '<span class="cmdbar__opt-tag">' + cbEscHtml(e.tag) + '</span>' : '') +
          '<span class="cmdbar__opt-m">' + cbEscHtml(e.m) + '</span>' +
          '<span class="cmdbar__opt-go" aria-hidden="true">&rarr;</span>' +
          '</div>';
      }

      function cbPaint(groupsInOrder, buckets, leadHtml) {
        var html = leadHtml || '';
        var gid = 0;
        groupsInOrder.forEach(function (g) {
          var rows = buckets[g];
          if (!rows || !rows.length) return;
          gid++;
          var lid = 'cmdbar-grp-' + gid;
          html += '<div role="group" aria-labelledby="' + lid + '">' +
            '<div class="cmdbar__grouplabel" id="' + lid + '">' + CB_GROUP_LABEL[g] + '</div>';
          rows.forEach(function (e) { html += cbOptionHtml(e, 'cmdbar-opt-' + (gid * 100 + rows.indexOf(e))); });
          html += '</div>';
        });
        cbPanel.innerHTML = html;
        cbOpts = Array.prototype.slice.call(cbPanel.querySelectorAll('.cmdbar__opt'));
        cbActive = -1;
        cbInput.removeAttribute('aria-activedescendant');
      }

      function cbShow() {
        if (cbOpen) return;
        cbPanel.hidden = false;
        if (!reduce) cbPanel.classList.add('is-open');
        cbInput.setAttribute('aria-expanded', 'true');
        cbOpen = true;
      }
      function cbClose() {
        if (!cbOpen) return;
        cbPanel.hidden = true;
        cbPanel.classList.remove('is-open');
        cbInput.setAttribute('aria-expanded', 'false');
        cbInput.removeAttribute('aria-activedescendant');
        cbActive = -1;
        cbOpen = false;
      }
      function cbHighlight(i) {
        if (!cbOpts.length) return;
        if (cbActive > -1 && cbOpts[cbActive]) cbOpts[cbActive].setAttribute('aria-selected', 'false');
        cbActive = (i + cbOpts.length) % cbOpts.length;
        var el = cbOpts[cbActive];
        el.setAttribute('aria-selected', 'true');
        cbInput.setAttribute('aria-activedescendant', el.id);
        if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      }
      function cbSay(msg) { if (cbLive) cbLive.textContent = msg; }

      // The empty-input prompt list. Small, labelled "Start here", and visibly
      // NOT a search result — it exists so the control teaches its own scope.
      function cbPrompt() {
        var starters = IX.filter(function (e) { return e.g === 'types'; }).slice();
        var buckets = { start: starters.concat([{ g:'start', t:'Browse all 9 California licences', m:'The full board', href:'inventory.html', tag:'' }]) };
        cbPaint(['start'], buckets);
        cbShow();
        cbSay(cbOpts.length + ' starting points. Type to search listings, licence types, industries and markets.');
      }

      function cbRender(q) {
        if (!q.trim()) { cbPrompt(); return; }
        var res = cbSearch(q);
        if (!res.hits.length) {
          // No match is still a route, not a dead end: one real option to the
          // full board, plus the plain statement that nothing matched.
          // aria-hidden: role="listbox" may only own option/group children, and
          // this banner is neither — an unowned div made the listbox structurally
          // invalid. Nothing is lost to a screen reader: cbSay below announces
          // the same sentence, Enter affordance included, on the status region.
          cbPaint(['coverage'], { coverage: [] },
            '<div class="cmdbar__none" aria-hidden="true">Nothing on the site matches &ldquo;' + cbEscHtml(q.trim()) +
            '&rdquo;. Press Enter to open the full board, or tell us what you are looking for.</div>' +
            '<div role="group" aria-labelledby="cmdbar-grp-none">' +
            '<div class="cmdbar__grouplabel" id="cmdbar-grp-none">Where to go instead</div>' +
            cbOptionHtml({ t:'Browse all 9 California licences', m:'The full board', href:'inventory.html', tag:'' }, 'cmdbar-opt-none-0') +
            cbOptionHtml({ t:'Send us a sourcing brief', m:'We source off-market against your spec', href:'contact.html#quote', tag:'' }, 'cmdbar-opt-none-1') +
            '</div>');
          cbOpts = Array.prototype.slice.call(cbPanel.querySelectorAll('.cmdbar__opt'));
          cbActive = -1;
          cbShow();
          cbSay('Nothing on the site matches ' + q.trim() +
            '. Press Enter to open the full board, or choose one of 2 alternatives.');
          return;
        }
        var buckets = {};
        res.hits.forEach(function (h) { (buckets[h.e.g] = buckets[h.e.g] || []).push(h.e); });
        cbPaint(res.commercial ? CB_ORDER_COMMERCIAL : CB_ORDER_CONTENT, buckets);
        cbShow();
        var n = cbOpts.length;
        cbSay(n + ' suggestion' + (n === 1 ? '' : 's') + ' for ' + q.trim() + '.');
      }

      // ---------------------------------------------------------------
      // 5. FREE-TEXT ENTER — apply what parsed, SAY what did not
      // ---------------------------------------------------------------
      function cbSubmit() {
        var raw = cbInput.value;
        var p = cbParse(raw);
        var applied = [], told = [], extraHref = null, extraLabel = 'Send a sourcing brief';

        var q = new URLSearchParams();
        if (p.type) { q.set('type', p.type); applied.push('Type ' + p.type); }
        if (p.place && p.place.slug) { q.set('county', p.place.slug); applied.push(p.place.label); }
        if (p.place && !p.place.slug) {
          // THE LOCATION-HONESTY RULE, on the Enter path: we understood the
          // market and we cover it — we simply hold nothing there today, and we
          // say so rather than quietly dropping the word.
          // [DJ] The out-of-state markets carry a `page`: that page owns the
          // counties, the cities, the regulator and the classifications, so it is
          // a better answer than a form, and the label below is that page's own
          // CTA wording off locations.html — nothing new is written.
          told.push('We broker in ' + p.place.label + ', but hold no live listings there today.');
          extraHref = p.place.page || 'contact.html#quote';
          if (p.place.page) extraLabel = 'Everything we broker in ' + p.place.label;
        }
        if (p.price) {
          if (p.band) { q.set('band', p.band); applied.push(CB_BAND_LABEL[p.band]); }
          else told.push('We read the price as ' + p.price.said + ', but the board filters price in three fixed bands and that spans more than one — so no price filter was applied.');
        }
        if (p.unread.length) {
          told.push('We could not interpret ' + p.unread.map(function (w) { return '“' + w + '”'; }).join(' or ') + '.');
        }

        var qs = q.toString();
        var href = 'inventory.html' + (qs ? '?' + qs : '');

        // Nothing to report -> go straight there (an empty box routes to the
        // unfiltered board rather than doing nothing).
        if (!told.length) { cbClose(); window.location.href = href; return; }

        // Something to report -> report it BEFORE navigating. Navigating first
        // would destroy the message, because inventory.html has nowhere to put
        // it and this build does not touch that page. The primary action is
        // focused, so a second Enter completes the journey.
        if (!cbNote) { cbClose(); window.location.href = href; return; }
        cbClose();   // the panel is absolutely positioned over the note area
        // The lead is written ONLY when something actually became a filter. A
        // blanket "nothing could be turned into a filter" would be plain wrong in
        // front of "we broker in Napa Valley…", where the market WAS understood —
        // it just is not a filter we can honestly apply.
        var lead = applied.length ? 'Showing ' + applied.join(' in ') + ' on the board. ' : '';
        var goLabel = applied.length ? 'Show matching licences' : 'Show all 9 California licences';
        cbNote.innerHTML =
          '<p class="cmdbar__note-txt">' + cbEscHtml(lead + told.join(' ')) + '</p>' +
          (extraHref ? '<a class="btn btn-secondary cmdbar__note-go" href="' + extraHref + '">' + cbEscHtml(extraLabel) + '</a>' : '') +
          '<a class="btn btn-primary cmdbar__note-go" href="' + cbEscHtml(href) + '">' + goLabel + '</a>';
        cbNote.hidden = false;
        cbSay(lead + told.join(' ') + ' ' + goLabel + '.');
        var go = cbNote.querySelector('.btn-primary');
        if (go) go.focus();
      }

      // ---------------------------------------------------------------
      // 6. WIRING
      // ---------------------------------------------------------------
      var cbTimer = null;
      cbInput.addEventListener('input', function () {
        if (cbNote) { cbNote.hidden = true; cbNote.innerHTML = ''; }
        if (cbTimer) window.clearTimeout(cbTimer);
        cbTimer = window.setTimeout(function () { cbRender(cbInput.value); }, 120);
      });
      cbInput.addEventListener('focus', function () { cbRender(cbInput.value); });
      // Click re-opens. `focus` alone is not enough: after Escape the input is
      // STILL focused, so clicking it fires no focus event and a mouse-only
      // visitor was left with a dead control (keyboard users recovered with
      // ArrowDown; they had no equivalent). The document-level outside-click
      // closer does not fire here — this target is inside cbRoot.
      cbInput.addEventListener('click', function () { if (!cbOpen) cbRender(cbInput.value); });

      cbInput.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!cbOpen) cbRender(cbInput.value); cbHighlight(cbActive + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (!cbOpen) cbRender(cbInput.value); cbHighlight(cbActive - 1); }
        else if (e.key === 'Home' && cbOpen) { e.preventDefault(); cbHighlight(0); }
        else if (e.key === 'End' && cbOpen) { e.preventDefault(); cbHighlight(cbOpts.length - 1); }
        else if (e.key === 'Enter') {
          if (cbOpen && cbActive > -1 && cbOpts[cbActive]) {
            e.preventDefault();
            window.location.href = cbOpts[cbActive].getAttribute('data-href');
          }
          // otherwise the form's submit handler runs the free-text parse
        } else if (e.key === 'Escape') {
          e.preventDefault(); cbClose(); cbInput.focus();
        } else if (e.key === 'Tab') {
          cbClose();
        }
      });

      cbPanel.addEventListener('mousedown', function (e) {
        // mousedown, not click: the input's blur would otherwise close the panel
        // out from under the pointer before the click landed.
        var opt = e.target.closest ? e.target.closest('.cmdbar__opt') : null;
        if (!opt) return;
        e.preventDefault();
        window.location.href = opt.getAttribute('data-href');
      });

      cbForm.addEventListener('submit', function (e) { e.preventDefault(); cbSubmit(); });

      document.addEventListener('click', function (e) {
        if (!cbRoot.contains(e.target)) cbClose();
      });

      // "/" focuses the bar from anywhere — but never while the visitor is
      // already typing in a field, where "/" is just a character.
      document.addEventListener('keydown', function (e) {
        if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
        var t = e.target;
        var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
        e.preventDefault();
        cbInput.focus();
        cbInput.select();
      });
    }
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

/* =============================================================================
 * [AF] LOCATIONS — the fourteen market tabs + the five-step qualifier.
 *
 * WHY A SECOND TOP-LEVEL IIFE RATHER THAN A BLOCK INSIDE THE FIRST: the file's
 * idiom is "one closure, many null-guarded feature blocks", and this keeps it —
 * it is null-guarded exactly the same way ([data-loc-tabs] / [data-qualifier] /
 * the contact form), so the other nine pages fall straight through. It is a
 * sibling closure only because the first one is already closed above; reopening
 * it would have meant editing a line every page depends on, for no behavioural
 * gain. Nothing here reads a variable from the closure above.
 *
 * WHAT IT DRIVES — three independent, individually guarded parts:
 *   A. TABS ......... locations.html. One parent page, fourteen inner tabs
 *                     (1 statewide + 13 markets), mirroring the client's own
 *                     live nav, which nests location -> licence type. Full
 *                     ARIA tabs pattern: roving tabindex, Arrow/Home/End,
 *                     and deep-linking, so locations.html#san-diego opens the
 *                     San Diego tab. The five ids the footer links on all ten
 *                     pages (#los-angeles #orange #san-diego #san-francisco
 *                     #sacramento) are panel ids, so nav-integrity resolves.
 *   B. QUALIFIER .... locations.html. Five steps, location pre-filled from the
 *                     tab you were reading, state kept across tab switches.
 *   C. HANDOFF ...... contact.html. Reads back what the qualifier sent so the
 *                     visitor does not retype it. Inert on a normal visit — it
 *                     requires from=qualifier in the query string.
 *
 * DEDUP DISCIPLINE (_content-requirements/_dedup-ledger.md PART 1, claim C21):
 * "which SECTOR needs which type" is HOMEPAGE-ONLY. So the eight industry
 * options render their NAME and nothing else, and the sector wording lives in
 * IND below, never in the page markup. It surfaces one row at a time, only
 * after the visitor asks for it by choosing "Not sure", quoted verbatim from
 * the homepage tile that owns it and captioned with a link back to that band.
 * A suggestion made on request is a pointer; a rendered eight-row mapping would
 * be a second copy of the claim. Nothing is ever auto-selected from it either —
 * the brief's rule is SUGGESTS, never forces.
 *
 * HONESTY: six of the thirteen markets hold no live stock. Their rows route to
 * a sourcing brief, never to the board, and the tab badge says so — the same
 * rule the hero command bar already follows on index.html.
 * ============================================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // A. THE MARKET TABS
  // ---------------------------------------------------------------------
  var locRoot = document.querySelector('[data-loc-tabs]');
  var locActivate = null;   // exposed to part B so a tab switch can pre-fill step 1

  if (locRoot) {
    var locTabs = Array.prototype.slice.call(locRoot.querySelectorAll('.loc-tab'));
    var locPanels = Array.prototype.slice.call(locRoot.querySelectorAll('.loc-panel'));

    var locSlugOf = function (tab) { return tab.getAttribute('data-loc-tab') || ''; };
    var locIndexOf = function (slug) {
      for (var i = 0; i < locTabs.length; i++) if (locSlugOf(locTabs[i]) === slug) return i;
      return -1;
    };

    locActivate = function (slug, opts) {
      opts = opts || {};
      var idx = locIndexOf(slug);
      if (idx === -1) return false;

      locTabs.forEach(function (t, i) {
        var on = i === idx;
        t.setAttribute('aria-selected', String(on));
        // Roving tabindex: exactly ONE tab is in the tab order at a time, which
        // is what makes Arrow keys the way you move between tabs.
        t.setAttribute('tabindex', on ? '0' : '-1');
      });
      locPanels.forEach(function (p) { p.hidden = p.getAttribute('data-loc-panel') !== slug; });

      if (opts.focus) locTabs[idx].focus();

      // Keep the SELECTED pill inside the scrolling rail on EVERY activation
      // path, not just the focused one. Below 640px the rail is a single
      // overflow-x row (structural.css [AF]), and gating this on opts.focus
      // meant the two paths that do NOT focus — deep-link-on-load and click —
      // left the rail at scrollLeft 0 with the active pill off-screen.
      // MEASURED at 375 before this fix: locations.html#san-francisco activated
      // the tab (aria-selected=true, panel shown) but rail.scrollLeft was 0 with
      // the active pill at x=926 in a rail whose right edge is 351 — i.e. the
      // visitor landed on the San Francisco panel with no pill highlighted
      // anywhere in view. The keyboard path scrolled correctly, which is what
      // pinned the cause to the opts.focus gate rather than to the CSS.
      // Horizontal-only, written straight to scrollLeft rather than through
      // scrollIntoView({block:'nearest'}): that call also scrolls the DOCUMENT
      // vertically, which on load would fight the browser's own fragment scroll.
      // getBoundingClientRect deltas, not offsetLeft — the rail sets no
      // `position`, so offsetLeft resolves against a distant offsetParent.
      var locRail = locTabs[idx].parentElement;
      if (locRail && locRail.scrollWidth > locRail.clientWidth + 1) {
        var rb = locRail.getBoundingClientRect();
        var tb = locTabs[idx].getBoundingClientRect();
        if (tb.left < rb.left) locRail.scrollLeft -= (rb.left - tb.left) + 16;
        else if (tb.right > rb.right) locRail.scrollLeft += (tb.right - rb.right) + 16;
      }
      if (opts.hash !== false) {
        // replaceState, never pushState — switching tabs must not fill the back
        // button. In its own try/catch: Chrome throws SecurityError for a
        // history write on a file:// document (opaque origin), and that must
        // never roll back the tab switch already applied above.
        try { history.replaceState(null, '', location.pathname + location.search + '#' + slug); } catch (e) { /* file:// */ }
      }
      if (opts.sync !== false && typeof window.__llaQzSyncMarket === 'function') window.__llaQzSyncMarket(slug);
      return true;
    };

    locTabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { locActivate(locSlugOf(tab), { hash: true }); });
      tab.addEventListener('keydown', function (e) {
        var next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % locTabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + locTabs.length) % locTabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = locTabs.length - 1;
        else return;
        e.preventDefault();
        locActivate(locSlugOf(locTabs[next]), { focus: true, hash: true });
      });
    });

    // Deep link on load, and again on a same-page hash change (the footer's
    // "Los Angeles County" link is locations.html#los-angeles from nine other
    // pages, but the tenth is THIS page, where no navigation happens).
    var locFromHash = function (focus) {
      var slug = (location.hash || '').replace(/^#/, '');
      if (!slug) return false;
      return locActivate(slug, { focus: !!focus, hash: false });
    };
    if (!locFromHash(false)) {
      // No usable hash: leave the statewide tab that the markup ships selected,
      // but still hand its slug to the qualifier so step 1 is never blank.
      var pre = locTabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || locTabs[0];
      if (pre) locActivate(locSlugOf(pre), { hash: false });
    }
    window.addEventListener('hashchange', function () { locFromHash(true); });
  }

  // ---------------------------------------------------------------------
  // B. THE FIVE-STEP QUALIFIER
  // ---------------------------------------------------------------------
  var qz = document.querySelector('[data-qualifier]');
  if (qz) {
    var qzSteps = Array.prototype.slice.call(qz.querySelectorAll('.qz__step'));
    var qzProgress = qz.querySelector('.qz__progress');
    var qzFill = qz.querySelector('.qz__fill');
    var qzMarket = qz.querySelector('#qz-market');
    var qzInfer = qz.querySelector('.qz__infer');
    var qzSum = qz.querySelector('.qz__sum');
    var qzTotal = qzSteps.length;
    var qzAt = 0;
    var qzMarketTouched = false;   // once the visitor edits step 1, a tab switch stops overwriting it

    // The eight homepage industry tiles. NAME + the tile's own dek, verbatim from
    // index.html#industries, + the classifications that dek NAMES IN SO MANY WORDS.
    // Four tiles name none — Hotels, Grocery stores, Convenience stores, Franchise
    // operators and Event venues — and they get an EMPTY list rather than a guess.
    // Inventing a mapping the source never made would be exactly the failure the
    // build contract's "invent nothing" rule exists to stop.
    var IND = {
      'restaurants': ['Restaurants', 'Runs on a Type 41 or a Type 47 — a decision worth making before an offer goes in, not after.', ['41', '47']],
      'bars-nightclubs': ['Bars & nightclubs', 'Rooms where the drink is the business rather than the accompaniment, which is what puts them on a Type 48 rather than a restaurant licence.', ['48']],
      'hotels': ['Hotels', 'One property, several outlets. Restaurant, room service and portable bars are licensed together rather than one at a time.', []],
      'liquor-stores': ['Liquor stores', 'A Type 21 storefront, where the licence is the business rather than one feature of it.', ['21']],
      'grocery-stores': ['Grocery stores', 'Beer and wine, off-sale, held alongside everything else on the shelves. For a multi-site grocer the same question comes up at every address.', []],
      'convenience-stores': ['Convenience stores', 'One counter, a small footprint, and a licence that stays with the site when the store changes hands.', []],
      'franchise-operators': ['Franchise operators', 'The licence follows the brand model. Service style and site requirements decide it, franchise by franchise.', []],
      'event-venues': ['Event venues', 'Hosted events are often served under a special or daily licence rather than a permanent one attached to the building.', []]
    };
    var TYPE_LABEL = {
      '20': 'Type 20 — Off-Sale Beer & Wine',
      '21': 'Type 21 — Off-Sale General',
      '41': 'Type 41 — On-Sale Beer & Wine, Eating Place',
      '47': 'Type 47 — On-Sale General, Eating Place',
      '48': 'Type 48 — On-Sale General, Public Premises'
    };
    var NEED_LABEL = { buy: 'Buying', sell: 'Selling', transfer: 'Transferring', value: 'Valuing' };

    function qzEsc(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function qzChecked(name) {
      var el = qz.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : '';
    }
    function qzVal(id) { var el = qz.querySelector('#' + id); return el ? el.value.trim() : ''; }

    // ---- step visibility + progress -------------------------------------
    function qzGo(n, focus) {
      if (n < 0) n = 0;
      if (n > qzTotal - 1) n = qzTotal - 1;
      qzAt = n;
      qzSteps.forEach(function (s, i) { s.hidden = i !== n; });
      if (qzProgress) qzProgress.textContent = 'Step ' + (n + 1) + ' of ' + qzTotal;
      if (qzFill) qzFill.style.width = Math.round(((n + 1) / qzTotal) * 100) + '%';
      if (n === qzTotal - 1) qzRenderSummary();
      if (focus) {
        var h = qzSteps[n].querySelector('.qz__q');
        /* [BM] 2026-08-10 — FOCUSING THE HEADING IS NOT THE SAME AS SHOWING THE
           STEP. qzGo() focused `.qz__q`, which on mobile is already inside the
           viewport at roughly y=165, so the browser had no reason to scroll —
           while the step's own body and its Continue button had moved BELOW the
           fold. Measured by walking all 5 steps with real taps at 375 and 390:
           window.scrollY never moved once across the whole wizard (3074 at 375,
           3057 at 390), so on steps 2 and 3 the visitor saw an unchanged screen
           and no indication that anything had happened.
           preventScroll keeps focus from fighting the scroll below; the scroll
           only fires when the step does NOT already fit under the sticky header,
           so a desktop viewport that shows the whole step is untouched. */
        if (h && h.focus) {
          try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
        }
        var st = qzSteps[n];
        if (st && st.getBoundingClientRect) {
          var hdr = document.querySelector('.site-header');
          var hdrH = (hdr && getComputedStyle(hdr).position === 'sticky') ? hdr.getBoundingClientRect().height : 0;
          /* The usable viewport is bounded at the BOTTOM too. First cut of this
             fix aligned the step's top under the sticky header and ignored the
             sticky CTA bar, which put step 2's own Continue button at y 788-830
             underneath a bar occupying 774-844: elementFromPoint over the button
             returned the bar, so the wizard's primary action was unclickable
             even though it was "in view". Measured at 375. */
          var bar = document.querySelector('.mm-sticky-cta');
          var barH = 0;
          if (bar && bar.classList.contains('show')) {
            var bcs2 = window.getComputedStyle(bar);
            if (bcs2.display !== 'none' && bcs2.visibility !== 'hidden') barH = bar.getBoundingClientRect().height;
          }
          var usableBottom = window.innerHeight - barH;
          var box = st.getBoundingClientRect();
          if (box.top < hdrH || box.bottom > usableBottom) {
            /* When the step fits the usable band, sit it under the header. When
               it does not, bias to the FOOT of the step so the control the
               visitor has to press is the part guaranteed to be on screen —
               the heading is one scroll away, the buried button is a dead end. */
            var target = (box.height <= usableBottom - hdrH)
              ? window.scrollY + box.top - hdrH - 12
              : window.scrollY + box.bottom - usableBottom + 12;
            window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
          }
        }
      }
    }

    // ---- the running summary on the last step ---------------------------
    function qzRenderSummary() {
      if (!qzSum) return;
      var mkt = qzMarket ? (qzMarket.options[qzMarket.selectedIndex] || {}).text || '' : '';
      var ind = qzChecked('industry');
      var typ = qzChecked('type');
      var need = qzChecked('need');
      var bits = [];
      if (mkt) bits.push('Market: <b>' + qzEsc(mkt) + '</b>');
      if (ind && IND[ind]) bits.push('Business: <b>' + qzEsc(IND[ind][0]) + '</b>');
      bits.push('Classification: <b>' + qzEsc(typ && TYPE_LABEL[typ] ? TYPE_LABEL[typ] : 'Not sure yet — we will advise') + '</b>');
      if (need && NEED_LABEL[need]) bits.push('You are: <b>' + qzEsc(NEED_LABEL[need]) + '</b>');
      qzSum.innerHTML = bits.join('<br>');
    }

    // ---- the inference callout ------------------------------------------
    // Fires ONLY on "Not sure", and only ever SUGGESTS. It never writes a
    // selection: two of the eight tiles name two classifications, and picking
    // one of them for the visitor would be forcing, not inferring.
    function qzUpdateInfer() {
      if (!qzInfer) return;
      var typ = qzChecked('type');
      var ind = qzChecked('industry');
      if (typ !== 'unsure') { qzInfer.hidden = true; qzInfer.innerHTML = ''; return; }
      var row = IND[ind];
      var html;
      if (!row) {
        html = 'Pick a business type on the step before this one and we will read the suggestion off it. ' +
               'You can also leave this on <b>Not sure</b> and let a broker answer it.';
      } else if (row[2].length) {
        var links = row[2].map(function (t) {
          return '<a href="licence-types.html#type-' + t + '">' + qzEsc(TYPE_LABEL[t]) + '</a>';
        }).join(row[2].length === 2 ? ' or ' : ', ');
        html = 'The homepage tile for <b>' + qzEsc(row[0]) + '</b> says: “' + qzEsc(row[1]) + '” ' +
               'So the likely answer is ' + links + '. Nothing has been selected for you — ' +
               'change the choice above if that is right, or leave it on Not sure. ' +
               '<a href="index.html#industries">All eight business types</a>.';
      } else {
        html = 'The homepage tile for <b>' + qzEsc(row[0]) + '</b> does not name one of these five. It says: “' +
               qzEsc(row[1]) + '” Leave this on <b>Not sure</b> and a broker will tell you which classification the site needs. ' +
               '<a href="index.html#industries">All eight business types</a>.';
      }
      qzInfer.innerHTML = html;
      qzInfer.hidden = false;
    }

    // ---- option rows -----------------------------------------------------
    // `.ec-shipopt` is the canonical radio card; `.is-sel` is its selected class.
    Array.prototype.slice.call(qz.querySelectorAll('input[type="radio"]')).forEach(function (input) {
      input.addEventListener('change', function () {
        var group = qz.querySelectorAll('input[name="' + input.name + '"]');
        Array.prototype.slice.call(group).forEach(function (i2) {
          var card = i2.closest ? i2.closest('.ec-shipopt') : null;
          if (card) card.classList.toggle('is-sel', i2.checked);
        });
        if (input.name === 'industry' || input.name === 'type') qzUpdateInfer();
      });
    });

    if (qzMarket) qzMarket.addEventListener('change', function () { qzMarketTouched = true; });

    // ---- nav -------------------------------------------------------------
    // Nothing here blocks on an unanswered question. Every field on this form is
    // optional by design; a stepper that refuses to advance is a worse form than
    // no stepper, and a broker would rather have four answers than none.
    Array.prototype.slice.call(qz.querySelectorAll('[data-qz-next]')).forEach(function (b) {
      b.addEventListener('click', function () { qzGo(qzAt + 1, true); });
    });
    Array.prototype.slice.call(qz.querySelectorAll('[data-qz-back]')).forEach(function (b) {
      b.addEventListener('click', function () { qzGo(qzAt - 1, true); });
    });

    // ---- submit ----------------------------------------------------------
    // The <form> carries action="contact.html" method="get", so with JS off it
    // still lands on the conversion page with every answer in the query string.
    // With JS on we build the same URL by hand, so the hash (#quote) survives —
    // a native GET submit would drop it.
    qz.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = [];
      var push = function (k, v) { if (v) q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); };
      push('from', 'qualifier');
      if (qzMarket) push('market', qzMarket.value);
      push('industry', qzChecked('industry'));
      push('type', qzChecked('type'));
      push('need', qzChecked('need'));
      push('name', qzVal('qz-name'));
      push('business', qzVal('qz-business'));
      push('reach', qzVal('qz-reach'));
      push('note', qzVal('qz-note'));
      window.location.href = 'contact.html' + (q.length ? '?' + q.join('&') : '') + '#quote';
    });

    // ---- pre-fill step 1 from the market tab -----------------------------
    // Exposed on window because part A owns the tabs and part B owns the form;
    // this is the one seam between them. Never overwrites a market the visitor
    // has chosen for themselves — that is the "keep state if the user switches
    // tabs" rule, and it applies to step 1 as much as to steps 2 to 5, which are
    // simply never touched by a tab switch at all.
    window.__llaQzSyncMarket = function (slug) {
      if (!qzMarket || qzMarketTouched) return;
      var ok = Array.prototype.some.call(qzMarket.options, function (o) { return o.value === slug; });
      if (ok) qzMarket.value = slug;
    };
    var initTab = document.querySelector('.loc-tab[aria-selected="true"]');
    if (initTab) window.__llaQzSyncMarket(initTab.getAttribute('data-loc-tab'));

    qzGo(0, false);
  }

  // ---------------------------------------------------------------------
  // C. THE CONTACT HANDOFF
  // Reads the qualifier's answers back into the enquiry form so nothing the
  // visitor typed is lost between the two pages. Gated on from=qualifier, so a
  // direct visit to contact.html is untouched — and every field is only filled
  // when it is EMPTY, so a half-typed form is never overwritten.
  // The county rides along in the "Business and county" field, which is what that
  // field is literally labelled for.
  //
  // UPDATED 2026-09-04 — the carry is INCOMPLETE again, deliberately. contact.html
  // was rebuilt to the client's own four-field form on the owner's instruction,
  // with this cost stated and accepted. Only name, reach and note have somewhere to
  // land now; business, industry, type and need are still collected by the
  // qualifier and have no field here, so they stay in the URL and are never shown.
  // Restoring them means restoring the fields — see _build-contact-form.py.
  // ---------------------------------------------------------------------
  var cName = document.getElementById('q-name');
  if (cName) {
    var cq;
    try { cq = new URLSearchParams(location.search); } catch (e) { cq = null; }
    if (cq && cq.get('from') === 'qualifier') {
      var fill = function (id, v) {
        var el = document.getElementById(id);
        if (el && v && !el.value) el.value = v;
      };
      var mkt = cq.get('market') || '';
      var biz = cq.get('business') || '';
      var mktLabel = mkt && mkt !== 'california' && mkt !== 'other'
        ? mkt.replace(/-/g, ' ').replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); })
        : '';
      fill('q-name', cq.get('name') || '');
      // reach is ONE field on the qualifier and TWO here, so it is split on the only
      // reliable signal available: an "@" means an address, anything else a number.
      // Guessing wrong would drop an email into a tel input.
      var reach = cq.get('reach') || '';
      if (reach) fill(reach.indexOf('@') > -1 ? 'q-email' : 'q-phone', reach);
      // Selects only accept a value the control actually offers — an unknown value
      // would leave the control blank-but-dirty and silently drop the answer.
      var fillSel = function (id, v) {
        var el = document.getElementById(id);
        if (!el || !v || el.value) return;
        var known = Array.prototype.some.call(el.options, function (o) { return o.value === v; });
        if (known) el.value = v;
      };
      var cnote = document.getElementById('q-note');
      if (cnote && cq.get('note') && !cnote.value) cnote.value = cq.get('note');
    }
  }
})();

/* =============================================================================
 * [AI] HERO COMMAND BAR — SUGGESTION-PANEL COMPACTION + PLACEMENT (2026-07-30).
 * Presentation: structural.css block [AI]. index.html only.
 *
 * NULL-GUARDED on [data-cmdbar] on the first line, exactly like [AE] and [AF]:
 * the other nine pages fall straight through with no work and no errors
 * (verified: all 12 other HTML files load clean).
 *
 * WHY A THIRD TOP-LEVEL IIFE: the file's idiom is already "one closure per
 * feature block, each null-guarded" — [AF] at line 1247 is a sibling closure to
 * the first for exactly the reason it states there, and reopening a closure
 * every page loads to add a placement concern would be a worse trade. Nothing
 * here reads a variable from either closure above.
 *
 * ── THE DEFECT [AE] LEFT BEHIND ──────────────────────────────────────────────
 * The panel is absolutely positioned inside `.hero--photo`, which sets BOTH
 * `overflow: hidden` (it clips the panel) AND `isolation: isolate` (it traps the
 * panel's z-index:4, so whatever escapes the clip is painted over by the next
 * section). MEASURED headless at four breakpoints x four scroll positions x
 * seven queries, hit-testing every rendered row's centre with elementFromPoint:
 *
 *     rows reachable          BEFORE        AFTER
 *       1440x900              62/164       164/164
 *       1024x800              70/164       152/164
 *        768x900             116/164       162/164
 *        375x812              50/164       122/164
 *     openings fully inside hero AND viewport
 *       1440 / 1024 / 768 / 375   8 / 4 / 16 / 8  (of 28)  ->  28/28 at every one
 *
 * On an unscrolled 1440x900 load the baseline reached ZERO of 43 rows: the bar
 * ends at y 868 in a 900px viewport. At 375 the baseline additionally scrolled
 * the WHOLE WINDOW during arrow-key navigation (scrollY 251 -> 337 -> 381),
 * because [AE]'s cbHighlight calls `scrollIntoView({block:'nearest'})` (:1020)
 * and the option was outside the viewport, not just outside the panel. Capping
 * the panel to the room that exists removes that too: scrollY is now constant
 * across a full arrow-key walk at every breakpoint.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 * It does not touch `isolation`, the hero z-index stack, `overflow`, any chrome
 * region (header / drawer / footer / sticky bars are READ for geometry and never
 * written), or any HTML. It does not fight the clip — it keeps the panel
 * ENTIRELY INSIDE it, which is where the isolated stacking context already
 * paints the panel correctly.
 *
 * ── THE THREE MEASUREMENTS, in the order they are taken ──────────────────────
 *  1. COMPACT. >=768px gets two columns (presentation in structural.css [AI]).
 *     [AE] emits one div[role="group"] per group (:986), so no group label can
 *     ever be orphaned from its options by the layout.
 *       - MULTI-GROUP: a CONTIGUOUS split over a 1px row grid — groups 1..k down
 *         column 1, k+1..n down column 2, k minimising the taller column. This
 *         is what makes the two columns independent instead of sharing row
 *         heights: measured "type" at 1440, 446px row-major -> 311px contiguous.
 *         Contiguous also keeps DOM order == reading order (down column 1, then
 *         down column 2) == the order [AE]'s arrow keys already walk.
 *       - SINGLE GROUP (the "Start here" prompt; the no-match alternatives): the
 *         group spans the panel and its OWN options are split, column-major, by
 *         explicit grid-column/grid-row — so the same reading convention holds.
 *     Below 768px the panel stays ONE column: a 375px viewport has no room for
 *     two, and [AE]'s own <=640 row treatment keeps owning the row shape.
 *  2. NATURAL HEIGHT, with the clamp lifted and the columns already applied, so
 *     the number is the real content height.
 *  3. THE ROOM THAT ACTUALLY EXISTS above and below the bar — the intersection
 *     of the visual viewport, EVERY clipping ancestor's box (resolved generically
 *     rather than by hard-coding `.hero--photo`), and any fixed/sticky chrome
 *     currently pinned to a viewport edge. Measured bindings at 1440: the
 *     viewport bottom when the hero runs past it, the HERO's own bottom edge
 *     once it is scrolled up (barTop: hero bottom 481 in a 900px viewport), and
 *     the sticky header's 80px at the top.
 * Then: open downward when the panel fits below, upward over the hero copy when
 * that is the clearly roomier side, and cap the height to the room on the chosen
 * side so the panel scrolls internally instead of being clipped away.
 *
 * THE SIDE IS A PURE FUNCTION OF GEOMETRY — no hysteresis, no remembered side. A
 * sticky "keep the previous side" rule was tried and measured to LATCH: a
 * placement that ran on the focus-scroll frame chose UP, every later placement
 * inherited it, and the panel then opened upward at positions where DOWN both
 * fit and was correct. The cost of determinism is that scrolling with the panel
 * open can flip it once at the crossover; that was judged the lesser evil.
 *
 * WIRING: a MutationObserver on the panel, NOT an edit to [AE]. [AE] owns
 * cbPaint/cbShow/cbClose privately (:978/:997/:1004); the panel's `hidden`
 * attribute and its innerHTML replacement are the two things every open and
 * every re-render already produce, so the observer catches all of them — first
 * open, each keystroke, the no-match path, the prompt list. cbPaint runs BEFORE
 * cbShow and a MutationObserver callback is a microtask, so both records arrive
 * in ONE callback, after the panel is already visible and populated: the panel is
 * measured and placed in the same frame it appears in, with no mis-placed flash.
 * The attributeFilter is ['hidden'] and this block only ever writes `class` and
 * `style` (on the panel and on its group/option children), so it cannot
 * re-trigger itself. cbOpts, cbActive and aria-activedescendant are untouched:
 * no DOM node is added, removed or reordered — only grid placement is set, which
 * cannot change DOM order.
 * ============================================================================= */
(function () {
  'use strict';

  var cbpRoot = document.querySelector('[data-cmdbar]');
  if (!cbpRoot) return;                       // the other nine pages stop here
  var cbpPanel = cbpRoot.querySelector('.cmdbar__panel');
  var cbpForm = cbpRoot.querySelector('.cmdbar__form');
  if (!cbpPanel || !cbpForm) return;
  // Fail closed: without an observer or custom-property support, leave [AE]
  // exactly as it is rather than half-applying a placement.
  if (!window.MutationObserver || !cbpPanel.style || !cbpPanel.style.setProperty) return;

  var CBP_GAP = 8;        // == --ds-space-xs, the offset in the panel's top/bottom calc
  var CBP_EDGE = 12;      // never let the panel touch a viewport / clip edge
  var CBP_MINH = 132;     // ~a group label + two rows; below this a panel says nothing
  var CBP_HYST = 48;      // flipping up must be a CLEAR win, not a 2px one
  var CBP_COLS_W = 768;   // matches the breakpoint in structural.css [AI]
  var CBP_OVERLAYS = '.site-header, .mm-sticky-cta, .ec-sticky-cta';

  function cbpPx(n) { return String(Math.round(n)) + 'px'; }

  // The VISUAL viewport, so a mobile keyboard — which shrinks the visual but not
  // the layout viewport — is treated as space the panel may not use.
  function cbpViewport() {
    var vv = window.visualViewport;
    if (vv && typeof vv.height === 'number' && vv.height > 0) {
      var t = vv.offsetTop || 0;
      return { top: t, bottom: t + vv.height };
    }
    var h = window.innerHeight || document.documentElement.clientHeight || 0;
    return { top: 0, bottom: h };
  }

  // Every ancestor that CLIPS, resolved generically rather than by hard-coding
  // `.hero--photo`: the tightest top and bottom any of them imposes. On
  // index.html the only hit is the hero itself (`overflow: hidden`, :3066) —
  // precisely the box the panel was escaping.
  function cbpClipBox() {
    var top = -Infinity, bottom = Infinity;
    var el = cbpPanel.parentNode;
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      var cs = window.getComputedStyle(el);
      if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') {
        var r = el.getBoundingClientRect();
        if (r.top > top) top = r.top;
        if (r.bottom < bottom) bottom = r.bottom;
      }
      el = el.parentNode;
    }
    return { top: top, bottom: bottom };
  }

  // Fixed/sticky chrome pinned to a viewport edge. READ ONLY — no chrome element
  // is written to, so the gated byte-parity of the chrome regions is untouched.
  // A bar translated off-screen (`.mm-sticky-cta`'s resting `translateY(110%)`,
  // :742) reports a rect outside the viewport and is skipped on its own; once it
  // gains `.show` past scrollY 480 (site.js :91) it becomes a hard floor,
  // because its z-index 980 would paint straight over the panel.
  function cbpOverlayBox(vp) {
    var top = vp.top, bottom = vp.bottom;
    var els = document.querySelectorAll(CBP_OVERLAYS);
    for (var i = 0; i < els.length; i++) {
      var cs = window.getComputedStyle(els[i]);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = els[i].getBoundingClientRect();
      if (r.height <= 0 || r.bottom <= vp.top || r.top >= vp.bottom) continue;
      if (r.top <= top + 1) { if (r.bottom > top && r.bottom < bottom) top = r.bottom; }
      else if (r.bottom >= bottom - 1) { if (r.top < bottom && r.top > top) bottom = r.top; }
    }
    return { top: top, bottom: bottom };
  }

  // ---------------------------------------------------------------------
  // COMPACTION. Clears unconditionally first: a re-render can leave stale
  // spans behind, and below the 2-column breakpoint every explicit placement
  // has to be gone. Sets grid placement ONLY — never touches the DOM tree.
  // ---------------------------------------------------------------------
  function cbpLayout(twoCol) {
    var kids = cbpPanel.children, leads = [], grps = [], i, el;
    for (i = 0; i < kids.length; i++) {
      el = kids[i];
      el.style.gridColumn = '';
      el.style.gridRow = '';
      if (el.getAttribute && el.getAttribute('role') === 'group') grps.push(el);
      else leads.push(el);                    // the no-match banner, etc.
    }
    var allOpts = cbpPanel.querySelectorAll('.cmdbar__opt');
    for (i = 0; i < allOpts.length; i++) {
      allOpts[i].style.gridColumn = '';
      allOpts[i].style.gridRow = '';
    }
    cbpPanel.classList.remove('is-balanced');
    cbpPanel.classList.remove('is-onegroup');
    if (!twoCol || !grps.length) return;

    // ONE group: it spans the panel (CSS) and its own options split
    // COLUMN-MAJOR — options 1..k down the left column, k+1..n down the right,
    // which is DOM order down each column and therefore arrow-key order.
    if (grps.length === 1) {
      cbpPanel.classList.add('is-onegroup');
      var opts = grps[0].querySelectorAll('.cmdbar__opt');
      var n = opts.length, k = Math.ceil(n / 2);
      if (n < 2) { if (n) opts[0].style.gridColumn = '1 / -1'; return; }
      for (i = 0; i < n; i++) {
        opts[i].style.gridColumn = (i < k) ? '1' : '2';
        opts[i].style.gridRow = String((i < k ? i : i - k) + 2);   // row 1 = label
      }
      return;
    }

    // TWO OR MORE groups: a CONTIGUOUS split over the 1px row grid. Heights are
    // measured AFTER the clear above and with the clamp already lifted by the
    // caller, so each group is measured at the column width it will keep and at
    // its full natural height. structural.css [AI] reserves the scrollbar track
    // and zeroes the row gap so neither can move these numbers afterwards.
    var h = [], leadH = [], total = 0, row, top, cut = -1, best = Infinity, acc = 0, tall;
    for (i = 0; i < leads.length; i++) {
      leadH[i] = Math.ceil(leads[i].getBoundingClientRect().height) || 1;
    }
    for (i = 0; i < grps.length; i++) {
      h[i] = Math.ceil(grps[i].getBoundingClientRect().height) || 1;
      total += h[i];
    }
    for (i = 0; i < grps.length - 1; i++) {
      acc += h[i];
      tall = acc > (total - acc) ? acc : (total - acc);
      if (tall < best) { best = tall; cut = i; }
    }
    if (cut < 0) return;

    cbpPanel.classList.add('is-balanced');
    row = 1;
    for (i = 0; i < leads.length; i++) {
      leads[i].style.gridColumn = '1 / -1';
      leads[i].style.gridRow = row + ' / span ' + leadH[i];
      row += leadH[i];
    }
    top = row;
    for (i = 0; i <= cut; i++) {
      grps[i].style.gridColumn = '1';
      grps[i].style.gridRow = row + ' / span ' + h[i];
      row += h[i];
    }
    row = top;
    for (i = cut + 1; i < grps.length; i++) {
      grps[i].style.gridColumn = '2';
      grps[i].style.gridRow = row + ' / span ' + h[i];
      row += h[i];
    }
  }

  // ---------------------------------------------------------------------
  // PLACEMENT
  // ---------------------------------------------------------------------
  var cbpBusy = false;
  function cbpPlace() {
    if (cbpBusy || cbpPanel.hidden) return;
    cbpBusy = true;
    try {
      // 1. compact. The clamp is lifted FIRST so every measurement below —
      //    the group heights inside cbpLayout included — is a natural height.
      //    The CSS is media-gated too, so a stale class cannot leak a
      //    2-column panel onto a 375px viewport.
      cbpPanel.style.setProperty('--cb-panel-max', 'none');
      var wide = (window.innerWidth || document.documentElement.clientWidth || 0) >= CBP_COLS_W;
      if (wide) cbpPanel.classList.add('is-cols');
      else cbpPanel.classList.remove('is-cols');
      cbpLayout(wide);

      // 2. the real content height, columns already applied.
      var natural = cbpPanel.getBoundingClientRect().height || cbpPanel.scrollHeight;

      // 3. the room that actually exists on each side.
      var vp = cbpViewport();
      var clip = cbpClipBox();
      var ov = cbpOverlayBox(vp);
      var topLimit = Math.max(clip.top, ov.top) + CBP_EDGE;
      var bottomLimit = Math.min(clip.bottom, ov.bottom) - CBP_EDGE;

      var r = cbpForm.getBoundingClientRect();   // the panel's containing block
      var below = bottomLimit - r.bottom - CBP_GAP;
      var above = r.top - CBP_GAP - topLimit;

      // DOWN whenever the panel fits below — which is what preserves the
      // existing downward behaviour wherever it already worked — and UP only
      // when it is a clear win. Stateless; see the header note on the latch.
      var up = (natural > below) && (above > below + CBP_HYST);
      var avail = up ? above : below;
      if (up) cbpPanel.classList.add('cmdbar__panel--up');
      else cbpPanel.classList.remove('cmdbar__panel--up');

      // Cap to the room on the chosen side; the panel already scrolls
      // internally (overflow-y: auto, :5042). Left at `none` when it fits, so a
      // short panel is not given a pointless max-height and the 62vh/520px
      // ceiling no longer truncates a panel that had room to spare.
      if (natural > avail) {
        cbpPanel.style.setProperty('--cb-panel-max', cbpPx(Math.max(CBP_MINH, avail)));
      }
    } finally {
      cbpBusy = false;   // never leave the placement latched shut on a throw
    }
  }

  var cbpRaf = 0;
  function cbpSchedule() {
    if (cbpPanel.hidden || cbpRaf) return;
    cbpRaf = window.requestAnimationFrame(function () { cbpRaf = 0; cbpPlace(); });
  }

  new window.MutationObserver(function () { cbpPlace(); })
    .observe(cbpPanel, { attributes: true, attributeFilter: ['hidden'], childList: true });

  // Scrolling moves the bar relative to the viewport, to the hero's clipped
  // bottom edge and to the sticky chrome, so an open panel is re-placed on the
  // next frame rather than left behind.
  window.addEventListener('resize', cbpSchedule);
  window.addEventListener('scroll', cbpSchedule, { passive: true });
  if (window.visualViewport && window.visualViewport.addEventListener) {
    window.visualViewport.addEventListener('resize', cbpSchedule);
    window.visualViewport.addEventListener('scroll', cbpSchedule);
  }
})();


/* =============================================================================
 * [AM] LICENSING DROPDOWN — THE PREVIEW PANE (2026-07-30).
 * Presentation: structural.css block [AM]. Chrome-wide (all 11 pages carry the
 * header), so unlike [AE]/[AI] this one does not stop on nine pages — but it is
 * NULL-GUARDED the same way, on #mm-dd-licensing first and then on the pane's
 * own parts, so brand-card.html / lock-preview.html (no chrome at all) and any
 * future chrome-less page fall straight through with no work and no errors.
 *
 * WHY A FOURTH TOP-LEVEL IIFE: the file's idiom is already "one closure per
 * feature block, each null-guarded" — [AI] states the same at :1739. Nothing
 * here reads a variable from any closure above it.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 * The panel's 268px left column used to be a FEATURE TILE that promoted Type 47
 * out of the list. The owner asked for Type 47 back IN the list and for that
 * area to be used "as a larger preview". So the area is now one <a>, and this
 * block points it at whichever of the nine items is hovered or keyboard-focused:
 *   · href      -> the item's OWN href, so clicking the pane goes exactly where
 *                  clicking the item goes. Never synthesised, never guessed.
 *   · watermark -> the licence NUMBER parsed out of the item's own title
 *                  (/^Type (\d+)/ -> "21" / "47" / "48"). An item with no number
 *                  gets "§" and NEVER an invented one. structural.css [AM]
 *                  carries the full argument for the section sign.
 *   · title/dek -> the item's own .t / .d text, verbatim. No rewriting.
 *
 * ── DEFAULT STATE ────────────────────────────────────────────────────────────
 * Nothing hovered and nothing focused -> Type 47: the flagship eating-place
 * licence and the owner's chosen feature. It is ALSO hard-coded in the markup,
 * so the pane is already correct before this file runs, and stays correct if it
 * never runs at all.
 *
 * ── ACCESSIBILITY ────────────────────────────────────────────────────────────
 * This block never adds a role, never removes aria-hidden, and never touches the
 * nine menuitems — it only writes href / textContent / data-kind on nodes that
 * are inside an aria-hidden="true" subtree. The pane duplicates list content, so
 * announcing it would announce every item twice and double the menu's item
 * count. Keyboard focus drives the pane exactly as hover does, so a keyboard
 * visitor is never shown a stale preview.
 *
 * WHY DIRECT focus/blur AND NOT focusin/focusout: focus does not bubble, but a
 * listener bound to the element ITSELF still fires, and this file has no focusin
 * usage to match. Nine links, four listeners each, bound once at load.
 *
 * LAST-INPUT-WINS: hover and focus are tracked separately and the more recent of
 * the two owns the pane — so tabbing away from where the mouse is parked updates
 * it, and moving the mouse after tabbing updates it too. Release both and it
 * falls back to Type 47.
 * ============================================================================= */
(function () {
  'use strict';

  var mdlPanel = document.getElementById('mm-dd-licensing');
  if (!mdlPanel) return;                          // no chrome on this page -> stop
  var mdlPane = mdlPanel.querySelector('.mm-dd-preview');
  if (!mdlPane) return;
  var mdlMark = mdlPane.querySelector('.mm-dd-preview__mark');
  var mdlTtl = mdlPane.querySelector('.mm-dd-preview__t');
  var mdlDek = mdlPane.querySelector('.mm-dd-preview__d');
  if (!mdlMark || !mdlTtl || !mdlDek) return;
  var mdlLinks = mdlPanel.querySelectorAll('ul > li > a[role="menuitem"]');
  if (!mdlLinks.length) return;

  // ESCAPED, not a literal "§": a classic <script src> with no charset on the
  // response inherits the DOCUMENT's encoding, so a raw U+00A7 in the code path
  // is one mis-served content-type away from painting "Â§" in the pane. The
  // escape is encoding-proof. (Comments may hold literals; a code path may not.)
  var MDL_NEUTRAL = '\u00A7';                // section sign — never a number
  var MDL_NUM = /^\s*Type\s+(\d+)\b/;

  var mdlItems = [];
  var mdlDef = 0;
  var i, node, tEl, dEl, title, hit;

  for (i = 0; i < mdlLinks.length; i++) {
    node = mdlLinks[i];
    tEl = node.querySelector('.t');
    dEl = node.querySelector('.d');
    // .t's arrow is a ::after pseudo-element, so it is not in textContent.
    title = tEl ? (tEl.textContent || '') : '';
    hit = MDL_NUM.exec(title);
    mdlItems.push({
      href: node.getAttribute('href') || '',
      title: title,
      dek: dEl ? (dEl.textContent || '') : '',
      mark: hit ? hit[1] : MDL_NEUTRAL,
      kind: hit ? 'num' : 'neutral'
    });
    if (hit && hit[1] === '47') mdlDef = i;        // the owner's flagship default
  }

  var mdlCur = -1;
  function mdlPaint(idx) {
    if (idx < 0 || idx >= mdlItems.length) idx = mdlDef;
    if (idx === mdlCur) return;
    var it = mdlItems[idx];
    mdlPane.setAttribute('href', it.href);
    mdlMark.setAttribute('data-kind', it.kind);
    mdlMark.textContent = it.mark;
    mdlTtl.textContent = it.title;
    mdlDek.textContent = it.dek;
    mdlCur = idx;
  }

  var mdlHover = -1;
  var mdlFocus = -1;
  var mdlLast = -1;
  function mdlSync() {
    var idx;
    if (mdlHover >= 0 && mdlFocus >= 0) idx = mdlLast >= 0 ? mdlLast : mdlHover;
    else if (mdlHover >= 0) idx = mdlHover;
    else if (mdlFocus >= 0) idx = mdlFocus;
    else idx = mdlDef;
    mdlPaint(idx);
  }

  // A NAMED binder, so each handler closes over its OWN idx — the classic
  // loop-variable capture trap, which is real here because this file is ES5 and
  // has no block scoping to lean on.
  function mdlBind(el, idx) {
    el.addEventListener('mouseenter', function () {
      mdlHover = idx;
      mdlLast = idx;
      mdlSync();
    });
    el.addEventListener('mouseleave', function () {
      if (mdlHover === idx) mdlHover = -1;
      mdlSync();
    });
    el.addEventListener('focus', function () {
      mdlFocus = idx;
      mdlLast = idx;
      mdlSync();
    });
    el.addEventListener('blur', function () {
      if (mdlFocus === idx) mdlFocus = -1;
      mdlSync();
    });
  }
  for (i = 0; i < mdlLinks.length; i++) mdlBind(mdlLinks[i], i);

  // Closing the menu with the mouse must RESET the pane, not leave it on the last
  // thing the pointer grazed on its way out. The panel's own <li> is the hover
  // host that structural.css:614 opens on, so its mouseleave is the close signal.
  // Focus, if any is still inside, keeps its claim — mdlSync decides.
  var mdlHost = mdlPanel.parentNode;
  if (mdlHost && mdlHost.addEventListener) {
    mdlHost.addEventListener('mouseleave', function () {
      mdlHover = -1;
      mdlSync();
    });
  }

  mdlPaint(mdlDef);                               // agree with the markup's default
})();


/* =============================================================================
 * [AP] #services DEPTH CAROUSEL — behaviour (2026-08-06)
 * -----------------------------------------------------------------------------
 * Presentation: design-system/structural.css block [AP]. Homepage only —
 * `.svc-rows` / `.svc-row` exist solely on index.html (services.html's #services
 * uses .cap-breakdown__grid / .capability-card), so this is a no-op elsewhere.
 * Self-guarded and null-safe: if #services or the track is absent it returns
 * without touching anything, per the one-IIFE-per-feature convention this file
 * already follows.
 *
 * DELIBERATELY THIN. The track is a native scroll-snap scroller, so swipe, drag,
 * keyboard scrolling and the scrollbar are all browser behaviour. This script
 * only: (a) adds `.svc-car-on`, the class every depth rule in [AP]'s CSS hangs
 * off, (b) injects the prev/next buttons, counter and polite live region, and
 * (c) marks which card is centred by reading the REAL scroll position.
 *
 * (a) IS LOAD-BEARING FOR NO-JS. Every blur/scale rule is gated on
 * `.svc-car-on`. Without this script no class is added, nothing is blurred, and
 * the band degrades to a plain readable horizontal scroller — verified with
 * javaScriptEnabled:false: 0 blurred, 8 sharp, track still scrollable. An
 * earlier version had the receded state as the CSS default and rendered all 8
 * cards permanently blurred with scripting off.
 *
 * (c) READS SCROLL POSITION, NEVER AN INTERNAL COUNTER. The active card is
 * derived from where the track actually is, so dragging, swiping, flicking,
 * keyboard-scrolling and clicking the buttons can never desync the highlight
 * from what the user is looking at.
 * ============================================================================= */

(function () {
  'use strict';

  var sec = document.getElementById('services');
  if (!sec) return;

  var track = sec.querySelector('.svc-rows');
  if (!track) return;

  var cards = Array.prototype.filter.call(track.children, function (el) {
    return el.classList && el.classList.contains('svc-row');
  });
  if (cards.length < 2) return;

  var LAST = cards.length - 1;

  function prefersReduce() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* Reveal safety. .wow-stagger.in-view > * is what lifts these cards off
     opacity:0; site.js adds .in-view via IntersectionObserver, but a card that
     is scrolled out of the TRACK is clipped and may never intersect. The class
     lives on the CONTAINER (all eight children light at once), so asserting it
     here guarantees no service can ever be stuck invisible inside the scroller. */
  track.classList.add('in-view');
  /* The enhancement flag. Every depth rule in opt-CAR.css hangs off this class,
     so with scripting off nothing is blurred and the band stays a plain,
     readable horizontal scroller. Added here, before the first paint work, so
     there is no flash of an un-receded band. */
  track.classList.add('svc-car-on');

  /* Image safety, and a real defect this layout creates rather than a gate
     workaround: once the cards live inside a clipped horizontal scroller, the
     seven off-centre ones are outside the viewport for lazy-loading purposes,
     so loading="lazy" never fires for them. MEASURED before this fix:
     brokenImages 5 of 8 at 1440/1024/768 and 4 of 8 at 375 — a swipe would land
     on an empty card and then pop. A carousel must have every slide decoded
     before it is reached, so the eight card images are promoted to eager.
     decoding="async" (already on the markup) keeps them off the main thread. */
  cards.forEach(function (card) {
    var im = card.querySelector('img');
    if (im && im.getAttribute('loading') === 'lazy') im.setAttribute('loading', 'eager');
  });

  /* ---------------------------------------------------------------------------
   * A11Y WIRING on the existing markup (no element is replaced or moved).
   * ------------------------------------------------------------------------ */
  if (!track.id) track.id = 'svc-carousel-track';
  track.setAttribute('role', 'group');
  track.setAttribute('aria-roledescription', 'carousel');

  var heading = sec.querySelector('h2');
  if (heading) {
    if (!heading.id) heading.id = 'svc-carousel-label';
    track.setAttribute('aria-labelledby', heading.id);
  } else {
    track.setAttribute('aria-label', 'Services');
  }

  /* A scrollable region must be reachable and operable by keyboard (WCAG 2.1.1
     / 2.1.3). Tab lands on the track; Left/Right/Home/End drive it. */
  if (!track.hasAttribute('tabindex')) track.setAttribute('tabindex', '0');

  cards.forEach(function (card, i) {
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', (i + 1) + ' of ' + cards.length);
  });

  /* ---------------------------------------------------------------------------
   * CONTROLS
   * ------------------------------------------------------------------------ */
  function makeButton(dir, label, glyph) {
    var b = document.createElement('button');
    b.type = 'button';                       /* a real <button>, never a <div> */
    b.className = 'svc-car__btn svc-car__btn--' + dir;
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-controls', track.id);
    var g = document.createElement('span');
    g.setAttribute('aria-hidden', 'true');   /* the glyph is decoration; the
                                                accessible name is the label */
    g.textContent = glyph;
    b.appendChild(g);
    return b;
  }

  var prevBtn = makeButton('prev', 'Previous service', '‹');
  var nextBtn = makeButton('next', 'Next service', '›');

  var counter = document.createElement('span');
  counter.className = 'svc-car__count';
  counter.setAttribute('aria-hidden', 'true');  /* the live region carries this
                                                   information for AT already */

  var live = document.createElement('div');
  live.className = 'svc-car__live';
  live.setAttribute('aria-live', 'polite');     /* polite, never assertive */
  live.setAttribute('aria-atomic', 'true');

  var ctrls = document.createElement('div');
  ctrls.className = 'svc-car__ctrls';
  ctrls.appendChild(prevBtn);
  ctrls.appendChild(nextBtn);
  ctrls.appendChild(counter);
  ctrls.appendChild(live);
  track.parentNode.insertBefore(ctrls, track.nextSibling);

  /* ---------------------------------------------------------------------------
   * GEOMETRY — layout coordinates only.
   * offsetLeft / offsetWidth are UNTRANSFORMED; getBoundingClientRect is not,
   * and the neighbours carry scale()+translateX(), so rect maths would centre
   * them wrongly. opt-CAR.css sets position:relative on the track precisely so
   * that every card's offsetParent IS the track and offsetLeft shares an origin
   * with scrollLeft.
   * ------------------------------------------------------------------------ */
  function layoutLeft(card) {
    if (card.offsetParent === track) return card.offsetLeft;
    /* fallback only — should never run while the CSS is loaded */
    return card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
  }

  function scrollTargetFor(i) {
    var card = cards[i];
    var raw = layoutLeft(card) - (track.clientWidth - card.offsetWidth) / 2;
    var max = Math.max(0, track.scrollWidth - track.clientWidth);
    return Math.max(0, Math.min(Math.round(raw), max));
  }

  function nearestIndex() {
    var mid = track.scrollLeft + track.clientWidth / 2;
    var best = 0, bestDist = Infinity;
    for (var i = 0; i < cards.length; i++) {
      var d = Math.abs(layoutLeft(cards[i]) + cards[i].offsetWidth / 2 - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------------------------------------------------------------------
   * STATE
   * ------------------------------------------------------------------------ */
  var current = -1;
  var announceTimer = 0;

  function announce(i) {
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(function () {
      var h3 = cards[i].querySelector('h3');
      live.textContent = 'Service ' + (i + 1) + ' of ' + cards.length +
        (h3 ? ': ' + h3.textContent.trim() : '');
    }, 320);   /* debounced so a drag across the track does not queue 8 messages */
  }

  function apply(i, shouldAnnounce) {
    if (i === current) return;
    current = i;

    for (var k = 0; k < cards.length; k++) {
      var card = cards[k];
      var rel = k - i;
      var isActive = rel === 0;
      var isNear = rel === 1 || rel === -1;

      card.classList.toggle('is-active', isActive);
      card.classList.toggle('is-near', isNear);

      /* +1 for the neighbour on the LEFT, -1 for the one on the RIGHT, so the
         CSS translateX always slides the neighbour INWARD, under the subject.
         Inward-only is what keeps the track's scrollable width from growing. */
      if (isNear) card.style.setProperty('--car-dir', String(-rel));
      else card.style.removeProperty('--car-dir');

      if (isActive) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    }

    counter.textContent = pad(i + 1) + ' / ' + pad(cards.length);

    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= LAST;
    /* never let focus evaporate onto a button we just disabled */
    if (nextBtn.disabled && document.activeElement === nextBtn && !prevBtn.disabled) prevBtn.focus();
    if (prevBtn.disabled && document.activeElement === prevBtn && !nextBtn.disabled) nextBtn.focus();

    if (shouldAnnounce) announce(i);
  }

  function goTo(i, smooth) {
    i = Math.max(0, Math.min(i, LAST));
    var left = scrollTargetFor(i);
    apply(i, true);
    try {
      track.scrollTo({ left: left, behavior: (smooth && !prefersReduce()) ? 'smooth' : 'auto' });
    } catch (e) {
      track.scrollLeft = left;   /* older engines without ScrollToOptions */
    }
  }

  /* ---------------------------------------------------------------------------
   * EVENTS
   * ------------------------------------------------------------------------ */
  prevBtn.addEventListener('click', function () { goTo(current - 1, true); });
  nextBtn.addEventListener('click', function () { goTo(current + 1, true); });

  var rafId = 0;
  track.addEventListener('scroll', function () {
    if (rafId) return;
    rafId = window.requestAnimationFrame(function () {
      rafId = 0;
      apply(nearestIndex(), true);
    });
  }, { passive: true });

  /* A focused card MUST be visible. Instant, never smooth: a smooth scroll
     leaves the focused element off-screen for the length of the animation,
     which is the keyboard trap this guards against. */
  track.addEventListener('focusin', function (e) {
    var node = e.target;
    var card = (node && node.closest) ? node.closest('.svc-row') : null;
    if (!card) return;                       /* the track itself took focus */
    var i = cards.indexOf(card);
    if (i < 0) return;
    goTo(i, false);
  });

  track.addEventListener('keydown', function (e) {
    if (e.target !== track) return;          /* never hijack keys inside a link */
    var k = e.key;
    if (k === 'ArrowRight') { e.preventDefault(); goTo(current + 1, true); }
    else if (k === 'ArrowLeft') { e.preventDefault(); goTo(current - 1, true); }
    else if (k === 'Home') { e.preventDefault(); goTo(0, true); }
    else if (k === 'End') { e.preventDefault(); goTo(LAST, true); }
  });

  /* re-centre the subject when the card width changes at a breakpoint */
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var i = current < 0 ? 0 : current;
      track.scrollLeft = scrollTargetFor(i);
    }, 150);
  });

  /* ---------------------------------------------------------------------------
   * INIT — synchronous, at end of body, so the band never paints with all eight
   * cards blurred and no subject.
   * ------------------------------------------------------------------------ */
  apply(nearestIndex(), false);
})();


/* =============================================================================
 * [AT] #inventory COVERFLOW — behaviour (2026-08-07)
 * -----------------------------------------------------------------------------
 * Presentation: design-system/structural.css block [AT]. Homepage only — the
 * selector is anchored on `#inventory.collection`, the one class that separates
 * index.html's band from inventory.html's full board, so this is a no-op on
 * every other page. Self-guarded and null-safe, per the one-IIFE-per-feature
 * convention this file already follows.
 * ============================================================================= */

/* =============================================================================
 * opt-COVER.js — #inventory COVERFLOW behaviour  ·  2026-08-07
 * -----------------------------------------------------------------------------
 * Presentation: opt-COVER.css. Homepage only — the selector is anchored on
 * `#inventory.collection`, the one class that distinguishes index.html's band
 * from inventory.html's full board, so this is a no-op on every other page.
 * Self-guarded and null-safe, per the one-IIFE-per-feature convention site.js
 * already follows.
 *
 * DELIBERATELY THIN, exactly like [AP]. The track is a native scroll-snap
 * scroller, so swipe, drag, momentum, keyboard scrolling and the scrollbar are
 * all browser behaviour. This script only:
 *   (a) adds `.cov-on`, the class EVERY 3D rule hangs off,
 *   (b) writes `data-off` — the signed distance from the subject — on each card,
 *   (c) injects prev/next, the counter and a polite live region,
 *   (d) brings a keyboard-focused card to the front.
 *
 * (a) IS LOAD-BEARING FOR NO-JS. If this file fails to load, no class is added,
 * no rotation applies, and the band degrades to a plain sharp horizontal
 * scroller with all six cards square-on and fully readable.
 *
 * (b) READS SCROLL POSITION, NEVER AN INTERNAL COUNTER. The subject is derived
 * from where the track actually is, so dragging, flicking, swiping, keyboard
 * scrolling and the buttons can never desync the fan from what is on screen.
 * ============================================================================= */

(function () {
  'use strict';

  var sec = document.querySelector('#inventory.collection');
  if (!sec) return;
  var track = sec.querySelector('.collection__grid');
  if (!track) return;
  var cards = Array.prototype.slice.call(track.querySelectorAll('.product-card'));
  if (cards.length < 2) return;

  /* (a) — the gate every 3D rule in the CSS hangs off */
  track.classList.add('cov-on');

  /* ---- (c) controls ------------------------------------------------------ */
  var nav = document.createElement('div');
  nav.className = 'cov-nav';

  var prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'cov-nav__btn cov-nav__btn--prev';
  prev.setAttribute('aria-label', 'Previous licence');
  prev.innerHTML = '‹';

  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'cov-nav__btn cov-nav__btn--next';
  next.setAttribute('aria-label', 'Next licence');
  next.innerHTML = '›';

  var count = document.createElement('span');
  count.className = 'cov-nav__count';

  var live = document.createElement('span');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');

  nav.appendChild(prev);
  nav.appendChild(next);
  nav.appendChild(count);
  nav.appendChild(live);
  track.parentNode.insertBefore(nav, track.nextSibling);

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---- the subject, read from the REAL scroll position ------------------- */
  function nearestIndex() {
    var mid = track.scrollLeft + track.clientWidth / 2;
    var best = 0, bestD = Infinity;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      /* offsetLeft is a LAYOUT metric — unaffected by the depth transform, so
         the maths never chases the very transform it is about to apply. Using
         getBoundingClientRect here would feed the scaled box back in and the
         subject would flicker between two cards at rest. */
      var centre = c.offsetLeft + c.offsetWidth / 2;
      var d = Math.abs(centre - mid);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  var lastActive = -1;

  /* ---- (b) write the signed offset -------------------------------------- */
  function paint() {
    var active = nearestIndex();
    for (var i = 0; i < cards.length; i++) {
      var off = i - active;
      if (off > 3) off = 3;
      if (off < -3) off = -3;
      cards[i].setAttribute('data-off', String(off));
      if (i === active) {
        cards[i].setAttribute('aria-current', 'true');
      } else {
        cards[i].removeAttribute('aria-current');
      }
    }
    prev.disabled = active <= 0;
    next.disabled = active >= cards.length - 1;
    count.textContent = pad(active + 1) + ' / ' + pad(cards.length);

    if (active !== lastActive) {
      lastActive = active;
      var name = cards[active].querySelector('.product-card__name');
      live.textContent = (name ? name.textContent.trim() + ', ' : '') +
                         'licence ' + (active + 1) + ' of ' + cards.length;
    }
  }

  function scrollToIndex(i, instant) {
    if (i < 0) i = 0;
    if (i > cards.length - 1) i = cards.length - 1;
    var c = cards[i];
    var target = c.offsetLeft + c.offsetWidth / 2 - track.clientWidth / 2;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (track.scrollTo) {
      track.scrollTo({ left: target, behavior: (instant || reduce) ? 'auto' : 'smooth' });
    } else {
      track.scrollLeft = target;
    }
    /* paint immediately rather than waiting for the scroll event: a focus jump
       must land the card at the front NOW, not one animation frame later. */
    paint();
  }

  prev.addEventListener('click', function () { scrollToIndex(nearestIndex() - 1); });
  next.addEventListener('click', function () { scrollToIndex(nearestIndex() + 1); });

  /* ---- (d) a focused card must come to the front -------------------------
     Turned-away cards are pointer-events:none in the CSS, which does NOT remove
     them from the tab order. So a keyboard user can land on a card that is
     hinged 42deg away and unreadable. Bringing it to the front on focus is what
     keeps that from being a trap.

     A keyboard jump is INSTANT, not smoothed: a smooth scroll means the card is
     still turned away for ~400ms after focus lands, and a screen-reader user
     hears the label of a card they cannot yet see. */
  track.addEventListener('focusin', function (e) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].contains(e.target)) {
        if (i !== nearestIndex()) scrollToIndex(i, true);
        break;
      }
    }
  });

  /* ---- repaint on real scroll, cheaply ----------------------------------
     ...and RE-SNAP once the scrolling stops. `scroll-snap-type: x mandatory`
     only snaps scrolls the SNAP CONTAINER performs; a programmatic scroll from
     outside — `element.scrollIntoView()` on the section, which is exactly what
     an anchor link to #inventory does, and what a browser does when restoring a
     scroll position — can leave the track parked BETWEEN two cards with a half
     card showing at the edge. MEASURED: capturing this band drove scrollLeft
     from 675 to 84 and left a sliced card on screen.
     So after the track has been still for a moment, if it is not aligned to a
     card centre, put it on one. Guarded by `settling` so our own correction
     cannot retrigger itself. */
  var ticking = false, settleTimer = null, settling = false;

  function reSnap() {
    if (settling) return;
    var i = nearestIndex();
    var c = cards[i];
    var want = c.offsetLeft + c.offsetWidth / 2 - track.clientWidth / 2;
    var max = track.scrollWidth - track.clientWidth;
    if (want < 0) want = 0;
    if (want > max) want = max;
    /* 2px of slop: never fight a scroll that is already effectively aligned */
    if (Math.abs(track.scrollLeft - want) <= 2) return;
    settling = true;
    track.scrollLeft = want;
    paint();
    window.requestAnimationFrame(function () { settling = false; });
  }

  track.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(function () { paint(); ticking = false; });
    }
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(reSnap, 140);
  }, { passive: true });

  window.addEventListener('resize', function () {
    /* --cov-w changes at the breakpoints, so the centring maths has to re-run */
    paint();
  });

  /* images are lazy — a late load changes offsetLeft, so repaint when they land */
  track.querySelectorAll('img').forEach(function (img) {
    if (!img.complete) img.addEventListener('load', paint, { once: true });
  });

  /* OPEN ON THE MIDDLE CARD. The reference is a SYMMETRIC fan: a centre card
     with neighbours falling away on both sides. Opening at scroll origin puts
     the subject at the far left with nothing to its left, so half the band is
     empty and it reads as a broken grid rather than a coverflow — the first
     capture showed exactly that. Instant, not smoothed: the band must be in its
     resting arrangement before it is ever seen, not animate into it on load. */
  scrollToIndex(Math.floor((cards.length - 1) / 2), true);
  paint();
})();


/* =============================================================================
 * [AV] #services MASTER-DETAIL — behaviour (owner-selected, 2026-08-07)
 * -----------------------------------------------------------------------------
 * Presentation: design-system/structural.css block [AV].
 * Homepage only — .svc-rows / .svc-row exist solely on index.html, so this is a
 * no-op elsewhere. Self-guarded and null-safe.
 *
 * RUNS AFTER [AP] IN THIS FILE, which is what lets PHASE 2 decommission the
 * carousel [AP] builds: it strips .svc-car-on, the roledescriptions and the
 * per-card aria-labels, REMOVES the prev/next controls [AP] injects, and then
 * re-asserts this block's own selection. Idempotent, bound to both
 * DOMContentLoaded and load.
 *
 * PHASE 1 adds .md-on — the class EVERY two-pane rule in [AV] hangs off. If this
 * script never runs, no class is added and the band degrades to a plain grid of
 * eight COMPLETE cards. Verified with javaScriptEnabled:false: 8/8 readable.
 * ============================================================================= */

/* =============================================================================
 * opt-MDTILE.js — #services MASTER-DETAIL behaviour  ·  2026-08-07
 * -----------------------------------------------------------------------------
 * Presentation: opt-MDTILE.css. Homepage only — `.svc-rows` / `.svc-row` exist
 * solely on index.html (services.html's #services uses .cap-breakdown__grid /
 * .capability-card), so this is a no-op elsewhere. Self-guarded and null-safe,
 * per the one-IIFE-per-feature convention site.js already follows.
 *
 * -----------------------------------------------------------------------------
 * ★ WHAT THIS SCRIPT IS ALLOWED TO DO: MOVE ONE CLASS.
 * -----------------------------------------------------------------------------
 * `.is-md` marks the selected card. CSS grid does the rest — the card carrying
 * it is placed in the large left cell and rendered large, the other seven fall
 * into the narrow columns and render compact. There is no detail pane to fill,
 * so there is nothing to clone: no innerHTML is read, no node is created except
 * one empty live region, no node is moved, and no content is duplicated. Every
 * heading, dek and link exists exactly once in the DOM and exactly once in the
 * accessibility tree, in the same order the markup ships them.
 *
 * -----------------------------------------------------------------------------
 * THE INTERACTION
 * -----------------------------------------------------------------------------
 * POINTER   the whole tile is the hit area (opt-MDTILE.css §6.4 stretches the
 *           card's own link across it). Clicking a tile SELECTS it — it does
 *           not navigate; the preview is the point. Clicking the subject's link
 *           navigates, because at that point the user has seen what they are
 *           clicking into.
 * KEYBOARD  all eight controls stay in the natural tab order — nothing is
 *           removed from it and there is no roving tabindex to strand anyone.
 *           Enter or Space on a tile selects it (MANUAL activation: focus alone
 *           does not select, so tabbing across the rail does not reflow the band
 *           under the user's cursor on every keystroke). Arrow keys / Home / End
 *           move between the eight controls. Enter on the subject's link follows
 *           it, exactly like the link it is.
 * ARIA      the selected <article> carries `aria-current="true"`. A tile's link
 *           points `aria-labelledby` at its OWN <h3>, because opt-MDTILE.css
 *           retires the link's visible label on a tile and the accessible name
 *           must match the label the user can see (WCAG 2.5.3). `labelledby`
 *           rather than an `aria-label` string, so the name is computed from the
 *           one and only copy of that heading and not even the accessibility
 *           tree gains a second instance of the text. Selecting a card clears it,
 *           so the subject's link is announced by its real, now-visible label.
 * ANNOUNCE  a polite live region names the service that is now showing, because
 *           the region that changed is a long way from the control that changed
 *           it.
 *
 * -----------------------------------------------------------------------------
 * WHY HALF OF THIS FILE IS ABOUT DECOMMISSIONING THE [AP] CAROUSEL
 * -----------------------------------------------------------------------------
 * design-system/site.js is a SYMLINK to the live client site and cannot be
 * edited from this lab, so its [AP] block (site.js:2232) still runs on this
 * page and still builds a carousel out of these eight cards: it adds
 * `.svc-car-on`, injects prev/next buttons + a counter + its own live region,
 * relabels every <article> as "N of 8" with `role="group"` /
 * `aria-roledescription="slide"`, makes the track a tabbable scroll region, and
 * marks a card `.is-active` + `aria-current` from the track's SCROLL POSITION.
 * Left alone, that fights this layout for the same attributes and would leave
 * two different cards claiming to be selected.
 *
 * In production this file REPLACES that IIFE. Here it neutralises it, and the
 * neutralisation is exhaustive rather than hopeful, because [AP] has exactly
 * five ways back in and all five are closed:
 *   1. prev / next click  -> the whole `.svc-car__ctrls` node is removed, so the
 *                            buttons no longer exist in the document.
 *   2. track `scroll`     -> the track is a grid with `overflow: visible`
 *                            (opt-MDTILE.css §1). A non-scrolling box never
 *                            fires `scroll`.
 *   3. track `keydown`    -> [AP]'s handler returns unless `e.target === track`,
 *                            and the track's `tabindex` is removed here, so the
 *                            track can never BE the target.
 *   4. window `resize`    -> its handler only assigns `track.scrollLeft`, which
 *                            is inert on a non-scrolling box.
 *   5. track `focusin`    -> the only live route left, and the one that would
 *                            re-mark a different card on every Tab. Closed with
 *                            a CAPTURE-phase listener on #services: capture runs
 *                            on ancestors BEFORE the bubble listener on the
 *                            track, so `stopPropagation()` there means the event
 *                            never reaches it. Scoped to this section, and
 *                            [AP]:2452 is the only `focusin` listener anywhere
 *                            inside it (site.js:178 is `focusout` on an
 *                            unrelated group; :2642 is #inventory's coverflow).
 *
 * -----------------------------------------------------------------------------
 * ORDERING — WHY THERE ARE TWO PHASES AND NOT ONE
 * -----------------------------------------------------------------------------
 * _base.html loads site.js with `defer`; make-opt.mjs appends this file as a
 * plain classic script before </body>. A classic script runs DURING parsing and
 * a deferred one runs AFTER it, so THIS FILE EXECUTES BEFORE site.js. Anything
 * torn down at execution time would simply be rebuilt moments later.
 *   PHASE 1 runs immediately: it adds `.md-on` and picks the first subject, so
 *           the band's very first paint is already the master-detail and there
 *           is no flash of the fallback grid.
 *   PHASE 2 runs on DOMContentLoaded, which fires AFTER every deferred script
 *           has executed — i.e. after [AP] has done its worst — and undoes it.
 *           It is idempotent and is re-run on `load` as cheap insurance.
 * ============================================================================= */

(function () {
  'use strict';

  var sec = document.getElementById('services');
  if (!sec) return;

  var track = sec.querySelector('.svc-rows');
  if (!track) return;

  var cards = Array.prototype.filter.call(track.children, function (el) {
    return el.classList && el.classList.contains('svc-row');
  });
  if (cards.length < 2) return;

  var LAST = cards.length - 1;
  var current = -1;
  var announceTimer = 0;
  var focusinBlocked = false;

  function headingOf(card) {
    var h = card.querySelector('h3');
    return h ? h.textContent.trim() : '';
  }
  function headingIdOf(card, i) {
    var h = card.querySelector('h3');
    if (!h) return '';
    if (!h.id) h.id = 'svc-md-h' + i;
    return h.id;
  }
  function controlOf(card) {
    return card.querySelector('.svc-row__link');
  }

  /* ---------------------------------------------------------------------------
   * PHASE 1 — synchronous, before first paint.
   * ------------------------------------------------------------------------ */

  /* The enhancement flag. EVERY two-pane rule in opt-MDTILE.css hangs off this
     class. Without this script no class is added, nothing is parked, nothing is
     retired, and the band is a plain two-up grid of eight COMPLETE cards —
     verified with javaScriptEnabled:false. This is the no-JS contract in one
     line: the master-detail is an enhancement, never the baseline. */
  track.classList.add('md-on');

  /* Reveal safety. `.wow-stagger > *` (structural.css:941) starts these cards at
     opacity 0 and only `.in-view` on the CONTAINER lifts them. site.js's
     IntersectionObserver normally adds it and [AP] asserts it too; asserting it
     here as well means no service can be stuck invisible if either changes.
     NOTE this is the `opacity` PROPERTY — it is load-bearing on these exact
     elements and no rule in opt-MDTILE.css touches it. */
  track.classList.add('in-view');

  /* The track is a labelled group of services, not a carousel. Set here so the
     grouping survives even if site.js never runs; PHASE 2 strips the carousel
     roledescription site.js adds on top of it. */
  var heading = sec.querySelector('h2');
  if (heading) {
    if (!heading.id) heading.id = 'svc-md-label';
    track.setAttribute('role', 'group');
    track.setAttribute('aria-labelledby', heading.id);
  }

  /* The polite live region. Appended to the SECTION, not to the track: it is not
     a service and must not become a grid item, and as a direct child of
     #services its own (visible) overflow has no clipping ancestor inside the
     section to leak into. Empty at rest — it names a service only in response to
     the user selecting one, and it is never read as part of the section's
     content because it holds nothing until then. */
  var live = document.createElement('p');
  live.className = 'md-live';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  sec.appendChild(live);

  /* ---------------------------------------------------------------------------
   * THE GHOST — owner request, 2026-08-07.
   * ---------------------------------------------------------------------------
   * Owner: "I want all services listed on the right and it does not move or
   * replace or rearrange the list. just grey out the selected service on the
   * right and on the left side I like how it is shown right now."
   *
   * The problem that creates: the selected card physically MOVES into the left
   * pane (that is what the owner likes and it is why nothing is cloned), so its
   * slot on the right goes empty and the remaining tiles would reflow into it.
   * Every switch would reshuffle the rail — exactly what the owner does not want.
   *
   * The fix is a GHOST: one decorative stand-in parked in the vacated slot,
   * showing the selected service's thumbnail and name greyed out. Combined with
   * the fixed per-index slots in opt-MDTILE.css, the rail becomes immovable —
   * all eight positions are permanently occupied, seven by real tiles and one by
   * the ghost, so no tile ever changes place.
   *
   * IT IS `aria-hidden` AND IT CARRIES NO HEADING ELEMENT. This is the whole
   * reason it is safe: the REAL card is still the one and only accessible copy
   * of that service (it lives in the detail pane with its heading, dek and link
   * intact), and the ghost is a picture of it. A screen reader still finds
   * exactly eight services, and probe-md's noDuplicatedCopy still passes. Using
   * a <span> rather than an <h3> means it cannot pollute the heading outline
   * even for a tool that ignores aria-hidden.
   *
   * `inert` where supported, plus pointer-events:none in CSS, so it can never
   * take focus or a click — it is scenery, and the thing it depicts is already
   * selected, so there is nothing for it to do.
   */
  var ghost = document.createElement('div');
  ghost.className = 'md-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  if ('inert' in ghost) ghost.inert = true;
  var ghostImg = document.createElement('span');
  ghostImg.className = 'md-ghost__media';
  var ghostName = document.createElement('span');
  ghostName.className = 'md-ghost__name';
  ghost.appendChild(ghostImg);
  ghost.appendChild(ghostName);

  function paintGhost(i) {
    var card = cards[i];
    if (!card) return;
    /* the ghost sits in the slot the selected card vacated. The slot is assigned
       per index in CSS (--md-slot-col / --md-slot-row); mirroring those two
       custom properties is enough to land it, so the placement maths lives in
       ONE place (the stylesheet) rather than being duplicated here. */
    ghost.style.setProperty('--md-slot-col', String(2 + (i % 2)));
    ghost.style.setProperty('--md-slot-row', String(Math.floor(i / 2) + 1));
    var img = card.querySelector('img');
    ghostImg.style.backgroundImage = img ? 'url("' + img.getAttribute('src') + '")' : 'none';
    ghostName.textContent = headingOf(card);
    if (ghost.parentNode !== track) track.appendChild(ghost);
  }

  /* ---------------------------------------------------------------------------
   * SELECTION — the whole state machine. One class, one attribute, one label.
   * ------------------------------------------------------------------------ */
  function select(i, announce) {
    if (i < 0 || i > LAST) return;
    current = i;

    for (var k = 0; k <= LAST; k++) {
      var card = cards[k];
      var isSubject = (k === i);

      card.classList.toggle('is-md', isSubject);

      if (isSubject) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');

      var ctrl = controlOf(card);
      if (!ctrl) continue;
      if (isSubject) {
        /* the subject's link shows its real label again, so its accessible name
           must go back to being that label */
        ctrl.removeAttribute('aria-labelledby');
      } else {
        /* names the tile's control from the heading NODE, not from a copy of
           its string — see the header. */
        ctrl.setAttribute('aria-labelledby', headingIdOf(card, k));
      }
    }

    /* park the ghost in the slot this card just vacated, so the rail keeps all
       eight positions filled and no tile moves */
    paintGhost(i);

    if (announce) {
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(function () {
        live.textContent = 'Now showing: ' + headingOf(cards[current]);
      }, 260);   /* debounced so arrowing across the rail does not queue eight */
    }
  }

  function focusCard(i) {
    var ctrl = controlOf(cards[Math.max(0, Math.min(i, LAST))]);
    if (ctrl) ctrl.focus();
  }

  /* ---------------------------------------------------------------------------
   * EVENTS — delegated on the track, so no per-card listener bookkeeping.
   * ------------------------------------------------------------------------ */

  /* CLICK. A tile previews; the subject's link navigates.
     preventDefault is applied ONLY on a card that is not currently the subject,
     which is precisely the set of cards whose link is not visible on screen.
     Modifier-clicks are left alone deliberately — the href is genuinely the
     right destination for that tile, so ctrl/cmd/middle-click opening it in a
     new tab is correct behaviour, not a bug. */
  track.addEventListener('click', function (e) {
    if (e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var card = (e.target && e.target.closest) ? e.target.closest('.svc-row') : null;
    if (!card) return;
    var i = cards.indexOf(card);
    if (i < 0 || i === current) return;
    e.preventDefault();
    select(i, true);
  });

  /* KEYBOARD. Enter on an <a> already fires a click, which the handler above
     turns into a selection; Space does not, and has to be handled explicitly.
     Arrows / Home / End move focus only — selection stays MANUAL, so tabbing or
     arrowing across the rail never reflows the band mid-keystroke.
     Scoped to the card's control: keys pressed anywhere else in the band keep
     their normal meaning, including page scrolling. */
  track.addEventListener('keydown', function (e) {
    var ctrl = (e.target && e.target.closest) ? e.target.closest('.svc-row__link') : null;
    if (!ctrl) return;
    var card = ctrl.closest('.svc-row');
    var i = card ? cards.indexOf(card) : -1;
    if (i < 0) return;

    var k = e.key;
    if (k === ' ' || k === 'Spacebar') {
      e.preventDefault();                 /* never page-scroll out of the band */
      if (i !== current) select(i, true);
      return;
    }
    if (k === 'Home') { e.preventDefault(); focusCard(0); return; }
    if (k === 'End')  { e.preventDefault(); focusCard(LAST); return; }

    var step = 0;
    if (k === 'ArrowRight' || k === 'ArrowDown') step = 1;
    else if (k === 'ArrowLeft' || k === 'ArrowUp') step = -1;
    if (!step) return;
    e.preventDefault();
    focusCard(i + step);
  });

  /* ---------------------------------------------------------------------------
   * PHASE 2 — after the deferred site.js has run: decommission [AP].
   * Idempotent; see the header for why each of the five re-entry routes is shut.
   * ------------------------------------------------------------------------ */
  function decommissionCarousel() {
    track.classList.remove('svc-car-on');
    track.removeAttribute('aria-roledescription');   /* "carousel"              */
    track.removeAttribute('tabindex');               /* nothing left to scroll  */

    var ctrls = sec.querySelector('.svc-car__ctrls');
    if (ctrls && ctrls.parentNode) ctrls.parentNode.removeChild(ctrls);

    for (var k = 0; k <= LAST; k++) {
      var card = cards[k];
      card.classList.remove('is-active', 'is-near');
      card.style.removeProperty('--car-dir');
      card.removeAttribute('role');                  /* "group"                 */
      card.removeAttribute('aria-roledescription');  /* "slide"                 */
      /* [AP] names each <article> "N of 8", which REPLACES the card's own
         content as its accessible name. Removing it hands the name back to the
         heading, which is what a service card should be called. */
      card.removeAttribute('aria-label');
      /* [AP] also leaves an aria-label on the LINK on some paths */
      var lk = controlOf(card);
      if (lk && !lk.hasAttribute('aria-labelledby')) lk.removeAttribute('aria-label');
    }

    if (!focusinBlocked) {
      focusinBlocked = true;
      sec.addEventListener('focusin', function (e) { e.stopPropagation(); }, true);
    }

    /* re-assert this file's selection over anything [AP] left behind */
    current = -1;
    select(0, false);
  }

  /* PHASE 1 paints a subject immediately so the first frame is already correct;
     PHASE 2 re-asserts it after site.js. */
  select(0, false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decommissionCarousel);
  } else {
    decommissionCarousel();
  }
  window.addEventListener('load', decommissionCarousel);
})();


/* ============================================================================
   [BD] SELECT AS COMMAND BAR — behaviour. Full rationale in structural.css [BD].
   Native <select> stays the source of truth; this builds the listbox over it and
   dispatches a real `change` so invApply() and the wizard keep working.
   ============================================================================ */
/* =============================================================================
 * [BD] SELECT AS COMMAND BAR — behaviour (owner, 2026-08-08)
 * -----------------------------------------------------------------------------
 * Owner: "dropdown can be similar to how we did with the enterprise search bar."
 *
 * A native <select>'s popup is drawn by the OPERATING SYSTEM. It is not in the
 * DOM, it takes no CSS, and no amount of styling the <select> itself changes it.
 * Matching .cmdbar therefore means building a real listbox in the page.
 *
 * THE ARCHITECTURE, and the reason for it:
 *   The native <select> STAYS. It keeps its id, its name, its options and its
 *   value, and it remains the single source of truth. The combobox is a skin
 *   that reads and writes it. Three of the seven selects on this site drive live
 *   behaviour (inv-county / inv-band / inv-sort call invApply() on `change`, and
 *   qz-market feeds the wizard), so anything that replaced the select outright
 *   would silently kill filtering, sorting and the form payload at once.
 *
 * WHY PROGRESSIVE ENHANCEMENT IS NOT OPTIONAL HERE. The wrapper, the button and
 * the panel are all created BY THIS SCRIPT, and the CSS that hides the native
 * select is scoped to the wrapper this script adds. With JS off, no wrapper
 * exists, so no rule matches and the ordinary <select> renders exactly as it
 * does today. That is the same failure this site already had to fix once, when
 * .wow-reveal left the whole page at opacity 0 for no-JS visitors.
 *
 * THE SUBTLE ONE — PROGRAMMATIC WRITES. site.js [AF] pre-fills #qz-market when a
 * market tab is clicked, by ASSIGNING `select.value`. A property assignment
 * fires NO event, so a skin that only listened for 'change' would keep showing
 * the old market while the form submitted the new one — a UI that lies about the
 * value it is about to send. The `value` and `selectedIndex` accessors are
 * therefore overridden PER INSTANCE (delegating to the real prototype accessors)
 * so any assignment, from anywhere, repaints the skin.
 *
 * POSITIONING IS ABSOLUTE, NOT FIXED, AND THAT IS MEASURED. `form.qz` — the
 * qualifier card, i.e. the dropdown the owner actually pointed at — carries a
 * transform from .wow-reveal. A transformed ancestor becomes the containing
 * block for position:fixed, so a fixed panel would resolve against the form
 * rather than the viewport and land in the wrong place on that one select.
 * Checked every ancestor of all seven selects: none clips overflow, so absolute
 * cannot be cut off either. Absolute is correct and fixed is not.
 * ============================================================================= */
(function () {
  'use strict';

  if (typeof document === 'undefined') return;

  var UID = 0;
  var openOne = null;   /* only one panel may be open at a time, site-wide */

  function esc(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&');
  }

  function enhance(sel) {
    /* A multi-select or a sized list box is a different control with different
       semantics; skinning it as a single-value combobox would misreport it. */
    if (!sel || sel.multiple || sel.size > 1) return;
    if (sel.getAttribute('data-dsel') === 'on') return;
    sel.setAttribute('data-dsel', 'on');

    var uid = sel.id || ('dsel' + (++UID));

    /* ---- wrapper -------------------------------------------------------- */
    var wrap = document.createElement('div');
    wrap.className = 'dsel';
    wrap.setAttribute('data-select', '');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);

    /* ---- accessible name, taken from the field's real <label for> -------- */
    var lab = sel.id ? document.querySelector('label[for="' + esc(sel.id) + '"]') : null;
    if (lab && !lab.id) lab.id = uid + '-lbl';

    /* ---- the field (the thing that looks like the command bar) ----------- */
    var btn = document.createElement('button');
    btn.type = 'button';                 /* inside a <form>, a bare button submits */
    btn.className = 'dsel__field';
    btn.id = uid + '-cb';
    btn.setAttribute('role', 'combobox');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', uid + '-lb');
    if (lab) btn.setAttribute('aria-labelledby', lab.id + ' ' + btn.id);
    else btn.setAttribute('aria-label', sel.getAttribute('name') || 'Choose an option');

    var valEl = document.createElement('span');
    valEl.className = 'dsel__value';
    btn.appendChild(valEl);

    var chev = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chev.setAttribute('class', 'dsel__chev');
    chev.setAttribute('viewBox', '0 0 16 16');
    chev.setAttribute('aria-hidden', 'true');
    chev.setAttribute('focusable', 'false');
    var pth = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pth.setAttribute('d', 'M3.5 6L8 10.5L12.5 6');
    pth.setAttribute('fill', 'none');
    pth.setAttribute('stroke', 'currentColor');
    pth.setAttribute('stroke-width', '1.75');
    pth.setAttribute('stroke-linecap', 'round');
    pth.setAttribute('stroke-linejoin', 'round');
    chev.appendChild(pth);
    btn.appendChild(chev);

    /* ---- the panel ------------------------------------------------------- */
    var panel = document.createElement('div');
    panel.className = 'dsel__panel';
    panel.id = uid + '-lb';
    panel.setAttribute('role', 'listbox');
    if (lab) panel.setAttribute('aria-labelledby', lab.id);
    panel.hidden = true;

    /* Options are built from the live <select>, INCLUDING <optgroup> labels, so
       a grouped select keeps its grouping instead of flattening into one list.
       Group labels are presentational only — they carry no role, so they never
       appear to a screen reader as selectable items. */
    var optEls = [];
    function buildOptions() {
      panel.textContent = '';
      optEls = [];
      var kids = sel.children, i, k;
      for (i = 0; i < kids.length; i++) {
        k = kids[i];
        if (k.tagName === 'OPTGROUP') {
          var gl = document.createElement('div');
          gl.className = 'dsel__grouplabel';
          gl.textContent = k.label;
          panel.appendChild(gl);
          for (var j = 0; j < k.children.length; j++) addOpt(k.children[j]);
        } else if (k.tagName === 'OPTION') {
          addOpt(k);
        }
      }
    }
    function addOpt(o) {
      var idx = Array.prototype.indexOf.call(sel.options, o);
      var d = document.createElement('div');
      d.className = 'dsel__opt';
      d.id = uid + '-o' + idx;
      d.setAttribute('role', 'option');
      d.setAttribute('data-idx', String(idx));
      d.setAttribute('aria-selected', 'false');
      if (o.disabled) d.setAttribute('aria-disabled', 'true');
      var t = document.createElement('span');
      t.className = 'dsel__opt-t';
      t.textContent = o.text;
      d.appendChild(t);
      panel.appendChild(d);
      optEls.push(d);
    }
    buildOptions();

    wrap.appendChild(btn);
    wrap.appendChild(panel);

    /* The native control is taken out of the tab order and hidden from the
       accessibility tree, because the combobox now represents it. It is NOT
       display:none — it stays a laid-out, submitting form control. */
    sel.setAttribute('tabindex', '-1');
    sel.setAttribute('aria-hidden', 'true');

    var active = -1;   /* index of the visually active option while open */

    /* ---- painting -------------------------------------------------------- */
    function paint() {
      var i = sel.selectedIndex;
      var o = i >= 0 ? sel.options[i] : null;
      valEl.textContent = o ? o.text : '';
      for (var n = 0; n < optEls.length; n++) {
        var oi = Number(optEls[n].getAttribute('data-idx'));
        optEls[n].setAttribute('aria-selected', oi === i ? 'true' : 'false');
      }
    }

    function elFor(idx) {
      for (var n = 0; n < optEls.length; n++) {
        if (Number(optEls[n].getAttribute('data-idx')) === idx) return optEls[n];
      }
      return null;
    }

    function setActive(idx, scroll) {
      var el = elFor(idx);
      if (!el) return;
      var prev = panel.querySelector('.is-active');
      if (prev) prev.classList.remove('is-active');
      el.classList.add('is-active');
      active = idx;
      btn.setAttribute('aria-activedescendant', el.id);
      if (scroll !== false && el.scrollIntoView) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }

    /* ---- escaping the section's paint order -------------------------------
     * MEASURED DEFECT, caught by hit-testing the open panel rather than by
     * looking at it: on locations.html, 4 of the 8 visible rows were COVERED by
     * the NEXT <section>. document.elementFromPoint returned SECTION.section,
     * P.eyebrow and H2 where "Sacramento County" and "San Diego County" should
     * have been — so half the counties were both unreadable and unclickable.
     *
     * Nothing was clipping and nothing overflowed; the panel simply could not
     * paint above a later sibling. `form.qz` carries a transform (.wow-reveal),
     * which makes it a STACKING CONTEXT, and a z-index inside a stacking context
     * is meaningless outside it — the whole form paints at its own place in the
     * section order, panel included. Raising the panel's own z-index, the
     * obvious fix, does nothing at all for the same reason.
     *
     * The fix has to lift the enclosing SECTION above its later siblings, so the
     * ancestor nearest <main> is raised for exactly as long as the panel is
     * open, and released on close so no section is left permanently reordered.
     * 30 is deliberate: above the sections (auto/0), still below .site-header's
     * 40, so an open dropdown can never paint over the sticky nav.
     * -------------------------------------------------------------------- */
    var raised = null;
    function raise() {
      var e = wrap;
      while (e.parentElement && e.parentElement !== document.body &&
             e.parentElement.tagName !== 'MAIN') e = e.parentElement;
      raised = e;
      raised.setAttribute('data-dsel-raise', '');
    }
    function unraise() {
      if (raised) { raised.removeAttribute('data-dsel-raise'); raised = null; }
    }

    /* ---- open / close ---------------------------------------------------- */
    function open() {
      if (!panel.hidden) return;
      if (openOne && openOne !== close) openOne();
      raise();
      panel.hidden = false;
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      /* the panel drops below by default and flips above only when there is not
         room, so it never pushes the document or hangs off the bottom */
      var r = btn.getBoundingClientRect();
      /* [BI] 2026-08-10 — THE ROOM BELOW IS NOT innerHeight - bottom ON MOBILE.
         `.mm-sticky-cta` is position:fixed at the foot of the viewport with
         z-index 980, twenty-four times this panel's 40, so any part of the panel
         that lands in the bar's band is painted over and DEAD TO TOUCH while
         still looking open. Measured at 375 and 390: #qz-market panel
         y=493 h=340 bottom=833 against a bar at top=774 -> a 58px dead strip,
         and elementFromPoint over "San Francisco County" returned the bar's own
         a.btn.btn-primary. #inv-county was worse: same collision AND that panel
         is not internally scrollable (scrollHeight - clientHeight = 0), so the
         covered option could not be reached by any means.
         Subtracting the bar makes the flip decision honest, and the max-height
         clamp stops a downward panel reaching into the bar's band at all.
         DESKTOP-SAFE BY CONSTRUCTION: barH is 0 whenever the bar is not shown,
         which is every width >= 982px, so `below` is unchanged there and the
         inline max-height is never written (the CSS min(46vh,340px) still owns
         it). Verified: 0 of 14,295 desktop element records drifted. */
      var bar = document.querySelector('.mm-sticky-cta');
      var barH = 0;
      if (bar && bar.classList.contains('show')) {
        var bcs = window.getComputedStyle(bar);
        if (bcs.display !== 'none' && bcs.visibility !== 'hidden') {
          barH = bar.getBoundingClientRect().height;
        }
      }
      var below = window.innerHeight - r.bottom - barH;
      wrap.classList.toggle('dsel--up', below < 240 && r.top > below);
      /* [DJ] INSIDE .cmdbar, ALWAYS CLAMP — not only when the mobile CTA bar is
         showing. MEASURED at 1440x900: the 15-option market panel opened 354px
         tall from y=649, bottom at 1003 — 103px below the fold — and because
         max-height(420) exceeded its content height, scrollHeight === clientHeight,
         so the hidden rows were neither painted NOR scrollable. Page-scrolling
         does not recover them: the panel is absolutely positioned and travels
         with the field (scrollBy(0,300) moved it y=649 -> y=349 and the
         unreachable count stayed at 3). Measured off the PANEL's own rect, so it
         is correct whatever gap the skin sets; when flipped up it also subtracts
         the sticky header, measured covering the first row at 375x812.
         SCOPED to .cmdbar deliberately: the four selects outside the command bar
         keep the shipped barH-only behaviour untouched. */
      if (wrap.closest && wrap.closest('.cmdbar')) {
        panel.style.maxHeight = '';
        var pr = panel.getBoundingClientRect();
        var hdr = document.querySelector('.site-header');
        var hdrB = hdr ? hdr.getBoundingClientRect().bottom : 0;
        var cbRoom = wrap.classList.contains('dsel--up')
          ? (pr.bottom - hdrB - 8)
          : (window.innerHeight - pr.top - barH - 8);
        panel.style.maxHeight = Math.max(0, cbRoom) + 'px';
      } else if (barH > 0) {
        var room = (wrap.classList.contains('dsel--up') ? r.top : below) - 8;
        panel.style.maxHeight = Math.max(0, Math.min(340, room)) + 'px';
      } else {
        panel.style.maxHeight = '';
      }
      setActive(sel.selectedIndex >= 0 ? sel.selectedIndex : 0);
      openOne = close;
    }

    function close(refocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      wrap.classList.remove('is-open', 'dsel--up');
      panel.style.maxHeight = ''; /* [BI] hand the cap back to the stylesheet */
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('aria-activedescendant');
      var a = panel.querySelector('.is-active');
      if (a) a.classList.remove('is-active');
      unraise();
      if (openOne === close) openOne = null;
      if (refocus) btn.focus();
    }

    /* ---- committing ------------------------------------------------------
     * The ONLY place the value changes. Assigning selectedIndex runs through the
     * overridden accessor below, which repaints; then a real `change` (and
     * `input`) is dispatched on the native select so every listener the site
     * already has — invApply(), the wizard's qzMarketTouched flag — fires
     * exactly as it did when the OS popup was doing the choosing.
     * -------------------------------------------------------------------- */
    function commit(idx) {
      var o = sel.options[idx];
      if (!o || o.disabled) return;
      var changed = sel.selectedIndex !== idx;
      if (changed) {
        sel.selectedIndex = idx;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      close(true);
    }

    /* ---- mouse ----------------------------------------------------------- */
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (panel.hidden) open(); else close();
    });

    panel.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[role="option"]') : null;
      if (!t || !panel.contains(t)) return;
      commit(Number(t.getAttribute('data-idx')));
    });

    panel.addEventListener('mousemove', function (e) {
      var t = e.target.closest ? e.target.closest('[role="option"]') : null;
      if (t && panel.contains(t)) setActive(Number(t.getAttribute('data-idx')), false);
    });

    /* ---- keyboard --------------------------------------------------------
     * Focus never leaves the button; the active option is announced through
     * aria-activedescendant. Escape CANCELS — it closes without writing a
     * value, which is what a select does and what a visitor expects.
     * -------------------------------------------------------------------- */
    var typed = '', typedAt = 0;

    function step(from, dir) {
      var n = sel.options.length, i = from;
      for (var guard = 0; guard < n; guard++) {
        i += dir;
        if (i < 0) i = 0;
        if (i > n - 1) i = n - 1;
        if (!sel.options[i].disabled) return i;
        if (i === 0 || i === n - 1) break;
      }
      return from;
    }

    btn.addEventListener('keydown', function (e) {
      var k = e.key;
      var isOpen = !panel.hidden;

      if (k === 'Escape') { if (isOpen) { e.preventDefault(); close(true); } return; }

      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { open(); return; }
        setActive(step(active < 0 ? sel.selectedIndex : active, k === 'ArrowDown' ? 1 : -1));
        return;
      }
      if (k === 'Home' || k === 'End') {
        if (!isOpen) return;
        e.preventDefault();
        setActive(k === 'Home' ? step(-1, 1) : step(sel.options.length, -1));
        return;
      }
      if (k === 'Enter') {
        if (isOpen) { e.preventDefault(); commit(active); }
        return;   /* closed + Enter falls through so the form can submit */
      }
      if (k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        if (isOpen) commit(active); else open();
        return;
      }
      if (k === 'Tab') { if (isOpen) close(); return; }

      /* type-ahead, the one affordance people miss most when a native select is
         replaced: typing "sac" jumps to Sacramento County */
      if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        var now = Date.now();
        typed = (now - typedAt > 900) ? k : (typed + k);
        typedAt = now;
        var q = typed.toLowerCase();
        for (var i = 0; i < sel.options.length; i++) {
          if (!sel.options[i].disabled && sel.options[i].text.toLowerCase().indexOf(q) === 0) {
            if (isOpen) setActive(i); else commit(i);
            break;
          }
        }
      }
    });

    /* ---- dismissal ------------------------------------------------------- */
    document.addEventListener('pointerdown', function (e) {
      if (!panel.hidden && !wrap.contains(e.target)) close();
    }, true);

    window.addEventListener('resize', function () { close(); });

    /* The panel is absolutely positioned, so it stays glued to the field as the
       page scrolls — but the drop-or-flip decision was made once, at open time,
       and would go stale if the field moved far enough to change the answer.
       Recomputed on scroll rather than closing the panel, because closing on
       scroll would fire on the panel's own wheel events. */
    window.addEventListener('scroll', function () {
      if (panel.hidden) return;
      var r = btn.getBoundingClientRect();
      var below = window.innerHeight - r.bottom;
      wrap.classList.toggle('dsel--up', below < 240 && r.top > below);
      /* [DJ] Inside .cmdbar the flip decision and the height clamp must be
         recomputed TOGETHER. .mm-sticky-cta gains .show ON SCROLL, so a panel
         opened near the top of the page was placed with barH = 0 and then had the
         bar appear underneath it — the exact collision the open-time clamp exists
         to prevent. Re-toggling `dsel--up` without re-clamping also leaves a
         flipped panel carrying the height computed for the dropped position. */
      if (!(wrap.closest && wrap.closest('.cmdbar'))) return;
      var sBar = document.querySelector('.mm-sticky-cta');
      var sBarH = 0;
      if (sBar && sBar.classList.contains('show')) {
        var sCs = window.getComputedStyle(sBar);
        if (sCs.display !== 'none' && sCs.visibility !== 'hidden') {
          sBarH = sBar.getBoundingClientRect().height;
        }
      }
      panel.style.maxHeight = '';
      var sPr = panel.getBoundingClientRect();
      var sHdr = document.querySelector('.site-header');
      var sHdrB = sHdr ? sHdr.getBoundingClientRect().bottom : 0;
      var sRoom = wrap.classList.contains('dsel--up')
        ? (sPr.bottom - sHdrB - 8)
        : (window.innerHeight - sPr.top - sBarH - 8);
      panel.style.maxHeight = Math.max(0, sRoom) + 'px';
    }, { passive: true });

    /* ---- staying in sync with the native control -------------------------
     * `change` covers anything that fires events. The accessor overrides cover
     * PLAIN ASSIGNMENT (`select.value = 'x'`), which fires nothing at all and is
     * exactly what site.js [AF] does when a market tab is clicked.
     * -------------------------------------------------------------------- */
    sel.addEventListener('change', paint);

    (function bindAccessors() {
      var P = window.HTMLSelectElement && HTMLSelectElement.prototype;
      if (!P) return;
      ['value', 'selectedIndex'].forEach(function (prop) {
        var d = Object.getOwnPropertyDescriptor(P, prop);
        if (!d || !d.get || !d.set) return;
        try {
          Object.defineProperty(sel, prop, {
            configurable: true,
            enumerable: false,
            get: function () { return d.get.call(this); },
            set: function (v) { d.set.call(this, v); paint(); }
          });
        } catch (err) { /* fail closed: the skin just repaints on `change` only */ }
      });
    })();

    /* if options are ever rewritten by other script, rebuild the list */
    if (window.MutationObserver) {
      new MutationObserver(function () { buildOptions(); paint(); })
        .observe(sel, { childList: true });
    }

    paint();
  }

  function init() {
    var list = document.querySelectorAll('select.ec-ctrl');
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* [BO] HERO COMMAND BAR — bridge the TWO panel systems that now share one bar.
 *
 * The hero bar now hosts two INDEPENDENT dropdown implementations:
 *   · [AE] .cmdbar__panel  — the federated free-text suggestions
 *   · [BD] .dsel__panel    — the three segment listboxes
 * Neither knows the other exists, so MEASURED: opening MARKET and then typing
 * left both panels open and overlapping (seg 460x354 @y649 vs suggestions
 * 1152x99 @y659). Geometry alone would not have caught it — the test is that
 * both are non-hidden at once.
 *
 * No internals are touched. [BD] exposes exactly one public handle: its field
 * button's click listener TOGGLES (`if (panel.hidden) open(); else close();`),
 * so clicking an open field closes it. [BD] also closes on POINTERDOWN, not
 * click, which is why a synthetic document click did not dismiss it.
 */
(function () {
  var root = document.querySelector('[data-cmdbar]');
  if (!root) return;                       /* null-guarded exactly like [AE]/[AF] */
  var input = root.querySelector('.cmdbar__input');
  var sugg  = root.querySelector('.cmdbar__panel');
  if (!input || !sugg) return;

  function closeSegments() {
    var open = root.querySelectorAll('.dsel.is-open');
    for (var i = 0; i < open.length; i++) {
      var b = open[i].querySelector('.dsel__field');
      if (b) b.click();                    /* [BD]'s own toggle — not its internals */
    }
  }

  /* typing or focusing the free-text half retires any open segment */
  ['focus', 'input', 'click'].forEach(function (ev) {
    input.addEventListener(ev, closeSegments);
  });

  /* and the reverse: reaching for a segment retires the suggestions. Capture +
     pointerdown because [BD] acts on pointerdown and would otherwise win the race. */
  root.addEventListener('pointerdown', function (e) {
    var f = e.target && e.target.closest ? e.target.closest('.dsel__field') : null;
    if (!f) return;
    if (!sugg.hasAttribute('hidden')) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
  }, true);
})();

/* ---------------------------------------------------------------------------
 * [BO] COMPOSE — the segments actually search.
 *
 * They map onto the SAME params inventory.html already reads (verified in
 * site.js invReadUrl: type / county / band / status / sort), so nothing new is
 * invented on the destination page.
 *
 * ⚠ THE BOARD FILTERS ONLY SEVEN COUNTIES (#inv-county), but the Market segment
 * offers FIFTEEN markets, because the site's coverage claim is wider than its
 * live stock. Eight of them therefore CANNOT become a filter. Silently dropping
 * them would be the exact dishonesty [AE] already guards against, so they take
 * the same treatment it gives a market with no stock: say it, and route to a
 * sourcing brief.
 *
 * ⚠ THERE IS NO INDUSTRY FILTER ON THE BOARD. Industry is a qualifier
 * dimension, not a listing attribute. It is carried into the brief and SAID,
 * never quietly discarded.
 *
 * PRECEDENCE: an explicit selection beats text inference. With no segment set
 * at all this handler returns untouched and [AE]'s free-text path runs exactly
 * as it does today — that is why the early return comes before preventDefault.
 * ------------------------------------------------------------------------- */
(function () {
  var root = document.querySelector('[data-cmdbar]');
  if (!root) return;
  var form  = root.querySelector('.cmdbar__form');
  var input = root.querySelector('.cmdbar__input');
  var note  = root.querySelector('.cmdbar__note');
  var live  = root.querySelector('.cmdbar__live');
  var mkt = document.getElementById('cb-market');
  var typ = document.getElementById('cb-type');
  var ind = document.getElementById('cb-industry');
  if (!form || !mkt || !typ || !ind) return;

  /* verbatim from inventory.html #inv-county */
  var FILTERABLE = ['los-angeles','orange','riverside','sacramento',
                    'san-bernardino','san-diego','san-francisco'];

  /* [DJ] The out-of-state values and the page that owns each. These can never
     become a board filter — inventory.html carries nine cards, every data-county
     on them is Californian, there is no data-state attribute, and #inv-county
     offers only the seven counties above — so the state page is the ONLY honest
     destination. Only the two INDEXABLE states are here; NJ/OH/PA are withheld
     from this control by owner decision 2026-09-11 (see index.html's [BO] note),
     so their values never reach this map. */
  var STATE_PAGE = {
    'st-arizona': ['arizona-liquor-license.html', 'Arizona'],
    'st-florida': ['florida-liquor-license.html', 'Florida']
  };

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function textOf(sel) {
    var o = sel.options[sel.selectedIndex];
    return o ? o.text : '';
  }

  form.addEventListener('submit', function (e) {
    var m = mkt.value, t = typ.value, i = ind.value;
    if (!m && !t && !i) return;        /* -> [AE], untouched */

    e.preventDefault();
    e.stopImmediatePropagation();      /* this submit is ours */

    var q = new URLSearchParams();
    var applied = [], told = [], extraHref = null;
    var extraLabel = 'Send a sourcing brief';
    var st = STATE_PAGE[m] || null;

    /* [DJ] The five licence types in this segment are CALIFORNIA ABC
       classifications. Arizona issues Series 6, 7, 9, 10, 11 and 12; Florida
       issues 1COP, 2COP, 3PS, 4COP, 4COP-SFS and 6COP (locations.html's own state
       rail says so). Applying a Type 47 filter for a Florida visitor would
       compose a licence that does not exist in their jurisdiction — the
       LOCATION-HONESTY RULE one axis over. So the type is SAID, not applied: the
       same idiom this block already uses for industry. */
    if (t && !st) { q.set('type', t); applied.push('Type ' + t); }
    if (t && st) {
      told.push('Type ' + t + ' is a California ABC classification, so it was not applied to ' +
                st[1] + '. ' + st[1] + ' issues its own classifications.');
    }

    if (m && m !== 'california') {
      var mLabel = textOf(mkt);
      if (st) {
        /* An out-of-state market. Say it, and route to the page that owns it. */
        told.push('We broker in ' + st[1] + ', but hold no live listings there today.');
        extraHref = st[0];
        extraLabel = 'Everything we broker in ' + st[1];
      } else if (m === 'other') {
        /* NOT a place. Its label is "Another California county", so it must not
           be fed through the sentence template below — a broken sentence is the
           worst place to ship the honest option. */
        told.push('Tell us which California county and we will source against it — we broker all 58.');
        extraHref = 'contact.html#quote';
      } else if (FILTERABLE.indexOf(m) !== -1) { q.set('county', m); applied.push(mLabel); }
      else {
        told.push('We broker in ' + mLabel + ', but hold no live listings there today.');
        extraHref = 'contact.html#quote';
      }
    }

    if (i) {
      told.push('The board is not filtered by industry, so ' + textOf(ind) +
                ' has been carried into your brief rather than applied to the listings.');
      extraHref = 'contact.html#quote';
    }

    var raw = (input.value || '').trim();
    if (raw) {
      told.push('Your selections were used, so the typed text “' + raw +
                '” was not combined with them.');
    }

    var qs = q.toString();
    var href = 'inventory.html' + (qs ? '?' + qs : '');

    if (!told.length) { window.location.href = href; return; }

    var lead = applied.length ? 'Showing ' + applied.join(' in ') + ' on the board. ' : '';
    var goLabel = applied.length ? 'Show matching licences' : 'Show all 9 California licences';
    if (!note) { window.location.href = href; return; }
    note.innerHTML =
      '<p class="cmdbar__note-txt">' + esc(lead + told.join(' ')) + '</p>' +
      (extraHref ? '<a class="btn btn-secondary cmdbar__note-go" href="' + extraHref +
                   '">' + esc(extraLabel) + '</a>' : '') +
      '<a class="btn btn-primary cmdbar__note-go" href="' + esc(href) + '">' + goLabel + '</a>';
    note.hidden = false;
    if (live) live.textContent = lead + told.join(' ') + ' ' + goLabel + '.';
    var go = note.querySelector('.btn-primary');
    if (go) go.focus();
  }, true);   /* CAPTURE: [AE] binds its own submit listener on this same form */
})();

/* ==========================================================================
   [BX] THE STATE TIER on locations.html
   --------------------------------------------------------------------------
   A second, OUTER tab controller sitting above the fourteen market tabs.

   Why this is a separate IIFE rather than an edit to part A: part A resolves
   its panels with `locRoot.querySelectorAll('.loc-panel')` where locRoot is
   `[data-loc-tabs]`. The California state panel is that element's PARENT and
   the other five are its SIBLINGS, so none of them are descendants of locRoot
   and part A cannot see them. Wrapping the matrix therefore changed nothing
   about how the market tabs behave, and this block adds the outer tier
   without touching a line of the code that drives them.

   Deep links: the market tabs own the bare `#fresno` form of the hash, which
   part A already handles. A bare market hash arriving while another state is
   selected has to snap back to California first, or part A would un-hide a
   panel inside a container that is itself hidden. States use `#state-<slug>`
   so the two hash namespaces cannot collide.
   -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var root = document.querySelector('[data-loc-states]');
  if (!root) return;

  var slice = function (n) { return Array.prototype.slice.call(n); };
  var tabs = slice(root.querySelectorAll('.loc-state'));
  var panels = slice(root.querySelectorAll('[data-loc-statepanel]'));
  if (!tabs.length || !panels.length) return;

  // Every market slug California owns, read off the markup rather than hard-coded,
  // so adding a market tab never needs a matching edit here.
  var marketSlugs = slice(root.querySelectorAll('.loc-tab')).map(function (t) {
    return t.getAttribute('data-loc-tab') || '';
  });

  var slugOf = function (t) { return t.getAttribute('data-loc-state') || ''; };
  var indexOf = function (slug) {
    for (var i = 0; i < tabs.length; i++) if (slugOf(tabs[i]) === slug) return i;
    return -1;
  };

  function activate(slug, opts) {
    opts = opts || {};
    var idx = indexOf(slug);
    if (idx === -1) return false;

    tabs.forEach(function (t, i) {
      var on = i === idx;
      t.setAttribute('aria-selected', String(on));
      t.setAttribute('tabindex', on ? '0' : '-1');   // roving tabindex, as part A
    });
    panels.forEach(function (p) {
      p.hidden = p.getAttribute('data-loc-statepanel') !== slug;
    });

    if (opts.focus) tabs[idx].focus();

    // Below 640px the rail is one overflow-x row. Keep the selected state in
    // view on EVERY activation path, not only the focused one — the same bug
    // [AF] fixed on the market rail.
    var rail = tabs[idx].parentElement;
    if (rail && rail.scrollWidth > rail.clientWidth) {
      var tb = tabs[idx].getBoundingClientRect();
      var rb = rail.getBoundingClientRect();
      if (tb.left < rb.left || tb.right > rb.right) {
        rail.scrollLeft += (tb.left - rb.left) - (rb.width - tb.width) / 2;
      }
    }

    // Hand a non-California state to the qualifier so step 1 is never left
    // saying "California — statewide" to someone who just told us they are in
    // Florida. The select carries a matching st-<slug> option; the market tabs
    // keep ownership of step 1 whenever California is the active state.
    if (slug !== 'california' && typeof window.__llaQzSyncMarket === 'function') {
      window.__llaQzSyncMarket('st-' + slug);
    }

    if (opts.hash && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '#state-' + slug);
    }
    return true;
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      activate(slugOf(tab), { hash: true });
    });
    tab.addEventListener('keydown', function (e) {
      var next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === -1) return;
      e.preventDefault();
      activate(slugOf(tabs[next]), { focus: true, hash: true });
    });
  });

  function fromHash(focus) {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return false;
    if (h.indexOf('state-') === 0) {
      return activate(h.slice(6), { focus: !!focus, hash: false });
    }
    // A bare market hash means California, whatever was selected before.
    if (marketSlugs.indexOf(h) !== -1) {
      return activate('california', { focus: false, hash: false });
    }
    return false;
  }

  if (!fromHash(false)) {
    var pre = tabs.filter(function (t) {
      return t.getAttribute('aria-selected') === 'true';
    })[0] || tabs[0];
    if (pre) activate(slugOf(pre), { hash: false });
  }
  window.addEventListener('hashchange', function () { fromHash(true); });
})();

/* ==========================================================================
   [BY] LOCATIONS CASCADE — the column-2 swap
   --------------------------------------------------------------------------
   Opening and closing the panel is still the generic .mm-has-panel controller
   above; this block only swaps which pane is in flow as you move down the
   state rail.

   Pointer AND keyboard both drive it, because the rail is a tablist: hovering
   or focusing a state shows its pane, Arrow keys move between states with a
   roving tabindex, and ArrowRight/Enter steps into the pane's first link.

   NULL-GUARDED: a page without [data-mm-cascade] skips the whole block.
   -------------------------------------------------------------------------- */
(function () {
  'use strict';

  var roots = Array.prototype.slice.call(document.querySelectorAll('[data-mm-cascade]'));
  if (!roots.length) return;

  roots.forEach(function (root) {
    var states = Array.prototype.slice.call(root.querySelectorAll('.mm-casc__state'));
    var panes = Array.prototype.slice.call(root.querySelectorAll('.mm-casc__pane'));
    // the left-most card swaps with the state too — it carries that state's general
    // location info, so it must never be showing one state while the rail shows another
    var cards = Array.prototype.slice.call(root.querySelectorAll('[data-mmcard]'));
    // column 4: what sits under the hovered option in column 3
    var details = Array.prototype.slice.call(root.querySelectorAll('[data-mmdetail]'));
    var fallback = root.querySelector('.mm-casc__dfall');
    if (!states.length || !panes.length) return;

    function showDetail(key) {
      var found = false;
      details.forEach(function (d) {
        var on = d.getAttribute('data-mmdetail') === key;
        d.hidden = !on;
        if (on) found = true;
      });
      // never blank the column: with no panel for this option, fall back to the prompt
      if (fallback) fallback.hidden = found;
    }
    // Switching state opens that state's DEFAULT detail rather than a prompt. An empty
    // fourth column that says "hover something" is an empty state, not a design — and it
    // was showing for three of the six states before you hovered anything at all.
    function showDefault(btn) {
      var key = btn && btn.getAttribute('data-mmdefault');
      if (key) { showDetail(key); return; }
      details.forEach(function (d) { d.hidden = true; });
      if (fallback) fallback.hidden = false;
    }
    // a row reveals its detail on hover AND on focus, so the keyboard path matches the pointer
    Array.prototype.slice.call(root.querySelectorAll('[data-mmopt]')).forEach(function (r) {
      var key = r.getAttribute('data-mmopt');
      r.addEventListener('mouseenter', function () { showDetail(key); });
      r.addEventListener('focus', function () { showDetail(key); });
    });

    var slugOf = function (b) { return b.getAttribute('data-mmstate') || ''; };

    function show(slug, opts) {
      opts = opts || {};
      var idx = -1;
      for (var i = 0; i < states.length; i++) if (slugOf(states[i]) === slug) { idx = i; break; }
      if (idx === -1) return false;

      states.forEach(function (b, i) {
        var on = i === idx;
        b.setAttribute('aria-selected', String(on));
        b.setAttribute('tabindex', on ? '0' : '-1');
      });
      panes.forEach(function (p) { p.hidden = p.getAttribute('data-mmpane') !== slug; });
      cards.forEach(function (c) { c.hidden = c.getAttribute('data-mmcard') !== slug; });
      showDefault(states[idx]);
      if (opts.focus) states[idx].focus();
      return true;
    }

    states.forEach(function (btn, i) {
      // Pointer: showing on hover is what makes it read as a cascade rather than a
      // set of tabs. It never navigates — the rows in column 2 are the links.
      btn.addEventListener('mouseenter', function () { show(slugOf(btn)); });
      btn.addEventListener('focus', function () { show(slugOf(btn)); });
      btn.addEventListener('click', function (e) { e.preventDefault(); show(slugOf(btn)); });

      btn.addEventListener('keydown', function (e) {
        var next = -1;
        if (e.key === 'ArrowDown') next = (i + 1) % states.length;
        else if (e.key === 'ArrowUp') next = (i - 1 + states.length) % states.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = states.length - 1;
        else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
          // step into the pane this state controls
          var pane = panes.filter(function (p) {
            return p.getAttribute('data-mmpane') === slugOf(btn);
          })[0];
          var first = pane && pane.querySelector('a[href]');
          if (first) { e.preventDefault(); first.focus(); }
          return;
        }
        if (next === -1) return;
        e.preventDefault();
        show(slugOf(states[next]), { focus: true });
      });
    });

    // INITIALISE. Without this the block only ever reacts to hover, so the very first
    // time the menu opens column 4 sits empty — every detail hidden by the markup and the
    // fallback prompt hidden too. Open on the selected state's default straight away.
    showDefault(states.filter(function (b) {
      return b.getAttribute('aria-selected') === 'true';
    })[0] || states[0]);

    // ArrowLeft from anywhere in the pane returns to the rail.
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft') return;
      if (!e.target.closest || !e.target.closest('.mm-casc__pane')) return;
      var sel = states.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0];
      if (sel) { e.preventDefault(); sel.focus(); }
    });
  });
})();


/* [CE] SERVICE ACCORDION — keep the deep links working.
   There are ~1,285 inbound links to #buy / #sell / #transfer / #valuation across
   the site (323 to #buy alone). The band is now four <details> rows, so a visitor
   arriving on one of those links would otherwise land on a COLLAPSED row and see
   a heading with nothing under it. This opens the targeted row — on first load and
   on every later hash change — then brings it into view.

   Progressive enhancement only: with JS off the markup is still a working native
   accordion, the first row is open, and every row can be opened by hand. */
(function () {
  // querySelectorAll, NOT querySelector — there are TWO accordion containers on
  // services.html (01-04 and 05-08). A singular lookup would silently ignore the
  // second one and strand the ~1,283 inbound links that point into it.
  var accs = [].slice.call(document.querySelectorAll('.svc-acc'));
  if (!accs.length) return;

  function rowFor(id) {
    if (!id) return null;
    var safe = (window.CSS && CSS.escape) ? CSS.escape(id) : id;
    for (var i = 0; i < accs.length; i++) {
      var row = accs[i].querySelector('details#' + safe);
      if (row) return row;
    }
    return null;
  }

  function openFromHash(scroll) {
    var row = rowFor((window.location.hash || '').replace('#', ''));
    if (!row) return;
    row.open = true;
    if (scroll) {
      // let the row finish expanding before measuring where it landed
      window.requestAnimationFrame(function () {
        row.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    }
  }

  openFromHash(true);
  window.addEventListener('hashchange', function () { openFromHash(true); });

  // An in-page link to a row that is already the target fires no hashchange,
  // so catch the click too.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var row = rowFor(href.slice(href.indexOf('#') + 1));
    if (row) row.open = true;
  });
})();


/* [CF] SERVICE SELECTOR — services 05-08. The four photographs are the navigation.

   PROGRESSIVE ENHANCEMENT, AND THE ORDER MATTERS. The panels are NOT hidden in the
   markup, so with JS off all four render stacked — degraded, but every service is
   readable and every anchor still lands somewhere real. This script hides the
   inactive ones on init; it never relies on the HTML having hidden them.

   THE ANCHORS ARE THE REASON FOR THE HASH HANDLING. ~1,283 inbound links point at
   #cup (432), #escrow (320), #new-business (319) and #compliance (212). The id lives
   on the PANEL, and arriving on one of those links selects that panel rather than
   leaving the visitor on service 05.

   Tab semantics are real, not decorative: roles and aria-selected are in the markup,
   this adds roving tabindex plus Arrow/Home/End, per the APG tabs pattern. */
(function () {
  var roots = [].slice.call(document.querySelectorAll('[data-svc-selector]'));
  if (!roots.length) return;

  roots.forEach(function (root) {
    var tabs   = [].slice.call(root.querySelectorAll('.svc-sel__thumb'));
    var panels = [].slice.call(root.querySelectorAll('.svc-sel__panel'));
    if (!tabs.length || tabs.length !== panels.length) return;

    function select(i, focus) {
      if (i < 0 || i >= tabs.length) return;
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[n].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }

    function indexOfId(id) {
      if (!id) return -1;
      for (var i = 0; i < panels.length; i++) if (panels[i].id === id) return i;
      return -1;
    }

    // init: whatever the markup marked selected, else the first
    var start = 0;
    tabs.forEach(function (t, n) { if (t.getAttribute('aria-selected') === 'true') start = n; });
    select(start, false);

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
    });

    root.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      e.preventDefault();
      select(next, true);
    });

    function fromHash(scroll) {
      var i = indexOfId((window.location.hash || '').replace('#', ''));
      if (i < 0) return;
      select(i, false);
      if (scroll) {
        window.requestAnimationFrame(function () {
          panels[i].scrollIntoView({ block: 'start', behavior: 'auto' });
        });
      }
    }

    fromHash(true);
    window.addEventListener('hashchange', function () { fromHash(true); });

    // an in-page link to the already-current hash fires no hashchange
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var i = indexOfId(href.slice(href.indexOf('#') + 1));
      if (i >= 0) select(i, false);
    });
  });
})();


/* [CG] CLICK-TO-LOAD OFFICE MAP — moved out of index.html's inline <script>.

   The CTA suite (heading, phone, consultation form and this map) now appears on the
   eight service pages as well as the homepage, and the loader had to travel with it —
   copying the markup alone would have left a dead "Load the map" button on eight pages.

   Kept as click-to-load ON PURPOSE: the page makes ZERO off-origin requests until the
   visitor asks for the map, and the address stays real selectable text rather than
   being baked into an image.

   Safe to run on every page: it returns immediately when the two ids are absent, which
   is why it can live in the shared bundle. The inline copy was REMOVED from index.html
   in the same change — leaving both would bind the listener twice and insert two
   iframes on one click. */
(function () {
  var b = document.getElementById('cta-map-load'), ph = document.getElementById('cta-map-ph');
  if (!b || !ph) return;
  b.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.title = 'Liquor License Agents office \u2014 5243 E Beverly Blvd, Los Angeles, CA 90022';
    f.src = 'https://maps.google.com/maps?q=5243%20E%20Beverly%20Blvd,%20Los%20Angeles,%20CA%2090022&t=&z=15&ie=UTF8&iwloc=&output=embed';
    f.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    f.setAttribute('loading', 'lazy');
    ph.replaceWith(f);
  });
})();
