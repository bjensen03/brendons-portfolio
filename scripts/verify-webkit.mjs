/*
  WebKit smoke test.

  Safari behaves differently enough around scroll-driven animation that it has
  to be checked continuously rather than at the end (and video autoplay will
  matter from Phase 2 on). This drives Playwright's WebKit build — the same
  engine as Safari, though not Safari itself, so a real-device pass is still
  worth doing before launch.

    npm run dev
    node scripts/verify-webkit.mjs
*/

import { webkit } from 'playwright-core';

const BASE = process.env.VERIFY_URL ?? 'http://localhost:4321';

const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const state = await page.evaluate(() => ({
  motionOk: document.documentElement.classList.contains('motion-ok'),
  lenis: Boolean(window.__motion?.lenis),
  triggers: window.__motion?.triggerCount ?? -1,
  splitChars: document.querySelectorAll('[data-split] .split-char').length,
}));

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1400);

const hidden = await page.evaluate(
  () =>
    Array.from(document.querySelectorAll('[data-reveal]')).filter(
      (el) => Number(getComputedStyle(el).opacity) < 0.9,
    ).length,
);

const scrolled = await page.evaluate(() => window.scrollY);

const checks = [
  ['page renders and motion boots', state.motionOk && state.lenis],
  ['ScrollTriggers created', state.triggers > 0, `${state.triggers}`],
  ['SplitText runs', state.splitChars > 0, `${state.splitChars} chars`],
  ['scrolling works under Lenis', scrolled > 0, `scrollY ${scrolled}`],
  ['reveal content becomes visible', hidden === 0, `${hidden} hidden`],
  ['no console or page errors', errors.length === 0, errors.slice(0, 2).join(' | ')],
];

let failed = 0;
for (const [name, ok, detail] of checks) {
  if (!ok) failed += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log(`\nWebKit: ${checks.length - failed}/${checks.length} checks passed`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
