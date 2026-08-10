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
  The proof strip.

  REAL NUMBERS ONLY. Every entry needs a source you could produce if a client
  or a hiring manager asked — analytics, a form-submission count, a sales
  figure, a ranking. If a project has no honest number, write the qualitative
  result into the case study instead and leave it out of here.

  Empty on purpose. The home page renders clearly-marked placeholders while this
  is empty so the layout can be judged, and switches to real content the moment
  entries are added. Do not fill it with estimates.
*/
export const PROOF: Array<{ value: string; label: string; source: string }> = [];
