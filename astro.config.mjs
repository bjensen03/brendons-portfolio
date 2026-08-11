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

  markdown: {
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
    Astro self-hosts these: downloads, subsets, emits woff2, generates
    metric-matched fallbacks and handles preload. That replaces the hand-rolled
    @font-face block and the size-adjust values that would otherwise have to be
    measured by hand.

    Two families: one display face and one text face. Big Shoulders is
    ultra-condensed and only reads at very large sizes; Space Grotesk carries
    everything else.
  */
  fonts: [
    {
      /* Google renamed this family from "Big Shoulders Display" to "Big
         Shoulders". The old name still resolves through the legacy CSS
         endpoint but not through the metadata API the provider uses, so it
         silently fell back to Impact. */
      name: 'Big Shoulders',
      cssVariable: '--font-condensed',
      provider: fontProviders.google(),
      weights: ['400 900'],
      subsets: ['latin'],
      fallbacks: ['Impact', 'sans-serif'],
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
