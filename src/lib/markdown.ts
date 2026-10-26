import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { rehypeExternalLinks } from './links';
import { remarkHighlight, stripHighlights } from './highlight';
import { stripPlaceholders } from './placeholders';

/*
  Markdown for the prose fields in the studies collection.

  Those fields live in YAML rather than an MDX body because the build sheet is a
  fixed set of named sections, and a schema can require every one of them where
  a free-form document can't. The cost is that the collection doesn't render
  them, so this does — at build time, with the same remark pipeline Astro uses
  for everything else, so nothing ships a parser to the browser.

  One processor for the whole build. Creating it is the expensive part. It
  carries the same off-site link rule as the MDX pipeline (./links.ts), plus
  ==highlights== (./highlight.ts), which only these fields use.
*/

let processor: Awaited<ReturnType<typeof createMarkdownProcessor>> | undefined;

export const md = async (source: string | undefined): Promise<string> => {
  if (!source) return '';
  source = stripPlaceholders(source);
  if (!source) return '';
  processor ??= await createMarkdownProcessor({
    remarkPlugins: [remarkHighlight],
    rehypePlugins: [rehypeExternalLinks],
  });
  const { code } = await processor.render(source);
  return code;
};

/** One line of markdown without the paragraph round it — for list items and
    other places that supply their own block element. */
export const mdInline = async (source: string | undefined): Promise<string> => {
  const html = (await md(source)).trim();
  const one = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return one && !one[1].includes('<p>') ? one[1] : html;
};

/** Word count for the hard-problem beats, which the sheet caps at 60. */
export const words = (source: string): number =>
  stripHighlights(source)
    .replace(/[`*>#-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
