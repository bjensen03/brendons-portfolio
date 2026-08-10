/*
  Site-wide constants. Values marked PHASE 0 are waiting on decisions that
  aren't code decisions — domain registration, the domain email, social URLs.
  They're placeholders on purpose rather than invented, so a wrong address
  can't quietly ship.
*/

export const SITE = {
  name: 'Brendon Jensen',
  /* PHASE 0: replace once the domain is registered. Also update `site` in
     astro.config.mjs — the sitemap and canonical tags read it from there. */
  url: 'https://brendonjensen.com',
  title: 'Brendon Jensen — Frontend Developer',
  description:
    'Frontend developer building fast, considered websites for businesses that need theirs to actually work.',
  locale: 'en-US',
} as const;

/* PHASE 0: real addresses. The Gmail is deliberately absent — a domain
   mailbox goes on the site instead. */
export const CONTACT = {
  email: 'hello@brendonjensen.com',
  github: 'https://github.com/bjensen03',
  linkedin: '',
  instagram: '',
} as const;

export const NAV = [
  { href: '/work/', label: 'Work' },
  { href: '/about/', label: 'About' },
  { href: '/lab/', label: 'Lab' },
  { href: '/contact/', label: 'Contact' },
] as const;

/*
  Self-hosted fonts are off until the faces are licensed and subsetted. While
  this is false, no preload link is emitted — a preload pointing at a missing
  file is a 404 on every page load and a console warning on every audit.
  See src/styles/fonts.css for the switch-on steps.
*/
export const FONTS = {
  enabled: false,
  preload: ['/fonts/display-600.woff2'],
} as const;
