/* ============================================================================
   apply.js  —  SGEN Local SEO + AEO  ·  APPLICATION OVERLAY state machine
   ----------------------------------------------------------------------------
   Vanilla, dependency-free. Drives #apply-overlay (markup in _frag/overlay.html,
   styled by page.css). Typeform-grade single-question flow with a branching
   service step. NO backend: on Submit it console.debug's the payload + shows the
   success screen. All copy VERBATIM from _CONTENT.md › APPLICATION OVERLAY.

   STEP / BRANCH MODEL
   -------------------
   intro (not counted)
     1  name          (text:  first* + last)
     2  primary goal   (single-select A–E)        personalize {First}
     3  contact        (phone w/ country + email + company)  personalize {First}
     4  service         (single-select A–E)  → BRANCHES, sets the tail + total
          A PPC / Google Ads    → generic tail
          B SEO                 → SEO tail (5→6→7→8→9), TOTAL = 9
          C AEO / AI Optimization → generic tail
          D Facebook / Meta Ads → generic tail
          E Website Development → generic tail
     SEO tail (B):
       5  website url   (url)
       6  prior SEO     (single-select A–D)
       7  services      (textarea)
       8  budget        (single-select, emoji chips)
       9  competitors   (textarea, optional)  → Submit
     Generic tail (A,C,D,E) — never dead-ends:
       5  tell us more  (textarea)  → Submit            TOTAL = 5
   ============================================================================ */
(function () {
  'use strict';

  var overlay = document.getElementById('apply-overlay');
  if (!overlay) return;

  var stage    = document.getElementById('apply-stage');
  var counter  = document.getElementById('apply-counter');
  var progress = document.getElementById('apply-progress');
  var backBtn  = overlay.querySelector('[data-apply-back]');
  var success  = document.getElementById('apply-success');
  var planFlag = overlay.querySelector('.ao-planflag');
  var planName = overlay.querySelector('[data-apply-planname]');

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- collected answers ------------------------------------------------- */
  var data = {
    plan: null,
    first: '', last: '',
    goal: '',
    phone: '', email: '', company: '',
    service: '',
    website: '',
    priorSeo: '',
    services: '',
    budget: '',
    competitors: '',
    details: ''   // generic-branch free text
  };

  var lastTrigger = null;       // element that opened the overlay (focus restore)
  var index = 0;                // current position in `flow`
  var flow = [];                // array of step-definitions (intro excluded)

  /* ---- helpers ----------------------------------------------------------- */
  function first() { return (data.first || '').trim() || 'there'; }
  function company() { return (data.company || '').trim() || 'your business'; }
  function personalize(s) {
    return String(s)
      .replace(/\{First\}/g, esc(first()))
      .replace(/\{Company\}/g, esc(company()));
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ===========================================================================
     FLOW DEFINITION  — each step returns the DOM for one .ao-step screen.
     Step kinds: 'text' (inputs), 'select' (option cards), 'textarea'.
     Steps after the service branch are spliced in by buildFlow().
     =========================================================================== */

  var STEP_NAME = {
    id: 'name', kind: 'text',
    render: function () {
      return field({
        kick: 'Step 1',
        q: "What's your best name?",
        sub: 'So we can personalize your growth strategy',
        fields: [
          { label: 'First name <span class="req">*</span>', name: 'first', type: 'text', value: data.first, required: true },
          { label: 'Last name (optional)', name: 'last', type: 'text', value: data.last }
        ],
        cta: 'Continue', enter: true
      });
    },
    valid: function (step) {
      return step.querySelector('[name="first"]').value.trim().length > 0;
    },
    commit: function (step) {
      data.first = step.querySelector('[name="first"]').value.trim();
      data.last  = step.querySelector('[name="last"]').value.trim();
    }
  };

  var STEP_GOAL = {
    id: 'goal', kind: 'select',
    render: function () {
      return options({
        kick: 'Step 2',
        q: 'Great to meet you, {First}!',
        sub: "What's your primary goal?",
        opts: [
          { v: 'leads',      L: 'A', b: 'Generate More Leads' },
          { v: 'cpl',        L: 'B', b: 'Lower Cost Per Lead' },
          { v: 'conversion', L: 'C', b: 'Improve Conversion Rate' },
          { v: 'rankings',   L: 'D', b: 'Higher Organic Rankings' },
          { v: 'other',      L: 'E', b: 'Other' }
        ]
      });
    },
    commit: function (step, val) { data.goal = val; }
  };

  var STEP_CONTACT = {
    id: 'contact', kind: 'text',
    render: function () {
      return field({
        kick: 'Step 3',
        q: 'Perfect, {First}!',
        sub: 'How can we reach you?',
        fields: [
          { label: 'Phone', name: 'phone', type: 'tel', value: data.phone, cc: '🇺🇸 +1', placeholder: '(201) 555-0123' },
          { label: 'Email address', name: 'email', type: 'email', value: data.email, placeholder: 'you@company.com' },
          { label: 'Company name', name: 'company', type: 'text', value: data.company, placeholder: 'Your business' }
        ],
        cta: 'Continue'
      });
    },
    valid: function (step) {
      var phone = step.querySelector('[name="phone"]').value.trim();
      var email = step.querySelector('[name="email"]').value.trim();
      var company = step.querySelector('[name="company"]').value.trim();
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      return phone.length >= 6 && emailOk && company.length > 0;
    },
    commit: function (step) {
      data.phone   = step.querySelector('[name="phone"]').value.trim();
      data.email   = step.querySelector('[name="email"]').value.trim();
      data.company = step.querySelector('[name="company"]').value.trim();
    }
  };

  var STEP_SERVICE = {
    id: 'service', kind: 'select',
    render: function () {
      return options({
        kick: 'Step 4',
        q: 'Which service interests you, {First}?',
        sub: "We'll customize the next questions based on your choice",
        opts: [
          { v: 'ppc',     L: 'A', b: 'PPC / Google Ads',       i: 'Paid search advertising' },
          { v: 'seo',     L: 'B', b: 'SEO',                    i: 'Organic search rankings' },
          { v: 'aeo',     L: 'C', b: 'AEO / AI Optimization',  i: 'AI search visibility' },
          { v: 'meta',    L: 'D', b: 'Facebook / Meta Ads',    i: 'Social media advertising' },
          { v: 'webdev',  L: 'E', b: 'Website Development',     i: 'Design & build websites' }
        ]
      });
    },
    commit: function (step, val) {
      data.service = val;
      buildFlow();           // re-derive the tail + total from the chosen branch
    }
  };

  /* ---- SEO branch tail (total = 9) --------------------------------------- */
  var STEP_WEBSITE = {
    id: 'website', kind: 'text',
    render: function () {
      return field({
        kick: 'Step 5',
        q: 'Which website are you looking to get SEO for?',
        sub: "We'll review your site's current performance and identify growth opportunities",
        fields: [
          { label: 'Website URL', name: 'website', type: 'url', value: data.website, placeholder: 'https://yoursite.com' }
        ],
        cta: 'Continue'
      });
    },
    valid: function (step) {
      return step.querySelector('[name="website"]').value.trim().length >= 3;
    },
    commit: function (step) { data.website = step.querySelector('[name="website"]').value.trim(); }
  };

  var STEP_PRIOR = {
    id: 'prior', kind: 'select',
    render: function () {
      return options({
        kick: 'Step 6',
        q: 'Have you worked on SEO for this website before?',
        sub: '',
        opts: [
          { v: 'agency',     L: 'A', b: 'Yes, with an agency' },
          { v: 'ourselves',  L: 'B', b: 'Yes, we did it ourselves' },
          { v: 'never',      L: 'C', b: 'No, never worked on SEO' },
          { v: 'notsure',    L: 'D', b: 'Not sure' }
        ]
      });
    },
    commit: function (step, val) { data.priorSeo = val; }
  };

  var STEP_SERVICES = {
    id: 'services', kind: 'textarea',
    render: function () {
      return textarea({
        kick: 'Step 7',
        q: "What services of your business you're looking to rank for?",
        sub: "Mention your top-selling services, products, or unique offers you'd like to rank on Google",
        name: 'services', value: data.services,
        placeholder: 'e.g. emergency plumbing, water heater install, drain cleaning…',
        cta: 'Continue', enter: true, required: true
      });
    },
    valid: function (step) { return step.querySelector('[name="services"]').value.trim().length > 0; },
    commit: function (step) { data.services = step.querySelector('[name="services"]').value.trim(); }
  };

  var STEP_BUDGET = {
    id: 'budget', kind: 'select',
    render: function () {
      return options({
        kick: 'Step 8',
        q: "What's your monthly budget for SEO?",
        sub: '',
        opts: [
          { v: 'lt300',     emoji: '😢', b: 'Less than $300' },
          { v: '400-500',   emoji: '🙂', b: '$400 – $500' },
          { v: '500-1000',  emoji: '😀', b: '$500 – $1,000' },
          { v: '1000-2000', emoji: '🤩', b: '$1,000 – $2,000' },
          { v: '2000plus',  emoji: '🔥', b: '$2,000+' }
        ]
      });
    },
    commit: function (step, val) { data.budget = val; }
  };

  var STEP_COMPETITORS = {
    id: 'competitors', kind: 'textarea', submit: true,
    render: function () {
      return textarea({
        kick: 'Step 9',
        q: 'Who are your main competitors online? (Optional)',
        sub: 'List any websites or businesses you often see ranking ahead of you on Google',
        name: 'competitors', value: data.competitors,
        placeholder: 'e.g. competitor1.com, competitor2.com…',
        cta: 'Submit', enter: true, required: false
      });
    },
    valid: function () { return true; },                                  // optional
    commit: function (step) { data.competitors = step.querySelector('[name="competitors"]').value.trim(); }
  };

  /* ---- generic branch tail (PPC / AEO / Meta / Website Dev) — total = 5 --- */
  var STEP_DETAILS = {
    id: 'details', kind: 'textarea', submit: true,
    render: function () {
      return textarea({
        kick: 'Step 5',
        q: 'Tell us more about what you need.',
        sub: 'A few sentences on your business, your goals, and what you want help with. A senior strategist reviews it before any call.',
        name: 'details', value: data.details,
        placeholder: 'Tell us about your business and what you want to achieve…',
        cta: 'Submit', enter: true, required: true
      });
    },
    valid: function (step) { return step.querySelector('[name="details"]').value.trim().length > 0; },
    commit: function (step) { data.details = step.querySelector('[name="details"]').value.trim(); }
  };

  /* ===========================================================================
     buildFlow — derives the active step list from the service branch.
     Before step 4 is answered we assume the SEO branch (9) for the counter;
     once the service is picked we splice the correct tail.
     =========================================================================== */
  function buildFlow() {
    var head = [STEP_NAME, STEP_GOAL, STEP_CONTACT, STEP_SERVICE];
    var tail;
    if (data.service === 'seo' || data.service === '') {
      // SEO branch fully built; default assumption before the pick = SEO (total 9)
      tail = [STEP_WEBSITE, STEP_PRIOR, STEP_SERVICES, STEP_BUDGET, STEP_COMPETITORS];
    } else {
      // graceful generic fallback for PPC / AEO / Meta / Website Dev (total 5)
      tail = [STEP_DETAILS];
    }
    flow = head.concat(tail);
  }

  function total() { return flow.length; }

  /* ===========================================================================
     TEMPLATE BUILDERS  — return a .ao-step element (class names match page.css)
     =========================================================================== */
  function stepShell(kick, q, sub) {
    var el = document.createElement('div');
    el.className = 'ao-step';
    var html = '<p class="ao-kick">' + esc(kick) + '</p>' +
               '<h2 class="ao-q">' + personalize(q) + '</h2>';
    if (sub) html += '<p class="ao-sub">' + personalize(sub) + '</p>';
    el.innerHTML = html;
    return el;
  }

  function options(cfg) {
    var el = stepShell(cfg.kick, cfg.q, cfg.sub);
    var wrap = document.createElement('div');
    wrap.className = 'ao-options';
    wrap.setAttribute('role', 'radiogroup');
    cfg.opts.forEach(function (o) {
      var btn = document.createElement('button');
      btn.className = 'ao-option';
      btn.type = 'button';
      btn.setAttribute('data-value', o.v);
      if (o.L) btn.setAttribute('data-letter', o.L);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      var chip = o.emoji
        ? '<span class="ao-emoji" aria-hidden="true">' + o.emoji + '</span>'
        : '<span class="ao-letter">' + esc(o.L) + '</span>';
      var label = '<span class="ao-olabel"><b>' + esc(o.b) + '</b>' +
                  (o.i ? '<i>' + esc(o.i) + '</i>' : '') + '</span>';
      btn.innerHTML = chip + label;
      wrap.appendChild(btn);
    });
    el.appendChild(wrap);
    return el;
  }

  function field(cfg) {
    var el = stepShell(cfg.kick, cfg.q, cfg.sub);
    var fields = document.createElement('div');
    fields.className = 'ao-fields';
    cfg.fields.forEach(function (f) {
      var wrap = document.createElement('div');
      wrap.className = 'ao-field';
      var input;
      if (f.cc) {
        input = '<div class="ao-phone"><span class="ao-cc">' + f.cc + '</span>' +
          '<input class="ao-input" type="' + f.type + '" name="' + f.name + '"' +
          ' value="' + esc(f.value || '') + '"' +
          (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
          (f.required ? ' required' : '') + ' autocomplete="off"></div>';
      } else {
        input = '<input class="ao-input" type="' + f.type + '" name="' + f.name + '"' +
          ' value="' + esc(f.value || '') + '"' +
          (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') +
          (f.required ? ' required' : '') + ' autocomplete="off">';
      }
      wrap.innerHTML = '<label>' + f.label + '</label>' + input;
      fields.appendChild(wrap);
    });
    el.appendChild(fields);
    el.appendChild(actions(cfg.cta, cfg.enter !== false));
    return el;
  }

  function textarea(cfg) {
    var el = stepShell(cfg.kick, cfg.q, cfg.sub);
    var fields = document.createElement('div');
    fields.className = 'ao-fields';
    var wrap = document.createElement('div');
    wrap.className = 'ao-field';
    wrap.innerHTML = '<textarea class="ao-textarea" name="' + cfg.name + '"' +
      (cfg.placeholder ? ' placeholder="' + esc(cfg.placeholder) + '"' : '') +
      '>' + esc(cfg.value || '') + '</textarea>';
    fields.appendChild(wrap);
    el.appendChild(fields);
    el.appendChild(actions(cfg.cta, cfg.enter !== false));
    return el;
  }

  function actions(ctaLabel, showEnter) {
    var wrap = document.createElement('div');
    wrap.className = 'ao-actions';
    var arrow = ctaLabel === 'Submit' ? '' : ' <span class="arr">→</span>';
    wrap.innerHTML =
      '<button class="btn btn-primary ao-next" type="button" disabled>' + esc(ctaLabel) + arrow + '</button>' +
      (showEnter ? '<span class="ao-enter">Press Enter <kbd>↵</kbd></span>' : '');
    return wrap;
  }

  /* ===========================================================================
     RENDER  — mount step at `index` into the stage, wire interactions.
     =========================================================================== */
  function renderStep() {
    var def = flow[index];
    var prev = stage.querySelector('.ao-step');

    var build = function () {
      var el = def.render();
      // staged cross-fade: clear stage, mount fresh (CSS ao-rise animates in)
      stage.innerHTML = '';
      stage.appendChild(el);
      stage.scrollTop = 0;
      wireStep(def, el);
      updateChrome();
      focusStep(def, el);
    };

    if (prev && !reduceMotion) {
      prev.style.transition = 'opacity .18s var(--sg-ease), transform .18s var(--sg-ease)';
      prev.style.opacity = '0';
      prev.style.transform = 'translateY(-8px)';
      window.setTimeout(build, 170);
    } else {
      build();
    }
  }

  function wireStep(def, el) {
    if (def.kind === 'select') {
      var opts = Array.prototype.slice.call(el.querySelectorAll('.ao-option'));
      opts.forEach(function (btn) {
        btn.addEventListener('click', function () { selectOption(def, opts, btn); });
      });
    } else {
      var next = el.querySelector('.ao-next');
      var inputs = Array.prototype.slice.call(el.querySelectorAll('.ao-input, .ao-textarea'));
      var revalidate = function () {
        next.disabled = !def.valid(el);
      };
      inputs.forEach(function (inp) {
        inp.addEventListener('input', revalidate);
      });
      revalidate();
      next.addEventListener('click', function () { advanceText(def, el); });
    }
  }

  function selectOption(def, opts, btn) {
    opts.forEach(function (o) { o.classList.remove('is-selected'); o.setAttribute('aria-checked', 'false'); });
    btn.classList.add('is-selected');
    btn.setAttribute('aria-checked', 'true');
    var val = btn.getAttribute('data-value');
    def.commit(stage.querySelector('.ao-step'), val);
    window.setTimeout(function () { goNext(def); }, 250);   // single-select auto-advance
  }

  function advanceText(def, el) {
    if (!def.valid(el)) return;
    def.commit(el);
    goNext(def);
  }

  function goNext(def) {
    if (def.submit) { submit(); return; }
    if (index < total() - 1) {
      index++;
      renderStep();
    } else {
      submit();
    }
  }

  function goBack() {
    if (index <= 0) {
      // back from step 1 → return to the intro screen
      showIntro();
      return;
    }
    index--;
    renderStep();
  }

  /* ===========================================================================
     CHROME  — counter, progress, back visibility, plan flag
     =========================================================================== */
  function updateChrome() {
    var n = index + 1;
    var t = total();
    counter.textContent = n + ' / ' + t;
    progress.style.width = Math.round((n / t) * 100) + '%';
    if (index >= 1) backBtn.removeAttribute('hidden');   // hidden on intro + step 1
    else backBtn.setAttribute('hidden', '');
  }

  function focusStep(def, el) {
    var target;
    if (def.kind === 'select') target = el.querySelector('.ao-option');
    else target = el.querySelector('.ao-input, .ao-textarea');
    if (target) {
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }
  }

  /* ===========================================================================
     INTRO / OPEN / CLOSE
     =========================================================================== */
  function showIntro() {
    success.setAttribute('hidden', '');
    success.classList.remove('open');
    backBtn.setAttribute('hidden', '');
    counter.textContent = '';
    progress.style.width = '0%';
    stage.innerHTML = introMarkup();
    var startBtn = stage.querySelector('.ao-next');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        buildFlow();
        index = 0;
        renderStep();
      });
      try { startBtn.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }
  }

  function introMarkup() {
    return '' +
      '<div class="ao-step" data-ao-intro>' +
        '<span class="ao-pill"><span class="dot"></span>Only 5 new clients onboarded per month</span>' +
        '<h2 class="ao-q">Your competitors are <span class="grad">stealing your customers</span></h2>' +
        '<p class="ao-sub">Tell us about your business in 90 seconds. If we\'re a fit, you can book a call with our team to map out the work.</p>' +
        '<div class="ao-actions">' +
          '<button class="btn btn-primary ao-next" type="button">See if we\'re a fit <span class="arr">→</span></button>' +
        '</div>' +
        '<div class="ao-social">' +
          '<span class="ao-avatars"><span>R</span><span>M</span><span>D</span><span>G</span><span>J</span></span>' +
          '<span class="ao-soc-text"><span class="stars">★★★★★</span> Trusted by 200+ businesses</span>' +
        '</div>' +
        '<div class="ao-trustchips">' +
          '<span class="tc">100% Free</span><span class="tc">No Obligation</span><span class="tc">15 Min Call</span>' +
        '</div>' +
      '</div>';
  }

  var PLAN_LABELS = { foundation: 'Foundation', accelerate: 'Accelerate', authority: 'Authority' };

  function open(trigger) {
    lastTrigger = trigger || null;

    // plan deep-link
    var plan = trigger && trigger.getAttribute ? trigger.getAttribute('data-plan') : null;
    if (plan && PLAN_LABELS[plan]) {
      data.plan = plan;
      planName.textContent = PLAN_LABELS[plan];
      planFlag.removeAttribute('hidden');
    } else {
      data.plan = null;
      planFlag.setAttribute('hidden', '');
    }

    buildFlow();
    showIntro();

    overlay.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('open');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if (lastTrigger && lastTrigger.focus) {
      try { lastTrigger.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }
  }

  function isOpen() { return overlay.classList.contains('open'); }

  /* ===========================================================================
     SUBMIT  — NO network. Payload to console.debug + show success.
     =========================================================================== */
  function submit() {
    var payload = {
      plan: data.plan,
      firstName: data.first,
      lastName: data.last,
      primaryGoal: data.goal,
      phone: data.phone,
      email: data.email,
      company: data.company,
      service: data.service
    };
    if (data.service === 'seo') {
      payload.website = data.website;
      payload.priorSeo = data.priorSeo;
      payload.servicesToRank = data.services;
      payload.monthlyBudget = data.budget;
      payload.competitors = data.competitors;
    } else {
      payload.details = data.details;
    }
    payload.submittedAt = new Date().toISOString();

    // eslint-disable-next-line no-console
    console.debug('[SGEN apply] application submitted (no network):', payload);

    // success screen — personalize {First} / {Company}
    stage.innerHTML = '';
    counter.textContent = '';
    progress.style.width = '100%';
    backBtn.setAttribute('hidden', '');

    var firstNode = success.querySelector('[data-success-first]');
    var companyNode = success.querySelector('[data-success-company]');
    if (firstNode) firstNode.textContent = first();
    if (companyNode) companyNode.textContent = company();

    success.removeAttribute('hidden');
    // force reflow so the .open pop animation always fires
    void success.offsetWidth;
    success.classList.add('open');
  }

  /* ===========================================================================
     GLOBAL WIRING  — open triggers, close controls, Esc, backdrop, keyboard
     =========================================================================== */

  // open from any [data-apply-open]
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('[data-apply-open]') : null;
    if (trigger) {
      e.preventDefault();
      open(trigger);
    }
  });

  // close controls + backdrop
  overlay.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-apply-close]')) { close(); return; }
    // backdrop = clicking the overlay shell itself (not a child step/success/chrome)
    if (e.target === overlay) { close(); }
  });

  // back control
  if (backBtn) backBtn.addEventListener('click', goBack);

  // keyboard: Esc closes · Enter advances text steps · A/B/C… selects options
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;

    if (e.key === 'Escape') { e.preventDefault(); close(); return; }

    // success screen swallows further keys
    if (!success.hasAttribute('hidden')) return;

    var step = stage.querySelector('.ao-step');
    if (!step) return;
    var def = flow[index];

    // intro screen: Enter starts
    if (step.hasAttribute('data-ao-intro')) {
      if (e.key === 'Enter') { e.preventDefault(); var s = step.querySelector('.ao-next'); if (s) s.click(); }
      return;
    }
    if (!def) return;

    if (def.kind === 'select') {
      var letter = (e.key || '').toUpperCase();
      if (/^[A-Z]$/.test(letter)) {
        var btn = step.querySelector('.ao-option[data-letter="' + letter + '"]');
        if (btn) { e.preventDefault(); btn.click(); }
      }
      return;
    }

    // text / textarea steps: Enter advances (Shift+Enter = newline in textarea)
    if (e.key === 'Enter') {
      var isTextarea = e.target && e.target.tagName === 'TEXTAREA';
      if (isTextarea && e.shiftKey) return;
      e.preventDefault();
      if (def.valid(step)) advanceText(def, step);
    }
  });

})();
