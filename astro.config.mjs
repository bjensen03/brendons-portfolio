// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Update once the domain is registered — sitemap and canonical URLs depend on it.
const SITE = 'https://brendonjensen.com';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
