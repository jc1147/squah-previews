/* ============================================================================
   SGEN LP — LOGO WALL  (S2 social-proof band)
   Replaces the thin text marquee with a dense 3-row auto-scrolling wall of ~80
   fictional LOCAL-BUSINESS logos across ~25 industries. Each logo is built from
   one of 4 rotating templates (glyph+name · monogram badge · wordmark · stacked
   + tagline), rotating the loaded display fonts + a muted brand hue so no two
   read alike. Rows alternate scroll direction; reduced-motion → static grid.
   Dependency-free. Tokens / loaded fonts only. Init on DOMContentLoaded.
   ============================================================================ */
(function () {
  'use strict';

  /* ---- loaded display faces (registered in _assemble.mjs Google Fonts link) ---- */
  var FONTS = [
    "'Inter', system-ui, sans-serif",                  // humanist sans (base)
    "'Roboto Slab', Georgia, serif",                   // slab serif
    "'Source Serif 4', 'Times New Roman', serif",      // elegant serif
    "'Fraunces', Georgia, serif",                      // characterful display serif
    "'Poppins', system-ui, sans-serif",                // rounded/geometric sans
    "'JetBrains Mono', ui-monospace, monospace"        // mono (occasional EST. lines)
  ];

  /* ---- muted brand hues (desaturated on the dark glass; color returns on hover) ---- */
  var HUES = [
    '#7fa8d6', '#8fbf9f', '#d6a96b', '#c98b8b', '#b59fd6', '#6fc0c0',
    '#d2b06a', '#9db86f', '#cf8fb4', '#7ab0a0', '#c79a7a', '#8aa0c8',
    '#bfae7c', '#a9c084', '#d68fa0', '#86b8c4'
  ];

  /* ---- compact line-icon glyphs (24×24 viewBox), one per industry family ---- */
  var GLYPHS = {
    wrench:  '<path d="M21 4a4 4 0 0 1-5.5 5.5L6 19l-2-2 9.5-9.5A4 4 0 0 1 19 2l-2.5 2.5 2 2L21 4Z"/>',
    drop:    '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
    flame:   '<path d="M12 3c2 3 1 4 0 5s-3 2-3 5a4 4 0 0 0 8 0c0-2-1-3-1-4 1 1 2 2 2 4a6 6 0 0 1-12 0c0-5 5-7 6-10Z"/>',
    roof:    '<path d="M3 11 12 4l9 7"/><path d="M5 10v9h14v-9"/>',
    bolt:    '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    leaf:    '<path d="M4 20c0-9 7-15 16-15 0 9-6 16-15 16"/><path d="M4 20S8 14 13 11"/>',
    truck:   '<path d="M2 7h11v8H2z"/><path d="M13 10h4l3 3v2h-7"/><circle cx="6" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/>',
    broom:   '<path d="M19 4 9 14"/><path d="M9 14l-4 6 6-4"/><path d="M5 20l-2-2"/>',
    bug:     '<rect x="8" y="8" width="8" height="10" rx="4"/><path d="M12 8V5M6 9 4 7M18 9l2-2M6 13H3M21 13h-3M6 17l-2 2M18 17l2 2"/>',
    tooth:   '<path d="M12 4c-3-2-6 0-6 4 0 5 1 11 3 11s1-5 3-5 1 5 3 5 3-6 3-11c0-4-3-6-6-4Z"/>',
    spa:     '<path d="M12 13c0-4 3-6 3-6s-1 4-3 6Zm0 0c0-4-3-6-3-6s1 4 3 6Z"/><path d="M12 13c4 0 7-2 7-2s-3 4-7 4-7-4-7-4 3 2 7 2Z"/>',
    spine:   '<path d="M12 3v18"/><path d="M9 6h6M8 10h8M8 14h8M9 18h6"/>',
    eye:     '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    scale:   '<path d="M12 3v18M6 21h12"/><path d="M12 6 4 9l3 5a3 3 0 0 1-6 0Z"/><path d="M12 6l8 3-3 5a3 3 0 0 0 6 0Z"/>',
    calc:    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M11 12h2M14 12h2M8 16h2M11 16h2"/>',
    house:   '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    car:     '<path d="M3 13l2-5h14l2 5"/><path d="M3 13h18v4H3z"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
    dumbbell:'<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
    lotus:   '<path d="M12 21c5 0 9-3 9-3s-1-5-4-6c0 0 1-4-5-7-6 3-5 7-5 7-3 1-4 6-4 6s4 3 9 3Z"/>',
    scissors:'<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 11M8 16 20 5"/>',
    coffee:  '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 9h2a2 2 0 0 1 0 5h-2"/><path d="M8 3v2M11 3v2"/>',
    flower:  '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C12 6 14 5 14 5s0 4-2 4.5ZM14.5 12c3.5 0 4.5-2 4.5-2s-4 0-4.5 2ZM12 14.5c0 3.5 2 4.5 2 4.5s0-4-2-4.5ZM9.5 12C6 12 5 10 5 10s4 0 4.5 2Z"/>',
    paw:     '<circle cx="7" cy="9" r="1.6"/><circle cx="12" cy="7" r="1.6"/><circle cx="17" cy="9" r="1.6"/><path d="M12 11c3 0 5 2 5 4a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3c0-2 2-4 5-4Z"/>',
    block:   '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    key:     '<circle cx="7" cy="15" r="4"/><path d="M10 12 20 2l2 2-2 2 2 2-2 2-2-2-3 3"/>',
    camera:  '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 7l1.5-2h5L16 7"/>'
  };

  /* ---- 80 fictional local businesses across ~25 industries ----
     [ name, glyph-key, primary-word (for monogram/wordmark accent), tagline ] */
  var BIZ = [
    // Plumbing
    ['Brightwater Plumbing', 'drop', 'Plumbing', 'EST. 2009'],
    ['Copper Line Plumbing', 'wrench', 'Plumbing', 'LICENSED & BONDED'],
    ['True North Drain Co', 'drop', 'Drain Co', 'FAMILY OWNED'],
    // HVAC
    ['Ironside HVAC', 'flame', 'HVAC', 'HEATING & COOLING'],
    ['Summit Air & Heat', 'flame', 'Air', 'EST. 2012'],
    ['Polar Peak HVAC', 'flame', 'HVAC', '24/7 SERVICE'],
    // Roofing
    ['Maplewood Roofing', 'roof', 'Roofing', 'EST. 1998'],
    ['Cedar Ridge Roofing', 'roof', 'Roofing', 'STORM CERTIFIED'],
    ['Apex Crown Roofing', 'roof', 'Roofing', 'FAMILY OWNED'],
    // Electrical
    ['Oakfield Electric', 'bolt', 'Electric', 'LICENSED ELECTRICIAN'],
    ['Voltline Electric', 'bolt', 'Electric', 'EST. 2007'],
    ['Beacon Hill Electric', 'bolt', 'Electric', 'RESIDENTIAL · COMMERCIAL'],
    // Landscaping
    ['Cedar & Pine Landscaping', 'leaf', 'Landscaping', 'EST. 2010'],
    ['Greenfield Lawn & Land', 'leaf', 'Lawn', 'DESIGN · BUILD'],
    ['Stonerow Landscapes', 'leaf', 'Landscapes', 'FAMILY OWNED'],
    // Junk removal / hauling
    ['Clearhaul Junk Removal', 'truck', 'Junk Removal', 'SAME-DAY HAUL'],
    ['EasyCart Hauling', 'truck', 'Hauling', 'EST. 2015'],
    // Cleaning
    ['Tideline Cleaning Co', 'broom', 'Cleaning Co', 'EST. 2013'],
    ['Sparrow Maids', 'broom', 'Maids', 'BONDED & INSURED'],
    ['Crystal Coast Cleaning', 'broom', 'Cleaning', 'FAMILY OWNED'],
    // Pest control
    ['Copper Canyon Pest', 'bug', 'Pest', 'PEST CONTROL'],
    ['Redbridge Pest Control', 'bug', 'Pest Control', 'EST. 2011'],
    // Dental
    ['Summit Family Dental', 'tooth', 'Dental', 'NEW PATIENTS WELCOME'],
    ['Northgate Dental', 'tooth', 'Dental', 'EST. 2006'],
    ['Lakeside Smile Studio', 'tooth', 'Smile', 'FAMILY DENTISTRY'],
    ['Willow Creek Dental', 'tooth', 'Dental', 'GENTLE CARE'],
    // Med spa
    ['Riverside Med Spa', 'spa', 'Med Spa', 'EST. 2018'],
    ['Lumiere Aesthetics', 'spa', 'Aesthetics', 'MEDICAL SPA'],
    ['Glow & Co Med Spa', 'spa', 'Med Spa', 'BY APPOINTMENT'],
    // Chiropractic
    ['Align Spine & Wellness', 'spine', 'Spine', 'CHIROPRACTIC'],
    ['Cornerstone Chiropractic', 'spine', 'Chiropractic', 'EST. 2008'],
    // Optometry
    ['Clearview Optometry', 'eye', 'Optometry', 'EYE CARE'],
    ['Bright Eyes Vision', 'eye', 'Vision', 'EST. 2014'],
    // Law
    ['Harbor Point Law', 'scale', 'Law', 'ATTORNEYS AT LAW'],
    ['Hawthorne & Reed', 'scale', 'Reed', 'EST. 1994'],
    ['Stonegate Legal Group', 'scale', 'Legal', 'TRIAL ATTORNEYS'],
    // Accounting
    ['Meridian Accounting', 'calc', 'Accounting', 'CPA FIRM'],
    ['Ledger & Vine CPAs', 'calc', 'CPAs', 'EST. 2009'],
    ['Fairview Tax & Books', 'calc', 'Tax', 'BOOKKEEPING'],
    // Real estate
    ['Stonebridge Realty', 'house', 'Realty', 'EST. 2003'],
    ['Harborview Properties', 'house', 'Properties', 'BUY · SELL · RENT'],
    ['Magnolia Lane Realty', 'house', 'Realty', 'FAMILY OWNED'],
    // Auto repair / detailing
    ['Coastal Auto Spa', 'car', 'Auto Spa', 'DETAILING'],
    ['Gearworks Auto Repair', 'car', 'Auto Repair', 'EST. 2005'],
    ['Redline Detailing', 'car', 'Detailing', 'CERAMIC COATING'],
    ['Anchor Tire & Auto', 'car', 'Tire', 'EST. 2000'],
    // Fitness gym
    ['Granite Peak Fitness', 'dumbbell', 'Fitness', 'EST. 2016'],
    ['Ironclad Strength Co', 'dumbbell', 'Strength', 'TRAIN HARD'],
    ['Summit Athletic Club', 'dumbbell', 'Athletic', 'MEMBERS ONLY'],
    // Yoga
    ['Stillwater Yoga', 'lotus', 'Yoga', 'EST. 2013'],
    ['Lotus Lane Studio', 'lotus', 'Studio', 'YOGA · PILATES'],
    // Salon / barber
    ['The Copper Chair', 'scissors', 'Copper Chair', 'BARBER CO'],
    ['Velvet & Vine Salon', 'scissors', 'Salon', 'EST. 2017'],
    ['Northside Barber Co', 'scissors', 'Barber Co', 'WALK-INS WELCOME'],
    ['Bloom Hair Studio', 'scissors', 'Hair Studio', 'EST. 2011'],
    // Cafe / bakery
    ['Honeybee Bakery', 'coffee', 'Bakery', 'EST. 2010'],
    ['Maple & Crumb', 'coffee', 'Crumb', 'BAKE SHOP'],
    ['Driftwood Coffee Co', 'coffee', 'Coffee Co', 'ROASTERS'],
    ['Sunrise Cafe & Bake', 'coffee', 'Cafe', 'FAMILY OWNED'],
    // Florist
    ['Wildflower & Co', 'flower', 'Wildflower', 'FLORAL DESIGN'],
    ['Petal & Stem Florist', 'flower', 'Florist', 'EST. 2014'],
    ['Rosewood Blooms', 'flower', 'Blooms', 'FRESH DAILY'],
    // Pet grooming / vet
    ['Willowbrook Vet', 'paw', 'Vet', 'ANIMAL HOSPITAL'],
    ['Pawsitive Grooming', 'paw', 'Grooming', 'EST. 2015'],
    ['Cedar Paws Pet Spa', 'paw', 'Pet Spa', 'FULL-SERVICE'],
    // Daycare
    ['Little Acorns Daycare', 'block', 'Daycare', 'EST. 2009'],
    ['Bright Beginnings', 'block', 'Beginnings', 'LEARNING CENTER'],
    // Moving
    ['Anchor Point Movers', 'truck', 'Movers', 'EST. 2008'],
    ['Hometown Moving Co', 'truck', 'Moving Co', 'LOCAL · LONG-DISTANCE'],
    // Locksmith
    ['Keystone Locksmith', 'key', 'Locksmith', '24/7 SERVICE'],
    ['Redbolt Lock & Key', 'key', 'Lock & Key', 'EST. 2012'],
    // Painting
    ['Brushstroke Painters', 'house', 'Painters', 'INTERIOR · EXTERIOR'],
    ['Heritage House Painting', 'house', 'Painting', 'EST. 2004'],
    // Photography
    ['Goldenhour Studio', 'camera', 'Studio', 'PHOTOGRAPHY'],
    ['Northlight Photo Co', 'camera', 'Photo Co', 'EST. 2016'],
    // Garage doors / fencing (extra trades to round to ~80)
    ['Overhead Door Pros', 'roof', 'Door Pros', 'GARAGE DOORS'],
    ['Cedarline Fencing', 'leaf', 'Fencing', 'EST. 2013'],
    ['Stonewall Masonry', 'block', 'Masonry', 'BRICK · STONE'],
    ['Clearpane Window Co', 'house', 'Window Co', 'INSTALL · REPAIR'],
    ['Sterling Pool & Spa', 'drop', 'Pool & Spa', 'EST. 2010']
  ];

  /* ---- monogram: 1–2 initials from the name (skip leading "The") ---- */
  function initials(name) {
    var words = name.replace(/^The\s+/i, '').split(/\s+/).filter(function (w) {
      return !/^(&|and|co|llc|the|of)$/i.test(w);
    });
    var a = words[0] ? words[0][0] : name[0];
    var b = words[1] ? words[1][0] : '';
    return (a + b).toUpperCase();
  }

  function svgGlyph(key, hue) {
    var inner = GLYPHS[key] || GLYPHS.block;
    return '<svg class="lw-glyph" viewBox="0 0 24 24" fill="none" stroke="' + hue +
      '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner + '</svg>';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- logo(biz, i): one of 4 rotating TEMPLATES, rotating font + hue ---- */
  function logo(biz, i) {
    var name = biz[0], gkey = biz[1], tag = biz[3];
    var hue  = HUES[i % HUES.length];
    var font = FONTS[(i + Math.floor(i / 4)) % FONTS.length];   // de-sync font from template
    var tpl  = i % 4;                                            // A,B,C,D rotation
    var nm   = esc(name);
    var fs   = 'style="--lw-hue:' + hue + ';font-family:' + font + '"';
    var body;

    if (tpl === 0) {
      /* A · industry GLYPH + name */
      body =
        '<span class="lw-mark lw-mark--glyph">' + svgGlyph(gkey, hue) + '</span>' +
        '<span class="lw-name">' + nm + '</span>';
    } else if (tpl === 1) {
      /* B · MONOGRAM badge + name */
      var mono = i % 8 < 4 ? 'lw-badge--round' : 'lw-badge--square';
      body =
        '<span class="lw-badge ' + mono + '"><span>' + esc(initials(name)) + '</span></span>' +
        '<span class="lw-name lw-name--stack">' + nm + '</span>';
    } else if (tpl === 2) {
      /* C · WORDMARK only, with a styled accent dot / underline */
      var accent = i % 2 ? '<span class="lw-dot">.</span>' : '';
      body =
        '<span class="lw-name lw-name--wm">' + nm + accent + '</span>';
    } else {
      /* D · STACKED name + tiny tagline */
      body =
        '<span class="lw-stack">' +
          '<span class="lw-name lw-name--lg">' + nm + '</span>' +
          '<span class="lw-tag">' + esc(tag) + '</span>' +
        '</span>';
    }

    return '<div class="lw-tile lw-tpl-' + 'ABCD'[tpl] + '" ' + fs + '>' + body + '</div>';
  }

  /* ---- build a row track (logos + duplicate set for the seamless 0→-50% loop) ---- */
  function buildTrack(items, rowIndex) {
    var half = items.map(function (b, k) { return logo(b, rowIndex * 100 + k); }).join('');
    var track = document.createElement('div');
    track.className = 'lw-track';
    // first set is real; aria-hidden duplicate completes the loop
    track.innerHTML = half + half.replace(/<div class="lw-tile/g, '<div aria-hidden="true" class="lw-tile');
    return track;
  }

  function build() {
    var mount = document.getElementById('logowall');
    if (!mount || mount.dataset.built) return;
    mount.dataset.built = '1';

    // distribute the ~80 across 3 rows (~27 each), interleaved so each row mixes industries
    var rows = [[], [], []];
    for (var i = 0; i < BIZ.length; i++) rows[i % 3].push(BIZ[i]);

    rows.forEach(function (items, r) {
      var row = document.createElement('div');
      row.className = 'lw-row lw-row--' + (r % 2 === 0 ? 'l' : 'r');  // alt direction
      row.appendChild(buildTrack(items, r));
      mount.appendChild(row);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
