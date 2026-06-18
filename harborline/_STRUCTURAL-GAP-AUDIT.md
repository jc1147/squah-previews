# Harborline — Structural Gap Audit (grep/parse only, no rendering)

Date: 2026-06-17. Method: full Read of all 5 pages + both CSS files + reference structural.css, plus exact grep counts. CSS rule that gates content: `structural.css` L522–525 — `.wow-reveal{opacity:0}` and `.wow-stagger>*{opacity:0}`, made visible ONLY by `.in-view`, which is added ONLY by the IntersectionObserver JS.

## 1. JS / behavior per page + count of opacity-gated (invisible-without-JS) elements

| Page | `<script>` | IntersectionObserver | in-view toggler | count-up | parallax | wow-reveal | wow-stagger | GATED & INVISIBLE? |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| index.html | 1 | yes (5 refs) | yes | yes | yes (4 els) | 23 | 8 | NO — JS inline, works |
| design-system.html | 1 | yes (7 refs) | yes | yes | yes (2 els) | 3 | 4 | NO — JS inline, works |
| about.html | **0** | **NO** | **NO** | **NO** | n/a (0) | 17 | 3 | **YES — all 20 reveal/stagger els stuck opacity:0** |
| services.html | **0** | **NO** | **NO** | **NO** | n/a (0) | 11 | 4 | **YES — all 15 reveal/stagger els stuck opacity:0** |
| brand-card.html | 0 | n/a | n/a | n/a | n/a | 0 | 0 | NO — uses zero wow-* motion classes; fully visible |

Root cause CONFIRMED: the reveal/count-up/parallax IntersectionObserver JS exists ONLY as an inline `<script>` in index.html (L602–694) and design-system.html (L344–414). It is NOT a shared linked `.js` file. about.html and services.html link only `tokens.css` + `structural.css` and ship NO `<script>` — so `.in-view` is never added and every `.wow-reveal` / `.wow-stagger` element stays `opacity:0` permanently in a real browser.
- about.html invisible elements: 17 wow-reveal + 3 wow-stagger containers (manifesto text, founder bio media+body, all 3 accolade `<li>`, all 3 proof stats, both work rows, both testimonials, hero eyebrow/h1/lede/cta, closing-cta h2/cta = essentially ALL body content).
- services.html invisible elements: 11 wow-reveal + 4 wow-stagger containers (hero block, all 3 service cards, all 3 process steps, all 3 proof stats, FAQ list, cta-form pitch = essentially ALL body content).
- count-up also dead: about has 3 `data-count` stats, services has 3 — without JS they render the literal placeholder text `0+`, `0★`, `0` instead of 40000+, 4.9★, 60, 2025. (Even if revealed, the numbers would read as zeros.)

brand-card.html is fine for a different reason: it is a self-contained identity sheet with its own inline `<style>`, uses zero wow-* motion classes, and links only tokens.css (no structural.css, no JS needed).

## 2. Chrome consistency — NOT identical across pages (a real, separate defect)

The header and footer markup is structurally DIFFERENT between the homepage and the inner pages — they do not share chrome:

- index.html header = `<header class="nav wow-glass">` with a bespoke `.nav__bar / .nav__brand / .nav__links / .nav__hamburger` structure + a mobile drawer, ALL styled by index.html's own inline `<style>` (L44–68). Footer = `<footer class="footer">` with bespoke `.footer__top / .footer__col / .footer__hours / .footer__bottom` 4-column structure, also inline-styled.
- about.html / services.html header = `<header class="site-header wow-glass">` with `.brand / .site-nav` (the shared chrome in structural.css L88–94). Footer = `<footer class="site-footer">` with `.site-footer__cols` 3-column structure (structural.css L97–101).

So: NOT byte-identical, NOT structurally identical. index.html uses one chrome system (inline, with hamburger + drawer + hours block + B-Corp bottom bar); inner pages use a second, simpler chrome system (shared classes, no hamburger, no drawer, 3-col footer, no hours). They also differ in nav link targets and labels. This is a consistency gap independent of the JS bug — fixing the JS will NOT make the chrome match.

### about.html "footer-like content high in the hero" anomaly — DIAGNOSED
- The footer is NOT duplicated and NOT misplaced. It appears EXACTLY ONCE, at the bottom of source (about.html L174–178), structurally correct.
- What the orchestrator saw is a pure CONSEQUENCE of the missing JS, not a markup defect: on about.html, the `.site-footer` is the ONLY text block on the whole page with NO wow-* gating (footer has no reveal class), so it stays fully opaque. Every section above it (hero, manifesto, founder bio, accolades, proof, work, testimonials, closing CTA) is entirely `opacity:0`. With all that content invisible/collapsed, the footer's "Shop / Visit / hello@harborline.co" links become the first readable text on the page and float up near the top of the viewport. Offending behavior is the missing JS, not the footer markup. Quoting the only-opaque block (about.html L174–178):
  ```html
  <footer class="site-footer"><div class="container site-footer__cols">
    <div><strong>Harborline Provisions</strong><p>Coastal specialty foods...</p></div>
    <div><strong>Shop</strong><a href="index.html#pantry">The Pantry</a>...</div>
    <div><strong>Visit</strong><a href="services.html#cafe">Dockside Café</a>...<a href="mailto:hello@harborline.co">hello@harborline.co</a></div>
  </div></footer>
  ```
- Same mechanism applies to services.html (its `.cta-form` pitch h2 is gated but the form fields + footer are not, so the form + footer are the only visible blocks).

## 3. Content completeness — CONTENT IS PRESENT (the HTML is fine, it's just hidden)

about.html sections (all have real content, no empty rows):
1. Hero — eyebrow, h1 "A pantry that starts at the tideline", lede, CTA. Real.
2. Manifesto — full paragraph. Real.
3. Founder bio — photo + "Maren Voss" bio paragraph. Real.
4. Accolades (inclusion-band) — 3 real `<li>`: Good Food Award 2025, B-Corp 2024, Coastal Made Member. (R-ACCO-01/02/03)
5. Proof (stat-strip) — 3 stats: 40000+, 4.9★, 60. (R-PROOF-01/02/03)
6. Work (capability-showcase) — 2 rows: Maritime Museum gift-shop line, Harbor Festival 2025, each with image + copy. (R-WORK-01/02)
7. Social (customer-proof) — 2 testimonial cards (Dana M., Priya R.). (R-SOC-01/02)
8. Closing CTA — h2 + button. Real.
- R-* markers: **10 present** (R-ACCO-01/02/03, R-PROOF-01/02/03, R-WORK-01/02, R-SOC-01/02) — matches the expected 10. ✓

services.html sections (all have real content, no empty rows):
1. Hero — eyebrow, h1 "Pick your harbor habit", lede, CTA. Real.
2. Services (capability-breakdown) — 3 cards: Provisioning Boxes, Dockside Café, Corporate Gifting, each image+copy. (R-SVC-01/02/03)
3. Process — 3 steps: choose cadence / curate / shipped. Real.
4. Proof (data-proof) — 3 stats: 40000+ boxes, 60 grocers, 2025 Good Food Award. (R-PROOF-01, R-PROOF-03, R-ACCO-01)
5. FAQ — 3 `<details>` items with real Q&A. Real.
6. CTA form — pitch + name/email/message form. Real.
- R-* markers: **6 present** (R-SVC-01/02/03, R-PROOF-01, R-PROOF-03, R-ACCO-01) — matches the expected 6. ✓

Conclusion: content-prep is COMPLETE on both inner pages. No empty/unfilled section. The pages render ~blank in a browser solely because the content is opacity-gated by CSS with no JS to un-gate it.

## 4. Other invisible-content causes besides the missing JS — NONE found
- `display:none` in the gated pages: about=0, services=0. (index.html has 3, all legitimate: `.nav__links`/`.nav__hamburger`/`.sticky-cta` responsive toggles + `.cap-switch__panel` library default — none affect inner-page content.)
- No broken/empty `<img>` slots — every `<img>` on the inner pages has a real Unsplash `src` + alt.
- No unfilled template slots / placeholder tokens.
- FAQ on services.html uses native `<details>` (closed by default) — answers are collapsed but that is correct accessible behavior, not a bug; summaries are visible (once un-gated).
- The `wow-grain`/`wow-bloom` ::after/::before overlays are `pointer-events:none` decorative and do not hide content.
- No `.section--dark` invisible-text (dark-on-dark) regression: structural.css L473–476 re-lights `.section--dark .stat__num/.stat__label` etc. correctly.

## DEFINITIVE FIX LIST (what must change for the pages to be complete, not just un-blanked)
1. PRIMARY: give about.html and services.html the reveal/count-up/parallax JS. The clean fix is to extract the canonical inline `<script>` (currently duplicated in index.html L602–694 and design-system.html L344–414) into a shared linked file (e.g. `design-system/site.js`) and `<script src>` it from all pages, OR at minimum add the `<script>` block to about.html and services.html. Without this, 20 (about) + 15 (services) elements stay opacity:0 and 6 count-up stats render as zeros.
2. SECONDARY (chrome consistency, independent of JS): index.html uses a bespoke inline `.nav`/`.footer` chrome (with hamburger + mobile drawer + hours + B-Corp bottom bar); about/services use the shared `.site-header`/`.site-footer` chrome (no hamburger/drawer, 3-col footer, no hours). The two chrome systems are not structurally identical. To make chrome consistent site-wide, unify on ONE header+footer system across all pages (note: the inner pages currently have NO mobile hamburger/drawer at all).
3. Nav link/label drift between pages (index uses on-page `#pantry/#boxes/#cafe/#story` anchors and a "Shop all 40 goods" CTA; inner pages cross-link to `index.html#pantry`, `services.html`, `services.html#cafe`, `about.html`) — reconcile if a single nav is adopted.
