/*
  Images for the studies collection, resolved from a glob scoped to
  src/content/studies/images rather than declared with image() in the schema.

  That keeps a path from becoming an asset until something renders it. It is
  not, on its own, enough to keep an unapproved study's screenshots out of a
  production build — Vite emits every file an import.meta.glob matches whether
  or not it is called. scripts/prune-assets.mjs is what enforces that: after the
  build, any image no page references is deleted.

  Shared by the study layout and the cards on the home and work pages, so a
  path means the same file everywhere.
*/
const STUDY_IMAGES = import.meta.glob<{ default: ImageMetadata }>(
  '../content/studies/images/**/*.{webp,png,jpg,jpeg}',
);

/*
  The Twilight Trekkers photo library lives with the project images
  (src/content/projects/images/twilight-trekkers/library/) because the brand page and the home page use it too. A study
  path starting `twilight-trekkers/library/` resolves there, so the same 136
  files aren't copied into a second folder.
*/
const LIBRARY_PREFIX = 'twilight-trekkers/library/';
const TWILIGHT_LIBRARY = import.meta.glob<{ default: ImageMetadata }>(
  '../content/projects/images/twilight-trekkers/library/*/*.webp',
);

export const loadStudyImage = async (rel: string): Promise<ImageMetadata> => {
  const importer = rel.startsWith(LIBRARY_PREFIX)
    ? TWILIGHT_LIBRARY[`../content/projects/images/${rel}`]
    : STUDY_IMAGES[`../content/studies/images/${rel}`];
  if (!importer) throw new Error(`Case study image not found: ${rel}`);
  return (await importer()).default;
};
