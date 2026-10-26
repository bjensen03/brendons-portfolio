/*
  Writing placeholders — [NEED — …], [PLACEHOLDER — …], [DATE?].

  They mark copy or files that haven't arrived yet, so they're useful while a
  page is being written and reviewed in `astro dev`. They must never reach a
  production build. Components check `showPlaceholders` and leave the whole
  element out of a build; markdown prose goes through `stripPlaceholders`
  (src/lib/markdown.ts does that for every yaml field), and a section whose
  prose ends up empty is dropped by the template.

  A build that drops one logs it, so a missing piece doesn't go unnoticed.
*/

export const showPlaceholders: boolean = import.meta.env.DEV;

const TEST = /\[(?:NEED|PLACEHOLDER|DATE\?)/;
/* The marker with any bold around it: **[NEED — …]** */
const MARK = /\*{0,2}\[(?:NEED|PLACEHOLDER|DATE\?)[^\]\n]*\]\*{0,2}/g;

export const isPlaceholder = (s: string | undefined | null): boolean => !!s && TEST.test(s);

/** Drops placeholder markers from markdown in a build; untouched in dev. */
export const stripPlaceholders = (source: string): string => {
  if (showPlaceholders || !isPlaceholder(source)) return source;
  const out = source
    .replace(MARK, '')
    /* list items or quotes left with nothing in them */
    .replace(/^[ \t]*(?:[-*+>]|\d+\.)[ \t]*$/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  console.warn(`[placeholders] left out of the build: ${source.match(MARK)?.join(' | ')}`);
  return out;
};
