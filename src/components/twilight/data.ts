/*
  The Twilight Trekkers page (/twilight-trekkers/). Kaylee's and my
  travel and adventure brand, and the WordPress site I built for it.

  Facts come from the case study (src/content/studies/twilight-trekkers.yaml). Photos are only ours, from
  src/content/projects/images/twilight-trekkers/. Alt text describes what is
  in the frame and doesn't name places the repo doesn't name.
*/

import { CONTACT } from '../../config';

export const INSTAGRAM_URL = CONTACT.instagram;

/* The handle as people type it, derived from the URL so the two can't drift. */
export const INSTAGRAM_HANDLE = `@${INSTAGRAM_URL.replace(/\/$/, '').split('/').pop()}`;

export const SITE_URL = 'https://thetwilighttrekkers.com/';
export const CASE_STUDY = '/work/twilight-trekkers/';

/* Instagram following. */
export const FOLLOWERS = '26k';
export const FOLLOWERS_AS_OF = 'October 2026';

export const STACK = ['WordPress', 'PHP', 'ACF Pro', 'Rank Math', 'Formidable Forms', 'Mailchimp'];

const FILES = import.meta.glob<ImageMetadata>('../../content/projects/images/twilight-trekkers/*.webp', {
  eager: true,
  import: 'default',
});
export const photo = (file: string): ImageMetadata => {
  const img = FILES[`../../content/projects/images/twilight-trekkers/${file}`];
  if (!img) throw new Error(`Twilight Trekkers image not found: ${file}`);
  return img;
};

/* The photo library, for the hero. The page's photo
   section and reels read the case study's yaml instead, so both pages show
   the same set. */
const LIBRARY = import.meta.glob<ImageMetadata>('../../content/projects/images/twilight-trekkers/library/*/*.webp', {
  eager: true,
  import: 'default',
});
const library = (file: string): ImageMetadata => {
  const img = LIBRARY[`../../content/projects/images/twilight-trekkers/library/${file}`];
  if (!img) throw new Error(`Twilight library image not found: ${file}`);
  return img;
};

/* My pick for the hero (2026-10-25): a hiker on a rocky overlook
   facing snowy peaks, 2400 x 1600 from my master. Focus points are in
   TwilightHero. */
export const BRAND_HERO = {
  src: library('mountains/cascade-ridge-hiker-01.webp'),
  alt: 'A hiker standing on a rocky overlook, looking out at a wall of jagged, snow-streaked peaks under a blue sky with thin clouds.',
};

/* What I do for the brand. */
export const ROLES = [
  { word: 'Drone', line: 'I fly the drone and make the drone videos.' },
  { word: 'Photo & video', line: 'I shoot some of the photos and video. Kaylee is our photographer, so most of the photos are hers.' },
  { word: 'The blog', line: 'I write the blog posts.' },
  { word: 'The website', line: 'I built the website, and I run it: SEO, image optimization, publishing and analytics.' },
] as const;

/* Every brand, stay and excursion we've worked with: 34, from my
   list (2026-10-25), grouped. Names use each company's own spelling where it
   could be confirmed; the eleven on the Collaborations page of
   thetwilighttrekkers.com keep that page's spelling and their lines, exactly
   as written there (captured 2026-10-23). The rest show the name only.
   One copy: /twilight-trekkers/, the case study (list:brands via
   src/lib/study-lists.ts) and the homepage section (home/twilight-data.ts,
   names only) all read it. */
export type BrandGroup = 'brands' | 'stays' | 'excursions';

export const BRAND_GROUP_LABELS: Record<BrandGroup, string> = {
  brands: 'Brands',
  stays: 'Hotels & stays',
  excursions: 'Excursions',
};

export const BRANDS: ReadonlyArray<{ name: string; group: BrandGroup; line?: string }> = [
  { name: '32 Degrees', group: 'brands', line: 'Simple, affordable basics that work surprisingly well for travel and everyday wear—easy to pack, easy to wear anywhere.' },
  { name: 'Aleya Platforms', group: 'brands' },
  { name: 'Ancient + Brave', group: 'brands' },
  { name: 'Arc Coffee', group: 'brands' },
  { name: 'Free Fly', group: 'brands', line: 'Lightweight, breathable, and built for hot desert days—this is the kind of gear we actually reach for on our hikes.' },
  { name: 'GCI Outdoor', group: 'brands' },
  { name: 'Honu Wear', group: 'brands' },
  { name: 'ICEMULE', group: 'brands' },
  { name: 'Insta360', group: 'brands' },
  { name: 'Javie', group: 'brands', line: 'Comfortable, durable socks that hold up on long hikes—one of those small things that actually makes a big difference.' },
  { name: 'Klean Freak', group: 'brands' },
  { name: 'KZ Gear', group: 'brands' },
  { name: 'Merino Tech', group: 'brands', line: 'All about comfort and versatility—perfect layers that handle everything from cold mornings to long travel days.' },
  { name: 'Muddy Vibe', group: 'brands' },
  { name: 'Nani', group: 'brands' },
  { name: 'Stay Wild', group: 'brands' },
  { name: 'Stio', group: 'brands' },
  { name: 'The Foldie', group: 'brands' },
  { name: 'Topo Designs', group: 'brands' },
  { name: 'Wulf Wool', group: 'brands' },
  { name: 'Evergreen Lodge', group: 'stays' },
  { name: 'Field Station Joshua Tree', group: 'stays' },
  { name: 'OutPostX', group: 'stays', line: 'A sci-fi glamping stay in Beryl, Utah, an hour west of Zion—cave villas, domes and tents where you can slow down and reconnect.' },
  { name: 'Reset Hotel', group: 'stays', line: 'A clean, modern stay right near Joshua Tree that keeps things simple and peaceful—exactly what you want after a long day in the desert.' },
  { name: 'Rush Creek Lodge', group: 'stays', line: 'A perfect basecamp just outside Yosemite that blends comfort with adventure. It’s where we recharge after long trail days without losing that mountain feel.' },
  { name: 'Wolfe’s Hotel', group: 'stays' },
  { name: 'Dolphins and You', group: 'excursions', line: 'One of the most unreal experiences we’ve had—snorkeling alongside dolphins and exploring the ocean in a way that feels wild but still safe and guided.' },
  { name: 'Fair Wind Cruises', group: 'excursions' },
  { name: 'Get In The Wild', group: 'excursions', line: 'A great way to experience canyoneering if you’re new or just want a guided day—safe, fun, and still feels like a real adventure.' },
  { name: 'Mad Moose Rentals', group: 'excursions', line: 'If you want to experience Sand Hollow the right way, this is it—easy rentals, epic UTVs, and access to some of the most fun terrain in Southern Utah.' },
  { name: 'Puget Sound Express', group: 'excursions' },
  { name: 'Redtail Air', group: 'excursions', line: 'Seeing Canyonlands from the air completely changes your perspective—this flight is one of the most unforgettable ways to experience the desert.' },
  { name: 'Sea Paradise', group: 'excursions' },
  { name: 'Sea Quest', group: 'excursions' },
];

/* The same list split by group, in the order above. */
export const BRAND_GROUPS = (Object.keys(BRAND_GROUP_LABELS) as BrandGroup[]).map((group) => ({
  group,
  label: BRAND_GROUP_LABELS[group],
  items: BRANDS.filter((b) => b.group === group),
}));

/* Three phones showing the Instagram feed, from my old Webflow portfolio
   (transparent background), trimmed to the phones. */
export const FEED_SHOT = {
  src: photo('the-twilight-trekkers-2-phones.webp'),
  alt: 'Three phones showing posts from the @thetwilighttrekkers Instagram feed: a slot canyon, a waterfall and a forest trail.',
};

export const SITE_SHOT = {
  src: photo('home-1440x900@2x.webp'),
  alt: 'The top of thetwilighttrekkers.com: two people at the foot of a waterfall under the headline "Chasing Sunsets. Finding Wild Places. Living the Story."',
};
