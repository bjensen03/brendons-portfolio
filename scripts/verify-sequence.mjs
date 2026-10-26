/*
  Runtime verification for the home page's motion: the opening, the hero
  entrance, the code field, the section order (hero, Selected Work,
  Technical skills, testimonials, Twilight), the Selected Work showcase, and
  the ScrollTrigger lifecycle across view transitions.

  The checks for the old canyon hero (intro overlay, hiker, walker, contour
  canvas, elevation track, route waypoints) went with those components. What
  they protected carries over: an overlay that must always clear, a hero that
  must always become readable, reveals that must actually open, a trigger
  count that must not climb, and reduced motion / mobile staying static.

    npm run dev
    node scripts/verify-sequence.mjs
*/

import { chromium } from 'playwright-core';

let failures = 0;
const BASE = process.env.VERIFY_URL ?? 'http://localhost:4321';
const b = await chromium.launch({ channel: 'chrome' });
const ok = (n, v, d) => {
  if (!v) failures += 1;
  console.log(`${v ? '  PASS' : '  FAIL'}  ${n}${d ? ' — ' + d : ''}`);
};
const note = (n, d) => console.log(`  NOTE  ${n}${d ? ' — ' + d : ''}`);

/* /twilight-trekkers/ is linked from the header while its page is still
   being built, so prefetching it 404s. Those (and only as many as were
   seen) are not counted as console errors until the page exists. */
const pending404 = { count: 0 };
const watch404 = (page) =>
  page.on('response', (r) => {
    if (r.status() === 404 && new URL(r.url()).pathname.startsWith('/twilight-trekkers')) pending404.count += 1;
  });
const realErrors = (list, seen = pending404.count) => {
  let allowance = seen;
  return list.filter((e) => {
    if (allowance > 0 && /status of 404/.test(e)) {
      allowance -= 1;
      return false;
    }
    return true;
  });
};

/* Lenis drives the scroll, so a bare scrollTo is a request it may smooth
   over. Ask Lenis directly when it's there. */
const scrollToY = (page, y) =>
  page.evaluate((y) => {
    const l = window.__motion?.lenis;
    if (l) l.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, y);
const scrollToEl = (page, sel, offset = 0) =>
  page.evaluate(
    ([sel, offset]) => {
      const el = document.querySelector(sel);
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      const l = window.__motion?.lenis;
      if (l) l.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    },
    [sel, offset],
  );

/* ---------------------------------------------------------------------------
   The opening. A fresh context is a fresh session, so it plays.
   ------------------------------------------------------------------------ */

const oc = await b.newContext({ viewport: { width: 1440, height: 900 } });
const o = await oc.newPage();
const errs = [];
watch404(o);
o.on('pageerror', (e) => errs.push(String(e)));
o.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await o.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

ok('opening plays on the first load of a session', await o
  .waitForFunction(() => document.documentElement.dataset.opening === 'play', null, { timeout: 3000 })
  .then(() => true)
  .catch(() => false));

/* The cover is a fixed full-screen layer. If it ever fails to clear, the
   whole site is a blank screen — so assert it goes, and is gone for good. */
const cleared = await o
  .waitForFunction(
    () =>
      document.documentElement.dataset.opening === undefined &&
      getComputedStyle(document.querySelector('[data-opening]')).display === 'none',
    null,
    { timeout: 4000 },
  )
  .then(() => true)
  .catch(() => false);
ok('opening clears itself', cleared);

const heroVisible = await o
  .waitForFunction(
    () =>
      ['[data-hero-title]', '[data-hero-line]', '[data-hero-actions]'].every((s) => {
        const el = document.querySelector(s);
        return el && Number(getComputedStyle(el).opacity) > 0.95;
      }) && !document.querySelector('[data-hero-title] .split-word-mask'),
    null,
    { timeout: 6000 },
  )
  .then(() => true)
  .catch(() => false);
ok('hero entrance completes after the opening', heroVisible);

ok('opening does not replay on reload', await (async () => {
  await o.reload({ waitUntil: 'domcontentloaded' });
  await o.waitForTimeout(200);
  return o.evaluate(() => getComputedStyle(document.querySelector('[data-opening]')).display === 'none');
})());

/* Skippable: a keypress finishes it at once. */
const sc = await b.newContext({ viewport: { width: 1440, height: 900 } });
const s = await sc.newPage();
await s.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await s.waitForFunction(() => window.__motion?.gsap.getTweensOf('[data-opening-stroke]').length, null, { timeout: 8000 }).catch(() => {});
await s.keyboard.press('Shift');
await s.waitForTimeout(120);
ok('opening skips on a keypress', await s.evaluate(() => document.documentElement.dataset.opening === undefined));
ok('skipping does not steal focus', await s.evaluate(() => document.activeElement === document.body || !document.activeElement?.closest('[data-opening]')));
await sc.close();

/* ---------------------------------------------------------------------------
   The page itself, with the opening already seen.
   ------------------------------------------------------------------------ */

const pc = await b.newContext({ viewport: { width: 1440, height: 900 } });
await pc.addInitScript(() => {
  try { sessionStorage.setItem('bj-opened', '1'); } catch {}
});
const p = await pc.newPage();
watch404(p);
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(`${BASE}/`, { waitUntil: 'load' });

ok('hero entrance completes', await p
  .waitForFunction(
    () =>
      ['[data-hero-title]', '[data-hero-line]', '[data-hero-actions]'].every(
        (s) => Number(getComputedStyle(document.querySelector(s)).opacity) > 0.95,
      ),
    null,
    { timeout: 15000 },
  )
  .then(() => true)
  .catch(() => false));

ok('headline keeps a readable label', await p.evaluate(() => {
  const t = document.querySelector('[data-hero-title]');
  const text = (t.getAttribute('aria-label') || t.textContent || '').replace(/\s+/g, ' ').trim();
  return /Hi, I.m Brendon\./i.test(text);
}));

/* Placeholder copy shipped to production once (YOUR METRIC HERE / 00 / 0.0s
   from an empty config array). Those stand-ins must never render. The
   redesign's bracketed [PLACEHOLDER — …] markers are deliberate, visible
   gaps waiting on final copy; they are counted, not hidden. */
ok('no stand-in content on the home page', await p.evaluate(() => {
  const text = document.body.innerText.toLowerCase();
  return !['your metric here', 'lorem ipsum', 'tbd'].some((n) => text.includes(n));
}));
const markers = await p.evaluate(() => (document.body.innerText.match(/\[PLACEHOLDER/g) || []).length);
if (markers) note('copy still waiting on final text', `${markers} [PLACEHOLDER] markers on the page`);

ok('code field drifts while the hero is on screen', await p.evaluate(() => {
  const a = document.querySelector('[data-code-field] .code-field__track')?.getAnimations() ?? [];
  return a.length > 0 && a[0].playState === 'running';
}));

/* ---- Scroll cue: a real link under the headline to the next section;
   clicking it glides there, and it's gone once the hero is scrolled past. */
{
  const cue = await p.evaluate(() => {
    const hero = document.querySelector('[data-hero]');
    const a = hero?.querySelector('[data-hero-cue-link]');
    const target = a && document.getElementById(a.hash.slice(1));
    /* The first section after the hero in document order. */
    const next = [...document.querySelectorAll('section')].find(
      (el) => hero.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !hero.contains(el));
    return {
      inHero: Boolean(a),
      href: a?.getAttribute('href'),
      name: a?.getAttribute('aria-label'),
      nextIsTarget: Boolean(target) && target === next,
      /* Layout size, not the rect: the entrance and the magnet transform it. */
      size: a ? Math.min(a.offsetWidth, a.offsetHeight) : 0,
      looping: document.querySelector('[data-hero-cue]').classList.contains('is-looping'),
    };
  });
  ok('scroll cue: a link in the hero to the next section', cue.inHero && cue.nextIsTarget && /work/i.test(cue.name ?? '') && cue.href === '#work',
    JSON.stringify(cue));
  ok('scroll cue: target at least 44px', cue.size >= 44, `${cue.size}px`);
  ok('scroll cue: idle loop running while the hero is on screen', cue.looping);
  await scrollToY(p, 0);
  await p.waitForTimeout(300);
  await p.click('[data-hero-cue-link]');
  await p.waitForTimeout(2000);
  const landed = await p.evaluate(() => ({
    top: Math.round(document.getElementById('work').getBoundingClientRect().top),
    vis: getComputedStyle(document.querySelector('[data-hero-cue]')).visibility,
    looping: document.querySelector('[data-hero-cue]').classList.contains('is-looping'),
  }));
  ok('scroll cue: click brings the next section to the top', Math.abs(landed.top) <= 8, `top ${landed.top}px`);
  ok('scroll cue: hidden once the hero is scrolled past', landed.vis === 'hidden', landed.vis);
  await scrollToY(p, 2400);
  await p.waitForTimeout(400);
  ok('scroll cue: loop stops with the hero off screen', !(await p.evaluate(() =>
    document.querySelector('[data-hero-cue]').classList.contains('is-looping'))));
  await scrollToY(p, 0);
  await p.waitForTimeout(300);
}

/* ---- Section order: hero, then Selected Work, Technical skills,
   testimonials, Twilight. (What I build was folded into Technical skills.) */
const order = await p.evaluate(() => {
  const at = (el) => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null);
  return {
    hero: at(document.querySelector('[data-hero]')),
    work: at(document.getElementById('work')),
    skills: at(document.getElementById('skills')),
    testimonials: at(document.querySelector('section.tm')),
    twilight: at(document.querySelector('section.td')),
    oldBuild: !!document.querySelector('[data-build], #what-i-build'),
  };
});
{
  const seq = [order.hero, order.work, order.skills, order.testimonials, order.twilight];
  ok('home: hero → work → technical skills → testimonials → Twilight',
    seq.every((y) => y !== null) && seq.every((y, i) => i === 0 || y > seq[i - 1]), JSON.stringify(order));
  ok('home: What I build is gone', !order.oldBuild);
}

await scrollToY(p, await p.evaluate(() => document.getElementById('work').getBoundingClientRect().top + window.scrollY + 400));
await p.waitForTimeout(600);
ok('code field pauses once the hero is off screen', await p.evaluate(() =>
  document.querySelector('[data-code-field]').classList.contains('is-paused')));

/* ---- Selected Work: index + stage. Names on the left walk with the
   scroll, the stage on the right follows whichever one is active. ---- */
const workReady = await p.evaluate(() => {
  const w = document.querySelector('[data-work]');
  return {
    ready: Boolean(document.querySelector('[data-work][data-ready]')),
    desk: getComputedStyle(w.querySelector('.work-desk')).display,
    stack: getComputedStyle(w.querySelector('.work-stack')).display,
  };
});
ok('selected work: stage is on at 1440', workReady.ready && workReady.desk !== 'none' && workReady.stack === 'none',
  JSON.stringify(workReady));

/* Drafts are dev-only, so the count differs between dev and a build. The
   stacked list renders every published project, so it is the expectation. */
const workCount = await p.evaluate(() => ({
  items: document.querySelectorAll('[data-work-item]').length,
  rows: document.querySelectorAll('.work-stack article').length,
}));
ok('selected work: one name per project', workCount.items >= 2 && workCount.items === workCount.rows,
  `${workCount.items} names, ${workCount.rows} rows`);
const nWork = workCount.items;

const workState = () =>
  p.evaluate(() => {
    const active = [...document.querySelectorAll('[data-work-item][data-active]')];
    const shown = [...document.querySelectorAll('[data-work-slide]')].filter((s) => {
      const cs = getComputedStyle(s);
      return cs.zIndex === '2' && cs.visibility === 'visible';
    });
    const metas = [...document.querySelectorAll('[data-work-meta]')].filter(
      (g) => getComputedStyle(g).visibility === 'visible' && !g.inert,
    );
    return {
      active: active.map((a) => a.dataset.workItem),
      activeHref: active[0]?.href,
      slide: shown.map((s) => s.dataset.workSlide),
      stageHref: document.querySelector('[data-work-stage]').href,
      metas: metas.map((g) => g.dataset.workMeta),
    };
  });
const stageMatches = (s, i) =>
  s.active.length === 1 && s.active[0] === String(i) &&
  s.slide.length === 1 && s.slide[0] === String(i) &&
  s.stageHref === s.activeHref &&
  s.metas.length === 1 && s.metas[0] === String(i);

/* The middle of project i's stretch of the run. */
const scrollToWork = (page, i, n) =>
  page.evaluate(([i, n]) => {
    const d = document.querySelector('[data-work-desk]');
    const top = d.getBoundingClientRect().top + window.scrollY;
    const y = top + (d.offsetHeight - window.innerHeight) * ((i + 0.5) / n);
    const l = window.__motion?.lenis;
    if (l) l.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, [i, n]);

for (const i of [0, nWork - 1]) {
  await scrollToWork(p, i, nWork);
  await p.waitForTimeout(1300);
  const st = await workState();
  ok(`selected work: scroll makes project ${i + 1} active`, st.active.length === 1 && st.active[0] === String(i),
    JSON.stringify(st.active));
  ok(`selected work: stage, link and meta follow project ${i + 1}`, stageMatches(st, i), JSON.stringify(st));
}

/* Hover the last name from the first stretch, then focus the first. */
await scrollToWork(p, 0, nWork);
await p.waitForTimeout(900);
await p.hover(`[data-work-item="${nWork - 1}"]`);
await p.waitForTimeout(1300);
const hov = await workState();
ok('selected work: hovering a name makes it active', stageMatches(hov, nWork - 1), JSON.stringify(hov));
await p.mouse.move(5, 5);
await p.focus('[data-work-item="0"]');
await p.waitForTimeout(1300);
const foc = await workState();
ok('selected work: focusing a name makes it active', stageMatches(foc, 0), JSON.stringify(foc));
await p.evaluate(() => document.activeElement?.blur());

/* Past the section, the sticky frame has to have left with it. */
await p.evaluate(() => {
  const d = document.querySelector('[data-work-desk]');
  const y = d.getBoundingClientRect().bottom + window.scrollY + 200;
  const l = window.__motion?.lenis;
  if (l) l.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
});
await p.waitForTimeout(600);
ok('selected work: nothing stays stuck after the section', await p.evaluate(() =>
  document.querySelector('[data-work-desk]').getBoundingClientRect().bottom < 0));

/* ---- Experience: every row actually ends up visible. A from-tween that
   reads its end value while the CSS gate still hides the row animates from
   0 to 0 and leaves it invisible. ---- */
const expRows = await p.evaluate(() => document.querySelectorAll('[data-exp-row]').length);
const expHidden = [];
for (let i = 0; i < expRows; i += 1) {
  await p.evaluate((i) => {
    const el = document.querySelectorAll('[data-exp-row]')[i];
    const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
    const l = window.__motion?.lenis;
    if (l) l.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, i);
  await p.waitForTimeout(1000);
  const op = await p.evaluate((i) => Number(getComputedStyle(document.querySelectorAll('[data-exp-row]')[i]).opacity), i);
  if (op < 0.95) expHidden.push(`${i + 1}: ${op}`);
}
if (!expRows) note('experience', 'no Experience section on the homepage any more; skipped');
else ok('experience: every row visible once scrolled to', expHidden.length === 0,
  expHidden.length ? `hidden rows ${expHidden.join(', ')}` : `${expRows} rows`);

/* Scroll to the bottom rather than counting wheel ticks — a fixed number of
   ticks is a bet on the page's height. */
for (let i = 0; i < 10; i += 1) {
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(180);
}
await p.waitForTimeout(800);
ok('scroll reaches the end of the document', await p.evaluate(() => {
  const de = document.documentElement;
  return window.scrollY >= de.scrollHeight - window.innerHeight - 4;
}));
ok('footer reachable', await p.evaluate(() => {
  const f = document.querySelector('footer');
  return f && f.getBoundingClientRect().top < window.innerHeight + 300;
}));
/* Nothing on the home page pins. A pin spacer means a stray pin survived. */
ok('nothing is pinned', await p.evaluate(() => document.querySelectorAll('.pin-spacer').length === 0));
ok('no horizontal overflow', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

/*
  Trigger lifecycle. Compare only the scrubbed / persistent triggers: reveal
  triggers use once:true and retire as they fire, so two totals taken after
  different scroll histories are never comparable — that difference reads as
  a leak and is not one. The persistent set must be identical however many
  times the page is revisited.
*/
const persistent = () =>
  p.evaluate(() => (window.__motion?.ScrollTrigger.getAll() || []).filter((t) => !t.vars.once).length);

await p.goto(`${BASE}/`, { waitUntil: 'load' });
await p.waitForTimeout(1600);
const before = await persistent();
const hasHandle = await p.evaluate(() => Boolean(window.__motion));
ok('motion debug handle present (dev server required)', hasHandle,
  hasHandle ? undefined : `no window.__motion at ${BASE} — leak checks need the dev server`);

for (let round = 0; round < 3; round += 1) {
  for (const h of ['/about/', '/', '/work/', '/']) {
    await p.click(`header a[href="${h}"]`).catch(() => p.click(`a[href="${h}"]`));
    await p.waitForTimeout(1400);
  }
}
await p.waitForTimeout(1200);
const after = await persistent();
const spacers = await p.evaluate(() => document.querySelectorAll('.pin-spacer').length);
ok('persistent triggers stay flat after 12 navigations', before === after && before > 0, `${before} -> ${after}`);
ok('no pin spacers left behind', spacers === 0, `${spacers}`);
ok('opening stays away on internal navigation', await p.evaluate(() =>
  getComputedStyle(document.querySelector('[data-opening]')).display === 'none'));
ok('code field has one spotlight layer after navigations', await p.evaluate(() =>
  document.querySelectorAll('[data-code-field] [data-cf-layer="lit"]').length <= 1));

/* ---------------------------------------------------------------------------
   Header: hides on the way down, back on the way up, never hidden at the
   top or with focus inside it, and the active bar under the right link.
   ------------------------------------------------------------------------ */

const headerState = (page) =>
  page.evaluate(() => {
    const h = document.querySelector('[data-nav]');
    const bar = document.querySelector('[data-nav-indicator]');
    const shown = bar?.classList.contains('is-shown');
    const br = bar?.getBoundingClientRect();
    const under = shown
      ? [...document.querySelectorAll('[data-nav-link]')].find((a) => {
          const r = a.querySelector('[data-nav-label]').getBoundingClientRect();
          return Math.abs(r.left - br.left) < 2 && Math.abs(r.width - br.width) < 2;
        })
      : null;
    return {
      hidden: h.hasAttribute('data-hidden'),
      top: h.getBoundingClientRect().top,
      bar: shown ? (under?.getAttribute('href') ?? 'misaligned') : 'none',
      progress: document.querySelector('[data-nav-progress]')?.style.transform ?? '',
    };
  });

await p.goto(`${BASE}/`, { waitUntil: 'load' });
await p.waitForTimeout(1200);
const hTop = await headerState(p);
ok('header: shown at the top, no active bar on the hero', !hTop.hidden && hTop.bar === 'none', JSON.stringify(hTop));

await scrollToY(p, 1400);
await p.waitForTimeout(300);
await p.mouse.wheel(0, 400);
await p.waitForTimeout(900);
const hDown = await headerState(p);
ok('header: hides on scroll down', hDown.hidden && hDown.top < -10, `top ${Math.round(hDown.top)}`);
ok('header: progress line tracks the page', /scaleX\(0\.[1-9]/.test(hDown.progress), hDown.progress);

await p.mouse.wheel(0, -150);
await p.waitForTimeout(900);
const hUp = await headerState(p);
ok('header: comes back on scroll up', !hUp.hidden && Math.abs(hUp.top) < 1, `top ${Math.round(hUp.top)}`);

await p.mouse.wheel(0, 400);
await p.waitForTimeout(900);
const yBeforeFocus = await p.evaluate(() => window.scrollY);
await p.focus('header [data-nav-link]');
await p.waitForTimeout(400);
const hFocus = await headerState(p);
ok('header: focus inside reveals it without scrolling the page',
  !hFocus.hidden && Math.abs(hFocus.top) < 1 && Math.abs((await p.evaluate(() => window.scrollY)) - yBeforeFocus) < 2);
await p.evaluate(() => document.activeElement?.blur());

await scrollToEl(p, '#work', -200);
await p.waitForTimeout(700);
ok('header: active bar on Work over Selected work', (await headerState(p)).bar === '/work/');
await scrollToEl(p, '#contact', 40);
await p.waitForTimeout(700);
ok('header: active bar on Contact over the contact section', (await headerState(p)).bar === '/contact/');
await scrollToY(p, 0);
await p.waitForTimeout(700);
ok('header: active bar leaves at the top', (await headerState(p)).bar === 'none');

for (const [path, href] of [['/about/', '/about/'], ['/work/', '/work/']]) {
  await p.click(`header a[href="${path}"]`);
  await p.waitForTimeout(1400);
  ok(`header: active bar under ${href} on ${path}`, (await headerState(p)).bar === href);
}

ok('header: four links in order — Projects, Twilight Trekkers, About, Contact', await p.evaluate(() =>
  [...document.querySelectorAll('header [data-nav-link]')].map((a) => a.getAttribute('href')).join(' ') ===
    '/work/ /twilight-trekkers/ /about/ /contact/'));
{
  /* The Twilight Trekkers page is being built separately; check the bar
     there once it exists. */
  const tt = await p.request.get(`${BASE}/twilight-trekkers/`).then((r) => r.status()).catch(() => 0);
  if (tt === 200) {
    await p.click('header a[href="/twilight-trekkers/"]');
    await p.waitForTimeout(1400);
    ok('header: active bar under /twilight-trekkers/ on /twilight-trekkers/', (await headerState(p)).bar === '/twilight-trekkers/');
    await p.click('header a[href="/work/"]');
    await p.waitForTimeout(1400);
  } else {
    note('header: /twilight-trekkers/ not built yet', `status ${tt}; active-bar check skipped`);
  }
}
ok('header: one label per link for assistive tech', await p.evaluate(() =>
  [...document.querySelectorAll('header [data-nav-link]')].every((a) => {
    const hidden = a.querySelectorAll('[aria-hidden="true"]');
    if (hidden.length !== 1) return false;
    /* What's left once the aria-hidden copy is ignored is the label, once. */
    const clone = a.cloneNode(true);
    clone.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
    return clone.textContent.trim() === hidden[0].textContent.trim();
  })));

ok('no console errors', realErrors(errs).length === 0, realErrors(errs).join(' | ') || undefined);

/* ---------------------------------------------------------------------------
   Reduced motion: everything visible, nothing moving.
   ------------------------------------------------------------------------ */

const r = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
await r.goto(`${BASE}/`, { waitUntil: 'load' });
await r.waitForTimeout(1500);
ok('reduced motion: no opening', await r.evaluate(() =>
  getComputedStyle(document.querySelector('[data-opening]')).display === 'none'));
ok('reduced motion: nothing pinned', await r.evaluate(() => document.querySelectorAll('.pin-spacer').length === 0));
ok('reduced motion: hero readable', await r.evaluate(() => {
  const t = document.querySelector('[data-hero-title]');
  return Number(getComputedStyle(t).opacity) > 0.95 && /Brendon/.test(t.textContent);
}));
ok('reduced motion: scroll cue visible and still', await r.evaluate(() => {
  const cue = document.querySelector('[data-hero-cue]');
  const moving = [...cue.querySelectorAll('*')].some((el) => el.getAnimations().length);
  return Number(getComputedStyle(cue).opacity) > 0.95 && !moving && !cue.classList.contains('is-looping');
}));
/* The stage still runs under reduced motion, it just swaps instantly. A
   clip-path that never animates is an invisible element, so the active
   slide has to be fully open. */
ok('reduced motion: work stage still on', await r.evaluate(() => Boolean(document.querySelector('[data-work][data-ready]'))));
{
  const nR = await r.evaluate(() => document.querySelectorAll('[data-work-item]').length);
  await scrollToWork(r, 1, nR);
  await r.waitForTimeout(500);
  const rs = await r.evaluate(() => {
    const active = [...document.querySelectorAll('[data-work-item][data-active]')].map((a) => a.dataset.workItem);
    const s = document.querySelector('[data-work-slide="1"]');
    const cs = getComputedStyle(s);
    return { active, vis: cs.visibility, clip: cs.clipPath, z: cs.zIndex };
  });
  ok('reduced motion: second stretch shows project 2, fully open',
    rs.active.length === 1 && rs.active[0] === '1' && rs.vis === 'visible' && rs.z === '2' &&
      (rs.clip === 'none' || /^inset\(0(px|%)?( 0(px|%)?){0,3}\)$/.test(rs.clip)),
    JSON.stringify(rs));
  ok('reduced motion: nothing pinned in Selected work', await r.evaluate(() => document.querySelectorAll('.pin-spacer').length === 0));
}
ok('reduced motion: code field is static', await r.evaluate(() =>
  (document.querySelector('[data-code-field]')?.getAnimations({ subtree: true }) ?? []).length === 0));
ok('reduced motion: logo drawn, header static and never hides', await (async () => {
  const still = await r.evaluate(() => {
    const paths = [...document.querySelectorAll('header [data-logo-path]')];
    return !document.documentElement.hasAttribute('data-logo-intro') &&
      paths.every((x) => Number(getComputedStyle(x).fillOpacity) === 1);
  });
  await r.evaluate(() => window.scrollTo(0, 1600));
  await r.waitForTimeout(200);
  await r.mouse.wheel(0, 400);
  await r.waitForTimeout(600);
  const h = await headerState(r);
  return still && !h.hidden && Math.abs(h.top) < 1;
})());
ok('reduced motion: progress line still tracks the page', /scaleX\(0\.[1-9]/.test((await headerState(r)).progress));
await r.goto(`${BASE}/about/`, { waitUntil: 'load' });
await r.waitForTimeout(800);
ok('reduced motion: active bar under the current page', (await headerState(r)).bar === '/about/');
await r.goto(`${BASE}/`, { waitUntil: 'load' });
await r.waitForTimeout(800);
/* ---------------------------------------------------------------------------
   Mobile: stacked, nothing pinned, no sideways scroll.
   ------------------------------------------------------------------------ */

const mc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await mc.addInitScript(() => {
  try { sessionStorage.setItem('bj-opened', '1'); } catch {}
});
const m = await mc.newPage();
await m.goto(`${BASE}/`, { waitUntil: 'load' });
await m.waitForTimeout(1800);
ok('mobile: nothing pinned', await m.evaluate(() => document.querySelectorAll('.pin-spacer').length === 0));
ok('mobile: no spotlight layer', await m.evaluate(() => !document.querySelector('[data-cf-layer="lit"]')));
ok('mobile: Selected work never builds the desktop stage', await m.evaluate(() => {
  const w = document.querySelector('[data-work]');
  return !w.hasAttribute('data-ready') && getComputedStyle(w.querySelector('.work-desk')).display === 'none';
}));
{
  const rows = await m.evaluate(() => document.querySelectorAll('.work-stack article').length);
  let shown = 0;
  for (let i = 0; i < rows; i += 1) {
    await m.evaluate((i) => document.querySelectorAll('.work-stack article')[i].scrollIntoView({ block: 'center' }), i);
    /* Wait on the real thing — the image decoded and the reveal finished —
       rather than a fixed delay: on a busy machine a lazy image in a
       sideways track can take longer than any fixed wait. */
    shown += await m.waitForFunction((i) => {
      const a = document.querySelectorAll('.work-stack article')[i];
      const img = a.querySelector('img');
      /* A featured study with no screenshot yet renders a labelled panel
         instead; it has to show just as fully as an image would. */
      const stand = img ? null : a.querySelector('.shot-needed');
      const box = a.querySelector('[data-reveal]');
      const cs = getComputedStyle(box);
      const r = (img ?? stand)?.getBoundingClientRect();
      const loaded = img ? img.complete && img.naturalWidth > 0 : Boolean(stand);
      return loaded && r.width > 100 && r.height > 50 &&
        Number(cs.opacity) > 0.95 && (cs.clipPath === 'none' || /^inset\(0(px|%)?( 0(px|%)?){0,3}\)$/.test(cs.clipPath));
    }, i, { timeout: 10000 }).then(() => 1).catch(() => 0);
  }
  const stands = await m.evaluate(() => document.querySelectorAll('.work-stack .shot-needed').length);
  ok('mobile: every project image shows in its carousel card', rows >= 2 && shown === rows,
    `${shown}/${rows}${stands ? `, ${stands} as a screenshot-needed panel` : ''}`);
  await m.evaluate(() => window.scrollTo(0, 0));
  await m.waitForTimeout(300);
}
ok('mobile: no overflow', await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
ok('mobile: brightness and Menu buttons keep 44px targets', await m.evaluate(() =>
  ['[data-lum-toggle]', '[data-nav-toggle]'].every((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return r.width >= 44 && r.height >= 44;
  })));
{
  const rows = await m.evaluate(() => document.querySelectorAll('[data-exp-row]').length);
  const hidden = [];
  for (let i = 0; i < rows; i += 1) {
    await m.evaluate((i) => document.querySelectorAll('[data-exp-row]')[i].scrollIntoView({ block: 'center' }), i);
    await m.waitForTimeout(900);
    const op = await m.evaluate((i) => Number(getComputedStyle(document.querySelectorAll('[data-exp-row]')[i]).opacity), i);
    if (op < 0.95) hidden.push(`${i + 1}: ${op}`);
  }
  if (!rows) note('mobile: experience', 'no Experience section on the homepage any more; skipped');
  else ok('mobile: every experience row visible once scrolled to', hidden.length === 0,
    hidden.length ? `hidden rows ${hidden.join(', ')}` : `${rows} rows`);
  await m.evaluate(() => window.scrollTo(0, 0));
  await m.waitForTimeout(300);
}
await m.evaluate(() => window.scrollTo(0, 1400));
await m.waitForTimeout(200);
await m.evaluate(() => window.scrollTo(0, 1800));
await m.waitForTimeout(700);
ok('mobile: header hides on scroll down', (await headerState(m)).hidden);
await m.evaluate(() => window.scrollTo(0, 1600));
await m.waitForTimeout(700);
ok('mobile: header comes back on scroll up', !(await headerState(m)).hidden);
await m.click('[data-nav-toggle]');
await m.waitForTimeout(200);
await m.evaluate(() => window.scrollTo(0, 2400));
await m.waitForTimeout(500);
ok('mobile: header stays put while the menu is open', !(await headerState(m)).hidden);
await m.click('[data-nav-toggle]');


/* ---------------------------------------------------------------------------
   Mobile-native moments (mobile-motion.ts): the hero's phone layout and
   touch spotlight, the Selected Work carousel, and on the Rally study the
   page scroller's thumb-scrolled window, the swipeable step viewers and eras,
   and the reading pill. Plus no sideways scroll at the common phone widths.
   ------------------------------------------------------------------------ */

{
  const mp = await mc.newPage();
  const mErr = [];
  mp.on('pageerror', (e) => mErr.push(String(e)));
  await mp.goto(`${BASE}/`, { waitUntil: 'load' });
  await mp.waitForTimeout(1800);

  const hero = await mp.evaluate(() => {
    const h = document.querySelector('[data-hero]').getBoundingClientRect();
    const t = document.querySelector('[data-hero-title]').getBoundingClientRect();
    const cue = document.querySelector('[data-hero-cue-link]').getBoundingClientRect();
    return { titleTop: t.top - h.top, heroH: h.height, vh: innerHeight, cueInHero: cue.bottom <= h.bottom && cue.top > h.top + h.height / 2 };
  });
  /* The phone hero is sized by its content —
     the name starts near the top, and the hero ends under the actions, so
     no screen-tall frame with empty ground above the type. */
  ok(
    'mobile: hero is a content-height poster — name near the top, cue beside the actions',
    hero.titleTop < 80 && hero.heroH < hero.vh * 0.75 && hero.cueInHero,
    JSON.stringify(hero),
  );

  /* Round 3: on a phone the light drifts through the code on its own, comes
     to a finger (a little above it) and drifts on again after the finger
     lifts (heroTouch, mobile-motion.ts). */
  const spot = () =>
    mp.evaluate(() => {
      const f = document.querySelector('[data-code-field]');
      return {
        layer: !!f.querySelector('[data-cf-layer="touch"]'),
        x: parseFloat(f.style.getPropertyValue('--cf-x')),
        y: parseFloat(f.style.getPropertyValue('--cf-y')),
        glow: parseFloat(f.querySelector('[data-cf-layer="touch"]')?.style.opacity ?? '0'),
      };
    });
  const d0 = await spot();
  await mp.waitForTimeout(1200);
  const d1 = await spot();
  ok(
    'mobile: the hero light drifts through the code on its own',
    d0.layer && d1.glow > 0.2 && Math.hypot(d1.x - d0.x, d1.y - d0.y) > 4,
    JSON.stringify({ d0, d1 }),
  );
  const cdp = await mc.newCDPSession(mp);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 60, y: 300 }] });
  await mp.waitForTimeout(700);
  const lit = await spot();
  const box = await mp.evaluate(() => document.querySelector('[data-code-field]').getBoundingClientRect().top);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mp.waitForTimeout(2600);
  const after = await spot();
  ok(
    'mobile: a finger on the hero brings the light to it; lifting it, the light drifts on',
    Math.abs(lit.x - 60) < 12 && Math.abs(lit.y - (300 - box - 48)) < 12 && lit.glow > 0.9 && Math.hypot(after.x - lit.x, after.y - lit.y) > 8,
    JSON.stringify({ lit, after }),
  );

  await mp.evaluate(() => document.querySelector('[data-work-track]').scrollIntoView({ block: 'center' }));
  await mp.waitForTimeout(1600);
  const car = await mp.evaluate(async () => {
    const t = document.querySelector('[data-work-track]');
    const cs = getComputedStyle(t);
    const count = () => document.querySelector('[data-work-count]').textContent;
    const out = { display: cs.display, snap: cs.scrollSnapType, overflow: cs.overflowX, start: count() };
    document.querySelector('[data-work-next]').click();
    await new Promise((r) => setTimeout(r, 900));
    const cards = [...t.querySelectorAll('[data-work-card]')];
    out.afterNext = count();
    out.snapped = Math.abs(t.scrollLeft - (cards[1].offsetLeft - t.offsetLeft - parseFloat(cs.scrollPaddingInlineStart))) < 3;
    /* A swipe, as the browser would end one: straight onto the third card. */
    t.scrollTo({ left: cards[2].offsetLeft - t.offsetLeft - parseFloat(cs.scrollPaddingInlineStart), behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 300));
    out.afterSwipe = count();
    out.prevEnabled = !document.querySelector('[data-work-prev]').disabled;
    return out;
  });
  ok('mobile: Selected work is a snapping horizontal carousel', car.display === 'flex' && /x/.test(car.snap) && car.overflow === 'auto', JSON.stringify(car));
  ok('mobile: carousel Next lands on card 2 and the counter follows a swipe', car.start === '1' && car.afterNext === '2' && car.snapped && car.afterSwipe === '3' && car.prevEnabled, JSON.stringify(car));
  ok('mobile: the carousel stays inside the page', await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  /* Studies open on the quick overview; the scroller, step viewers and eras
     are in the full case study. */
  await mp.goto(`${BASE}/work/rally-trailer/?view=full`, { waitUntil: 'load' });
  await mp.waitForTimeout(1800);

  const ps = await mp.evaluate(async () => {
    const run = document.querySelector('[data-ps-run]');
    const view = run.querySelector('[data-ps-view]');
    run.scrollIntoView({ block: 'start' });
    await new Promise((r) => setTimeout(r, 400));
    const img = view.querySelector('img');
    if (img && !img.complete) await new Promise((r) => img.addEventListener('load', r, { once: true }));
    const cs = getComputedStyle(view);
    const active = () => [...run.querySelectorAll('[data-ps-body]')].findIndex((b) => b.classList.contains('is-active'));
    const out = { overflow: cs.overflowY, scrolls: view.scrollHeight > view.clientHeight + 100, first: active() };
    view.scrollTop = view.scrollHeight;
    await new Promise((r) => setTimeout(r, 300));
    out.last = active();
    out.notes = run.querySelectorAll('[data-ps-body]').length;
    out.shown = getComputedStyle(run.querySelector('[data-ps-body].is-active')).visibility;
    return out;
  });
  ok('mobile: page scroller window scrolls under the thumb', ps.overflow === 'auto' && ps.scrolls, JSON.stringify(ps));
  ok('mobile: page scroller note follows the markers as the window scrolls', ps.first === 0 && ps.last === ps.notes - 1 && ps.shown === 'visible', JSON.stringify(ps));

  const sv = await mp.evaluate(async () => {
    const v = document.querySelector('[data-viewer]');
    const track = v.querySelector('.sv-panels');
    v.scrollIntoView({ block: 'start' });
    const sel = () => [...v.querySelectorAll('[data-viewer-tab]')].findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const panels = [...v.querySelectorAll('[data-viewer-panel]')];
    const out = { snap: getComputedStyle(track).scrollSnapType, start: sel() };
    track.scrollTo({ left: panels[2].offsetLeft - track.offsetLeft, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 400));
    out.afterSwipe = sel();
    v.querySelectorAll('[data-viewer-tab]')[0].click();
    await new Promise((r) => setTimeout(r, 1000));
    out.trackBack = Math.abs(track.scrollLeft) < 3;
    v.querySelector('[data-viewer-panel].is-active .sv-media').click();
    await new Promise((r) => setTimeout(r, 1000));
    out.afterTap = sel();
    out.height = Math.abs(track.offsetHeight - panels[out.afterTap].offsetHeight) < 3;
    return out;
  });
  ok('mobile: step viewer swipes, and tabs and the track stay in step', /x/.test(sv.snap) && sv.start === 0 && sv.afterSwipe === 2 && sv.trackBack, JSON.stringify(sv));
  ok('mobile: tapping a step\'s screenshot goes to the next; track fits the step', sv.afterTap === 1 && sv.height, JSON.stringify(sv));

  const er = await mp.evaluate(async () => {
    const root = document.querySelector('[data-eras]');
    root.scrollIntoView({ block: 'start' });
    const track = root.querySelector('[data-er-track]');
    const out = { scrub: getComputedStyle(root.querySelector('[data-er-scrub]')).position };
    root.querySelector('[data-er-year="2"]').click();
    await new Promise((r) => setTimeout(r, 1200));
    const item = track.querySelectorAll('[data-er-item]')[2];
    const pad = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0;
    out.atEnd = Math.abs(track.scrollLeft - (item.offsetLeft - track.offsetLeft - pad)) < 3;
    out.current = root.querySelector('[data-er-year][aria-current="true"]')?.dataset.erYear;
    return out;
  });
  ok('mobile: eras swipe, and the sticky year scrubber jumps between them', er.scrub === 'sticky' && er.atEnd && er.current === '2', JSON.stringify(er));

  const pill = await mp.evaluate(async () => {
    /* Each step waits for the state it expects (or gives up after 3s), not
       for a fixed time. */
    const until = (test) =>
      new Promise((r) => {
        const t0 = performance.now();
        const tick = () => (test() || performance.now() - t0 > 3000 ? r(test()) : requestAnimationFrame(tick));
        tick();
      });
    const el = document.querySelector('[data-cs-pill]');
    const role = document.querySelector('#role');
    /* Down into My role: the pill tucks away while scrolling down... */
    /* The pill reads the scroll once per frame; let it see each position. */
    const frames = (n) => new Promise((r) => {
      const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step));
      step();
    });
    window.scrollTo(0, role.offsetTop);
    await frames(3);
    await until(() => el.classList.contains('is-shown'));
    window.scrollTo(0, role.offsetTop + 300);
    await frames(3);
    const tuckedDown = await until(() => el.classList.contains('is-tucked'));
    /* ...and comes back on the way up. */
    window.scrollTo(0, role.offsetTop + 100);
    await until(() => el.classList.contains('is-shown') && !el.classList.contains('is-tucked'));
    await until(() => /role/i.test(el.querySelector('[data-cs-pill-label]').textContent));
    const out = { tuckedDown, shown: el.classList.contains('is-shown') && !el.classList.contains('is-tucked'), label: el.querySelector('[data-cs-pill-label]').textContent };
    el.querySelector('[data-cs-pill-btn]').click();
    await new Promise((r) => setTimeout(r, 300));
    const links = el.querySelectorAll('.cs-pill__link');
    out.links = links.length;
    const target = [...links].find((a) => /hard problem/i.test(a.textContent)) ?? links[links.length - 1];
    out.target = target.getAttribute('href');
    target.click();
    out.closed = await until(() => el.querySelector('[data-cs-pill-sheet]').hidden);
    /* It lands just below the bar: at its scroll-margin-top, not at 0. */
    const landAt = parseFloat(getComputedStyle(document.querySelector(out.target)).scrollMarginTop) || 0;
    out.landed = await until(() => Math.abs(document.querySelector(out.target).getBoundingClientRect().top - landAt) < 40);
    out.landAt = landAt;
    return out;
  });
  ok('mobile: reading pill tucks on the way down, shows the section on the way up, and jumps', pill.tuckedDown && pill.shown && /role/i.test(pill.label) && pill.links >= 5 && pill.closed && pill.landed, JSON.stringify(pill));
  ok('mobile: no page errors on the mobile pages', mErr.length === 0, mErr.join(' | '));
  await mp.close();
}

for (const width of [360, 375, 390, 430]) {
  const wc = await b.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
  await wc.addInitScript(() => {
    try { sessionStorage.setItem('bj-opened', '1'); } catch {}
  });
  const wp = await wc.newPage();
  const wide = [];
  for (const path of ['/', '/work/', '/work/rally-trailer/', '/about/']) {
    await wp.goto(`${BASE}${path}`, { waitUntil: 'load' });
    await wp.waitForTimeout(900);
    /* Walk the page so everything that arrives on scroll has arrived. */
    const h = await wp.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) {
      await wp.evaluate((y) => window.scrollTo(0, y), y);
      await wp.waitForTimeout(60);
    }
    const sw = await wp.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (sw[0] > width + 1 || sw[1] > width + 1) wide.push(`${path} ${sw[0]}`);
  }
  ok(`mobile: no sideways scroll at ${width}px`, wide.length === 0, wide.join(', '));
  await wc.close();
}


/* ---------------------------------------------------------------------------
   Header overlay menu (MenuOverlay.astro, Nav.astro, header-motion.ts).
   Opens and closes from the bar's Menu button at every width; Esc closes;
   focus moves in, is trapped in the header, and comes back to the button;
   the page behind is inert and scroll-locked while it's up and released
   after; navigating from it leaves a clean page; reduced motion shows it
   instantly with no cursor preview.
   ------------------------------------------------------------------------ */

const menuState = (page) =>
  page.evaluate(() => {
    const t = document.querySelector('[data-nav-toggle]');
    const menu = document.querySelector('[data-menu]');
    const header = document.querySelector('[data-nav]');
    const active = document.activeElement;
    return {
      expanded: t?.getAttribute('aria-expanded'),
      controls: t?.getAttribute('aria-controls'),
      controlsMenu: Boolean(menu && t?.getAttribute('aria-controls') === menu.id),
      hidden: menu?.hidden ?? true,
      shown: Boolean(menu && !menu.hidden && menu.getBoundingClientRect().height >= window.innerHeight - 1),
      clip: menu ? getComputedStyle(menu).clipPath : '',
      focusInMenu: Boolean(active && menu?.contains(active)),
      focusInHeader: Boolean(active && header?.contains(active)),
      focusOnToggle: active === t,
      overflow: document.documentElement.style.overflow,
      mainInert: Boolean(document.querySelector('main')?.inert),
      inertCount: document.querySelectorAll('[inert]').length,
      lenisStopped: Boolean(window.__motion?.lenis?.isStopped),
      headerHidden: Boolean(header?.hasAttribute('data-hidden')),
      words: [...document.querySelectorAll('[data-menu] [data-menu-word]')].map((w) => {
        const r = w.getBoundingClientRect();
        const m = w.closest('.menu__mask').getBoundingClientRect();
        return r.top >= m.top - 2 && r.bottom <= m.bottom + 2;
      }),
    };
  });

{
  const mcx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await mcx.addInitScript(() => {
    try { sessionStorage.setItem('bj-opened', '1'); } catch {}
  });
  const mp = await mcx.newPage();
  const menuErrs = [];
  const menu404 = { count: 0 };
  mp.on('response', (r) => {
    if (r.status() === 404 && new URL(r.url()).pathname.startsWith('/twilight-trekkers')) menu404.count += 1;
  });
  mp.on('pageerror', (e) => menuErrs.push(String(e)));
  mp.on('console', (msg) => msg.type() === 'error' && menuErrs.push(msg.text()));
  await mp.goto(`${BASE}/`, { waitUntil: 'load' });
  await mp.waitForTimeout(1500);

  const m0 = await menuState(mp);
  ok('menu: closed on load, button controls the menu', m0.expanded === 'false' && m0.hidden && m0.controlsMenu, JSON.stringify({ e: m0.expanded, h: m0.hidden, c: m0.controls }));
  const triggers0 = await mp.evaluate(() => window.__motion?.triggerCount ?? -1);

  /* Part-way down, with the bar brought back by a small scroll up (a hidden
     bar can't be clicked, and Playwright would scroll the page to reach it). */
  const inert0 = m0.inertCount;
  await scrollToY(mp, 1400);
  await mp.waitForTimeout(300);
  await mp.mouse.move(700, 500);
  await mp.mouse.wheel(0, -120);
  await mp.waitForTimeout(900);
  const yLocked = await mp.evaluate(() => window.scrollY);
  await mp.click('[data-nav-toggle]');
  await mp.waitForTimeout(250);
  const mMid = await menuState(mp);
  ok('menu: opens — expanded, visible, focus moved into it', mMid.expanded === 'true' && !mMid.hidden && mMid.focusInMenu, JSON.stringify({ e: mMid.expanded, f: mMid.focusInMenu }));
  ok('menu: page behind is inert and scroll-locked, and stays where it was', mMid.mainInert && mMid.overflow === 'hidden' && mMid.lenisStopped && Math.abs((await mp.evaluate(() => window.scrollY)) - yLocked) < 2);
  await mp.waitForTimeout(1300);
  const mOpen = await menuState(mp);
  ok('menu: settles fully open with every word out of its mask', mOpen.shown && mOpen.clip === 'none' && mOpen.words.length >= 3 && mOpen.words.every(Boolean), `clip ${mOpen.clip}, words ${mOpen.words.filter(Boolean).length}/${mOpen.words.length}`);
  await mp.mouse.wheel(0, 600);
  await mp.waitForTimeout(500);
  ok('menu: wheel does not scroll the page behind', Math.abs((await mp.evaluate(() => window.scrollY)) - yLocked) < 2);
  ok('menu: header stays shown while it is open', !(await menuState(mp)).headerHidden);

  /* Focus trap: tab well past the number of stops, both ways. */
  let escaped = 0;
  for (let i = 0; i < 16; i += 1) {
    await mp.keyboard.press('Tab');
    if (!(await menuState(mp)).focusInHeader) escaped += 1;
  }
  for (let i = 0; i < 16; i += 1) {
    await mp.keyboard.press('Shift+Tab');
    if (!(await menuState(mp)).focusInHeader) escaped += 1;
  }
  ok('menu: focus is trapped in the header (Tab and Shift+Tab)', escaped === 0, `${escaped} escapes`);

  /* Cursor preview on a fine pointer. */
  const sub = await mp.locator('[data-menu] .menu__sub').first().boundingBox();
  if (sub) {
    await mp.mouse.move(sub.x + 20, sub.y + sub.height / 2, { steps: 4 });
    await mp.waitForTimeout(600);
    const pv = await mp.evaluate(() => {
      const el = document.querySelector('[data-menu-preview]');
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const word = document.querySelector('[data-menu] .menu__sub [data-menu-word]').getBoundingClientRect();
      const overlaps = r.left < word.right && r.right > word.left && r.top < word.bottom && r.bottom > word.top;
      return { vis: cs.visibility, op: Number(cs.opacity), clear: !overlaps };
    });
    ok('menu: hover shows the preview beside the word, not over it', pv.vis === 'visible' && pv.op > 0.8 && pv.clear, JSON.stringify(pv));
  }

  await mp.keyboard.press('Escape');
  await mp.waitForTimeout(150);
  const mEsc = await menuState(mp);
  ok('menu: Esc closes it and returns focus to the button', mEsc.expanded === 'false' && mEsc.focusOnToggle, JSON.stringify({ e: mEsc.expanded, f: mEsc.focusOnToggle }));
  await mp.waitForTimeout(900);
  const mClosed = await menuState(mp);
  ok('menu: fully hidden after closing; lock, inert and Lenis released', mClosed.hidden && mClosed.overflow === '' && mClosed.inertCount === inert0 && !mClosed.lenisStopped, JSON.stringify({ h: mClosed.hidden, o: mClosed.overflow, i: mClosed.inertCount, l: mClosed.lenisStopped }));
  await mp.mouse.move(700, 500);
  await mp.mouse.wheel(0, 500);
  await mp.waitForTimeout(800);
  ok('menu: page scrolls again after closing', (await mp.evaluate(() => window.scrollY)) > yLocked + 50);
  await mp.mouse.wheel(0, -200);
  await mp.waitForTimeout(900);

  /* The button again, and the close button closes it. */
  await mp.click('[data-nav-toggle]');
  await mp.waitForTimeout(300);
  await mp.click('[data-nav-toggle]');
  await mp.waitForTimeout(1000);
  const mBtn = await menuState(mp);
  ok('menu: the Close button closes it mid-open', mBtn.expanded === 'false' && mBtn.hidden && mBtn.overflow === '');

  /* Navigating from it. */
  await mp.click('[data-nav-toggle]');
  await mp.waitForTimeout(900);
  await mp.click('[data-menu] a[href="/about/"]');
  await mp.waitForURL('**/about/');
  await mp.waitForTimeout(1400);
  const mNav = await menuState(mp);
  ok('menu: closes on navigation and leaves the new page clean', mNav.expanded === 'false' && mNav.hidden && mNav.overflow === '' && mNav.inertCount === 0 && !mNav.lenisStopped, JSON.stringify({ e: mNav.expanded, h: mNav.hidden, o: mNav.overflow, i: mNav.inertCount, l: mNav.lenisStopped }));
  ok('menu: marks the current page', await mp.evaluate(() =>
    document.querySelector('[data-menu] a[href="/about/"]')?.getAttribute('aria-current') === 'page'));

  await mp.click('header a[href="/"]');
  await mp.waitForTimeout(1600);
  for (let i = 0; i < 3; i += 1) {
    await mp.click('[data-nav-toggle]');
    await mp.waitForTimeout(500);
    await mp.keyboard.press('Escape');
    await mp.waitForTimeout(700);
  }
  const triggers1 = await mp.evaluate(() => window.__motion?.triggerCount ?? -1);
  ok('menu: trigger count flat across open/close and navigation', triggers0 === triggers1, `${triggers0} -> ${triggers1}`);
  ok('menu: no console errors', realErrors(menuErrs, menu404.count).length === 0, realErrors(menuErrs, menu404.count).join(' | ') || undefined);
  await mcx.close();
}

{
  const rcx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rp = await rcx.newPage();
  await rp.goto(`${BASE}/`, { waitUntil: 'load' });
  await rp.waitForTimeout(1000);
  const rInert0 = (await menuState(rp)).inertCount;
  await rp.click('[data-nav-toggle]');
  await rp.waitForTimeout(60);
  const rOpen = await menuState(rp);
  ok('reduced motion: menu appears at once, words in place', rOpen.shown && rOpen.clip === 'none' && rOpen.words.every(Boolean) && rOpen.focusInMenu, JSON.stringify({ s: rOpen.shown, c: rOpen.clip }));
  ok('reduced motion: no cursor preview', await rp.evaluate(() =>
    getComputedStyle(document.querySelector('[data-menu-preview]')).display === 'none'));
  await rp.keyboard.press('Escape');
  await rp.waitForTimeout(60);
  const rClosed = await menuState(rp);
  ok('reduced motion: Esc hides it at once and releases the page', rClosed.hidden && rClosed.focusOnToggle && rClosed.overflow === '' && rClosed.inertCount === rInert0);
  await rcx.close();
}

{
  const pcx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await pcx.addInitScript(() => {
    try { sessionStorage.setItem('bj-opened', '1'); } catch {}
  });
  const pp = await pcx.newPage();
  await pp.goto(`${BASE}/`, { waitUntil: 'load' });
  await pp.waitForTimeout(1500);
  const pInert0 = (await menuState(pp)).inertCount;
  await pp.tap('[data-nav-toggle]');
  await pp.waitForTimeout(1500);
  const pOpen = await menuState(pp);
  const pFit = await pp.evaluate(() => {
    const menu = document.querySelector('[data-menu]');
    const lum = document.querySelector('[data-lum-toggle]')?.getBoundingClientRect();
    const links = [...menu.querySelectorAll('a')].map((a) => a.getBoundingClientRect());
    return {
      noOverflow: menu.scrollWidth <= window.innerWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1,
      targets: links.every((r) => r.height >= 44 || r.width >= 200),
      lum: Boolean(lum && lum.width >= 44 && lum.height >= 44),
      preview: getComputedStyle(menu.querySelector('[data-menu-preview]')).display,
    };
  });
  ok('mobile: menu opens full screen with no sideways overflow', pOpen.shown && pFit.noOverflow, JSON.stringify(pFit));
  ok('mobile: menu links and the brightness button keep 44px targets', pFit.targets && pFit.lum);
  ok('mobile: no cursor preview on touch', pFit.preview === 'none');
  await pp.tap('[data-nav-toggle]');
  await pp.waitForTimeout(1000);
  const pClosed = await menuState(pp);
  ok('mobile: menu closes and releases the page', pClosed.hidden && pClosed.overflow === '' && pClosed.inertCount === pInert0);

  /* Thumb reach: the words sit in the lower part of the screen and a round
     Close waits in the bottom-right corner; it closes like the bar's. */
  await pp.tap('[data-nav-toggle]');
  await pp.waitForTimeout(1500);
  const thumb = await pp.evaluate(() => {
    const items = [...document.querySelectorAll('[data-menu] .menu__item')].map((a) => a.getBoundingClientRect());
    const close = document.querySelector('[data-menu-close]').getBoundingClientRect();
    return {
      lastItemBottom: Math.round(items[items.length - 1].bottom),
      vh: innerHeight,
      close: [Math.round(close.width), Math.round(close.height), Math.round(close.right), Math.round(close.bottom)],
    };
  });
  ok('mobile: menu words sit low, round Close in the thumb corner',
    thumb.lastItemBottom > thumb.vh * 0.7 && thumb.close[0] >= 44 && thumb.close[1] >= 44 && thumb.close[2] > 340 && thumb.close[3] > thumb.vh * 0.85,
    JSON.stringify(thumb));
  await pp.tap('[data-menu-close]');
  await pp.waitForTimeout(1000);
  const pClosed2 = await menuState(pp);
  ok('mobile: the thumb Close closes the menu and releases the page', pClosed2.hidden && pClosed2.overflow === '' && pClosed2.inertCount === pInert0);
  await pcx.close();
}


await b.close();
console.log(failures === 0 ? '\nall sequence checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
