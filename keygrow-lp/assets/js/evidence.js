/* ============================================================================
   SGEN LP — EVIDENCE JS
   · 90-day GSC-style charts (seeded, daily noise, accelerating upward trend)
   · impact-card sparklines
   · impact + reviews carousels (arrows + dots, snap)
   No deps. Motion respects prefers-reduced-motion (charts are static SVG anyway).
   ============================================================================ */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // realistic daily series: accelerating upward trend + daily noise + rare spikes
  function genSeries(days, startV, endV, vol, seed) {
    var rnd = mulberry32(seed), out = [];
    for (var i = 0; i < days; i++) {
      var t = i / (days - 1);
      var trend = startV + (endV - startV) * (t * t * 0.62 + t * 0.38);
      var noise = trend * vol * (rnd() * 2 - 1);
      var spike = rnd() > 0.93 ? trend * 0.45 * rnd() : 0;
      out.push(Math.max(0, trend + noise + spike));
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

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function buildChart(plot) {
    var W = 640, H = 200, padT = 12, padB = 6, days = 90;
    var seed = +plot.getAttribute('data-seed') || 7;
    var cs = +plot.getAttribute('data-clk-start') || 1, ce = +plot.getAttribute('data-clk-end') || 16;
    var is = +plot.getAttribute('data-imp-start') || 220, ie = +plot.getAttribute('data-imp-end') || 2400;
    var clk = genSeries(days, cs, ce, 0.34, seed);
    var imp = genSeries(days, is, ie, 0.30, seed + 99);
    var pc = pathFor(clk, W, H, padT, padB), pi = pathFor(imp, W, H, padT, padB);

    var grid = '';
    for (var g = 1; g <= 3; g++) { var y = (H / 4) * g; grid += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="var(--ev-grid)" stroke-width="1"/>'; }

    var uid = 'ch' + seed;
    var svg =
      '<svg class="gsc2-plot" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="90-day performance, trending up">' +
      '<defs>' +
      '<linearGradient id="' + uid + 'i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ev-imp)" stop-opacity=".28"/><stop offset="1" stop-color="var(--ev-imp)" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + uid + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ev-clk)" stop-opacity=".34"/><stop offset="1" stop-color="var(--ev-clk)" stop-opacity="0"/></linearGradient>' +
      '</defs>' +
      grid +
      '<path d="' + pi.area + '" fill="url(#' + uid + 'i)"/>' +
      '<path d="' + pc.area + '" fill="url(#' + uid + 'c)"/>' +
      '<path d="' + pi.line + '" fill="none" stroke="var(--ev-imp)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
      '<path d="' + pc.line + '" fill="none" stroke="var(--ev-clk)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
      '</svg>';
    plot.innerHTML = svg;

    // x-axis date ticks (90-day window ending at a fixed recent date)
    var ax = plot.parentNode.querySelector('.gsc2-xaxis');
    if (ax) {
      var end = new Date(2026, 5, 8), labels = [];
      [0, 18, 36, 54, 72, 89].forEach(function (d) {
        var dt = new Date(end.getTime() - (days - 1 - d) * 86400000);
        labels.push('<span>' + MON[dt.getMonth()] + ' ' + dt.getDate() + '</span>');
      });
      ax.innerHTML = labels.join('');
    }
  }

  function buildSpark(host) {
    var seed = +host.getAttribute('data-spark') || 3;
    var vals = genSeries(20, 2, 14, 0.28, seed);
    var p = pathFor(vals, 76, 28, 3, 3);
    host.innerHTML =
      '<svg viewBox="0 0 76 28" preserveAspectRatio="none" style="width:76px;height:28px;display:block">' +
      '<path d="' + p.area + '" fill="rgba(255,42,56,.18)"/>' +
      '<path d="' + p.line + '" fill="none" stroke="var(--sg-red-hot)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  // generic snap-carousel: wrapper holds .{name}-track + [data-caro-prev/next/dots]
  function initCarousel(wrap) {
    var track = wrap.querySelector('[data-caro-track]');
    if (!track) return;
    var prev = wrap.querySelector('[data-caro-prev]');
    var next = wrap.querySelector('[data-caro-next]');
    var dotsBox = wrap.querySelector('[data-caro-dots]');
    var page = function () { return Math.max(1, Math.round(track.clientWidth)); };
    var pages = function () { return Math.max(1, Math.ceil((track.scrollWidth - 4) / page())); };
    var cur = function () { return Math.round(track.scrollLeft / page()); };

    if (dotsBox) {
      dotsBox.innerHTML = '';
      for (var i = 0; i < pages(); i++) {
        var b = document.createElement('button'); b.type = 'button';
        b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        (function (idx) { b.addEventListener('click', function () { track.scrollTo({ left: idx * page(), behavior: 'smooth' }); }); })(i);
        dotsBox.appendChild(b);
      }
    }
    var sync = function () {
      if (!dotsBox) return;
      var c = cur(), kids = dotsBox.children;
      for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('is-on', i === c);
    };
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -page(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: page(), behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  function init() {
    document.querySelectorAll('[data-chart]').forEach(buildChart);
    document.querySelectorAll('[data-spark]').forEach(buildSpark);
    document.querySelectorAll('[data-caro]').forEach(initCarousel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
