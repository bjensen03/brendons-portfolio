import { getCollection, type CollectionEntry } from 'astro:content';
import { showDrafts } from './drafts';

/*
  Where a study lives. Nested under its parent (/work/<parent>/<id>/)
  unless it is marked `standalone`, which gives a family member its own
  top-level page (/work/all-in/) while it stays in the family. Every link to
  a study should come from here, so the two can't drift.
*/
export const studyHref = (s: Pick<CollectionEntry<'studies'>, 'id' | 'data'>): string =>
  s.data.parent && !s.data.standalone ? `/work/${s.data.parent}/${s.id}/` : `/work/${s.id}/`;

/*
  Studies that get a page at /work/<id>/.

  Not nested under another study (unless standalone), not the head of a family
  (PROLOOK has its own route directory), and
  publishable under the same rule every route uses. Shared by the study route
  and the older project route, so the two can never both try to build the
  same URL.
*/
export const topLevelStudies = async (): Promise<Array<CollectionEntry<'studies'>>> => {
  const all = await getCollection('studies');
  const parents = new Set(all.map((s) => s.data.parent).filter(Boolean));
  return all
    .filter((s) => (!s.data.parent || s.data.standalone) && !parents.has(s.id))
    .filter((s) => s.data.approved || showDrafts())
    .sort((a, b) => a.data.order - b.data.order);
};

/*
  Whether a /work/ URL is a page this build actually produces.

  Used by Next Project. The build sheet chains every study to the next one, and
  that chain gets written before the next study exists — Lincoln pointed at
  Meal Planner for weeks before its page did. Lincoln was approved and
  shipping, so without this the live site would have carried a link to a 404
  until the next study was written.

  Anything outside /work/ is assumed to exist; this only knows about the routes
  generated from the content collections.
*/
export const workRouteExists = async (href: string): Promise<boolean> => {
  const path = href.replace(/[?#].*$/, '').replace(/\/?$/, '/');
  if (!path.startsWith('/work/')) return true;
  if (path === '/work/') return true;

  const studies = await getCollection('studies');
  const published = (s: CollectionEntry<'studies'>) => s.data.approved || showDrafts();

  const built = new Set<string>();
  for (const s of studies.filter(published)) {
    built.add(studyHref(s));
    /* A standalone study's old nested URL still builds, as a redirect. */
    if (s.data.parent) built.add(`/work/${s.data.parent}/${s.id}/`);
  }

  /* The PROLOOK page always builds — as the full study or the resume page. */
  built.add('/work/prolook/');

  const replaced = new Set((await topLevelStudies()).map((s) => s.id));
  for (const p of await getCollection('projects')) {
    if (p.data.depth !== 'card' && !replaced.has(p.id)) built.add(`/work/${p.id}/`);
  }

  return built.has(path);
};
