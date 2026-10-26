import type { Element, ElementContent, Root, RootContent } from 'hast';
import { SITE } from '../config';

/*
  Off-site links open in a new tab. Somebody reading the portfolio who clicks
  through to a client's live site shouldn't lose their place here, so every
  http(s) link that leaves this origin gets target="_blank",
  rel="noopener noreferrer", a visible ↗ and a screen-reader note saying it
  opens a new tab.

  One rule, used twice: by ExternalLink.astro for links written in templates,
  and by rehypeExternalLinks below for links written in markdown/MDX prose.
  mailto:, tel:, relative paths, #anchors and absolute URLs back to this
  site's own domain are left alone.
*/

const bare = (host: string) => host.replace(/^www\./, '').toLowerCase();
const OWN_HOST = bare(new URL(SITE.url).hostname);

export const NEW_TAB_HINT = ' (opens in a new tab)';

export const isExternal = (href: string | undefined | null): boolean => {
  if (!href || !/^https?:\/\//i.test(href)) return false;
  try {
    return bare(new URL(href).hostname) !== OWN_HOST;
  } catch {
    return false;
  }
};

/** rel for an external link, keeping any extra tokens (e.g. "me") the caller passes. */
export const externalRel = (extra?: string): string => {
  const tokens = new Set(['noopener', 'noreferrer', ...(extra ?? '').split(/\s+/).filter(Boolean)]);
  return [...tokens].join(' ');
};

/* ── Markdown / MDX ───────────────────────────────────────────────────────
   A small rehype plugin rather than rehype-external-links, which isn't
   installed. Registered in astro.config.mjs (MDX inherits it) and in
   src/lib/markdown.ts for the YAML prose fields. */

const hasText = (node: ElementContent): boolean =>
  node.type === 'text' ? node.value.trim() !== '' : node.type === 'element' && node.children.some(hasText);

const textOf = (node: ElementContent): string =>
  node.type === 'text' ? node.value : node.type === 'element' ? node.children.map(textOf).join('') : '';

const visit = (node: Root | RootContent): void => {
  if (node.type !== 'root' && node.type !== 'element') return;
  if (node.type === 'element' && node.tagName === 'a') decorate(node);
  node.children.forEach(visit);
};

const decorate = (a: Element): void => {
  const href = typeof a.properties.href === 'string' ? a.properties.href : undefined;
  if (!isExternal(href)) return;

  const existingRel = Array.isArray(a.properties.rel) ? a.properties.rel.join(' ') : String(a.properties.rel ?? '');
  a.properties.target = '_blank';
  a.properties.rel = externalRel(existingRel).split(' ');

  /* Prose that already ends in → gets the ↗ instead of both. */
  const last = a.children[a.children.length - 1];
  if (last?.type === 'text') last.value = last.value.replace(/\s*→\s*$/, '');

  if (!a.children.some(hasText) || a.children.map(textOf).join('').includes(NEW_TAB_HINT.trim())) return;

  a.children.push(
    { type: 'element', tagName: 'span', properties: { className: ['sr-only'] }, children: [{ type: 'text', value: NEW_TAB_HINT }] },
    {
      type: 'element',
      tagName: 'span',
      properties: { className: ['link-arrow', 'ext-arrow'], ariaHidden: 'true' },
      children: [{ type: 'text', value: '↗' }],
    },
  );
};

export const rehypeExternalLinks = () => (tree: Root) => visit(tree);
