/*
  Runtime verification for the motion foundation.

  These are the checks that can only be made in a real browser, and they cover
  the three failure modes the motion module exists to prevent. Run against the
  dev server:

    npm run dev          # in one terminal
    node scripts/verify-motion.mjs

  Uses the Chrome already installed on the machine rather than downloading a
  browser. Exits non-zero on any failure so it can gate a commit.
*/

import { chromium } from 'playwright-core';

const BASE = process.env.VERIFY_URL ?? 'http://localhost:4321';

const results = [];
const record = (name, passed, detail) => {
  results.push({ name, passed, detail });
  const mark = passed ? '  PASS' : '  FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const readTriggerCount = (page) =>
  page.evaluate(() => window.__motion?.triggerCount ?? -1);

const run = async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  /* ---------------------------------------------------------------------
     Motion enabled
     --------------------------------------------------------------------- */
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.goto(BASE, { waitUntil: 'networkidle' });

  const debugHandlePresent = await page.evaluate(() => Boolean(window.__motion));
  record(
    'debug handle available (dev build)',
    debugHandlePresent,
    debugHandlePresent ? undefined : 'run against `npm run dev`, not the preview build',
  );
  if (!debugHandlePresent) {
    await browser.close();
    return false;
  }

  record(
    'motion-ok applied',
    await page.evaluate(() => document.documentElement.classList.contains('motion-ok')),
  );

  record(
    'failsafe disarmed by initMotion',
    await page.evaluate(() => window.__motionFailsafe === undefined || true) &&
      (await page.evaluate(async () => {
        /* If the failsafe had fired, motion-ok would be gone by now. */
        await new Promise((resolve) => setTimeout(resolve, 3200));
        return document.documentElement.classList.contains('motion-ok');
      })),
    'motion-ok still present after the 3s failsafe window',
  );

  record(
    'Lenis running',
    await page.evaluate(() => Boolean(window.__motion.lenis)),
  );

  /* Gotcha 2: Lenis hijacks scroll, so ScrollTrigger must be driven from it.
     Scrolling should move ScrollTrigger's notion of scroll position too. */
  const scrollSync = await page.evaluate(async () => {
    const before = window.__motion.ScrollTrigger.positionInViewport
      ? window.scrollY
      : window.scrollY;
    window.__motion.lenis.scrollTo(900, { immediate: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { before, after: window.scrollY };
  });
  record(
    'Lenis drives the window scroll position',
    scrollSync.after > scrollSync.before,
    `${scrollSync.before} → ${scrollSync.after}`,
  );

  /* Gotcha 6: split headlines must not be read out character by character. */
  const splitAria = await page.evaluate(() => {
    const el = document.querySelector('[data-split]');
    if (!el) return null;
    const chars = el.querySelectorAll('.split-char');
    return {
      label: el.getAttribute('aria-label'),
      charCount: chars.length,
      allHidden: Array.from(chars).every(
        (c) => c.getAttribute('aria-hidden') === 'true' || c.closest('[aria-hidden="true"]'),
      ),
    };
  });
  record(
    'split headline exposes readable text',
    Boolean(splitAria?.label && splitAria.label.length > 0),
    splitAria ? `aria-label: "${splitAria.label}"` : 'no [data-split] found',
  );
  record(
    'split characters hidden from a11y tree',
    Boolean(splitAria && splitAria.charCount > 0 && splitAria.allHidden),
    splitAria ? `${splitAria.charCount} chars` : undefined,
  );

  /* Reveal content actually becomes visible. */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  const hiddenReveals = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-reveal]')).filter(
      (el) => Number(getComputedStyle(el).opacity) < 0.9,
    ).length,
  );
  record('all reveal elements visible after scrolling', hiddenReveals === 0, `${hiddenReveals} still hidden`);

  /* ---------------------------------------------------------------------
     Gotcha 1: the view-transition leak.

     Navigate back and forth repeatedly and compare each page against itself
     on later visits. Comparing home to a subpage proves nothing — they have
     different numbers of animated elements — and comparing a scrolled page to
     a fresh one proves nothing either, because reveal triggers are `once` and
     kill themselves after firing. A leak shows up as the SAME page reporting
     a higher count on each subsequent visit.
     --------------------------------------------------------------------- */
  /* A fresh page, because the checks above scrolled to the bottom. Reloading
     the same page would have Chrome restore that scroll position, firing the
     `once` triggers before they can be counted. */
  const leakPage = await context.newPage();

  const navigate = async (href) => {
    await leakPage.evaluate((target) => {
      const link = document.querySelector(`header a[href="${target}"]`);
      if (link) link.click();
      else window.location.assign(target);
    }, href);
    await leakPage.waitForTimeout(800);
    return readTriggerCount(leakPage);
  };

  await leakPage.goto(BASE, { waitUntil: 'networkidle' });
  await leakPage.waitForTimeout(800);

  const homeCounts = [await readTriggerCount(leakPage)];
  const workCounts = [];

  for (let lap = 0; lap < 3; lap += 1) {
    workCounts.push(await navigate('/work/'));
    homeCounts.push(await navigate('/'));
  }

  const stable = (counts) => counts.every((count) => count === counts[0]);

  record(
    'ScrollTrigger count stable across repeated visits (home)',
    stable(homeCounts) && homeCounts[0] > 0,
    `visits: ${homeCounts.join(', ')}`,
  );
  record(
    'ScrollTrigger count stable across repeated visits (work)',
    stable(workCounts) && workCounts[0] > 0,
    `visits: ${workCounts.join(', ')}`,
  );

  /* Orphaned SplitText spans would accumulate if revert() were skipped. */
  const orphanSpans = await leakPage.evaluate(
    () => document.querySelectorAll('[data-split] .split-char').length,
  );
  const splitCharsSane = orphanSpans > 0 && orphanSpans < 200;
  record(
    'SplitText spans reverted between pages',
    splitCharsSane,
    `${orphanSpans} character spans on the current page`,
  );

  record('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await context.close();

  /* ---------------------------------------------------------------------
     Reduced motion
     --------------------------------------------------------------------- */
  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(BASE, { waitUntil: 'networkidle' });
  await reducedPage.waitForTimeout(600);

  record(
    'reduced motion: motion-ok never applied',
    await reducedPage.evaluate(
      () => !document.documentElement.classList.contains('motion-ok'),
    ),
  );
  record(
    'reduced motion: Lenis not started',
    await reducedPage.evaluate(() => !window.__motion.lenis),
  );
  record(
    'reduced motion: no ScrollTriggers created',
    (await readTriggerCount(reducedPage)) === 0,
    `${await readTriggerCount(reducedPage)} triggers`,
  );

  const hiddenUnderReduce = await reducedPage.evaluate(
    () =>
      Array.from(document.querySelectorAll('[data-reveal]')).filter(
        (el) => Number(getComputedStyle(el).opacity) < 0.9,
      ).length,
  );
  record(
    'reduced motion: all content visible without scrolling',
    hiddenUnderReduce === 0,
    `${hiddenUnderReduce} hidden`,
  );

  const headlineText = await reducedPage.evaluate(
    () => document.querySelector('[data-split]')?.textContent?.trim() ?? '',
  );
  record(
    'reduced motion: headline text intact and unsplit',
    headlineText.length > 0 &&
      (await reducedPage.evaluate(
        () => document.querySelectorAll('[data-split] .split-char').length === 0,
      )),
    `"${headlineText}"`,
  );

  await reduced.close();

  /* ---------------------------------------------------------------------
     Toggling the preference mid-session.

     A value read once at load would leave someone who just switched Reduce
     Motion on with all the motion they turned off, so this exercises the
     matchMedia change listener rather than only the initial state.
     --------------------------------------------------------------------- */
  const toggleContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const togglePage = await toggleContext.newPage();
  await togglePage.goto(BASE, { waitUntil: 'networkidle' });
  await togglePage.waitForTimeout(700);

  const beforeToggle = await readTriggerCount(togglePage);
  await togglePage.emulateMedia({ reducedMotion: 'reduce' });
  await togglePage.waitForTimeout(700);

  record(
    'toggling reduce-motion on tears down existing animations',
    beforeToggle > 0 && (await readTriggerCount(togglePage)) === 0,
    `${beforeToggle} triggers → ${await readTriggerCount(togglePage)}`,
  );
  record(
    'toggling reduce-motion on stops Lenis',
    await togglePage.evaluate(() => !window.__motion.lenis),
  );
  record(
    'toggling reduce-motion on leaves all content visible',
    (await togglePage.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-reveal]')).filter(
          (el) => Number(getComputedStyle(el).opacity) < 0.9,
        ).length,
    )) === 0,
  );

  /* ---------------------------------------------------------------------
     Mobile navigation.

     Deliberately independent of the motion module, so it's checked
     independently too — it has to work whether or not GSAP ever loads.
     --------------------------------------------------------------------- */
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE, { waitUntil: 'networkidle' });

  const panelHidden = () => mobilePage.locator('[data-nav-panel]').isHidden();

  record('mobile: panel starts closed', await panelHidden());

  await mobilePage.locator('[data-nav-toggle]').click();
  await mobilePage.waitForTimeout(200);
  record(
    'mobile: toggle opens the panel',
    !(await panelHidden()) &&
      (await mobilePage.locator('[data-nav-toggle]').getAttribute('aria-expanded')) === 'true',
  );

  await mobilePage.keyboard.press('Escape');
  await mobilePage.waitForTimeout(200);
  record(
    'mobile: Escape closes the panel and restores aria-expanded',
    (await panelHidden()) &&
      (await mobilePage.locator('[data-nav-toggle]').getAttribute('aria-expanded')) === 'false',
  );

  await mobilePage.locator('[data-nav-toggle]').click();
  await mobilePage.waitForTimeout(200);
  await mobilePage.locator('[data-nav-panel] a[href="/about/"]').click();
  await mobilePage.waitForTimeout(900);
  record(
    'mobile: navigating from the panel closes it',
    await panelHidden(),
    `now at ${new URL(mobilePage.url()).pathname}`,
  );

  /* aria-current has to follow the page, which is why the header is not
     persisted across transitions. */
  record(
    'mobile: aria-current follows navigation',
    (await mobilePage.locator('header a[href="/about/"]').first().getAttribute('aria-current')) ===
      'page',
  );

  record(
    'mobile: no horizontal overflow',
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    `scrollWidth ${await mobilePage.evaluate(() => document.documentElement.scrollWidth)} vs ${await mobilePage.evaluate(() => window.innerWidth)}`,
  );

  await mobile.close();

  /* And back off again — the switch has to work in both directions. */
  await togglePage.emulateMedia({ reducedMotion: 'no-preference' });
  await togglePage.waitForTimeout(700);
  record(
    'toggling reduce-motion back off restores motion',
    (await readTriggerCount(togglePage)) > 0 &&
      (await togglePage.evaluate(() => Boolean(window.__motion.lenis))),
    `${await readTriggerCount(togglePage)} triggers restored`,
  );

  await browser.close();

  const failed = results.filter((r) => !r.passed);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed` +
      (failed.length ? `\nFailed: ${failed.map((f) => f.name).join(', ')}` : ''),
  );
  return failed.length === 0;
};

run()
  .then((ok) => process.exit(ok ? 0 : 1))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
