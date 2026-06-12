/* ============================================================================
   SGEN LOCAL SEO + AEO  —  PAGE INTERACTIONS  (vanilla, no deps)
   ----------------------------------------------------------------------------
   Modules:
     reveal         · IntersectionObserver -> adds the design-system "in" class
                      to .reveal (reduced-motion: reveal immediately, no observer)
     nav            · #lp-nav .is-solid past the hero · #sticky-apply .show after hero
     roiCalc        · live math from #roi-industry / #roi-jobs / #roi-ticket
     faq            · one-open accordion on .faq-item (animated max-height)
     reviewCarousel · <=991 swipe + JS-built [data-carousel-dots]; >=992 static grid
     applyFlow      · the #apply-overlay typeform state machine (every Apply CTA)

   Contract hooks honored (see _CONTRACT.md):
     data-apply-open · data-plan · #lp-nav(.is-solid) · #sticky-apply(.show)
     #roi-industry · #roi-jobs · #roi-ticket · [data-roi-val] · [data-roi]
     .faq-item > button.faq-q + div.faq-a (.is-open) · [data-carousel="reviews"]
     [data-carousel-dots] (button.is-active) · #apply-overlay(.open) · #apply-stage
     #apply-progress · #apply-counter · [data-apply-back] · [data-apply-close]
     #apply-success(.open) · [data-apply-planname]
   NOTE: the design-system .reveal visible state is the class "in" (sgen-structural.css
   line 139: ".reveal.in"); we toggle that. ("is-in" is added too for brief-compat,
   but "in" is the load-bearing one the CSS keys off.)
   ============================================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* =========================================================================
     1 · REVEAL  — IntersectionObserver -> add "in" (design-system) to .reveal
     ========================================================================= */
  function reveal() {
    var nodes = $$('.reveal');
    if (!nodes.length) return;

    // Reduced motion (or no IO support): reveal everything immediately.
    if (REDUCED || !('IntersectionObserver' in window)) {
      nodes.forEach(function (el) { el.classList.add('in', 'is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in', 'is-in');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    nodes.forEach(function (el) { io.observe(el); });
  }

  /* =========================================================================
     2 · NAV  — solid-on-scroll + sticky-apply bar after the hero
     ========================================================================= */
  function nav() {
    var navEl    = $('#lp-nav');
    var sticky   = $('#sticky-apply');
    var hero     = $('#top') || $('.hero') || $('header + section') ||
                   (navEl && navEl.nextElementSibling);

    // Threshold = bottom of the hero (fallback to a sensible viewport fraction).
    function heroBottom() {
      if (hero && hero.getBoundingClientRect) {
        var h = hero.offsetHeight || hero.getBoundingClientRect().height;
        if (h > 0) return h - 80;
      }
      return Math.round(window.innerHeight * 0.82);
    }

    var ticking = false;
    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var past = y > heroBottom();
      if (navEl)  navEl.classList.toggle('is-solid', y > 24);
      if (sticky) sticky.classList.toggle('show', past);
      ticking = false;
    }
    function request() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
    }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    onScroll();
  }

  /* =========================================================================
     3 · ROI CALC  — live math from select + 2 sliders
        today      = jobs * ticket
        sgen       = today * 2.2
        annualLift = (sgen - today) * 12
        roi%       = round( (annualLift - annualCost) / annualCost * 100 )
                     annualCost = 797 * 12  (Accelerate retainer)
        Defaults Plumbing/HVAC · 40 jobs · $450 ticket ->
        $18,000/mo · $39,600/mo · $259K · 2,610%   (matches _CONTRACT.md exactly)
     ========================================================================= */
  function roiCalc() {
    var sel    = $('#roi-industry');
    var jobsEl = $('#roi-jobs');
    var tixEl  = $('#roi-ticket');
    if (!jobsEl || !tixEl) return;

    var MULT         = 2.2;          // SGEN lead multiplier
    var ANNUAL_COST  = 797 * 12;     // $9,564 — Accelerate retainer / yr

    // Sensible per-industry presets (jobs / avg ticket). Picking an industry
    // seeds the sliders; the documented Plumbing / HVAC default = 40 / $450.
    var PRESETS = {
      'plumbing / hvac':       { jobs: 40,  ticket: 450 },
      'roofing':               { jobs: 12,  ticket: 9500 },
      'electrical':            { jobs: 45,  ticket: 380 },
      'landscaping':           { jobs: 35,  ticket: 600 },
      'junk removal':          { jobs: 60,  ticket: 320 },
      'cleaning services':     { jobs: 80,  ticket: 180 },
      'dental / med spa':      { jobs: 55,  ticket: 850 },
      'law firm':              { jobs: 18,  ticket: 3500 },
      'home buyers / re':      { jobs: 8,   ticket: 12000 },
      'auto services':         { jobs: 90,  ticket: 280 }
    };

    var valJobs = $('[data-roi-val="jobs"]');
    var valTix  = $('[data-roi-val="ticket"]');
    var outToday  = $('[data-roi="today"]');
    var outSgen   = $('[data-roi="sgen"]');
    var outAnnual = $('[data-roi="annual"]');
    var outRoi    = $('[data-roi="roi"]');

    function money(n) {
      return '$' + Math.round(n).toLocaleString('en-US');
    }
    // Annual lift abbreviated to $K (or $M past 7 figures) per the contract default ($259K).
    function moneyK(n) {
      n = Math.round(n);
      if (n >= 1000000) {
        return '$' + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M';
      }
      if (n >= 1000) {
        return '$' + Math.round(n / 1000).toLocaleString('en-US') + 'K';
      }
      return money(n);
    }

    function compute() {
      var jobs   = parseInt(jobsEl.value, 10) || 0;
      var ticket = parseInt(tixEl.value, 10) || 0;

      var today      = jobs * ticket;
      var sgen       = today * MULT;
      var annualLift = (sgen - today) * 12;
      var roiPct     = ANNUAL_COST > 0
        ? Math.round((annualLift - ANNUAL_COST) / ANNUAL_COST * 100)
        : 0;
      if (roiPct < 0) roiPct = 0;

      if (valJobs) valJobs.textContent = String(jobs);
      if (valTix)  valTix.textContent  = money(ticket);

      if (outToday)  outToday.textContent  = money(today) + '/mo';
      if (outSgen)   outSgen.textContent   = money(sgen) + '/mo';
      if (outAnnual) outAnnual.textContent = moneyK(annualLift);
      if (outRoi)    outRoi.textContent    = roiPct.toLocaleString('en-US') + '%';
    }

    if (sel) {
      sel.addEventListener('change', function () {
        var key = sel.value.trim().toLowerCase();
        var p = PRESETS[key];
        if (p) {
          jobsEl.value = clampRange(jobsEl, p.jobs);
          tixEl.value  = clampRange(tixEl, p.ticket);
        }
        compute();
      });
    }
    jobsEl.addEventListener('input', compute);
    tixEl.addEventListener('input', compute);

    compute(); // seed live outputs on load
  }

  function clampRange(input, v) {
    var min = parseFloat(input.min);
    var max = parseFloat(input.max);
    if (!isNaN(min) && v < min) v = min;
    if (!isNaN(max) && v > max) v = max;
    return v;
  }

  /* =========================================================================
     4 · FAQ  — one-open accordion (animate .faq-a max-height -> scrollHeight)
     ========================================================================= */
  function faq() {
    var items = $$('.faq-item');
    if (!items.length) return;

    function close(item) {
      item.classList.remove('is-open');
      var ans = $('.faq-a', item);
      var btn = $('.faq-q', item);
      if (ans) ans.style.maxHeight = '0px';
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    function open(item) {
      item.classList.add('is-open');
      var ans = $('.faq-a', item);
      var btn = $('.faq-q', item);
      if (ans) ans.style.maxHeight = ans.scrollHeight + 'px';
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }

    items.forEach(function (item) {
      var btn = $('.faq-q', item);
      var ans = $('.faq-a', item);
      if (!btn || !ans) return;

      // a11y wiring
      btn.setAttribute('aria-expanded', 'false');
      ans.style.maxHeight = '0px';

      btn.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');
        items.forEach(function (other) { if (other !== item) close(other); });
        if (isOpen) { close(item); } else { open(item); }
      });
    });

    // Keep an open panel's height correct on resize (text reflow changes scrollHeight).
    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        var openItem = $('.faq-item.is-open');
        if (openItem) {
          var ans = $('.faq-a', openItem);
          if (ans) ans.style.maxHeight = ans.scrollHeight + 'px';
        }
      }, 120);
    }, { passive: true });
  }

  /* =========================================================================
     5 · REVIEW CAROUSEL  — <=991 swipe-snap + dots; >=992 static grid (no JS)
        The track scroll-snaps natively (CSS). We build/sync dots and let dots
        scroll the track. On >=992 the dots container is hidden by CSS.
     ========================================================================= */
  function reviewCarousel() {
    var track = $('[data-carousel="reviews"]');
    var dotsWrap = $('[data-carousel-dots]');
    if (!track || !dotsWrap) return;

    var cards = $$('.review-card', track);
    if (!cards.length) return;

    var dots = [];
    function buildDots() {
      dotsWrap.innerHTML = '';
      dots = cards.map(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Go to review ' + (i + 1));
        b.addEventListener('click', function () { scrollToCard(i); });
        dotsWrap.appendChild(b);
        return b;
      });
    }
    function scrollToCard(i) {
      var card = cards[i];
      if (!card) return;
      var left = card.offsetLeft - track.offsetLeft;
      track.scrollTo
        ? track.scrollTo({ left: left, behavior: REDUCED ? 'auto' : 'smooth' })
        : (track.scrollLeft = left);
    }
    function activeIndex() {
      // closest card center to the track's scroll center
      var center = track.scrollLeft + track.clientWidth / 2;
      var best = 0, bestDist = Infinity;
      cards.forEach(function (card, i) {
        var c = card.offsetLeft - track.offsetLeft + card.offsetWidth / 2;
        var d = Math.abs(c - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }
    function syncDots() {
      var idx = activeIndex();
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === idx);
      });
    }

    buildDots();
    syncDots();

    var sT;
    track.addEventListener('scroll', function () {
      clearTimeout(sT);
      sT = setTimeout(syncDots, 60);
    }, { passive: true });

    window.addEventListener('resize', function () {
      clearTimeout(sT);
      sT = setTimeout(syncDots, 120);
    }, { passive: true });
  }

  /* =========================================================================
     6 · APPLY FLOW  — the #apply-overlay typeform state machine
        Opens from any [data-apply-open]; deep-links the plan via data-plan.
        SEO branch = 9 steps total. Other service branches fall back to a
        generic "tell us more" + submit so the flow never dead-ends.
        NO backend: Submit -> success screen (console.debug the payload only).
     ========================================================================= */
  function applyFlow() {
    var overlay = $('#apply-overlay');
    if (!overlay) return;

    var stage    = $('#apply-stage', overlay);
    var progress = $('#apply-progress', overlay);
    var counter  = $('#apply-counter', overlay);
    var backBtn  = $('[data-apply-back]', overlay);
    var closeBtn = $('[data-apply-close]', overlay);
    var success  = $('#apply-success', overlay);
    var planFlag = $('.ao-planflag', overlay);
    var planName = $('[data-apply-planname]', overlay);

    var PLAN_LABELS = {
      foundation: 'Foundation',
      accelerate: 'Accelerate',
      authority:  'Authority'
    };

    // ---- step definitions -------------------------------------------------
    // type: 'intro' | 'options' | 'text' | 'contact'
    // Personalization tokens {First} / {Company} are swapped at render.
    var INTRO = { type: 'intro' };

    var STEP_NAME = {
      type: 'text', kick: 'Step 1',
      q: "What's your best name?",
      sub: 'So we can personalize your growth strategy',
      fields: [
        { name: 'first', label: 'First name', type: 'text', required: true },
        { name: 'last',  label: 'Last name (optional)', type: 'text' }
      ]
    };
    var STEP_GOAL = {
      type: 'options', kick: 'Step 2',
      q: 'Great to meet you, {First}!',
      sub: "What's your primary goal?",
      key: 'goal',
      options: [
        { value: 'leads',      letter: 'A', label: 'Generate More Leads' },
        { value: 'cpl',        letter: 'B', label: 'Lower Cost Per Lead' },
        { value: 'cvr',        letter: 'C', label: 'Improve Conversion Rate' },
        { value: 'rankings',   letter: 'D', label: 'Higher Organic Rankings' },
        { value: 'other',      letter: 'E', label: 'Other' }
      ]
    };
    var STEP_CONTACT = {
      type: 'contact', kick: 'Step 3',
      q: 'Perfect, {First}!',
      sub: 'How can we reach you?',
      fields: [
        { name: 'phone',   label: 'Phone', type: 'tel', phone: true,
          placeholder: '(201) 555-0123' },
        { name: 'email',   label: 'Email address', type: 'email', required: true,
          placeholder: 'you@business.com' },
        { name: 'company', label: 'Company name', type: 'text', required: true,
          placeholder: 'Your business' }
      ]
    };
    var STEP_SERVICE = {
      type: 'options', kick: 'Step 4',
      q: 'Which service interests you, {First}?',
      sub: "We'll customize the next questions based on your choice",
      key: 'service',
      options: [
        { value: 'ppc', letter: 'A', label: 'PPC / Google Ads',      sub: 'Paid search advertising' },
        { value: 'seo', letter: 'B', label: 'SEO',                   sub: 'Organic search rankings' },
        { value: 'aeo', letter: 'C', label: 'AEO / AI Optimization', sub: 'AI search visibility' },
        { value: 'meta',letter: 'D', label: 'Facebook / Meta Ads',   sub: 'Social media advertising' },
        { value: 'web', letter: 'E', label: 'Website Development',    sub: 'Design & build websites' }
      ]
    };
    // ---- SEO branch (steps 5-9; total 9) ---------------------------------
    var STEP_URL = {
      type: 'text', kick: 'Step 5',
      q: 'Which website are you looking to get SEO for?',
      sub: "We'll review your site's current performance and identify growth opportunities",
      fields: [
        { name: 'url', label: 'Website URL', type: 'url', required: true,
          placeholder: 'https://yoursite.com' }
      ]
    };
    var STEP_HISTORY = {
      type: 'options', kick: 'Step 6',
      q: 'Have you worked on SEO for this website before?',
      key: 'history',
      options: [
        { value: 'agency',   letter: 'A', label: 'Yes, with an agency' },
        { value: 'self',     letter: 'B', label: 'Yes, we did it ourselves' },
        { value: 'never',    letter: 'C', label: 'No, never worked on SEO' },
        { value: 'notsure',  letter: 'D', label: 'Not sure' }
      ]
    };
    var STEP_SERVICES_TEXT = {
      type: 'text', kick: 'Step 7',
      q: "What services of your business you're looking to rank for?",
      sub: "Mention your top-selling services, products, or unique offers you'd like to rank on Google",
      fields: [
        { name: 'services', label: 'Your services', type: 'textarea', required: true,
          placeholder: 'e.g. emergency plumbing, water heater install, drain cleaning…' }
      ]
    };
    var STEP_BUDGET = {
      type: 'options', kick: 'Step 8',
      q: "What's your monthly budget for SEO?",
      key: 'budget',
      options: [
        { value: 'lt300',     emoji: '😢', label: 'Less than $300' },
        { value: '400-500',   emoji: '🙂', label: '$400 – $500' },
        { value: '500-1000',  emoji: '😀', label: '$500 – $1,000' },
        { value: '1000-2000', emoji: '🤩', label: '$1,000 – $2,000' },
        { value: '2000plus',  emoji: '🔥', label: '$2,000+' }
      ]
    };
    var STEP_COMPETITORS = {
      type: 'text', kick: 'Step 9', submit: true,
      q: 'Who are your main competitors online? (Optional)',
      sub: 'List any websites or businesses you often see ranking ahead of you on Google',
      fields: [
        { name: 'competitors', label: 'Competitors (optional)', type: 'textarea',
          placeholder: 'List competitor sites or business names…' }
      ]
    };
    // ---- generic fallback for non-SEO branches (so nothing dead-ends) -----
    function genericTellMore(stepNo) {
      return {
        type: 'text', kick: 'Step ' + stepNo, submit: true,
        q: 'Tell us more about what you need.',
        sub: 'A senior strategist reviews every application personally before any call.',
        fields: [
          { name: 'details', label: 'Your goals', type: 'textarea', required: true,
            placeholder: 'What are you trying to achieve, and where are you today?' }
        ]
      };
    }

    // Base steps shown to everyone (intro + 1..4). Service step branches the rest.
    var BASE = [INTRO, STEP_NAME, STEP_GOAL, STEP_CONTACT, STEP_SERVICE];

    var SEO_BRANCH = [STEP_URL, STEP_HISTORY, STEP_SERVICES_TEXT, STEP_BUDGET, STEP_COMPETITORS];

    // ---- runtime state ----------------------------------------------------
    var steps   = BASE.slice();   // full step list (rebuilt when service is picked)
    var idx     = 0;              // current index into `steps`
    var answers = {};             // collected answers
    var lastFocus = null;         // element to restore focus to on close

    function firstName() {
      var f = (answers.first || '').trim();
      return f ? f.split(/\s+/)[0] : 'there';
    }
    function company() {
      return (answers.company || '').trim() || 'your business';
    }
    function personalize(str) {
      return String(str)
        .replace(/\{First\}/g, firstName())
        .replace(/\{Company\}/g, company());
    }

    // Total = number of QUESTION screens (intro excluded). SEO branch -> 9.
    function totalQuestions() {
      // steps[0] is the intro; questions are the rest.
      return steps.length - 1;
    }
    function questionNumber() {
      // idx 0 = intro -> show as "1 / total" anchor; questions are idx>=1.
      return Math.max(1, idx);
    }

    // -------- rendering ----------------------------------------------------
    function render() {
      var step = steps[idx];
      stage.innerHTML = '';
      if (success) { success.hidden = true; success.classList.remove('open'); }
      stage.hidden = false;

      var node;
      if (step.type === 'intro')        node = renderIntro();
      else if (step.type === 'options') node = renderOptions(step);
      else                              node = renderText(step); // text + contact

      stage.appendChild(node);
      updateChrome();
      focusStep(node, step);
    }

    function updateChrome() {
      var step = steps[idx];
      var isIntro = step.type === 'intro';

      // progress: intro = 0%, then proportional through the question set
      var total = totalQuestions();
      var pct = isIntro ? 0 : Math.round((idx / total) * 100);
      if (progress) progress.style.width = pct + '%';

      // counter "n / total" — hidden conceptually on intro (show 1/total anchor)
      if (counter) {
        counter.textContent = isIntro
          ? ('1 / ' + total)
          : (questionNumber() + ' / ' + total);
        counter.style.visibility = isIntro ? 'hidden' : 'visible';
      }

      // back: hidden on intro + step 1 (idx 0 and 1)
      if (backBtn) {
        if (idx <= 1) backBtn.setAttribute('hidden', '');
        else backBtn.removeAttribute('hidden');
      }
    }

    function focusStep(node, step) {
      // Move focus to the first interactive control for keyboard + a11y.
      var target = node.querySelector('.ao-input, .ao-textarea, .ao-option, .ao-next');
      if (target) {
        // slight delay so the rise animation doesn't fight the scroll-into-view
        window.setTimeout(function () { try { target.focus(); } catch (e) {} }, REDUCED ? 0 : 40);
      }
    }

    // INTRO -----------------------------------------------------------------
    function renderIntro() {
      var step = document.createElement('div');
      step.className = 'ao-step';
      step.innerHTML =
        '<span class="ao-pill"><span class="dot"></span>Only 5 new clients onboarded per month</span>' +
        '<h2 class="ao-q">Your competitors are <span class="grad">stealing your customers</span></h2>' +
        '<p class="ao-sub">Tell us about your business in 90 seconds. If we’re a fit, you can book a call with our team to map out the work.</p>' +
        '<div class="ao-actions"><button class="btn btn-primary ao-next" type="button">See if we’re a fit <span class="arr">→</span></button></div>' +
        '<div class="ao-social">' +
          '<span class="ao-avatars"><span>R</span><span>M</span><span>D</span><span>G</span><span>J</span></span>' +
          '<span class="ao-soc-text"><span class="stars">★★★★★</span> Trusted by 200+ businesses</span>' +
        '</div>' +
        '<div class="ao-trustchips"><span class="tc">100% Free</span><span class="tc">No Obligation</span><span class="tc">15 Min Call</span></div>';
      $('.ao-next', step).addEventListener('click', advance);
      return step;
    }

    // OPTIONS ---------------------------------------------------------------
    function renderOptions(step) {
      var node = document.createElement('div');
      node.className = 'ao-step';

      var html =
        '<p class="ao-kick">' + esc(step.kick) + '</p>' +
        '<h2 class="ao-q">' + esc(personalize(step.q)) + '</h2>' +
        (step.sub ? '<p class="ao-sub">' + esc(personalize(step.sub)) + '</p>' : '') +
        '<div class="ao-options" role="radiogroup" aria-label="' + esc(personalize(step.sub || step.q)) + '">';

      step.options.forEach(function (opt) {
        var chip = opt.emoji
          ? '<span class="ao-emoji">' + opt.emoji + '</span>'
          : '<span class="ao-letter">' + esc(opt.letter) + '</span>';
        html +=
          '<button class="ao-option" type="button" role="radio" aria-checked="false"' +
            ' data-value="' + esc(opt.value) + '"' +
            (opt.letter ? ' data-letter="' + esc(opt.letter) + '"' : '') + '>' +
            chip +
            '<span class="ao-olabel"><b>' + esc(opt.label) + '</b>' +
              (opt.sub ? '<i>' + esc(opt.sub) + '</i>' : '') +
            '</span>' +
          '</button>';
      });
      html += '</div>';
      node.innerHTML = html;

      $$('.ao-option', node).forEach(function (btn) {
        btn.addEventListener('click', function () { selectOption(step, btn); });
      });
      return node;
    }

    function selectOption(step, btn) {
      var options = $$('.ao-option', btn.parentNode);
      options.forEach(function (o) {
        o.classList.remove('is-selected');
        o.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('is-selected');
      btn.setAttribute('aria-checked', 'true');

      var value = btn.getAttribute('data-value');
      answers[step.key] = value;

      // Service step rebuilds the remaining branch + total.
      if (step.key === 'service') applyBranch(value);

      // single-select auto-advance ~250ms after selection
      window.setTimeout(advance, REDUCED ? 0 : 250);
    }

    function applyBranch(service) {
      // steps so far up to & including the service step are fixed (BASE).
      var head = BASE.slice(); // intro..service
      if (service === 'seo') {
        steps = head.concat(SEO_BRANCH);
      } else {
        // generic single tell-us-more + submit (step number after service = 5)
        steps = head.concat([genericTellMore(5)]);
      }
    }

    // TEXT / CONTACT --------------------------------------------------------
    function renderText(step) {
      var node = document.createElement('div');
      node.className = 'ao-step';

      var html =
        '<p class="ao-kick">' + esc(step.kick) + '</p>' +
        '<h2 class="ao-q">' + esc(personalize(step.q)) + '</h2>' +
        (step.sub ? '<p class="ao-sub">' + esc(personalize(step.sub)) + '</p>' : '') +
        '<div class="ao-fields">';

      step.fields.forEach(function (f) {
        var reqMark = f.required ? ' <span class="req">*</span>' : '';
        html += '<div class="ao-field"><label>' + esc(f.label) + reqMark + '</label>';
        if (f.type === 'textarea') {
          html += '<textarea class="ao-textarea" name="' + esc(f.name) + '"' +
                  (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
                  (f.required ? ' required' : '') + '></textarea>';
        } else if (f.phone) {
          html += '<div class="ao-phone"><span class="ao-cc">🇺🇸 +1</span>' +
                  '<input class="ao-input" type="tel" name="' + esc(f.name) + '"' +
                  (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '></div>';
        } else {
          html += '<input class="ao-input" type="' + esc(f.type) + '" name="' + esc(f.name) + '"' +
                  (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
                  (f.required ? ' required' : '') + '>';
        }
        html += '</div>';
      });
      html += '</div>';

      var btnLabel = step.submit
        ? 'Submit <span class="arr">→</span>'
        : 'Continue <span class="arr">→</span>';
      html +=
        '<div class="ao-actions">' +
          '<button class="btn btn-primary ao-next" type="button" disabled>' + btnLabel + '</button>' +
          '<span class="ao-enter">Press Enter <kbd>↵</kbd></span>' +
        '</div>';
      node.innerHTML = html;

      var inputs = $$('.ao-input, .ao-textarea', node);
      var nextBtn = $('.ao-next', node);

      function validate() {
        var ok = true;
        step.fields.forEach(function (f) {
          if (!f.required) return;
          var el = node.querySelector('[name="' + f.name + '"]');
          if (!el) return;
          var v = (el.value || '').trim();
          if (!v) ok = false;
          else if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ok = false;
          else if (f.type === 'url'   && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}/.test(v)) ok = false;
        });
        // a step with NO required fields (optional textarea) is always valid
        var hasRequired = step.fields.some(function (f) { return f.required; });
        nextBtn.disabled = hasRequired ? !ok : false;
        return nextBtn.disabled === false;
      }

      inputs.forEach(function (el) {
        el.addEventListener('input', function () {
          collect(step, node);
          validate();
        });
        el.addEventListener('keydown', function (e) {
          // Enter advances on text inputs (not textarea, where Enter = newline
          // unless the field is the only one and valid -> allow ctrl/cmd? keep simple:
          // textarea uses the Continue button / Enter still advances if valid).
          if (e.key === 'Enter' && el.tagName !== 'TEXTAREA') {
            e.preventDefault();
            collect(step, node);
            if (validate()) advance();
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && el.tagName === 'TEXTAREA') {
            e.preventDefault();
            collect(step, node);
            if (validate()) advance();
          }
        });
      });

      nextBtn.addEventListener('click', function () {
        collect(step, node);
        if (validate()) advance();
      });

      validate(); // initial disabled state
      return node;
    }

    function collect(step, node) {
      step.fields.forEach(function (f) {
        var el = node.querySelector('[name="' + f.name + '"]');
        if (el) answers[f.name] = el.value;
      });
    }

    // -------- navigation ---------------------------------------------------
    function advance() {
      var step = steps[idx];
      if (step && step.submit) { submit(); return; }
      if (idx < steps.length - 1) {
        idx++;
        render();
        scrollStageTop();
      } else {
        submit();
      }
    }
    function back() {
      if (idx > 0) {
        idx--;
        render();
        scrollStageTop();
      }
    }
    function scrollStageTop() {
      if (stage && stage.scrollTo) {
        stage.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
      } else if (stage) {
        stage.scrollTop = 0;
      }
    }

    // -------- submit -> success -------------------------------------------
    function submit() {
      // NO backend: log payload only (never POST).
      try {
        console.debug('[SGEN apply] submission', JSON.parse(JSON.stringify(answers)));
      } catch (e) { /* noop */ }

      if (!success) return;
      // Personalize success copy.
      var title = success.querySelector('.ao-stitle');
      var body  = success.querySelector('.ao-sbody');
      if (title) title.textContent = personalize('You’re in, {First}.');
      if (body) {
        body.textContent = personalize(
          'Your application for {Company} is with a senior strategist. We personally ' +
          'review every business before any call — expect your 30-day plan and ' +
          'baseline audit within 24 hours.'
        );
      }

      stage.hidden = true;
      success.hidden = false;
      // progress -> 100%
      if (progress) progress.style.width = '100%';
      if (counter) counter.style.visibility = 'hidden';
      if (backBtn) backBtn.setAttribute('hidden', '');

      // fire the check-mark pop
      void success.offsetWidth; // reflow so the animation restarts
      success.classList.add('open');
    }

    // -------- open / close -------------------------------------------------
    function open(plan) {
      lastFocus = document.activeElement;
      // reset state
      steps = BASE.slice();
      idx = 0;
      answers = {};

      // plan deep-link tag
      if (plan && PLAN_LABELS[plan]) {
        answers.plan = plan;
        if (planFlag) planFlag.removeAttribute('hidden');
        if (planName) planName.textContent = PLAN_LABELS[plan];
      } else if (planFlag) {
        planFlag.setAttribute('hidden', '');
      }

      render();
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    function close() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) {
        try { lastFocus.focus(); } catch (e) {}
      }
    }

    // -------- wiring -------------------------------------------------------
    $$('[data-apply-open]').forEach(function (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        open(cta.getAttribute('data-plan'));
      });
    });
    if (backBtn)  backBtn.addEventListener('click', back);
    if (closeBtn) closeBtn.addEventListener('click', close);

    // close on overlay backdrop click (but not when clicking the card/chrome)
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) close();
    });

    // keyboard: Esc closes; A/B/C… selects on an options step
    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') { close(); return; }

      var step = steps[idx];
      if (step && step.type === 'options' && /^[a-zA-Z]$/.test(e.key)) {
        var letter = e.key.toUpperCase();
        var match = stage.querySelector('.ao-option[data-letter="' + letter + '"]');
        if (match) { e.preventDefault(); selectOption(step, match); }
      }
    });

    overlay.setAttribute('aria-hidden', 'true');
  }

  /* small HTML-escape for interpolated copy */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* =========================================================================
     BOOT
     ========================================================================= */
  function init() {
    reveal();
    nav();
    roiCalc();
    faq();
    reviewCarousel();
    applyFlow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
