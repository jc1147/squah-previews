/* ============================================================================
   apply.js  —  SGEN Local SEO + AEO  ·  APPLICATION OVERLAY state machine
   ----------------------------------------------------------------------------
   Vanilla, dependency-free. Drives #apply-overlay (markup in _frag/overlay.html,
   styled by page.css + apply-v2.css). Typeform-grade single-question flow.
   NO backend: on Submit it console.debug's the payload + shows an animated
   success screen. Copy VERBATIM from _CONTENT.md unless the flow brief changed it.

   STEP MODEL  (single linear path — no branching)
   -----------------------------------------------
   intro (not counted)
     1  name          (text:  first* + last)
     2  primary goal   (single-select A–E)         personalize {First}
     3  contact        (intl phone + email + company)  personalize {First}
     4  service         (MULTI-select A–F, Continue, >=1 required)  personalize {First}
     5  has website?    (Yes/No → reveals URL field on Yes, URL required)
     6  prior Local SEO (single-select A–D)
     7  locations       (single-select)  → Submit → success
   ============================================================================ */
(function () {
  'use strict';

  var overlay = document.getElementById('apply-overlay');
  if (!overlay) return;

  /* ---- ensure our companion stylesheet is present (we own apply-v2.css; the
         page may not link it yet — inject once, never edit the other CSS) ----- */
  (function ensureCss() {
    var href = 'assets/css/apply-v2.css';
    var have = false, links = document.getElementsByTagName('link'), i;
    for (i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href') || '';
      if (h.indexOf('apply-v2.css') !== -1) { have = true; break; }
    }
    if (!have) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      (document.head || document.documentElement).appendChild(l);
    }
  })();

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
    phone: '', country: '', email: '', company: '',
    services: [],          // multi-select
    hasWebsite: '',        // 'yes' | 'no'
    website: '',
    priorSeo: '',
    locations: ''
  };

  var lastTrigger = null;       // element that opened the overlay (focus restore)
  var index = 0;                // current position in `flow`
  var flow = [];                // array of step-definitions (intro excluded)

  /* ===========================================================================
     COUNTRIES  — intl phone field config.
     digits = exact national digit count; fmt() groups a digit string for display.
     ========================================================================= */
  var COUNTRIES = [
    { iso: 'US', name: 'United States', flag: '🇺🇸', dial: '+1',   digits: 10, ph: '(702) 619-8872', fmt: fmtNANP },
    { iso: 'CA', name: 'Canada',        flag: '🇨🇦', dial: '+1',   digits: 10, ph: '(416) 555-0142', fmt: fmtNANP },
    { iso: 'GB', name: 'United Kingdom',flag: '🇬🇧', dial: '+44',  digits: 11, ph: '07123 456789',   fmt: fmtGB },
    { iso: 'DE', name: 'Germany',       flag: '🇩🇪', dial: '+49',  digits: 11, ph: '030 12345678',   fmt: fmtDE },
    { iso: 'FR', name: 'France',        flag: '🇫🇷', dial: '+33',  digits: 10, ph: '06 12 34 56 78', fmt: fmtFR },
    { iso: 'NL', name: 'Netherlands',   flag: '🇳🇱', dial: '+31',  digits: 10, ph: '06 12345678',    fmt: fmtNL },
    { iso: 'IE', name: 'Ireland',       flag: '🇮🇪', dial: '+353', digits: 10, ph: '085 123 4567',   fmt: fmtIE },
    { iso: 'ES', name: 'Spain',         flag: '🇪🇸', dial: '+34',  digits: 9,  ph: '612 34 56 78',   fmt: fmtES },
    { iso: 'IT', name: 'Italy',         flag: '🇮🇹', dial: '+39',  digits: 10, ph: '312 345 6789',   fmt: fmtIT },
    { iso: 'AU', name: 'Australia',     flag: '🇦🇺', dial: '+61',  digits: 10, ph: '0412 345 678',   fmt: fmtAU },
    { iso: 'SG', name: 'Singapore',     flag: '🇸🇬', dial: '+65',  digits: 8,  ph: '8123 4567',      fmt: fmtSG }
  ];
  var COUNTRY_BY_ISO = {};
  COUNTRIES.forEach(function (c) { COUNTRY_BY_ISO[c.iso] = c; });

  /* national-format groupers (operate on a raw digit string, already length-capped) */
  function group(d, sizes, seps) {
    // generic left-to-right grouper: sizes[] chunk widths, seps[] separators
    var out = '', i = 0, g = 0;
    while (i < d.length && g < sizes.length) {
      if (g > 0 && i > 0) out += seps[g - 1] || ' ';
      out += d.substr(i, sizes[g]);
      i += sizes[g];
      g++;
    }
    if (i < d.length) out += (seps[g - 1] || ' ') + d.substr(i);
    return out;
  }
  function fmtNANP(d) { // (702) 619-8872
    if (d.length <= 3) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.substr(0, 3) + ') ' + d.substr(3);
    return '(' + d.substr(0, 3) + ') ' + d.substr(3, 3) + '-' + d.substr(6);
  }
  function fmtGB(d) { return group(d, [5, 6], [' ']); }          // 07123 456789
  function fmtDE(d) { return group(d, [3, 8], [' ']); }          // 030 12345678
  function fmtFR(d) { return group(d, [2, 2, 2, 2, 2], [' ', ' ', ' ', ' ']); } // 06 12 34 56 78
  function fmtNL(d) { return group(d, [2, 8], [' ']); }          // 06 12345678
  function fmtIE(d) { return group(d, [3, 3, 4], [' ', ' ']); }  // 085 123 4567
  function fmtES(d) { return group(d, [3, 2, 2, 2], [' ', ' ', ' ']); } // 612 34 56 78
  function fmtIT(d) { return group(d, [3, 3, 4], [' ', ' ']); }  // 312 345 6789
  function fmtAU(d) { return group(d, [4, 3, 3], [' ', ' ']); }  // 0412 345 678
  function fmtSG(d) { return group(d, [4, 4], [' ']); }          // 8123 4567

  /* ---- detect a sensible default country (sync, never blocks) ------------ */
  function detectCountry() {
    var tz = '';
    try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch (e) {}
    var lang = ((navigator.language || navigator.userLanguage || '') + '').toLowerCase();

    // timezone wins where unambiguous
    if (/Australia\//.test(tz)) return 'AU';
    if (tz === 'Asia/Singapore') return 'SG';
    if (tz === 'Europe/London') return 'GB';
    if (tz === 'Europe/Dublin') return 'IE';
    if (tz === 'Europe/Berlin') return 'DE';
    if (tz === 'Europe/Paris') return 'FR';
    if (tz === 'Europe/Amsterdam') return 'NL';
    if (tz === 'Europe/Madrid') return 'ES';
    if (tz === 'Europe/Rome') return 'IT';
    if (/America\/Toronto|America\/Vancouver|America\/Edmonton|America\/Winnipeg|America\/Halifax|America\/St_Johns|America\/Regina/.test(tz)) return 'CA';

    // language locale fallback (region tag)
    var m = lang.match(/[-_]([a-z]{2})\b/);
    var region = m ? m[1].toUpperCase() : '';
    if (region && COUNTRY_BY_ISO[region]) return region;
    if (lang === 'en-gb') return 'GB';
    if (lang === 'en-au') return 'AU';
    if (lang === 'en-ca') return 'CA';
    if (lang === 'en-ie') return 'IE';
    if (lang === 'en-sg') return 'SG';
    if (lang.indexOf('de') === 0) return 'DE';
    if (lang.indexOf('fr') === 0) return 'FR';
    if (lang.indexOf('nl') === 0) return 'NL';
    if (lang.indexOf('es') === 0) return 'ES';
    if (lang.indexOf('it') === 0) return 'IT';

    return 'US';
  }

  /* optional non-blocking IP refinement; sets data.country if still unpicked */
  var ipRefined = false, userPickedCountry = false;
  function ipRefineCountry() {
    if (!window.fetch) return;
    try {
      window.fetch('https://ipapi.co/json/', { mode: 'cors' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j) return;
          var iso = (j.country_code || '').toUpperCase();
          ipRefined = true;
          // only override if the user hasn't manually picked and it's supported
          if (!userPickedCountry && COUNTRY_BY_ISO[iso]) {
            data.country = iso;
            syncCountryUI();
          }
        })['catch'](function () { /* never block the UI */ });
    } catch (e) { /* noop */ }
  }

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
     Step kinds: 'text' (inputs), 'select' (option cards), 'multi', 'textarea'.
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
      }, data.goal);
    },
    commit: function (step, val) { data.goal = val; }
  };

  var STEP_CONTACT = {
    id: 'contact', kind: 'text',
    render: function () {
      var el = field({
        kick: 'Step 3',
        q: 'Perfect, {First}!',
        sub: 'How can we reach you?',
        fields: [
          { label: 'Phone', name: 'phone', custom: 'phone' },
          { label: 'Email address', name: 'email', type: 'email', value: data.email, placeholder: 'you@company.com' },
          { label: 'Company name', name: 'company', type: 'text', value: data.company, placeholder: 'Your business' }
        ],
        cta: 'Continue', enter: false
      });
      return el;
    },
    valid: function (step) {
      var c = COUNTRY_BY_ISO[data.country] || COUNTRY_BY_ISO.US;
      var digits = digitsOf(step.querySelector('[name="phone"]').value);
      var email = step.querySelector('[name="email"]').value.trim();
      var comp  = step.querySelector('[name="company"]').value.trim();
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      return digits.length === c.digits && emailOk && comp.length > 0;
    },
    commit: function (step) {
      var c = COUNTRY_BY_ISO[data.country] || COUNTRY_BY_ISO.US;
      var digits = digitsOf(step.querySelector('[name="phone"]').value);
      data.phone   = c.dial + ' ' + c.fmt(digits);
      data.email   = step.querySelector('[name="email"]').value.trim();
      data.company = step.querySelector('[name="company"]').value.trim();
    }
  };

  var STEP_SERVICE = {
    id: 'service', kind: 'multi',
    render: function () {
      return multi({
        kick: 'Step 4',
        q: 'Which services interest you, {First}?',
        sub: 'Pick all that apply.',
        opts: [
          { v: 'localseo', L: 'A', b: 'Local SEO & AEO' },
          { v: 'webdev',   L: 'B', b: 'Website Development' },
          { v: 'serp',     L: 'C', b: 'Traditional SEO (SERP)' },
          { v: 'aeo',      L: 'D', b: 'AEO / AI Optimization' },
          { v: 'ppc',      L: 'E', b: 'PPC / Google Ads' },
          { v: 'meta',     L: 'F', b: 'Facebook / Meta Ads' }
        ],
        cta: 'Continue'
      }, data.services);
    },
    valid: function () { return data.services.length >= 1; },
    commit: function () { /* committed live via toggles */ }
  };

  var STEP_WEBSITE = {
    id: 'website', kind: 'yesno-url',
    render: function () {
      return yesNoUrl({
        kick: 'Step 5',
        q: 'Do you currently have a website?',
        sub: '',
        cta: 'Continue'
      });
    },
    valid: function () {
      if (data.hasWebsite === 'no') return true;
      if (data.hasWebsite === 'yes') return data.website.trim().length >= 3;
      return false;
    },
    commit: function () { /* committed live */ }
  };

  var STEP_PRIOR = {
    id: 'prior', kind: 'select',
    render: function () {
      return options({
        kick: 'Step 6',
        q: 'Have you worked on Local SEO before?',
        sub: '',
        opts: [
          { v: 'agency',    L: 'A', b: 'Yes, with an agency' },
          { v: 'ourselves', L: 'B', b: 'Yes, we did it ourselves' },
          { v: 'never',     L: 'C', b: 'No, never' },
          { v: 'notsure',   L: 'D', b: 'Not sure' }
        ]
      }, data.priorSeo);
    },
    commit: function (step, val) { data.priorSeo = val; }
  };

  var STEP_LOCATIONS = {
    id: 'locations', kind: 'select', submit: true,
    render: function () {
      return options({
        kick: 'Step 7',
        q: 'How many locations do you have?',
        sub: '',
        opts: [
          { v: '1',    L: 'A', b: '1 location' },
          { v: '2-5',  L: 'B', b: '2–5' },
          { v: '6-10', L: 'C', b: '6–10' },
          { v: '11+',  L: 'D', b: '11+' }
        ]
      }, data.locations);
    },
    commit: function (step, val) { data.locations = val; }
  };

  /* ===========================================================================
     buildFlow — single linear path; total is fixed at 7.
     =========================================================================== */
  function buildFlow() {
    flow = [STEP_NAME, STEP_GOAL, STEP_CONTACT, STEP_SERVICE, STEP_WEBSITE, STEP_PRIOR, STEP_LOCATIONS];
  }

  function total() { return flow.length; }

  /* ===========================================================================
     TEMPLATE BUILDERS  — return a .ao-step element
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

  function optBtn(o, selected) {
    var btn = document.createElement('button');
    btn.className = 'ao-option' + (selected ? ' is-selected' : '');
    btn.type = 'button';
    btn.setAttribute('data-value', o.v);
    if (o.L) btn.setAttribute('data-letter', o.L);
    var chip = o.emoji
      ? '<span class="ao-emoji" aria-hidden="true">' + o.emoji + '</span>'
      : '<span class="ao-letter">' + esc(o.L) + '</span>';
    var label = '<span class="ao-olabel"><b>' + esc(o.b) + '</b>' +
                (o.i ? '<i>' + esc(o.i) + '</i>' : '') + '</span>';
    btn.innerHTML = chip + label;
    return btn;
  }

  function options(cfg, current) {
    var el = stepShell(cfg.kick, cfg.q, cfg.sub);
    var wrap = document.createElement('div');
    wrap.className = 'ao-options';
    wrap.setAttribute('role', 'radiogroup');
    cfg.opts.forEach(function (o) {
      var sel = current === o.v;
      var btn = optBtn(o, sel);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', sel ? 'true' : 'false');
      wrap.appendChild(btn);
    });
    el.appendChild(wrap);
    return el;
  }

  function multi(cfg, currentArr) {
    var el = stepShell(cfg.kick, cfg.q, cfg.sub);
    el.classList.add('ao-multi-step');   // marker for mobile compaction (Issue 2)
    var wrap = document.createElement('div');
    wrap.className = 'ao-options ao-multi';
    wrap.setAttribute('role', 'group');
    cfg.opts.forEach(function (o) {
      var sel = currentArr.indexOf(o.v) !== -1;
      var btn = optBtn(o, sel);
      btn.setAttribute('role', 'checkbox');
      btn.setAttribute('aria-checked', sel ? 'true' : 'false');
      btn.insertAdjacentHTML('beforeend',
        '<span class="ao-check-box" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
        '</span>');
      wrap.appendChild(btn);
    });
    el.appendChild(wrap);
    el.appendChild(actions(cfg.cta, false));
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
      if (f.custom === 'phone') {
        input = phoneMarkup();
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

  function yesNoUrl(cfg) {
    var el = stepShell(cfg.kick, cfg.q, cfg.sub);
    var wrap = document.createElement('div');
    wrap.className = 'ao-options';
    wrap.setAttribute('role', 'radiogroup');
    [{ v: 'yes', L: 'A', b: 'Yes' }, { v: 'no', L: 'B', b: 'No' }].forEach(function (o) {
      var sel = data.hasWebsite === o.v;
      var btn = optBtn(o, sel);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', sel ? 'true' : 'false');
      wrap.appendChild(btn);
    });
    el.appendChild(wrap);

    // conditional URL reveal (hidden until Yes)
    var rev = document.createElement('div');
    rev.className = 'ao-reveal' + (data.hasWebsite === 'yes' ? ' is-open' : '');
    rev.setAttribute('data-url-reveal', '');
    rev.innerHTML =
      '<div class="ao-field">' +
        '<label>Website URL <span class="req">*</span></label>' +
        '<input class="ao-input" type="url" name="website" value="' + esc(data.website || '') +
          '" placeholder="https://yoursite.com" autocomplete="off">' +
      '</div>';
    el.appendChild(rev);

    el.appendChild(actions(cfg.cta, false));
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

  /* ---- intl phone field markup + behavior -------------------------------- */
  function digitsOf(s) { return (s || '').replace(/\D+/g, ''); }

  function phoneMarkup() {
    if (!data.country) data.country = detectCountry();
    var c = COUNTRY_BY_ISO[data.country] || COUNTRY_BY_ISO.US;
    var menu = '';
    COUNTRIES.forEach(function (cc) {
      menu +=
        '<button type="button" class="ao-cc-opt" role="option" data-iso="' + cc.iso + '"' +
          (cc.iso === c.iso ? ' aria-selected="true"' : ' aria-selected="false"') + '>' +
          '<span class="fl" aria-hidden="true">' + cc.flag + '</span>' +
          '<span class="nm">' + esc(cc.name) + '</span>' +
          '<span class="dl">' + esc(cc.dial) + '</span>' +
        '</button>';
    });
    return '' +
      '<div class="ao-phone" data-phone>' +
        '<div class="ao-cc-wrap">' +
          '<button type="button" class="ao-cc" data-cc-toggle aria-haspopup="listbox" aria-expanded="false">' +
            '<span class="fl" data-cc-flag aria-hidden="true">' + c.flag + '</span>' +
            '<span class="dl" data-cc-dial>' + esc(c.dial) + '</span>' +
            '<span class="cv" aria-hidden="true">▾</span>' +
          '</button>' +
          '<div class="ao-cc-menu" data-cc-menu role="listbox" hidden>' + menu + '</div>' +
        '</div>' +
        '<input class="ao-input" type="tel" name="phone" inputmode="tel" autocomplete="off"' +
          ' value="' + esc(c.fmt(digitsOf(data.phone))) + '" placeholder="' + esc(c.ph) + '">' +
      '</div>';
  }

  function wirePhone(step, revalidate) {
    var root = step.querySelector('[data-phone]');
    if (!root) return;
    var toggle = root.querySelector('[data-cc-toggle]');
    var menu   = root.querySelector('[data-cc-menu]');
    var flagEl = root.querySelector('[data-cc-flag]');
    var dialEl = root.querySelector('[data-cc-dial]');
    var input  = root.querySelector('input[name="phone"]');

    function applyCountry(iso, opts) {
      var c = COUNTRY_BY_ISO[iso] || COUNTRY_BY_ISO.US;
      data.country = c.iso;
      flagEl.textContent = c.flag;
      dialEl.textContent = c.dial;
      input.placeholder = c.ph;
      // reformat whatever digits are present under the new country's rules
      var d = digitsOf(input.value).slice(0, c.digits);
      input.value = c.fmt(d);
      // reflect selection in menu
      menu.querySelectorAll('.ao-cc-opt').forEach(function (b) {
        b.setAttribute('aria-selected', b.getAttribute('data-iso') === c.iso ? 'true' : 'false');
      });
      if (opts && opts.fromUser) { userPickedCountry = true; }
      revalidate();
    }
    // expose so the async IP refine can update this live field if still mounted
    syncCountryUI = function () {
      if (!document.body.contains(input)) return;
      applyCountry(data.country, { fromUser: false });
    };

    function closeMenu() { menu.setAttribute('hidden', ''); toggle.setAttribute('aria-expanded', 'false'); root.classList.remove('cc-open'); }
    function openMenu()  { menu.removeAttribute('hidden'); toggle.setAttribute('aria-expanded', 'true'); root.classList.add('cc-open'); }

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hasAttribute('hidden')) openMenu(); else closeMenu();
    });
    menu.addEventListener('click', function (e) {
      var opt = e.target.closest ? e.target.closest('.ao-cc-opt') : null;
      if (!opt) return;
      applyCountry(opt.getAttribute('data-iso'), { fromUser: true });
      closeMenu();
      input.focus();
    });
    // close on outside click / Esc (scoped; Esc still bubbles to overlay close otherwise)
    document.addEventListener('click', function onDoc(e) {
      if (!document.body.contains(root)) { document.removeEventListener('click', onDoc); return; }
      if (!root.contains(e.target)) closeMenu();
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hasAttribute('hidden')) { e.stopPropagation(); closeMenu(); toggle.focus(); }
    });

    // LIVE auto-format on every input
    input.addEventListener('input', function () {
      var c = COUNTRY_BY_ISO[data.country] || COUNTRY_BY_ISO.US;
      var d = digitsOf(input.value).slice(0, c.digits);
      input.value = c.fmt(d);
      revalidate();
    });
  }

  /* ===========================================================================
     RENDER  — mount step at `index`, wire interactions.
     =========================================================================== */
  function renderStep() {
    var def = flow[index];
    var prev = stage.querySelector('.ao-step');

    var build = function () {
      var el = def.render();
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
      return;
    }

    if (def.kind === 'multi') {
      var mopts = Array.prototype.slice.call(el.querySelectorAll('.ao-option'));
      var mnext = el.querySelector('.ao-next');
      var mreval = function () { mnext.disabled = !def.valid(el); };
      mopts.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var v = btn.getAttribute('data-value');
          var i = data.services.indexOf(v);
          if (i === -1) data.services.push(v); else data.services.splice(i, 1);
          var on = data.services.indexOf(v) !== -1;
          btn.classList.toggle('is-selected', on);
          btn.setAttribute('aria-checked', on ? 'true' : 'false');
          mreval();
        });
      });
      mreval();
      mnext.addEventListener('click', function () { if (!mnext.disabled) advanceText(def, el); });
      return;
    }

    if (def.kind === 'yesno-url') {
      var ynext = el.querySelector('.ao-next');
      var reveal = el.querySelector('[data-url-reveal]');
      var urlInput = reveal.querySelector('input[name="website"]');
      var yreval = function () { ynext.disabled = !def.valid(el); };
      var yopts = Array.prototype.slice.call(el.querySelectorAll('.ao-option'));
      yopts.forEach(function (btn) {
        btn.addEventListener('click', function () {
          yopts.forEach(function (o) { o.classList.remove('is-selected'); o.setAttribute('aria-checked', 'false'); });
          btn.classList.add('is-selected');
          btn.setAttribute('aria-checked', 'true');
          data.hasWebsite = btn.getAttribute('data-value');
          if (data.hasWebsite === 'yes') {
            reveal.classList.add('is-open');
            try { urlInput.focus({ preventScroll: true }); } catch (e) { urlInput.focus(); }
          } else {
            reveal.classList.remove('is-open');
            data.website = '';
            urlInput.value = '';
          }
          yreval();
        });
      });
      urlInput.addEventListener('input', function () { data.website = urlInput.value.trim(); yreval(); });
      yreval();
      ynext.addEventListener('click', function () { if (!ynext.disabled) advanceText(def, el); });
      return;
    }

    // text / textarea
    var next = el.querySelector('.ao-next');
    var inputs = Array.prototype.slice.call(el.querySelectorAll('.ao-input, .ao-textarea'));
    var revalidate = function () { next.disabled = !def.valid(el); };
    if (def.id === 'contact') wirePhone(el, revalidate);
    inputs.forEach(function (inp) { inp.addEventListener('input', revalidate); });
    revalidate();
    next.addEventListener('click', function () { advanceText(def, el); });
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
    if (index <= 0) { showIntro(); return; }
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
    if (index >= 1) backBtn.removeAttribute('hidden');
    else backBtn.setAttribute('hidden', '');
  }

  function focusStep(def, el) {
    var target;
    if (def.kind === 'select' || def.kind === 'multi' || def.kind === 'yesno-url') target = el.querySelector('.ao-option');
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
    overlay.classList.remove('is-success');   // restore the stage (Issue 3)
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
    var avatars = [
      { src: 'assets/img/av-rob.jpg', alt: 'Rob' },
      { src: 'assets/img/av-michael.jpg', alt: 'Michael' },
      { src: 'assets/img/av-drew.jpg', alt: 'Drew' },
      { src: 'assets/img/av-grace.jpg', alt: 'Grace' },
      { src: 'assets/img/av-jessica.jpg', alt: 'Jessica' }
    ].map(function (a) {
      return '<img src="' + a.src + '" alt="' + esc(a.alt) + '" loading="lazy" decoding="async">';
    }).join('');

    return '' +
      '<div class="ao-step" data-ao-intro>' +
        '<span class="ao-pill"><span class="dot"></span>Only 5 new clients onboarded per month</span>' +
        '<h2 class="ao-q">Your competitors are <span class="grad">stealing your customers</span></h2>' +
        '<p class="ao-sub">Tell us about your business in 90 seconds. If we\'re a fit, you can book a call with our team to map out the work.</p>' +
        '<div class="ao-actions">' +
          '<button class="btn btn-primary ao-next" type="button">See if we\'re a fit <span class="arr">→</span></button>' +
        '</div>' +
        '<div class="ao-social">' +
          '<span class="ao-avatars ao-avatars-photo">' + avatars + '</span>' +
          '<span class="ao-soc-text"><span class="stars">★★★★★</span> Trusted by 1,000+ businesses across 25 industries</span>' +
        '</div>' +
        '<div class="ao-trustchips">' +
          '<span class="tc">100% Free</span><span class="tc">No Obligation</span><span class="tc">15 Min Call</span>' +
        '</div>' +
      '</div>';
  }

  var PLAN_LABELS = { foundation: 'Foundation', accelerate: 'Accelerate', authority: 'Authority' };

  function open(trigger) {
    lastTrigger = trigger || null;

    var plan = trigger && trigger.getAttribute ? trigger.getAttribute('data-plan') : null;
    if (plan && PLAN_LABELS[plan]) {
      data.plan = plan;
      planName.textContent = PLAN_LABELS[plan];
      planFlag.removeAttribute('hidden');
    } else {
      data.plan = null;
      planFlag.setAttribute('hidden', '');
    }

    if (!data.country) { data.country = detectCountry(); ipRefineCountry(); }

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

  /* placeholder until a contact step mounts (async IP refine calls it safely) */
  var syncCountryUI = function () {};

  /* ===========================================================================
     SUBMIT  — NO network. Payload to console.debug + show animated success.
     =========================================================================== */
  function submit() {
    var payload = {
      plan: data.plan,
      firstName: data.first,
      lastName: data.last,
      primaryGoal: data.goal,
      country: data.country,
      phone: data.phone,
      email: data.email,
      company: data.company,
      services: data.services.slice(),
      hasWebsite: data.hasWebsite,
      website: data.hasWebsite === 'yes' ? data.website : '',
      priorLocalSeo: data.priorSeo,
      locations: data.locations,
      submittedAt: new Date().toISOString()
    };

    // eslint-disable-next-line no-console
    console.debug('[SGEN apply] application submitted (no network):', payload);

    stage.innerHTML = '';
    counter.textContent = '';
    progress.style.width = '100%';
    backBtn.setAttribute('hidden', '');

    buildSuccess();

    // flag the overlay so CSS collapses the emptied stage + lets #apply-success
    // own the scroll (Issue 3 — success was trapped below the fold on mobile)
    overlay.classList.add('is-success');

    success.removeAttribute('hidden');
    void success.offsetWidth;          // force reflow so .open animations fire
    success.classList.add('open');

    if (!reduceMotion) animateSuccess();
  }

  /* ---- build the success DOM (we own this; no HTML-file edit) ------------- */
  function buildSuccess() {
    var f = first(), comp = company();
    success.innerHTML = '' +
      '<span class="ao-check">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
      '</span>' +
      '<h2 class="ao-stitle">You\'re in, <span data-success-first>' + esc(f) + '</span>!</h2>' +
      '<p class="ao-sbody">Your application for <span data-success-company>' + esc(comp) + '</span> is with a senior strategist. ' +
        'We personally review every business before any call — expect your 30-day plan and baseline audit within 24 hours. ' +
        '<b class="ao-soon">We\'ll be in contact soon.</b></p>' +

      // ---- Book CTA sits RIGHT under the green "in contact soon" line (Issue 3) ----
      '<div class="cta-row center ao-scta">' +
        '<a class="btn btn-primary" href="#">Book your 15-min call <span class="arr">→</span></a>' +
      '</div>' +

      // ---- ranking climb widget ----
      '<div class="ao-celebrate" data-celebrate>' +
        '<div class="ao-climb" data-climb>' +
          '<div class="ao-climb-head">' +
            '<span class="cl-title">Projected rankings</span>' +
            '<span class="cl-live"><i></i>live preview</span>' +
          '</div>' +
          climbRows() +
        '</div>' +

        // ---- growth area chart ----
        '<div class="ao-growth" data-growth>' +
          '<div class="ao-growth-head">' +
            '<span class="gr-title">Projected growth</span>' +
            '<span class="gr-up"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12 7 7l3 3 4-5"/><path d="M14 5h-3M14 5v3"/></svg>Trending up</span>' +
          '</div>' +
          growthChart() +
        '</div>' +
      '</div>' +

      '<div class="ao-trustchips">' +
        '<span class="tc">100% Free</span><span class="tc">No Obligation</span><span class="tc">15 Min Call</span>' +
      '</div>';
  }

  var CLIMB = [
    { kw: 'near me',            from: 8 },
    { kw: 'best in {city}',     from: 6 },
    { kw: 'emergency service',  from: 4 },
    { kw: '24/7 {service}',     from: 5 }
  ];
  function climbRows() {
    return CLIMB.map(function (r, i) {
      var label = r.kw.replace('{city}', 'your city').replace('{service}', 'pro');
      return '' +
        '<div class="ao-climb-row" data-climb-row style="--i:' + i + '">' +
          '<span class="cr-kw">' + esc(label) + '</span>' +
          '<span class="cr-bar"><span class="cr-fill"></span></span>' +
          '<span class="cr-rank" data-from="' + r.from + '" data-to="1">#' + r.from + '</span>' +
        '</div>';
    }).join('');
  }

  /* seeded series → an upward area+line path; echoes evidence.js math */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function genSeries(n, startV, endV, vol, seed) {
    var rnd = mulberry32(seed), out = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var trend = startV + (endV - startV) * (t * t * 0.62 + t * 0.38);
      var noise = trend * vol * (rnd() * 2 - 1);
      out.push(Math.max(0, trend + noise));
    }
    return out;
  }
  function pathFor(vals, W, H, padT, padB) {
    var max = Math.max.apply(null, vals) || 1, n = vals.length, innerH = H - padT - padB;
    var pts = vals.map(function (v, i) {
      return [(i / (n - 1)) * W, padT + innerH - (v / max) * innerH];
    });
    var line = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
    var area = line + ' L' + W.toFixed(1) + ',' + (H - padB).toFixed(1) + ' L0,' + (H - padB).toFixed(1) + ' Z';
    return { line: line, area: area };
  }
  function growthChart() {
    var W = 560, H = 150, padT = 12, padB = 6;
    var vals = genSeries(40, 6, 92, 0.18, 41);
    var p = pathFor(vals, W, H, padT, padB);
    var grid = '';
    for (var g = 1; g <= 3; g++) { var y = (H / 4) * g; grid += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="var(--ev-grid)" stroke-width="1"/>'; }
    return '' +
      '<svg class="ao-growth-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Projected growth, trending up">' +
        '<defs><linearGradient id="aoGrowthFill" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="var(--ev-clk)" stop-opacity=".34"/>' +
          '<stop offset="1" stop-color="var(--ev-clk)" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        grid +
        '<path class="ao-growth-area" d="' + p.area + '" fill="url(#aoGrowthFill)"/>' +
        '<path class="ao-growth-line" d="' + p.line + '" fill="none" stroke="var(--ev-clk)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  /* ---- run the entrance animations (motion already gated by caller) ------- */
  function animateSuccess() {
    // ranking badges count down to #1
    var rows = success.querySelectorAll('[data-climb-row]');
    rows.forEach(function (row, i) {
      var rank = row.querySelector('.cr-rank');
      var fill = row.querySelector('.cr-fill');
      var from = +rank.getAttribute('data-from');
      var to   = +rank.getAttribute('data-to');
      var startDelay = 520 + i * 180;
      window.setTimeout(function () {
        row.classList.add('is-live');
        if (fill) fill.style.width = '100%';
        var cur = from, steps = from - to;
        var stepMs = steps > 0 ? Math.max(140, 620 / steps) : 0;
        (function tick() {
          rank.textContent = '#' + cur;
          if (cur > to) {
            cur--;
            window.setTimeout(tick, stepMs);
          } else {
            rank.classList.add('is-one');
          }
        })();
      }, startDelay);
    });

    // draw the growth line, then sweep the area in
    var line = success.querySelector('.ao-growth-line');
    var area = success.querySelector('.ao-growth-area');
    if (line && line.getTotalLength) {
      try {
        var len = line.getTotalLength();
        line.style.transition = 'none';
        line.style.strokeDasharray = len + ' ' + len;
        line.style.strokeDashoffset = len;
        if (area) area.style.opacity = '0';
        // next frame → animate
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            line.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.22,.61,.36,1) .35s';
            line.style.strokeDashoffset = '0';
            if (area) { area.style.transition = 'opacity .9s var(--sg-ease) .8s'; area.style.opacity = '1'; }
          });
        });
      } catch (e) { /* static fallback = full path already drawn */ }
    }
  }

  /* ===========================================================================
     GLOBAL WIRING  — open triggers, close controls, Esc, backdrop, keyboard
     =========================================================================== */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest ? e.target.closest('[data-apply-open]') : null;
    if (trigger) {
      e.preventDefault();
      open(trigger);
    }
  });

  overlay.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-apply-close]')) { close(); return; }
    if (e.target === overlay) { close(); }
  });

  if (backBtn) backBtn.addEventListener('click', goBack);

  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;

    if (e.key === 'Escape') { e.preventDefault(); close(); return; }

    if (!success.hasAttribute('hidden')) return;

    var step = stage.querySelector('.ao-step');
    if (!step) return;
    var def = flow[index];

    if (step.hasAttribute('data-ao-intro')) {
      if (e.key === 'Enter') { e.preventDefault(); var s = step.querySelector('.ao-next'); if (s) s.click(); }
      return;
    }
    if (!def) return;

    // single-select: letter keys pick + advance
    if (def.kind === 'select') {
      var letter = (e.key || '').toUpperCase();
      if (/^[A-Z]$/.test(letter)) {
        var btn = step.querySelector('.ao-option[data-letter="' + letter + '"]');
        if (btn) { e.preventDefault(); btn.click(); }
      }
      return;
    }

    // multi-select + yes/no-url: letter toggles option; Enter advances if valid
    if (def.kind === 'multi' || def.kind === 'yesno-url') {
      var L = (e.key || '').toUpperCase();
      if (/^[A-Z]$/.test(L) && (!e.target || e.target.tagName !== 'INPUT')) {
        var b2 = step.querySelector('.ao-option[data-letter="' + L + '"]');
        if (b2) { e.preventDefault(); b2.click(); return; }
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (def.valid(step)) advanceText(def, step);
      }
      return;
    }

    // text / textarea: Enter advances (Shift+Enter = newline in textarea)
    if (e.key === 'Enter') {
      var isTextarea = e.target && e.target.tagName === 'TEXTAREA';
      if (isTextarea && e.shiftKey) return;
      e.preventDefault();
      if (def.valid(step)) advanceText(def, step);
    }
  });

})();
