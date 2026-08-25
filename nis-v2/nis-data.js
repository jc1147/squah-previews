/* nis-data.js: NIS dynamic totals loader. Dependency-free, ES5-safe (old mobile Safari).
   Fills elements carrying data-nis="dot.path" from /data/totals.json at runtime.
   On ANY failure the build-stamped fallback text is left untouched. Silent unless
   <body data-nis-debug> is present. Pure helpers exported for Node tests. */
(function (global) {
  'use strict';
  function nisResolve(obj, path) {
    if (obj === null || typeof obj !== 'object' || typeof path !== 'string' || path === '') return undefined;
    var parts = path.split('.'), cur = obj, i;
    for (i = 0; i < parts.length; i++) {
      if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, parts[i])) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function nisFormat(value, raw) {
    if (typeof value === 'number' && isFinite(value) && !raw) {
      var neg = value < 0 ? '-' : '', s = String(Math.abs(value)), dot = s.indexOf('.');
      var intPart = dot === -1 ? s : s.slice(0, dot), rest = dot === -1 ? '' : s.slice(dot);
      return neg + intPart.replace(/\B(?=(\d{3})+$)/g, ',') + rest;
    }
    return String(value);
  }
  var api = { resolve: nisResolve, format: nisFormat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.NIS_DATA = api;
  if (typeof document === 'undefined') return; /* Node test harness stops here */

  /* Site root = directory this script was served from (nis-data.js sits at site root),
     so subpath hosting (e.g. GitHub Pages project sites) resolves correctly. */
  var script = document.currentScript || null, tags, i;
  if (!script) {
    tags = document.getElementsByTagName('script');
    for (i = tags.length - 1; i >= 0; i--) {
      if (tags[i].src && /nis-data\.js([?#]|$)/.test(tags[i].src)) { script = tags[i]; break; }
    }
  }
  var root = (script && script.src) ? script.src.replace(/nis-data\.js([?#][^\/]*)?$/, '') : '/';

  function bind() {
    var debug = !!(document.body && document.body.hasAttribute('data-nis-debug'));
    function log(msg) { if (debug && global.console && console.log) console.log('[nis-data] ' + msg); }
    if (!global.fetch || !document.querySelectorAll) { log('fetch/qsa unavailable; keeping stamped text'); return; }
    global.fetch(root + 'data/totals.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.json();
    }).then(function (totals) {
      var els = document.querySelectorAll('[data-nis]'), n = 0, el, v;
      for (var j = 0; j < els.length; j++) {
        el = els[j];
        v = nisResolve(totals, el.getAttribute('data-nis'));
        if (v === undefined || v === null || typeof v === 'object') { log('unresolved: ' + el.getAttribute('data-nis')); continue; }
        el.textContent = nisFormat(v, el.hasAttribute('data-nis-raw'));
        n++;
      }
      log('bound ' + n + '/' + els.length + ' from ' + root + 'data/totals.json (generated ' + totals.generated + ')');
    }).catch(function (e) { log('load failed, stamped text kept: ' + (e && e.message ? e.message : e)); });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bind); }
  else { bind(); }
})(typeof window !== 'undefined' ? window : this);
