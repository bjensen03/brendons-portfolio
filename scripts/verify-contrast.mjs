/*
  Contrast audit.

  Walks every text element on every page and fails if any of it sits below WCAG
  AA against what is actually painted behind it.

  Colours are resolved by compositing onto a canvas rather than by parsing the
  string. Parsing is the obvious approach and it is wrong: Tailwind emits
  oklab() for opacity modifiers, and reading its first three components as
  0-255 RGB reports a white header as near-black — which is a false failure
  that sends you looking for a bug in the page instead of the test.

    npm run dev
    node scripts/verify-contrast.mjs            every page, then the brightness sweep
    node scripts/verify-contrast.mjs --lum      the brightness sweep only

  Brightness sweep: the whole palette is derived from --lum on <html> (see
  global.css), so the homepage is re-measured with --lum set directly at each
  position in LUM_POSITIONS. Every position has to pass, including the ones
  either side of the dark/light flip at 0.5. The pages above run at the
  default (a fresh browser has nothing saved, so 0.12).
*/

import { chromium } from 'playwright-core';

const BASE = process.env.VERIFY_URL ?? 'http://localhost:4321';
const PAGES = [
  '/',
  '/work/',
  /* The Twilight Trekkers. Its hero name sits over a photograph behind a
     scrim, which this audit can't see — it measures painted background
     colours, not image pixels — so treat the hero there as unmeasured. */
  '/twilight-trekkers/',
  '/about/',
  '/contact/',
  '/work/rally-trailer/',
  /* Ships without screenshots or figures on purpose, so it is almost entirely
     text on two surfaces — exactly the kind of page this audit is for. */
  '/work/prolook/',
  /* The case-study layout. These case-study pages build in production too.
     The hard problem puts accent text on the raised surface, a pairing no
     other page uses. */
  '/work/all-in/',
  '/work/legends/',
  /* One concept page — the UI/UX set shares a template, so checking one
     covers the type scale and the badge treatment all six use. */
  '/work/ux-feit-electric/',
];

/* 0 and 1 are the ends, 0.12 the default, 0.47 / 0.5 / 0.53 straddle the
   flip, the rest sit inside each range. */
const LUM_POSITIONS = process.env.VERIFY_LUM
  ? process.env.VERIFY_LUM.split(',').map(Number)
  : [0, 0.12, 0.3, 0.47, 0.5, 0.53, 0.7, 1];
const LUM_ONLY = process.argv.includes('--lum');
/* The page the sweep runs on. The homepage by default; set VERIFY_LUM_PATH
   to sweep another, e.g. a case study:
     VERIFY_LUM_PATH=/work/rally-trailer/ node scripts/verify-contrast.mjs --lum */
const LUM_PATH = process.env.VERIFY_LUM_PATH ?? '/';

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
let bad = 0;

const measure = () =>
  p.evaluate(() => {
    /*
      Colours are resolved by painting them onto a canvas over white and
      reading the pixel back. Parsing the string is the obvious approach and it
      is wrong: Tailwind emits oklab() for opacity modifiers, and treating its
      first three components as 0-255 RGB reads a white header as near-black.
      Compositing also handles alpha for free.
    */
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d', { willReadFrequently: true });

    const resolve = (color, under = '#ffffff') => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = under;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, bl] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, bl];
    };

    const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const lum = ([r, g, bl]) =>
      0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(bl / 255);

    /* Composite every background from the page down to the element, so a
       translucent layer is measured as what the eye actually receives. */
    const bgOf = (el) => {
      const stack = [];
      let n = el;
      while (n) { stack.push(getComputedStyle(n).backgroundColor); n = n.parentElement; }
      let base = '#ffffff';
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        const c = stack[i];
        if (!c || c === 'transparent' || c.includes('rgba(0, 0, 0, 0)')) continue;
        const [r, g, bl] = resolve(c, base);
        base = `rgb(${r}, ${g}, ${bl})`;
      }
      return base;
    };

    const out = [];
    let min = { ratio: Infinity, t: '', margin: Infinity };
    document
      .querySelectorAll('p,h1,h2,h3,h4,a,span,li,dt,dd,label,button,figcaption,mark,strong')
      .forEach((el) => {
        const txt = el.textContent.trim();
        if (!txt || el.children.length) return;
        /* The hero's scrolling code texture is decoration (aria-hidden, no
           information) and deliberately faint, which WCAG 1.4.3 exempts. It
           is skipped by name, not by aria-hidden, because plenty of
           aria-hidden text on this site is visible and does need to pass. */
        if (el.closest('[data-code-field], [data-contrast-exempt]')) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;

        const bg = bgOf(el);
        const fgL = lum(resolve(cs.color, bg));
        const bgL = lum(resolve(bg));
        const [hi, lo] = fgL > bgL ? [fgL, bgL] : [bgL, fgL];
        const ratio = (hi + 0.05) / (lo + 0.05);

        const px = parseFloat(cs.fontSize);
        const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
        const bar = large ? 3 : 4.5;
        if (ratio / bar < min.margin) min = { ratio: +ratio.toFixed(2), t: txt.slice(0, 28), margin: ratio / bar };
        if (ratio < bar) {
          out.push({ t: txt.slice(0, 36), ratio: +ratio.toFixed(2), px: Math.round(px), bar, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40) });
        }
      });
    /* Highlight underlines (study.css .hl) are a non-text mark in the accent:
       3:1 against whatever the phrase sits on. The stroke colour is the
       mark's --hl-ink, read through a probe so the token is resolved. */
    document.querySelectorAll('mark.hl').forEach((m) => {
      if (!m.getClientRects().length) return;
      const probe = document.createElement('span');
      probe.style.color = 'var(--hl-ink)';
      m.append(probe);
      const ink = getComputedStyle(probe).color;
      probe.remove();
      const bg = bgOf(m);
      const a = lum(resolve(ink, bg));
      const c = lum(resolve(bg));
      const ratio = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
      const t = `underline: ${m.textContent.trim().slice(0, 22)}`;
      if (ratio / 3 < min.margin) min = { ratio: +ratio.toFixed(2), t, margin: ratio / 3 };
      if (ratio < 3) out.push({ t, ratio: +ratio.toFixed(2), px: 0, bar: 3, cls: 'hl stroke' });
    });

    window.__contrastMin = min;
    return out;
  });


for (const path of LUM_ONLY ? [] : PAGES) {
  const response = await p.goto(BASE + path, { waitUntil: 'networkidle' });
  /* A renamed route used to pass silently here: the 404 page has no contrast
     failures, so a page that had stopped existing reported clean. Fail loudly
     instead — this list is only trustworthy if every entry in it is real. */
  if (!response || response.status() >= 400) {
    bad += 1;
    console.log(`  FAIL  ${path} — HTTP ${response ? response.status() : 'no response'}`);
    continue;
  }
  await p.waitForTimeout(800);

  const fails = await measure();

  console.log(`${path.padEnd(26)} ${fails.length === 0 ? 'all text passes AA' : fails.length + ' below AA'}`);
  fails.slice(0, Number(process.env.VERIFY_SHOW ?? 5)).forEach((f) => console.log(`     ${f.ratio} (needs ${f.bar}) ${f.px}px — "${f.t}"  [${f.cls}]`));
  bad += fails.length;
}

/* Brightness sweep on the homepage. Transitions are switched off
   (.lum-instant) so each measurement is the settled value, not a frame of
   the crossfade. The lowest ratio found is printed per position so the
   margin is visible, not just pass/fail. */
console.log(`\nBrightness sweep — ${LUM_PATH}`);
await p.goto(BASE + LUM_PATH, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
for (const lum of LUM_POSITIONS) {
  await p.evaluate((v) => {
    const root = document.documentElement;
    root.classList.add('lum-instant');
    /* Show every reveal-hidden element so all of the page is measured. */
    root.classList.remove('motion-ok');
    root.style.setProperty('--lum', String(v));
    root.dataset.scheme = v >= 0.5 ? 'light' : 'dark';
  }, lum);
  await p.waitForTimeout(150);
  const fails = await measure();
  const min = await p.evaluate(() => window.__contrastMin);
  console.log(
    `  lum ${String(lum).padEnd(5)} ${fails.length === 0 ? 'all text passes AA' : fails.length + ' below AA'}  (lowest ${min.ratio} on "${min.t}")`,
  );
  fails.slice(0, Number(process.env.VERIFY_SHOW ?? 5)).forEach((f) => console.log(`     ${f.ratio} (needs ${f.bar}) ${f.px}px — "${f.t}"  [${f.cls}]`));
  bad += fails.length;

  /* The focus ring is non-text UI: 3:1 against every surface it can sit
     on, in the page scope and in a band. */
  const rings = await p.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const px = (c) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      return ctx.getImageData(0, 0, 1, 1).data;
    };
    const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = (c) => {
      const [r, g, bl] = px(c);
      return 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(bl / 255);
    };
    const cr = (a, b) => {
      const [x, y] = [L(a), L(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const out = [];
    for (const el of [document.body, document.querySelector('[data-tone="dark"]')]) {
      if (!el) continue;
      const cs = getComputedStyle(el);
      const focus = cs.getPropertyValue('--color-focus');
      for (const s of ['--color-surface', '--color-surface-sunken', '--color-surface-raised']) {
        out.push(cr(focus, cs.getPropertyValue(s)));
      }
    }
    return Math.min(...out);
  });
  console.log(`            focus ring lowest ${rings.toFixed(2)} (needs 3)`);
  if (rings < 3) bad += 1;
}

console.log(bad === 0 ? '\nevery page passes AA' : `\n${bad} elements below AA`);
await b.close();
process.exit(bad === 0 ? 0 : 1);
