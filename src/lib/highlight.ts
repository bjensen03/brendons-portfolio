import type { Parent, PhrasingContent, Root, RootContent } from 'mdast';

/*
  ==Highlights== in the study prose.

  Wrapping a phrase in double equals marks it as one of the few things a
  skimmer should not miss. It renders as <mark class="hl" data-hl="n">,
  which study.css underlines with a hand-drawn tan stroke and
  study-motion.ts draws in on scroll.

  A remark step rather than a regex over the source, so it only ever sees
  prose: `==` inside inline code or a fenced block is a different node type
  and is left exactly as written. It runs per parent, so a highlight can
  span bold or a link (`==the **cache** was the problem==`) as long as it
  opens and closes inside the same paragraph, list item or heading.

  The opening `==` has to be followed by a non-space and the closing one
  preceded by a non-space, so an equation like `a == b` in running text
  stays literal. An `==` with no partner is put back as text.
*/

const MARK = Symbol('hl');

/* Nodes whose children are never prose. */
const SKIP = new Set(['code', 'inlineCode', 'html', 'math', 'inlineMath']);

const OPEN = /==(?=\S)/y;
const CLOSE = /(?<=\S)==/y;

/* Split one text node into text and marker tokens. Whether a given `==`
   can open or close depends on its neighbours, so both are recorded and
   the pairing below decides. */
type Marker = { mark: typeof MARK; open: boolean; close: boolean };

/* `edgeBefore` / `edgeAfter`: the text node sits right after / before an
   inline node (bold, a link), so a marker at its very start can close and
   one at its very end can open — `==the **cache**==`. */
const splitText = (value: string, edgeBefore: boolean, edgeAfter: boolean): Array<string | Marker> => {
  const out: Array<string | Marker> = [];
  let last = 0;
  for (let i = 0; i < value.length - 1; i += 1) {
    if (value[i] !== '=' || value[i + 1] !== '=') continue;
    /* `===` or longer runs are not markers. */
    if (value[i - 1] === '=' || value[i + 2] === '=') continue;
    OPEN.lastIndex = i;
    CLOSE.lastIndex = i;
    const open = OPEN.test(value) || (edgeAfter && i === value.length - 2);
    const close = CLOSE.test(value) || (edgeBefore && i === 0);
    if (!open && !close) continue;
    if (i > last) out.push(value.slice(last, i));
    out.push({ mark: MARK, open, close });
    last = i + 2;
    i += 1;
  }
  if (last < value.length) out.push(value.slice(last));
  return out;
};

const highlightChildren = (parent: Parent): void => {
  /* Recurse first, so highlights inside bold or a link are handled there. */
  parent.children.forEach((child) => {
    if (!SKIP.has(child.type) && 'children' in child) highlightChildren(child as Parent);
  });

  if (!parent.children.some((c) => c.type === 'text' && c.value.includes('=='))) return;

  /* Flatten into tokens. */
  const tokens: Array<RootContent | Marker> = [];
  const kids = parent.children as RootContent[];
  kids.forEach((child, k) => {
    if (child.type !== 'text') {
      tokens.push(child);
      return;
    }
    const before = k > 0 && kids[k - 1].type !== 'text';
    const after = k < kids.length - 1 && kids[k + 1].type !== 'text';
    splitText(child.value, before, after).forEach((piece) =>
      tokens.push(typeof piece === 'string' ? { type: 'text', value: piece } : piece),
    );
  });

  const isMarker = (t: RootContent | Marker): t is Marker => (t as Marker).mark === MARK;
  const asText = (): RootContent => ({ type: 'text', value: '==' });

  const out: RootContent[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (!isMarker(t)) {
      out.push(t);
      i += 1;
      continue;
    }
    if (!t.open) {
      out.push(asText());
      i += 1;
      continue;
    }
    /* The nearest marker after this one that can close it. */
    let j = i + 1;
    while (j < tokens.length && !(isMarker(tokens[j]) && (tokens[j] as Marker).close)) j += 1;
    if (j >= tokens.length || j === i + 1) {
      out.push(asText());
      i += 1;
      continue;
    }
    const inner = tokens.slice(i + 1, j).map((x) => (isMarker(x) ? asText() : x)) as PhrasingContent[];
    glueShortEnds(inner);
    out.push({
      /* Not a standard mdast type; mdast-util-to-hast turns any node with
         data.hName into that element. */
      type: 'highlight' as 'emphasis',
      /* Which of the three scribbles (study.css). From the phrase's
         length, so it's stable between builds and neighbours differ. */
      data: { hName: 'mark', hProperties: { className: ['hl'], dataHl: String((textLength(inner) % 3) + 1) } },
      children: inner,
    });
    i = j + 1;
  }

  /* Merge adjacent text nodes back together so smartypants and friends see
     whole runs. */
  parent.children = out.reduce<RootContent[]>((acc, node) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.type === 'text' && node.type === 'text') prev.value += node.value;
    else acc.push(node);
    return acc;
  }, []) as Parent['children'];
};

/* Each wrapped line of a highlight gets its own underline, so a line that
   holds just "a" or "of" would get a squashed scribble. A short first or
   last word is tied to its neighbour with a no-break space instead. */
const glueShortEnds = (inner: PhrasingContent[]): void => {
  const first = inner[0];
  if (first?.type === 'text') first.value = first.value.replace(/^(\S{1,3}) (?=\S)/, '$1\u00a0');
  const last = inner[inner.length - 1];
  if (last?.type === 'text') last.value = last.value.replace(/(?<=\S) (\S{1,3}[.,;:!?]?)$/, '\u00a0$1');
};

const textLength = (nodes: Array<RootContent | PhrasingContent>): number =>
  nodes.reduce(
    (n, c) => n + ('value' in c ? String(c.value).length : 'children' in c ? textLength(c.children as RootContent[]) : 0),
    0,
  );

export const remarkHighlight = () => (tree: Root) => highlightChildren(tree);

/** The source with the markers removed — for plain-text uses (word counts,
    meta descriptions, aria labels). */
export const stripHighlights = (source: string): string =>
  source.replace(/==(?=\S)([\s\S]*?\S)==/g, '$1');
