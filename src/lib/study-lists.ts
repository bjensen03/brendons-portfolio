import { BRANDS, BRAND_GROUP_LABELS } from '../components/twilight/data';

/*
  Lists a study's `list:<id>` block can take with `from:` instead of
  repeating them in the yaml, so one copy serves every page that shows it.
  'twilight-brands': every brand, stay and excursion we've worked with,
  grouped, with the Collaborations page's line where there is one (also on
  /twilight-trekkers/ and the homepage Twilight section).
*/
export const LIST_SOURCES = {
  'twilight-brands': BRANDS.map((b) => ({ name: b.name, body: b.line ?? '', group: BRAND_GROUP_LABELS[b.group] })),
} satisfies Record<string, Array<{ name: string; body: string; group?: string }>>;
