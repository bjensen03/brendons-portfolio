/*
  Link audit.

  Off-site links open in a new tab (src/lib/links.ts, ExternalLink.astro and
  the rehype plugin for markdown). This crawls the dev server and fails if
  any page breaks the rule:

    - every http(s) link to another origin has target="_blank" and a rel
      containing noopener
    - its accessible name says "opens in a new tab"
    - no internal, mailto: or tel: link has target="_blank" (except a
      same-site PDF, which must then say "opens in a new tab" too)

  It starts from the same page list as verify-contrast and follows every
  same-origin link it finds, so a new page gets checked as soon as anything
  links to it.

    npm run dev
    node scripts/verify-links.mjs
*/

import { chromium } from 'playwright-core';

const BASE = process.env.VERIFY_URL ?? 'http://localhost:4321';
const SEEDS = [
  '/',
  '/work/',
  '/twilight-trekkers/',
  '/about/',
  '/contact/',
  '/work/rally-trailer/',
  '/work/prolook/',
  '/work/all-in/',
  /* Redirects to /work/all-in/ since ALL IN got its own page. */
  '/work/prolook/all-in/',
  '/work/legends/',
  '/work/ux-feit-electric/',
];
const MAX_PAGES = 200;

const origin = new URL(BASE).origin;
const queue = SEEDS.map((p) => new URL(p, BASE).href);
const seen = new Set(queue);

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });

let bad = 0;
let pages = 0;
let externals = 0;
const fail = (path, msg) => {
  bad++;
  console.log(`  FAIL ${path}  ${msg}`);
};

while (queue.length && pages < MAX_PAGES) {
  const url = queue.shift();
  const path = new URL(url).pathname;
  /* Fetch the HTML on its own, outside the browser, before navigating. A
     static build serves redirects as <meta http-equiv="refresh"> pages
     (Astro.redirect in a static build), and the browser follows one as soon
     as it reads it. Reading the body from the page response was racy: once
     the refresh had fired, res.text() came back empty and the target page got
     evaluated under the redirect's path. A separate request never runs the
     refresh, so the check is the same on every run. One retry, because the
     dev server restarts itself on config changes. */
  const get = () => p.request.get(url);
  const pre = await get().catch(() => new Promise((r) => setTimeout(r, 2000)).then(get).catch(() => null));
  if (!pre || !pre.ok()) {
    /* A 404 is a broken internal link, which is worth knowing about too. */
    fail(path, `HTTP ${pre?.status() ?? 'no response'}`);
    continue;
  }
  pages++;

  const queueRedirect = (to) => {
    if (to.origin !== origin) return fail(path, `redirects off-site to ${to.href}`);
    const next = new URL(to.pathname, origin).href;
    console.log(`  redirect ${path} -> ${to.pathname}`);
    if (!seen.has(next)) {
      seen.add(next);
      queue.push(next);
    }
  };

  /* An HTTP redirect (a server that sends a real 301) ends on another URL. */
  if (new URL(pre.url()).pathname !== path) {
    queueRedirect(new URL(pre.url()));
    continue;
  }
  const refresh = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']\s*\d+\s*;\s*url=([^"'>]+)/i.exec(
    await pre.text().catch(() => ''),
  );
  if (refresh) {
    queueRedirect(new URL(refresh[1].trim(), url));
    continue;
  }

  const go = () => p.goto(url, { waitUntil: 'domcontentloaded' });
  const res = await go().catch(() => new Promise((r) => setTimeout(r, 2000)).then(go).catch(() => null));
  if (!res || !res.ok()) {
    fail(path, `HTTP ${res?.status() ?? 'no response'} in the browser`);
    continue;
  }
  /* Belt and braces: if the browser still ended up somewhere else (a
     script redirect, say), don't count that page's links under this path. */
  if (new URL(p.url()).pathname !== path) {
    queueRedirect(new URL(p.url()));
    continue;
  }

  const links = await p.evaluate(() => {
    /* Accessible name, close enough for links: aria-labelledby, then
       aria-label, then the text of everything not aria-hidden (sr-only text
       counts, which is the point) plus img alt. */
    const nameOf = (el) => {
      const by = el.getAttribute('aria-labelledby');
      if (by)
        return by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
      const label = el.getAttribute('aria-label');
      if (label) return label;
      const walk = (n) => {
        if (n.nodeType === Node.TEXT_NODE) return n.textContent;
        if (n.nodeType !== Node.ELEMENT_NODE) return '';
        if (n.getAttribute('aria-hidden') === 'true') return '';
        if (n.tagName === 'IMG') return n.getAttribute('alt') ?? '';
        return [...n.childNodes].map(walk).join('');
      };
      return walk(el).replace(/\s+/g, ' ').trim();
    };
    return [...document.querySelectorAll('a[href]')].map((a) => ({
      href: a.href,
      raw: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel') ?? '',
      name: nameOf(a),
    }));
  });

  for (const l of links) {
    let u;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    const web = u.protocol === 'http:' || u.protocol === 'https:';
    const external = web && u.origin !== origin;
    const tag = `${l.raw} "${l.name.slice(0, 60)}"`;

    if (external) {
      externals++;
      if (l.target !== '_blank') fail(path, `external link without target=_blank: ${tag}`);
      if (!/\bnoopener\b/.test(l.rel)) fail(path, `external link rel lacks noopener ("${l.rel}"): ${tag}`);
      if (!/opens in a new tab/i.test(l.name)) fail(path, `external link name lacks "opens in a new tab": ${tag}`);
    } else {
      /* A same-site document (the résumé PDF) may open in a new tab, as long
         as it says so like an external link does. */
      const doc = web && /\.pdf$/i.test(u.pathname);
      if (l.target === '_blank' && !doc) fail(path, `internal/mailto link opens a new tab: ${tag}`);
      if (doc && l.target === '_blank' && !/opens in a new tab/i.test(l.name)) fail(path, `new-tab document link name lacks "opens in a new tab": ${tag}`);
      if (web) {
        const next = new URL(u.pathname, origin).href;
        if (!seen.has(next) && !/\.[a-z0-9]{2,5}$/i.test(u.pathname)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }
}

await b.close();
console.log(`\n${pages} pages, ${externals} external links checked`);
if (pages >= MAX_PAGES) console.log(`  (stopped at MAX_PAGES=${MAX_PAGES})`);
console.log(bad ? `${bad} problem(s)` : 'all links pass');
process.exit(bad ? 1 : 0);
