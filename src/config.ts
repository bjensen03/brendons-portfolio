/* Site-wide constants. */

export const SITE = {
  name: 'Brendon Jensen',
  /* The live domain (apex, no www). Keep `SITE` in astro.config.mjs the
     same: the sitemap and canonical tags read it from there. */
  url: 'https://brendonjensen.dev',
  /* Deliberately not "Frontend Developer" alone. The work spans development,
     design, marketing and automation, and a title that names a third of it
     invites being screened out for the other two thirds. */
  title: 'Brendon Jensen — Web Developer, Designer & Marketer',
  description:
    'I build the website and the machine behind it — design, development, marketing and automation for businesses that need theirs to actually work.',
  locale: 'en-US',
} as const;

/* Instagram is The Twilight Trekkers account (Kaylee's and mine), not a
   personal one. */
export const CONTACT = {
  email: 'brendonjensen03@gmail.com',
  github: 'https://github.com/bjensen03',
  linkedin: 'https://www.linkedin.com/in/brendon-jensen-5682a5247/',
  instagram: 'https://www.instagram.com/thetwilighttrekkers/',
  /* The Web3Forms access key for the contact form. It's meant to be public
     (it can only send mail to the address it was created for), so it lives
     here. Blank = no form: /contact/ shows the email and Copy email instead. */
  web3formsKey: 'c2bc386c-9f6d-4c13-9c41-bf4be9baab7e' as string,
} as const;

export const NAV = [
  { href: '/work/', label: 'Work' },
  { href: '/about/', label: 'About' },
  { href: '/contact/', label: 'Contact' },
] as const;

