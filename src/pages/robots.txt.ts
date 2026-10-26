import type { APIRoute } from 'astro';
import { SITE } from '../config';

/*
  robots.txt, generated so the sitemap URL follows the configured `site`
  (astro.config.mjs, the www origin Vercel serves). Everything is
  crawlable.
*/
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', site ?? SITE.url).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
