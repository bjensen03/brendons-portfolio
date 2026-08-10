// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Update once the domain is registered — sitemap and canonical URLs depend on it.
const SITE = 'https://brendonjensen.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [mdx(), sitemap()],

  /*
    Astro self-hosts these: downloads, subsets, emits woff2, generates
    metric-matched fallbacks and handles preload. That replaces the hand-rolled
    @font-face block and the size-adjust values that would otherwise have to be
    measured by hand.

    Three families here because three design directions are being prototyped.
    Once one is chosen, delete the other two — the font payload should be one
    display face and one text face, not six.
  */
  fonts: [
    {
      name: 'Big Shoulders Display',
      cssVariable: '--font-condensed',
      provider: fontProviders.google(),
      weights: ['400 900'],
      subsets: ['latin'],
      fallbacks: ['Impact', 'sans-serif'],
      optimizedFallbacks: true,
      display: 'swap',
    },
    {
      name: 'Bricolage Grotesque',
      cssVariable: '--font-bricolage',
      provider: fontProviders.google(),
      weights: ['400 800'],
      subsets: ['latin'],
      fallbacks: ['Helvetica Neue', 'sans-serif'],
      optimizedFallbacks: true,
      display: 'swap',
    },
    {
      name: 'Space Grotesk',
      cssVariable: '--font-grotesk',
      provider: fontProviders.google(),
      weights: ['300 700'],
      subsets: ['latin'],
      fallbacks: ['Helvetica Neue', 'sans-serif'],
      optimizedFallbacks: true,
      display: 'swap',
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
