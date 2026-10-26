import { getCollection } from 'astro:content';
import { CONTACT } from '../../config';
import { studyHref } from '../../lib/studies';
import { showDrafts } from '../../lib/drafts';

/*
  What the footer options link to. Everything comes from src/config.ts and
  the studies collection; a blank value is left out rather than shown as a
  placeholder, so the footer never prints "[PLACEHOLDER]" or an empty row.

  RESUME is my résumé PDF in public/. It opens in a new tab (newTab), like
  the profile links, so the page stays where it was.
*/

export const RESUME = '/brendon-jensen-resume.pdf';

export type ContactLink = { label: string; href: string; rel?: string; newTab?: boolean };

export const email = CONTACT.email || '';

/** Off-site and document links, blanks removed. Email is handled separately. */
export const contactLinks: ContactLink[] = [
  { label: 'GitHub', href: CONTACT.github, rel: 'me' },
  { label: 'LinkedIn', href: CONTACT.linkedin, rel: 'me' },
  { label: 'Instagram', href: CONTACT.instagram, rel: 'me' },
  { label: 'Résumé', href: RESUME, newTab: true },
].filter((l) => Boolean(l.href));

export type MapLink = { label: string; href: string };

export const sitePages: MapLink[] = [
  { label: 'All projects', href: '/work/' },
  { label: 'Twilight Trekkers', href: '/twilight-trekkers/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
];

/** Case studies that are published (top-level ones only), in their set order. */
export const caseStudies = async (): Promise<MapLink[]> => {
  const all = await getCollection('studies');
  return all
    .filter((s) => s.data.approved || showDrafts())
    .filter((s) => !s.data.parent || s.data.standalone)
    .sort((a, b) => a.data.order - b.data.order)
    .map((s) => ({ label: s.data.name, href: studyHref(s) }));
};

export const year = new Date().getFullYear();

/*
  The address broken into display lines, so it can be set huge. Where the
  name appears run together ("brendonjensen"), the break falls between its
  words so the lines read as the name; otherwise the address breaks at the @.

    brendonjensen03@gmail.com  phone [brendon] [jensen03@] [gmail.com]
                               wider [brendonjensen03] [@gmail.com]
    hello@brendonjensen.com    phone [hello@] [brendon] [jensen.com]
                               wider [hello@brendon] [jensen.com]
*/
export const emailLines = (address: string, name: string): { phone: string[]; wide: string[] } => {
  const [local, domain = ''] = address.split('@');
  const words = name.toLowerCase().split(/\s+/);
  const joined = words.join('');
  const cut = words[0].length;
  if (words.length > 1 && local.toLowerCase().startsWith(joined)) {
    return {
      phone: [local.slice(0, cut), `${local.slice(cut)}@`, domain],
      wide: [local, `@${domain}`],
    };
  }
  if (words.length > 1 && domain.toLowerCase().startsWith(joined)) {
    return {
      phone: [`${local}@`, domain.slice(0, cut), domain.slice(cut)],
      wide: [`${local}@${domain.slice(0, cut)}`, domain.slice(cut)],
    };
  }
  return { phone: [`${local}@`, domain], wide: [local, `@${domain}`] };
};
