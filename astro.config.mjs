// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';
import { createHash as digest } from 'node:crypto';
import { unified } from '@astrojs/markdown-remark';
import { rehypeExternalLinks } from './src/lib/links.ts';

// The live origin. Vercel serves the site on www and 308s the apex
// (brendonjensen.dev) to it, so canonicals, og:url, the sitemap and
// robots.txt all use www — a canonical on the apex would point search
// engines at a redirect. src/config.ts SITE.url is only a fallback now.
const SITE = 'https://www.brendonjensen.dev';

/* Kept out of the sitemap: old addresses that only redirect. */
const REDIRECTS = ['/work/prolook/all-in/'];
const inSitemap = (/** @type {string} */ page) => !REDIRECTS.includes(new URL(page).pathname);

/*
  Dev only (`apply: 'serve'`): the /_image endpoint, made fast and fresh.

  Freshness (BUG-004): /_image in dev has no content hash in its URL, so
  Astro's year-long cache-control kept a replaced image stale. This sends
  no-cache with an ETag from the source file's mtime and size instead, so an
  unchanged image is a quick 304 and a changed one reloads.

  Speed: Astro's dev endpoint resizes and encodes on every request and keeps
  nothing, 0.2–0.5 s per image (AVIF is the slow part). A case study asks
  for dozens at once, and on a busy machine they came back after the reader
  had scrolled past (blank boxes). So:
    - Every encoded image is kept on disk in node_modules/.astro/dev-images,
      keyed by the request URL plus the source file's mtime and size. A hit
      is a file read; it survives dev restarts; editing the source changes
      the key, so the new image is encoded and shown at once.
    - At most DEV_IMAGE_ENCODES encodes run at a time; the rest wait their
      turn. sharp runs on Node's small libuv thread pool, so forty encodes
      at once also starved the file reads that serve page HTML and modules.

  The static build writes hashed /_astro files and never touches any of this.
*/
const DEV_IMAGE_ENCODES = 3;
const DEV_IMAGE_DIR = path.join(process.cwd(), 'node_modules/.astro/dev-images');

function devImages() {
  let running = 0;
  /** @type {(() => void)[]} */
  const waiting = [];
  const acquire = () =>
    new Promise((resolve) => {
      if (running < DEV_IMAGE_ENCODES) {
        running += 1;
        resolve(undefined);
      } else waiting.push(() => resolve(undefined));
    });
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  };

  return {
    name: 'dev-images',
    apply: /** @type {const} */ ('serve'),
    /** @param {import('vite').ViteDevServer} server */
    configureServer(server) {
      fs.mkdirSync(DEV_IMAGE_DIR, { recursive: true });
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/_image')) return next();
        const href = new URL(req.url, 'http://localhost').searchParams.get('href') ?? '';
        const src = decodeURIComponent(href.split('?')[0]);
        const file = src.startsWith('/@fs/') ? src.slice(4) : path.join(process.cwd(), 'public', src);
        let st;
        try {
          st = fs.statSync(file);
        } catch {
          return next();
        }
        const version = `${st.mtimeMs.toString(36)}-${st.size.toString(36)}`;
        const etag = `W/"${version}-${createHash(req.url)}"`;
        if (req.headers['if-none-match'] === etag) {
          res.statusCode = 304;
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', 'no-cache');
          return res.end();
        }

        const key = digest('sha1').update(`${req.url}|${version}`).digest('hex');
        const body = path.join(DEV_IMAGE_DIR, key);
        const meta = `${body}.type`;
        if (fs.existsSync(body) && fs.existsSync(meta)) {
          res.statusCode = 200;
          res.setHeader('Content-Type', fs.readFileSync(meta, 'utf8'));
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', 'no-cache');
          return res.end(fs.readFileSync(body));
        }

        await acquire();
        /* The browser gave up while this waited (scrolled on, navigated). */
        if (res.destroyed || req.destroyed) {
          release();
          return;
        }
        let released = false;
        const done = () => {
          if (released) return;
          released = true;
          release();
        };
        res.once('finish', done);
        res.once('close', done);

        /* Astro sets its own cache-control and etag later, through setHeader
           or writeHead — overrule both, so the ETag here is the one a
           revalidation is checked against. */
        const ours = /** @type {Record<string, string>} */ ({ 'cache-control': 'no-cache', etag });
        const setHeader = res.setHeader.bind(res);
        res.setHeader = (name, value) => setHeader(name, ours[name.toLowerCase()] ?? value);
        const writeHead = res.writeHead.bind(res);
        res.writeHead = (/** @type {any[]} */ ...args) => {
          const headers = args.find((a) => a && typeof a === 'object');
          if (headers && !Array.isArray(headers)) {
            for (const k of Object.keys(headers)) if (k.toLowerCase() in ours) delete headers[k];
          }
          setHeader('ETag', etag);
          setHeader('Cache-Control', 'no-cache');
          return /** @type {any} */ (writeHead)(...args);
        };
        setHeader('ETag', etag);
        setHeader('Cache-Control', 'no-cache');

        /* Keep a copy of what Astro sends, and store it once it's complete. */
        /** @type {Buffer[]} */
        const chunks = [];
        const keep = (/** @type {unknown} */ chunk, /** @type {unknown} */ enc) => {
          if (Buffer.isBuffer(chunk)) chunks.push(chunk);
          else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
          else if (typeof chunk === 'string') {
            const encoding = typeof enc === 'string' && Buffer.isEncoding(enc) ? enc : 'utf8';
            chunks.push(Buffer.from(chunk, encoding));
          }
        };
        const write = res.write.bind(res);
        const end = res.end.bind(res);
        res.write = (/** @type {any} */ chunk, /** @type {any[]} */ ...rest) => {
          keep(chunk, rest[0]);
          return /** @type {any} */ (write)(chunk, ...rest);
        };
        res.end = (/** @type {any} */ chunk, /** @type {any[]} */ ...rest) => {
          keep(chunk, rest[0]);
          const type = res.getHeader('content-type');
          if (res.statusCode === 200 && chunks.length && typeof type === 'string' && type.startsWith('image/')) {
            try {
              const tmp = `${body}.${process.pid}.tmp`;
              fs.writeFileSync(tmp, Buffer.concat(chunks));
              fs.writeFileSync(meta, type);
              fs.renameSync(tmp, body);
            } catch {
              /* A cache miss next time is fine. */
            }
          }
          return /** @type {any} */ (end)(chunk, ...rest);
        };
        next();
      });
    },
  };
}

/* Short, stable tag for the transform params (width, height, format), so two
   sizes of the same file don't share an ETag. */
function createHash(/** @type {string} */ s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [mdx(), sitemap({ filter: inSitemap })],

  markdown: {
    /* Off-site links in markdown and MDX prose open in a new tab, the same
       way ExternalLink.astro does it in templates. MDX inherits this.
       Astro 7.4 takes plugins on the processor, not markdown.rehypePlugins. */
    processor: unified({ rehypePlugins: [rehypeExternalLinks] }),
    /*
      Shiki ships with Astro, so code blocks are highlighted at build time and
      cost no client JS. github-dark-default sits closest to the rock surfaces;
      the block's border, padding and radius come from tokens in the page
      styles rather than from the theme.
    */
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: false,
    },
  },

  /*
    Geist (display + body) and Geist Mono (short labels), self-hosted from
    src/assets/fonts. Both are OFL — the licence ships beside them as
    GEIST-OFL.txt. Each is a single variable file covering 100–900, so one
    request per family and the browser never synthesises a bold.

    They live in src/assets rather than public/ on Astro's own advice: a file in
    public/ is copied verbatim into the build as well as processed, so a font
    kept there ships twice.

    Astro emits the @font-face rules, preload links and metric-matched
    fallbacks; global.css maps --font-sans to --font-display/--font-body and
    --font-mono-face to --font-mono.
  */
  fonts: [
    {
      name: 'Geist',
      cssVariable: '--font-sans',
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            weight: '100 900',
            style: 'normal',
            src: ['./src/assets/fonts/Geist-Variable.woff2'],
          },
        ],
      },
      fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif'],
      optimizedFallbacks: true,
      display: 'swap',
    },
    {
      name: 'Geist Mono',
      cssVariable: '--font-mono-face',
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            weight: '100 900',
            style: 'normal',
            src: ['./src/assets/fonts/GeistMono-Variable.woff2'],
          },
        ],
      },
      fallbacks: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      optimizedFallbacks: true,
      display: 'swap',
    },
    /*
      Archivo, the display face (Decisions log 2026-10-21): heavy, wide,
      uppercase headings over Geist body. One variable file, latin subset,
      covering both axes — width 62–125% and weight 100–900 — so every
      display step is the same request. OFL; licence beside it as
      ARCHIVO-OFL.txt. global.css maps --font-archivo to --font-display.
    */
    {
      name: 'Archivo',
      cssVariable: '--font-archivo',
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            weight: '100 900',
            stretch: '62% 125%',
            style: 'normal',
            src: ['./src/assets/fonts/Archivo-Variable.woff2'],
          },
        ],
      },
      fallbacks: ['Arial Black', 'Helvetica Neue', 'Arial', 'sans-serif'],
      optimizedFallbacks: true,
      display: 'swap',
    },
  ],


  vite: {
    plugins: [tailwindcss(), devImages()],
  },
  /* Prefetch a page when its link is hovered or focused (or tapped), not
     every link that scrolls into view: on / that fetched every page in the
     menu, footer and Selected Work, and the résumé PDF, on load. */
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
});
