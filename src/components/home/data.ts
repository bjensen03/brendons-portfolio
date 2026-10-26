import { getCollection, type CollectionEntry } from 'astro:content';
import { showDrafts } from '../../lib/drafts';
import { loadStudyImage } from '../../lib/study-images';
import { studyHref } from '../../lib/studies';

/*
  Homepage data. Everything the home sections print comes from the studies
  collection; the only things written here are which studies are featured, in
  what order, and which screenshot each one uses when its YAML has no cover.
*/

type Study = CollectionEntry<'studies'>;

/* Shared class strings, so every text link and the one button style on the
   page stay identical (spec §10).

   textLink also carries `link-reveal` (src/styles/motion.css), which swaps the
   static underline for one that draws in on hover. The underline utilities
   stay as the fallback wherever motion.css isn't loaded. */
export const textLink =
  'link-reveal font-medium text-fg underline decoration-edge-strong decoration-1 underline-offset-[6px] transition-[text-decoration-color] duration-(--duration-fast) ease-out-soft hover:decoration-current';

export const primaryButton =
  'inline-flex min-h-12 items-center rounded-control bg-accent-fill px-6 text-small font-medium text-on-accent transition-[background-color,box-shadow,transform] duration-(--duration-fast) ease-out-soft hover:-translate-y-0.5 hover:inset-ring hover:inset-ring-line active:translate-y-0 active:scale-[0.98]';

export const published = (s: Study): boolean => s.data.approved || showDrafts();

/* One source for study URLs (standalone studies like ALL IN live at the
   top level), re-exported so the home sections can keep importing it here. */
export { studyHref };

/** The study's own stack line, falling back to its full-stack groups. */
export const stackItems = (s: Study): string[] =>
  s.data.stack
    ? s.data.stack.split(',').map((item) => item.trim())
    : s.data.fullStack.flatMap((g) => g.items);

export type Shot = {
  src: ImageMetadata;
  alt: string;
};

/*
  The homepage screenshot for each study: a clean top-of-page capture of the
  live site at 1440×900 @2x, so it matches aspect-shot (16:10) exactly and
  object-cover never crops the sides. Kept here rather than in the YAML so the
  case-study covers stay the architect's call.
*/
export const HOME_SHOTS: Record<string, { path: string; alt: string }> = {
  'rally-trailer': {
    path: 'rally-trailer/home-1440x900@2x.webp',
    alt: 'The top of the Rally Trailer Manufacturing home page on desktop.',
  },
  'lincoln-academy': {
    path: 'lincoln-academy/home-1440x900@2x.webp',
    alt: 'The top of the Lincoln Academy home page on desktop.',
  },
  quickstrike: {
    path: 'quickstrike/home-1440x900@2x.webp',
    alt: 'The top of the QuickStrike home page on desktop.',
  },
  'all-in': {
    path: 'all-in/home-1440x900@2x.webp',
    alt: 'The top of the ALL IN Tournament home page on desktop.',
  },
  prolook: {
    path: 'prolook/home-1440x900@2x.webp',
    alt: 'The top of the PROLOOK Sports home page on desktop.',
  },
  /* The app is phone-first and sits behind a two-account sign-in, so this is
     three of my dark phone captures side by side on one panel rather
     than a site capture. Built at the same 2880×1800 as the others. */
  'meal-planner': {
    path: 'meal-planner/composites/home-phones-1440x900@2x.webp',
    alt: 'Three Meal Planner screens on a phone: the week plan with each person’s calories and protein, a dinner scaled into per-person portions, and the recipe library both of them rate.',
  },
};

/*
  Featured studies that don't have a screenshot yet. The card renders a solid
  labelled panel in the image's place, so the gap is obvious rather than an
  empty frame. Delete an entry once HOME_SHOTS has one.
*/
export const SHOT_NEEDED: Record<string, string> = {};

export const homeShot = async (id: string): Promise<Shot | undefined> => {
  const entry = HOME_SHOTS[id];
  return entry ? { src: await loadStudyImage(entry.path), alt: entry.alt } : undefined;
};

/*
  Featured order. Unapproved studies would still
  drop out of production builds through `published`, but all four are approved.
  Studies that aren't featured here still have their own pages.
*/
const FEATURED = ['rally-trailer', 'prolook', 'lincoln-academy', 'meal-planner'];

/*
  Featured entries that keep their own name but open a different study.
  PROLOOK's entry opens ALL IN, the biggest piece of work there and the one
  I want seen first. The entry names ALL IN under PROLOOK
  so nobody is surprised by where the click lands, takes ALL IN's line,
  role, stack and screenshot to match, and keeps a smaller link to the
  PROLOOK page itself.
*/
const OPENS: Record<string, { study: string; moreLabel: string }> = {
  prolook: { study: 'all-in', moreLabel: 'All PROLOOK work' },
};

export type FeaturedProject = {
  id: string;
  number: string;
  name: string;
  category: string;
  line: string;
  role: string;
  stack: string[];
  href: string;
  shot?: Shot;
  /** Label for the placeholder panel shown when there's no shot yet. */
  shotNeeded?: string;
  /** Name of the study the entry opens, when it isn't the entry's own. */
  opens?: string;
  /** A second, smaller link back to the entry's own study. */
  more?: { label: string; href: string };
};

export const pad = (n: number): string => String(n).padStart(2, '0');

export const featuredProjects = async (): Promise<FeaturedProject[]> => {
  const all = await getCollection('studies');
  const byId = new Map(all.map((s) => [s.id, s]));
  const out: FeaturedProject[] = [];

  for (const id of FEATURED) {
    const study = byId.get(id);
    if (!study || !published(study)) continue;
    /* The study the entry actually opens; its own if the swap isn't set or
       the target isn't published in this build. */
    const swap = OPENS[study.id];
    const swapTo = swap ? byId.get(swap.study) : undefined;
    const target = swapTo && published(swapTo) ? swapTo : study;
    const d = target.data;
    out.push({
      id: study.id,
      number: pad(out.length + 1),
      name: study.data.name,
      category: d.kind ?? '',
      line: d.label,
      role: d.role,
      stack: stackItems(target).slice(0, 5),
      href: studyHref(target),
      shot: await homeShot(target.id),
      shotNeeded: SHOT_NEEDED[target.id],
      ...(target !== study && swap
        ? { opens: d.name, more: { label: swap.moreLabel, href: studyHref(study) } }
        : {}),
    });
  }
  return out;
};

/* ── Technical skills (the tabbed areas) ─────────────────────────────────── */

export const AREAS = [
  {
    id: 'frontend',
    name: 'Frontend',
    heading: 'Frontend: the layouts, components and interactions people use.',
  },
  {
    id: 'backend',
    name: 'Backend',
    heading: 'Backend: data, logic, forms and the integrations behind them.',
  },
  {
    id: 'wordpress',
    name: 'WordPress & CMS',
    heading: 'WordPress & CMS: custom themes and the editing experience.',
  },
  {
    id: 'workflow',
    name: 'Design & workflow',
    heading: 'Design & workflow: from layout to a tested release.',
  },
  /* `studies` pins the links instead of deriving them. */
  {
    id: 'marketing',
    name: 'Marketing',
    heading: 'Marketing: content, campaigns and the work behind them.',
    studies: ['twilight-trekkers', 'rally-rep', 'rally-trailer'],
    /* Picked from those studies' full-stack lists, so the panel shows tools
       rather than features like "Dealer lead routing". */
    tools: ['Mailchimp', 'HubSpot', 'Instagram reels', 'Drone video editing', 'Lightroom', 'Google Analytics 4'],
  },
] as const;

type AreaId = (typeof AREAS)[number]['id'];

/*
  Sorts every item in a study's full-stack list into one of the areas.
  WordPress-specific tools win over the group they were listed under; the
  rest go by the group's own name. Groups about marketing or brand assets go
  to Marketing, which only reads the studies it names (so QuickStrike's
  fonts and video don't land there).
*/
const WORDPRESS = /wordpress|\bacf\b|acf pro|sage|blade|acorn|yoast|custom post types|custom roles|wp-cli|formidable|forminator|nextend/i;

const areaFor = (group: string, item: string): AreaId | undefined => {
  if (WORDPRESS.test(item)) return 'wordpress';
  if (/front end/i.test(group)) return 'frontend';
  if (/backend|runtime|authentication|forms/i.test(group)) return 'backend';
  if (/design|development|deployment|build|tooling|infrastructure|process/i.test(group)) return 'workflow';
  if (/marketing|brand/i.test(group)) return 'marketing';
  return undefined;
};

/*
  The studies name the same tool different ways ("SCSS / CSS", "SCSS",
  "CSS"; "ACF" and "ACF Pro"). Fold those into one name before counting.
*/
const CANONICAL: Array<[RegExp, string]> = [
  [/^(scss \/ css|scss|css)$/i, 'CSS / SCSS'],
  [/^acf( pro)?$/i, 'ACF Pro'],
  [/^blade( templates)?$/i, 'Blade'],
  [/^sage\b/i, 'Sage (Roots)'],
  [/^(git|github|git \/ github)$/i, 'Git / GitHub'],
  [/^mustache( templates)?$/i, 'Mustache'],
  [/^php\b/i, 'PHP'],
  [/^custom roles and (capabilities|permissions)$/i, 'Custom roles and permissions'],
  [/^responsive (layouts|layout work|components)$/i, 'Responsive layouts'],
];

const canonical = (item: string): string => {
  for (const [re, name] of CANONICAL) if (re.test(item.trim())) return name;
  return item.trim();
};

export type AreaData = {
  id: AreaId;
  name: string;
  heading: string;
  tools: string[];
  studies: Array<{ name: string; href: string }>;
};

export const expertiseAreas = async (toolLimit = 6, studyLimit = 4): Promise<AreaData[]> => {
  /* QuickStrike and Legends stay out of the "Used in" lists; they have
     their own pages and rows on /work/. */
  const studies = (await getCollection('studies'))
    .filter(published)
    .filter((s) => s.id !== 'quickstrike' && s.id !== 'legends')
    .sort((a, b) => a.data.order - b.data.order);

  return AREAS.map((area) => {
    /* Tool name (case-folded key) → display name, count, and which studies use it. */
    const tools = new Map<string, { name: string; count: number; studies: Set<Study> }>();
    const pinned: readonly string[] | undefined = 'studies' in area ? area.studies : undefined;
    const pool = pinned ? studies.filter((s) => pinned.includes(s.id)) : studies;

    for (const s of pool) {
      for (const g of s.data.fullStack) {
        for (const raw of g.items) {
          if (areaFor(g.group, raw) !== area.id) continue;
          const name = canonical(raw);
          const key = name.toLowerCase();
          const t = tools.get(key) ?? { name, count: 0, studies: new Set<Study>() };
          if (!t.studies.has(s)) {
            t.studies.add(s);
            t.count += 1;
          }
          tools.set(key, t);
        }
      }
    }

    /* Most-used first; ties keep first-seen order. */
    const top = [...tools.values()].sort((a, b) => b.count - a.count).slice(0, toolLimit);

    /* Studies that use the tools actually shown, most matches first. */
    const hits = new Map<Study, number>();
    for (const t of top) for (const s of t.studies) hits.set(s, (hits.get(s) ?? 0) + 1);
    const used = pinned
      ? pinned.flatMap((id) => pool.filter((s) => s.id === id)).map((s) => ({ name: s.data.name, href: studyHref(s) }))
      : [...hits.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].data.order - b[0].data.order)
          .slice(0, studyLimit)
          .map(([s]) => ({ name: s.data.name, href: studyHref(s) }));

    const named: readonly string[] | undefined = 'tools' in area ? area.tools : undefined;
    return { ...area, tools: named ? [...named] : top.map((t) => t.name), studies: used };
  });
};

/* ── Experience ───────────────────────────────────────────────────────── */

export type Role = {
  dates?: string;
  title: string;
  company: string;
  line: string;
  href?: string;
};

export const experience = async (): Promise<Role[]> => {
  const all = await getCollection('studies');
  const get = (id: string) => all.find((s) => s.id === id);
  const rows: Role[] = [];

  const fromStudy = (id: string, line?: string, href?: string) => {
    const s = get(id);
    if (!s) return;
    rows.push({
      dates: s.data.timeline,
      title: s.data.role,
      company: s.data.company,
      line: line ?? s.data.label,
      href: href ?? (published(s) ? studyHref(s) : undefined),
    });
  };

  fromStudy('rally-trailer');

  /* PROLOOK: role and dates are resume-level; the line names the study
     nested under it (ALL IN). The PROLOOK page always builds. */
  const sites = all
    .filter((s) => s.data.parent === 'prolook')
    .sort((a, b) => a.data.order - b.data.order)
    /* Each name holds together ("ALL IN Tournament" never splits after
       ALL), and the dot stays with the name before it. */
    .map((s) => s.data.name.replace(/ /g, '\u00a0'));
  fromStudy('prolook', sites.length ? `Sites: ${sites.join('\u00a0· ')}` : undefined, '/work/prolook/');

  fromStudy('lincoln-academy');

  /* 2024 to present, built in WordPress. */
  rows.push({
    dates: '2024 to Present',
    title: 'Web Designer & Developer',
    company: 'Freelance',
    line: 'WordPress sites I designed and built for local businesses, including DeDona Restoration and American Legacy.',
  });

  return rows;
};
