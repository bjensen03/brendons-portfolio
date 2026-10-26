import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { homeShot, published, stackItems, SHOT_NEEDED, pad, type Shot } from '../home/data';
/* The shared helper, so a standalone family member (ALL IN) links to its own
   page rather than the redirect at its old nested URL. */
import { studyHref } from '../../lib/studies';
import { loadStudyImage } from '../../lib/study-images';

/*
  The Projects page (/work/). Every row comes from content that already
  exists in the repo: the studies collection for the case studies, the
  concept MDX for the design concepts, and the screenshot folders for the
  freelance client sites. Nothing here is written fresh except which group a
  project sits in and which filter tags it carries.

  Order: the big case studies first, then the small
  ones, then one grouped entry for the freelance client sites and one for the
  design concepts, last.
*/

export type Tag = 'client' | 'marketing' | 'apps' | 'freelance' | 'personal';

export const FILTERS: Array<{ id: 'all' | Tag; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'client', label: 'Client work' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'apps', label: 'Apps' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'personal', label: 'Personal' },
];

/** One site or concept inside a grouped entry. */
export type SetItem = {
  id: string;
  name: string;
  line?: string;
  /** "No longer live", "Concept", … */
  status?: string;
  href?: string;
  linkLabel?: string;
  shot: Shot;
};

export type ProjectRow = {
  id: string;
  number: string;
  name: string;
  line: string;
  meta: string;
  year?: string;
  tags: Tag[];
  href?: string;
  external?: boolean;
  shot?: Shot;
  shotNeeded?: string;
  children?: ProjectRow[];
  /** A grouped entry: a row of small screenshots ('sites') or a gallery that
      opens on demand ('concepts'). */
  set?: { kind: 'sites' | 'concepts'; items: SetItem[] };
};

export type ProjectGroup = { id: string; title: string; rows: ProjectRow[] };

/** How many projects a row stands for: a grouped entry counts each item. */
export const projectCount = (r: ProjectRow): number => r.set?.items.length ?? 1;

/* Keeps a tool name's own words together so the line breaks between tools. */
const keep = (t: string) => t.replace(/ /g, ' ');
const metaLine = (role: string, stack: string[]) => `${role} · ${stack.slice(0, 4).map(keep).join(', ')}`;

type Study = CollectionEntry<'studies'>;

/*
  The case studies, best first. Tags: Marketing marks the projects with real
  marketing work in them — Rally Trailer (catalogs, emails, HubSpot), PROLOOK
  (landing pages, PRO-AI), Lincoln (the Monday newsletter), The Twilight
  Trekkers (the brand and its audience).
*/
const BIG: Array<{ id: string; tags: Tag[] }> = [
  { id: 'prolook', tags: ['client', 'marketing'] },
  { id: 'rally-trailer', tags: ['client', 'marketing'] },
  { id: 'lincoln-academy', tags: ['client', 'marketing'] },
  { id: 'meal-planner', tags: ['apps', 'personal'] },
  { id: 'twilight-trekkers', tags: ['personal', 'marketing'] },
];

/* Studies shown nested under their parent's row (ALL IN under PROLOOK).
   ALL IN is a live SvelteKit app, so it shows under Apps as well. */
const CHILD_TAGS: Record<string, Tag[]> = {
  'all-in': ['client', 'apps'],
};

/*
  The small case studies, each linking to its study whenever that study is
  published in the build (until it's approved the row still shows, without
  a link). Rally Rep: tradeshow and email campaigns. Leamington Town: a
  small showcase study, tagged Client work. It's a study, so it is not a tile in the
  Freelance sites row.
*/
const SMALL: Array<{ id: string; tags: Tag[] }> = [
  { id: 'quickstrike', tags: ['client'] },
  { id: 'legends', tags: ['client'] },
  { id: 'rally-rep', tags: ['client', 'marketing'] },
  { id: 'leamington-town', tags: ['client'] },
];

/* Shots for studies HOME_SHOTS doesn't cover. Legends is the first screen
   of legends-custom.com, the site itself (captured 2026-10-23). */
const EXTRA_SHOTS: Record<string, { path: string; alt: string }> = {
  legends: {
    path: 'legends/site-home-1440x900@2x.webp',
    alt: 'The legends-custom.com homepage on desktop — a lacrosse game from the hero video under the Legends Team logo and menu.',
  },
  /* A laptop mockup. The home
     page capture is too wide for the card: its town name fell off the
     edge in the crop. */
  'leamington-town': {
    path: 'leamington-town/mockup.webp',
    alt: 'A laptop showing the Leamington Town website: "How Can We Help?" above "Town Services", with buttons for Town Council, Planning & Zoning, Public Works and Town Documents.',
  },
};

/* Shots kept in the projects image folders rather than the studies ones. */
const PROJECT_SHOTS: Record<string, { path: string; alt: string }> = {
  'rally-rep': {
    path: 'rally-rep/live-home.webp',
    alt: 'The top of the Rally Rep home page on desktop.',
  },
};

/* Project screenshots (src/content/projects/images). */
const FILES = import.meta.glob<ImageMetadata>('../../content/projects/images/**/*.{webp,jpg,jpeg,png}', {
  eager: true,
  import: 'default',
});
const findImage = (rel: string): ImageMetadata | undefined => FILES[`../../content/projects/images/${rel}`];
const projectImage = (rel: string): ImageMetadata => {
  const img = findImage(rel);
  if (!img) throw new Error(`Project image not found: ${rel}`);
  return img;
};

/* Homepage shot first (so a study looks the same here as on the home page),
   then the extras above, then the study's own cover (The Twilight Trekkers). */
const shotFor = async (s: Study): Promise<Shot | undefined> => {
  const id = s.id;
  const home = await homeShot(id);
  if (home) return home;
  const extra = EXTRA_SHOTS[id];
  if (extra) return { src: await loadStudyImage(extra.path), alt: extra.alt };
  const local = PROJECT_SHOTS[id];
  if (local) return { src: projectImage(local.path), alt: local.alt };
  return s.data.cover && s.data.coverAlt
    ? { src: await loadStudyImage(s.data.cover), alt: s.data.coverAlt }
    : undefined;
};

const fromStudy = async (s: Study, number: string, tags: Tag[], link = true): Promise<ProjectRow> => ({
  id: s.id,
  number,
  name: s.data.name,
  line: s.data.label,
  meta: metaLine(s.data.role, stackItems(s)),
  year: s.data.timeline,
  tags,
  href: link ? studyHref(s) : undefined,
  shot: await shotFor(s),
  shotNeeded: SHOT_NEEDED[s.id],
});

/*
  Freelance client sites (2024 to present, alongside the jobs above), shown
  together as one entry: DeDona Restoration and American Legacy, both live,
  each linking to its site. The one line is the kind of business and job.
  An entry only shows once its image exists, so a missing file drops the
  tile rather than the build.
*/
const EARLIER: Array<Omit<SetItem, 'shot'> & { shot: string; alt: string }> = [
  {
    id: 'dedona',
    name: 'DeDona Restoration',
    line: 'Restoration company · site build · Live',
    href: 'https://dedonarestoration.com/',
    linkLabel: 'Visit the site',
    shot: 'dedona/live-home.webp',
    alt: 'The top of the DeDona Restoration home page on desktop.',
  },
  /* A WordPress site I designed and built, freelance, for a Utah County
     construction and remodeling contractor. Captured from the live site. */
  {
    id: 'american-legacy',
    name: 'American Legacy',
    line: 'Contracting company · site build · Live',
    href: 'https://americanlegacycontracting.com/',
    linkLabel: 'Visit the site',
    shot: 'american-legacy/home.webp',
    alt: 'The top of the American Legacy Contracting home page on desktop: the logo, then a navy hero card reading "American Legacy Contracting" with Call Now and Get A Quote buttons and three value columns underneath.',
  },
];

/* Design concepts: self-directed, each with its own concept page. The one
   line is the concept's own title from its MDX, or its outcome where the
   title is just the name (ExoticRides). */
const CONCEPTS: Array<{ id: string; name: string; shot: string; alt?: string }> = [
  { id: 'ux-zion-explorer', name: 'Zion Explorer', shot: 'ux-zion/zion-explorer-1.webp' },
  { id: 'ux-photographer-booking', name: 'Capture Memories', shot: 'ux-photographer/capture-memories-1.webp' },
  { id: 'ux-feit-electric', name: 'Feit Electric', shot: 'ux-feit/feit-electric-1.webp' },
  { id: 'ux-lightup', name: 'Light Up', shot: 'ux-lightup/light-up-1.webp' },
  { id: 'ux-partypad', name: 'Party Pad', shot: 'ux-partypad/party-pad-1.webp' },
  {
    id: 'exotic-rides',
    name: 'ExoticRides',
    shot: 'exotic-rides/exotic-rides-2.webp',
    alt: 'The ExoticRides collection page on a laptop: category buttons, a filter panel and a grid of cars with prices.',
  },
];

/** A concept's short name ("Zion Explorer"), for its own page's title. */
export const conceptName = (id: string): string | undefined => CONCEPTS.find((c) => c.id === id)?.name;
/** Every concept's short name, so their page titles can share one size. */
export const conceptNames: string[] = CONCEPTS.map((c) => c.name);

export const projectGroups = async (): Promise<ProjectGroup[]> => {
  const all = await getCollection('studies');
  const byId = new Map(all.map((s) => [s.id, s]));
  let n = 0;
  const next = () => pad(++n);

  /* The big case studies, with any nested study under its parent. */
  const big: ProjectRow[] = [];
  for (const f of BIG) {
    const s = byId.get(f.id);
    if (!s || !published(s)) continue;
    const row = await fromStudy(s, next(), f.tags);
    const kids = all
      .filter((c) => c.data.parent === s.id && published(c))
      .sort((a, b) => a.data.order - b.data.order);
    if (kids.length) {
      row.children = [];
      for (const [i, c] of kids.entries()) {
        row.children.push(await fromStudy(c, `${row.number}.${i + 1}`, CHILD_TAGS[c.id] ?? ['client']));
      }
    }
    big.push(row);
  }

  const more: ProjectRow[] = [];
  for (const f of SMALL) {
    const s = byId.get(f.id);
    if (!s) continue;
    more.push(await fromStudy(s, next(), f.tags, published(s)));
  }

  const earlier: SetItem[] = EARLIER.flatMap(({ shot, alt, ...item }) => {
    const src = findImage(shot);
    return src ? [{ ...item, shot: { src, alt } }] : [];
  });
  if (earlier.length) {
    more.push({
      id: 'earlier-sites',
      number: next(),
      name: 'Freelance sites',
      line: 'WordPress sites I designed and built for local businesses, alongside the work above.',
      meta: 'Site builds',
      tags: ['client', 'freelance'],
      set: { kind: 'sites', items: earlier },
    });
  }

  const concepts: SetItem[] = [];
  for (const c of CONCEPTS) {
    const entry = await getEntry('projects', c.id);
    if (!entry) continue;
    concepts.push({
      id: c.id,
      name: c.name,
      line: entry.data.title === c.name ? entry.data.outcome.trim() : entry.data.title,
      href: `/work/${c.id}/`,
      linkLabel: 'See the concept',
      shot: { src: projectImage(c.shot), alt: c.alt ?? `Screens from the ${c.name} concept.` },
    });
  }
  if (concepts.length) {
    more.push({
      id: 'design-concepts',
      number: next(),
      name: 'Design concepts',
      line: 'Self-directed app and storefront designs. Concept work, not client projects.',
      meta: 'Product design · UI design',
      tags: ['personal'],
      set: { kind: 'concepts', items: concepts },
    });
  }

  return [
    { id: 'case-studies', title: 'Case studies', rows: big },
    { id: 'more', title: 'Smaller work', rows: more },
  ];
};

/** Every row and child, flat. */
export const flatRows = (groups: ProjectGroup[]): ProjectRow[] =>
  groups.flatMap((g) => g.rows.flatMap((r) => [r, ...(r.children ?? [])]));
