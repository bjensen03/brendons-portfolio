/*
  Every image on every built page actually loads.

  Exists because the build now deletes images nothing references
  (scripts/prune-assets.mjs). A pruning step is only safe if something proves it
  never removed an image a page needed — and a broken <img> fails silently: no
  console error, no build error, just an empty box.

  Runs against a production build, not the dev server, because the dev server
  never prunes anything and would pass by definition. Pages come from dist/, so
  a new page is covered without editing this file.
*/
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.VERIFY_URL ?? 'http://localhost:4322';

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });

const pages = walk('dist')
  .filter((f) => f.endsWith('index.html'))
  .map((f) => '/' + path.relative('dist', path.dirname(f)).replace(/\\/g, '/'))
  .map((p) => (p === '/.' || p === '/' ? '/' : p + '/'))
  .sort();

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let failures = 0;
let checked = 0;

for (const route of pages) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });

  /*
    Force every image to load, then wait for each to decode.

    The first version scrolled the page to trigger lazy loading and reported 51
    broken images. None were broken. Lenis smooth-scroll aside, the horizontal
    drag strip holds images off to the right that vertical scrolling can never
    bring into view, so they never requested — and a lazy image that hasn't
    requested yet looks identical to a broken one. The question this suite
    exists to answer is whether every file a page names is actually there and
    decodable, so it asks that directly instead of depending on scroll.
  */
  const broken = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('img')];
    imgs.forEach((img) => img.setAttribute('loading', 'eager'));
    const results = await Promise.all(
      imgs.map(async (img) => {
        try {
          await Promise.race([
            img.decode(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
          ]);
          return img.naturalWidth > 0 ? null : img.currentSrc || img.getAttribute('src');
        } catch {
          return img.currentSrc || img.getAttribute('src');
        }
      }),
    );
    return results.filter(Boolean);
  });
  const count = await page.evaluate(() => document.querySelectorAll('img').length);
  checked += count;

  if (broken.length) {
    failures += broken.length;
    console.log(`  FAIL  ${route} — ${broken.length} of ${count} images broken`);
    broken.slice(0, 3).forEach((src) => console.log(`        ${src}`));
  } else {
    console.log(`  PASS  ${route.padEnd(30)} ${count} images`);
  }
}

await browser.close();
console.log(failures === 0 ? `\nall ${checked} images load across ${pages.length} pages` : `\n${failures} broken images`);
process.exit(failures === 0 ? 0 : 1);
