/*
  Social share images (og:image / twitter:image) and the touch icon.

    node scripts/og-images.mjs             every card
    node scripts/og-images.mjs --default   only public/og/default.png

  Writes, all 1200 × 630 unless noted:
    public/og/default.png            the site card (home, About, Contact, …)
    public/og/<study>.jpg            one per published study
    public/og/twilight-trekkers-page.jpg   the /twilight-trekkers/ page
    public/apple-touch-icon.png      180 × 180

  Renders an HTML template in Chrome (playwright-core, already a dev
  dependency) with the site's own fonts (the full files in
  src/assets/fonts/source) and his mark, then screenshots it. The PNGs are
  committed, so the production build needs no browser and no new
  dependency. Re-run it when a study's name, kind or screenshot changes, or
  a study is published.

  Each study card shows only that study's own facts: its name, its `kind`
  line, its live address and a capture of its own site. Nothing about other
  studies or a parent company.
*/

import { chromium } from 'playwright-core';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/og');
const STUDIES = join(ROOT, 'src/content/studies');
mkdirSync(OUT, { recursive: true });

const font = (f) => pathToFileURL(join(ROOT, 'src/assets/fonts/source', f)).href;
const mark = readFileSync(join(ROOT, 'src/assets/logo/mark.svg'), 'utf8');
const LINE = 'Full-stack developer';

/* Which capture each card uses, when it isn't the study's
   images/<id>/home-1440x900@2x.webp. `plain` drops the browser frame (a
   composite or a private app with no address to show). */
const SHOT = {
  'leamington-town': { file: 'leamington-town/home-hero.webp' },
  legends: { file: 'legends/site-home-1440x900@2x.webp' },
  'rally-rep': { file: 'rally-rep/home-desktop.webp' },
  'twilight-trekkers': { file: 'twilight-trekkers/home.webp' },
  'meal-planner': { file: 'meal-planner/composites/home-phones-1440x900@2x.webp', plain: true },
};

/* The /twilight-trekkers/ page card: one of their Best-tier photographs. */
const TWILIGHT_PHOTO = {
  file: join(ROOT, 'src/content/projects/images/twilight-trekkers/library/canyons/zion-subway-01.webp'),
  focus: '50% 68%',
};

/* Real lines from the home page's code field (src/components/home/snippets.ts). */
const CODE = `// Lives in functions.php, where plugin updates can't undo it.
add_action('template_redirect', function () {
    if (is_user_logged_in() && is_page_template('templates/dealer-portal.php')) {
        // Keep LiteSpeed from caching the dealer portal.
        do_action('litespeed_control_set_nocache', 'dealer portal');
    }
});`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const css = `
@font-face { font-family: Archivo; src: url(${font('Archivo-Variable.woff2')}) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: Geist; src: url(${font('Geist-Variable.woff2')}) format('woff2'); font-weight: 100 900; }
@font-face { font-family: GeistMono; src: url(${font('GeistMono-Variable.woff2')}) format('woff2'); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: #1a1a1a; color: #fff; -webkit-font-smoothing: antialiased; }
.og { position: relative; width: 1200px; height: 630px; overflow: hidden; }
.mark { position: absolute; color: #fff; }
.mark svg { display: block; width: 100%; height: auto; }
.display { font-family: Archivo; font-weight: 900; font-stretch: 115%; text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.86; }
.body { font-family: Geist; }
.muted { color: #d5d2cd; }
.bar { background: #c2a27c; height: 8px; border-radius: 2px; }
.code { position: absolute; font-family: GeistMono; font-size: 17px; line-height: 1.75; white-space: pre; color: #fff; opacity: 0.1;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 35%); }
.frame { position: absolute; border-radius: 14px; overflow: hidden; background: #2a2a28; box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.6); border: 1px solid #3a3a37; }
.frame__bar { height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 16px; }
.frame__bar i { width: 11px; height: 11px; border-radius: 50%; background: #4a4946; }
.frame__url { margin-left: 18px; padding: 5px 14px; border-radius: 6px; background: #1f1f1e; font-family: Geist; font-size: 15px; color: #a19d96; }
.frame img, .plain img { display: block; width: 100%; }
.plain { position: absolute; border-radius: 14px; overflow: hidden; }
.photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.scrim { position: absolute; inset: 0; background: linear-gradient(to top, #1a1a1a 0%, rgb(26 26 26 / 0.85) 28%, rgb(26 26 26 / 0.2) 58%, transparent 75%); }
`;

const page = (inner) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="og">${inner}</div></body></html>`;

const defaultCard = () =>
  page(`
  <div class="code" style="left: 430px; top: 70px;">${esc(CODE)}</div>
  <div class="mark" style="left: 64px; top: 60px; width: 54px;">${mark}</div>
  <div class="display" style="position: absolute; left: 60px; top: 214px; font-size: 156px;">Brendon<br>Jensen</div>
  <div class="bar" style="position: absolute; left: 64px; top: 506px; width: 96px;"></div>
  <p class="body" style="position: absolute; left: 192px; top: 490px; font-size: 34px; font-weight: 500;">${esc(LINE)}</p>
  <p class="body muted" style="position: absolute; left: 64px; bottom: 44px; font-size: 24px;">brendonjensen.dev</p>
`);

const studyCard = ({ name, kind, img, url, plain }) =>
  page(`
  <div class="mark" style="left: 64px; top: 60px; width: 40px;">${mark}</div>
  <p class="body muted" style="position: absolute; left: 124px; top: 64px; font-size: 22px; line-height: 40px;">Brendon Jensen</p>
  <div id="name" class="display" style="position: absolute; left: 62px; top: 168px; width: 500px; font-size: 76px;">${esc(name)}</div>
  <div id="bar" class="bar" style="position: absolute; left: 64px; width: 72px;"></div>
  <p id="kind" class="body" style="position: absolute; left: 64px; width: 480px; font-size: 26px; line-height: 1.3; font-weight: 500;">${esc(kind)}</p>
  <p class="body muted" style="position: absolute; left: 64px; bottom: 44px; font-size: 22px;">brendonjensen.dev</p>
  ${
    plain || !url
      ? `<div class="plain" style="left: 600px; top: 108px; width: 760px;"><img src="${img}"></div>`
      : `<div class="frame" style="left: 600px; top: 108px; width: 760px;">
           <div class="frame__bar"><i></i><i></i><i></i><span class="frame__url">${esc(url)}</span></div>
           <img src="${img}">
         </div>`
  }
`);

const photoCard = ({ name, line, img, focus }) =>
  page(`
  <img class="photo" src="${img}" style="object-position: ${focus};">
  <div class="scrim"></div>
  <div class="mark" style="left: 64px; top: 60px; width: 40px;">${mark}</div>
  <div class="display" style="position: absolute; left: 60px; bottom: 150px; font-size: 104px;">${esc(name)}</div>
  <div class="bar" style="position: absolute; left: 64px; bottom: 104px; width: 72px;"></div>
  <p class="body" style="position: absolute; left: 164px; bottom: 90px; font-size: 28px; font-weight: 500;">${esc(line)}</p>
  <p class="body muted" style="position: absolute; left: 64px; bottom: 40px; font-size: 22px;">brendonjensen.dev</p>
`);

/* The name: the largest size (76 → 44px) at which it fits 500px wide in at
   most three lines; the name, bar and kind line are then centred as one
   block between the byline and the domain. */
const fit = () => {
  const n = document.getElementById('name');
  if (!n) return;
  let size = 76;
  const lh = () => parseFloat(getComputedStyle(n).lineHeight);
  while (size > 44 && (n.scrollWidth > 500 || n.offsetHeight > lh() * 3 + 1)) {
    size -= 2;
    n.style.fontSize = `${size}px`;
  }
  const kind = document.getElementById('kind');
  const block = n.offsetHeight + 58 + kind.offsetHeight;
  const top = Math.round(110 + (450 - block) / 2);
  n.style.top = `${top}px`;
  document.getElementById('bar').style.top = `${top + n.offsetHeight + 30}px`;
  kind.style.top = `${top + n.offsetHeight + 58}px`;
};

const studies = () =>
  readdirSync(STUDIES)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => ({ id: f.replace(/\.yaml$/, ''), data: parse(readFileSync(join(STUDIES, f), 'utf8')) }))
    .filter(({ data }) => data.approved)
    .map(({ id, data }) => {
      const shot = SHOT[id];
      const file = shot ? join(STUDIES, 'images', shot.file) : join(STUDIES, 'images', id, 'home-1440x900@2x.webp');
      if (!existsSync(file)) throw new Error(`No capture for ${id}: ${file}`);
      const url = String(data.live ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      return { id, name: data.name, kind: data.kind ?? '', img: pathToFileURL(file).href, url, plain: shot?.plain };
    });

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const tmp = join(OUT, '.render.html');

/* PNG for the type-only default card (crisp, ~60 KB); JPEG at quality 88
   for cards with a photo or screenshot (~100–250 KB instead of up to 1 MB,
   comfortably under every network's size limit). */
const shoot = async (html, file) => {
  writeFileSync(tmp, html);
  await p.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(fit);
  const jpeg = file.endsWith('.jpg');
  await p.screenshot({
    path: join(OUT, file),
    clip: { x: 0, y: 0, width: 1200, height: 630 },
    ...(jpeg ? { type: 'jpeg', quality: 88 } : {}),
  });
  console.log(`public/og/${file}`);
};

await shoot(defaultCard(), 'default.png');
const onlyDefault = process.argv.includes('--default');
if (!onlyDefault) for (const s of studies()) await shoot(studyCard(s), `${s.id}.jpg`);
if (!onlyDefault) await shoot(
  photoCard({
    name: 'The Twilight Trekkers',
    line: 'Travel and adventure photos, reels and stories',
    img: pathToFileURL(TWILIGHT_PHOTO.file).href,
    focus: TWILIGHT_PHOTO.focus,
  }),
  'twilight-trekkers-page.jpg',
);

/* Touch icon: the mark in white on graphite. iOS rounds the corners. */
if (!onlyDefault) {
  await p.setViewportSize({ width: 180, height: 180 });
  writeFileSync(
    tmp,
    `<!doctype html><style>html,body{margin:0;width:180px;height:180px;background:#1a1a1a;display:grid;place-items:center;color:#fff}svg{width:96px;height:auto;display:block}</style>${mark}`,
  );
  await p.goto(pathToFileURL(tmp).href);
  await p.screenshot({ path: join(ROOT, 'public/apple-touch-icon.png') });
  console.log('public/apple-touch-icon.png');
}

rmSync(tmp, { force: true });
await browser.close();
