/*
  The motion module. Every animation on this site is created here or through
  the helpers this file exports — nothing else touches GSAP, Lenis or
  ScrollTrigger directly.

  It exists as one file because three separate failure modes all live at the
  same seam, and they can only be solved together:

  1. Astro's <ClientRouter /> swaps the DOM without a page load. ScrollTriggers
     created on the previous page survive the swap and keep pointing at removed
     elements. Left alone, that shows up much later as scroll positions that
     drift, animations that fire early, and a trigger count that climbs with
     every navigation. Everything created here is registered for teardown and
     killed on `astro:before-swap`.

  2. Lenis hijacks scrolling, so ScrollTrigger stops being told when the page
     moved. It has to be driven from GSAP's ticker and wired to
     ScrollTrigger.update, or triggers fire at the wrong positions.

  3. prefers-reduced-motion has to be a single switch, checked in one place and
     reactive to change — users toggle it mid-session, and a value read once at
     load leaves them with the motion they just turned off.
*/

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';

/* Flip isn't here: only /work/ uses it (ProjectsIndex imports and registers
   it), and as part of this module it was 24 KiB on every page. */
gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

/* -------------------------------------------------------------------------
   State
   ---------------------------------------------------------------------- */

type Cleanup = () => void;
type Setup = () => Cleanup | void;

/** Teardown functions for everything created on the current page. */
let pageCleanups: Cleanup[] = [];

/** Setup functions registered by components, re-run on every page load. */
const setups = new Set<Setup>();

/*
  Which setups have already been built for the page currently on screen.

  Without this a setup could run twice on one page. `registerMotion` runs a
  setup immediately when the system has already started — so that a component
  registering late still animates — and `buildPage` then runs every setup in
  the registry, including that one. Whether it happened came down to whether a
  given script was evaluated before or after `initMotion`, which is bundle
  order and not something a component can reason about: page-level scripts lost
  that race and component scripts didn't. The symptom was two ScrollTriggers
  per element, which reads as a leak and doubles the work on every scroll.
*/
const builtSetups = new Set<Setup>();

let lenis: Lenis | null = null;
let started = false;
let built = false;
/** Where the page should sit once it's built: a saved scroll position for
    Back/Forward, an element id for a link with a #hash, or null (the top,
    which the router already gave it). Set on astro:after-swap, used once by
    buildPage. */
let landing: number | string | null = null;

const reduceQuery =
  typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;

/** The single source of truth. Nothing else reads the media query. */
export const prefersReducedMotion = (): boolean => reduceQuery?.matches ?? false;

/**
 * Where a scroll reveal starts by default. On a desktop screen 'top 85%'
 * leaves a moment of anticipation; on a phone, where 15–18% of the screen is
 * a whole paragraph, it left a band of nothing at the bottom of every
 * screen until the thing above it scrolled further. Below 1024 a reveal
 * starts as its top clears the bottom edge. Callers that pass their own
 * start keep it.
 */
export const revealStart = (desktop: string): string =>
  typeof matchMedia === 'function' && matchMedia('(max-width: 63.999rem)').matches
    ? 'top 97%'
    : desktop;

/* -------------------------------------------------------------------------
   Timing tokens

   Durations and easings are defined once in global.css. Reading them back off
   the document keeps JS timings and CSS timings from drifting apart as the
   design changes.
   ---------------------------------------------------------------------- */

const cssTime = (name: string, fallback: number): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return fallback;
  return raw.endsWith('ms') ? value / 1000 : value;
};

export const duration = {
  get fast() {
    return cssTime('--duration-fast', 0.24);
  },
  get base() {
    return cssTime('--duration-base', 0.55);
  },
  get slow() {
    return cssTime('--duration-slow', 0.9);
  },
  get reveal() {
    return cssTime('--duration-reveal', 1.1);
  },
  get snap() {
    return cssTime('--duration-snap', 0.42);
  },
};

/*
  GSAP does not understand the `cubic-bezier()` string CSS uses — handing it
  one silently falls back to a default ease, which is the kind of bug you feel
  but can't see. CustomEase takes the same four control points as an SVG path,
  so these are the exact curves declared in the --ease-* tokens.

  A cubic-bezier(x1, y1, x2, y2) becomes "M0,0 C x1,y1 x2,y2 1,1".
*/
const bezier = (name: string, x1: number, y1: number, x2: number, y2: number) =>
  CustomEase.create(name, `M0,0 C${x1},${y1} ${x2},${y2} 1,1`);

export const ease = {
  outSoft: bezier('outSoft', 0.22, 1, 0.36, 1),
  /* Overshoots and settles. For anything that should land rather than drift. */
  snap: bezier('snap', 0.16, 1.32, 0.36, 1),
  outStrata: bezier('outStrata', 0.16, 0.84, 0.24, 1),
  inOutSoft: bezier('inOutSoft', 0.65, 0, 0.35, 1),
} as const;

/* -------------------------------------------------------------------------
   Registration
   ---------------------------------------------------------------------- */

/**
 * Register a setup function to run on every page load and be torn down before
 * every view transition. This is how components opt into bespoke motion —
 * they never add their own `astro:page-load` listener, because a listener that
 * outlives its element is exactly the leak this module exists to prevent.
 *
 * Setups are skipped under reduced motion, unless registered with
 * `{ reduced: true }`. That is for the few things that still have a job to do
 * with motion off (the header's active bar and scroll progress): such a setup
 * runs either way and checks prefersReducedMotion() itself.
 */
export const registerMotion = (setup: Setup, options: { reduced?: boolean } = {}): void => {
  setups.add(setup);
  if (options.reduced) reducedSetups.add(setup);
  /* If pages have already loaded, run it now so late registration still works
     (a component below the fold, hydrated after `astro:page-load` fired). */
  if (started && built && runsNow(setup) && !builtSetups.has(setup)) {
    builtSetups.add(setup);
    const cleanup = guard('a registered setup', setup);
    if (cleanup) pageCleanups.push(cleanup);
  }
};

/** Setups that also run under reduced motion. */
const reducedSetups = new Set<Setup>();
const runsNow = (setup: Setup) => !prefersReducedMotion() || reducedSetups.has(setup);

/** Record a teardown function against the current page. */
const onTeardown = (cleanup: Cleanup): void => {
  pageCleanups.push(cleanup);
};

/* -------------------------------------------------------------------------
   Helpers

   Each returns nothing and registers its own teardown. Callers never hold a
   reference they have to remember to kill.
   ---------------------------------------------------------------------- */

const toElements = (target: string | Element | Iterable<Element>): HTMLElement[] => {
  if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
  if (target instanceof Element) return [target as HTMLElement];
  return Array.from(target) as HTMLElement[];
};

/*
  Whether an element has a box to trigger on. Something hidden at this
  breakpoint (inside `lg:hidden`), a `display: contents` wrapper or an empty
  0×0 node measures as sitting at the very top of the page, so its trigger
  resolves to start 0 / end 0. ScrollTrigger reads an end of 0 as "not set
  up yet" and refreshes it again inside the next trigger's refresh, where a
  `once` trigger that has already passed fires and kills itself, shrinking
  the list ScrollTrigger is walking. The next lookup is undefined and throws
  "Cannot read properties of undefined (reading 'end')". Such targets are
  shown as they are instead of animated.
*/
const hasBox = (el: Element): boolean => {
  const rect = el.getBoundingClientRect();
  return el.getClientRects().length > 0 && rect.width > 0 && rect.height > 0;
};

/*
  Run one piece of motion setup so that a failure stays local. Without this
  one bad element threw out of the whole page build and every reveal after it
  stayed hidden, leaving the rest of the page blank.
*/
const guard = <T>(label: string, run: () => T): T | undefined => {
  try {
    return run();
  } catch (error) {
    console.error(`[motion] ${label} failed; the rest of the page still animates.`, error);
    return undefined;
  }
};

type RevealOptions = {
  /** Vertical travel in pixels. */
  y?: number;
  /** Seconds between siblings in the same call. */
  stagger?: number;
  /** How far into the viewport before it fires. */
  start?: string;
  duration?: number;
};

/**
 * Fade and rise elements as they enter the viewport, once each.
 *
 * Elements are marked `is-revealed` on completion. global.css only hides
 * unrevealed elements while `html.motion-ok` is set, so content stays visible
 * for reduced-motion users and if this script never runs at all.
 */
export const revealOnScroll = (
  target: string | Element | Iterable<Element>,
  options: RevealOptions = {},
): void => {
  const all = toElements(target);
  /* Boxless targets are shown as they are (see hasBox). */
  const elements = prefersReducedMotion() ? all : all.filter(hasBox);
  all.filter((el) => !elements.includes(el)).forEach((el) => el.classList.add('is-revealed'));
  if (!elements.length || prefersReducedMotion()) {
    elements.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const { y = 28, stagger = 0.08, start = revealStart('top 85%'), duration: d = duration.reveal } = options;

  const tween = gsap.fromTo(
    elements,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration: d,
      stagger,
      ease: ease.outSoft,
      onStart: () => elements.forEach((el) => el.classList.add('is-revealed')),
      scrollTrigger: {
        trigger: elements[0],
        start,
        once: true,
      },
    },
  );

  onTeardown(() => {
    tween.scrollTrigger?.kill();
    tween.kill();
  });
};

type SplitOptions = {
  /** Words (the default) or whole lines. Lines suit long display headlines,
      where a word-by-word stagger takes too long to read. */
  by?: 'words' | 'lines';
  stagger?: number;
  start?: string;
  duration?: number;
};

/*
  A words split has to break exactly where the plain heading does. Each word
  becomes an inline-block, and a row of inline-blocks doesn't wrap like text:
  the boxes round their widths up and lose the kerning into the space, so a
  line the plain heading fills to within a pixel no longer fits. At 390,
  Lincoln's "Parent and staff feedback" (second line 349.7px in a 350px box)
  went from two lines to three while split and snapped back to two when the
  split reverted, about a second after landing. That 30px jump moved
  everything below it, so an anchor or a Back position landed off.

  So the plain text's own line breaks are read first, one point per word,
  and the split is held to them: a <br> before each word that started a
  line, and no wrapping of its own until revert(). revert() restores the
  original markup, which takes the <br>s with it.
*/
const plainLineStarts = (el: HTMLElement): { starts: number[]; words: number } => {
  const starts: number[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let words = 0;
  let lastTop: number | null = null;
  /* A word can run across an element boundary (part of it in an <em>), and
     SplitText counts that as one word. Only a whitespace boundary starts a
     new one. */
  let inWord = false;
  /* A new block (the footer question is two block spans) already starts a
     line; a <br> there would add an empty one. */
  const blockOf = (node: Node): Element => {
    let at = node.parentElement;
    while (at && at !== el && getComputedStyle(at).display.startsWith('inline')) at = at.parentElement;
    return at ?? el;
  };
  let lastBlock: Element | null = null;
  let afterWrap = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? '';
    const block: Element | null = /\S/.test(text) ? blockOf(node) : lastBlock;
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const continues = inWord && m.index === 0;
      inWord = m.index + m[0].length === text.length;
      if (continues) continue;
      range.setStart(node, m.index);
      range.setEnd(node, m.index + 1);
      const top = range.getBoundingClientRect().top;
      /* The plain text may break inside a word at its hyphen ("ONE-" /
         "DAY"); a split word can't, so the whole word goes to the next
         line instead of running off the side (a 390 phone, ALL IN). */
      range.setStart(node, m.index + m[0].length - 1);
      range.setEnd(node, m.index + m[0].length);
      const end = range.getBoundingClientRect().top;
      const wraps = end > top + 1;
      /* The word after it starts a line too: in the plain text it shared a
         line with the word's tail only. */
      if (lastTop !== null && (top > lastTop + 1 || wraps || afterWrap) && block === lastBlock) starts.push(words);
      afterWrap = wraps;
      lastTop = end;
      lastBlock = block;
      words += 1;
    }
    if (!/\S$/.test(text)) inWord = false;
  }
  return { starts, words };
};

const holdLineBreaks = (el: HTMLElement, create: () => SplitText): SplitText => {
  /* Breaks read in the fallback face would be held after the web font
     arrives. splitHeadline waits for fonts; anything else just wraps. */
  if (document.fonts && document.fonts.status !== 'loaded') return create();
  const { starts, words } = plainLineStarts(el);
  const split = create();
  /* If the counts disagree the mapping is a guess; better the old wrap than
     breaks in the wrong places. */
  if (split.words.length !== words) return split;
  starts.forEach((i) => {
    const word = split.words[i] as HTMLElement;
    const box = word.parentElement?.classList.contains('split-word-mask') ? word.parentElement : word;
    box.before(document.createElement('br'));
  });
  const before = el.style.whiteSpace;
  el.style.whiteSpace = 'nowrap';
  const revert = split.revert.bind(split);
  split.revert = () => {
    revert();
    el.style.whiteSpace = before;
    return split;
  };
  return split;
};

/**
 * Split a heading into masked words (or lines) and return the pieces.
 *
 * Each piece sits inside a clipping wrapper, so animating it on yPercent makes
 * it slide up from behind its own baseline rather than fade in. Never letters:
 * a headline that arrives one character at a time takes too long to read.
 *
 * On a heading, `aria: 'auto'` puts the original text on it as an aria-label
 * and hides the generated spans, so a screen reader still hears one sentence.
 * An aria-label isn't allowed on a <p> or <span> with no role (and is often
 * ignored there), so for those the spans are hidden and the original text is
 * added as a visually hidden copy instead. revert() puts the original markup
 * back, which removes that copy too.
 * Callers own the returned split and must revert() it in their teardown.
 */
export const maskSplit = (el: HTMLElement, by: 'words' | 'lines' = 'words'): SplitText => {
  const heading = /^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading';
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const create = () =>
    SplitText.create(el, {
      type: by === 'lines' ? 'lines' : 'words',
      mask: by,
      wordsClass: 'split-word',
      linesClass: 'split-line',
      aria: heading ? 'auto' : 'none',
    });
  /* A lines split measures the lines itself, so only words need holding. */
  const split = by === 'words' ? holdLineBreaks(el, create) : create();
  if (!heading) {
    split.masks.forEach((m) => m.setAttribute('aria-hidden', 'true'));
    const copy = document.createElement('span');
    copy.className = 'sr-only';
    copy.textContent = text;
    el.append(copy);
  }
  return split;
};

/**
 * The vertical offset an unrevealed `[data-settle]` element or page title is
 * painted at (motion.css), in px, so a tween can take over from exactly
 * where the CSS left it. Read it before adding `is-revealed`.
 */
export const settleOffset = (el: Element): number => {
  const t = getComputedStyle(el).translate;
  return t && t !== 'none' ? parseFloat(t.split(' ')[1] ?? '0') || 0 : 0;
};

/**
 * Reveal a headline word by word (or line by line) as it scrolls into view,
 * once. Not scrubbed — a heading that un-reveals on the way back up is noise.
 *
 * The split is reverted as soon as the reveal finishes, so the heading is
 * plain text again and reflows normally on resize; a lines split left in place
 * would keep the line breaks it measured at load.
 */
export const splitHeadline = (
  target: string | Element,
  options: SplitOptions = {},
): void => {
  const [el] = toElements(target);
  if (!el) return;

  if (prefersReducedMotion()) {
    el.classList.add('is-revealed');
    return;
  }

  const {
    by = 'words',
    stagger = by === 'lines' ? 0.12 : 0.07,
    start = revealStart('top 85%'),
    duration: d = duration.slow,
  } = options;

  let split: SplitText | null = null;
  let tween: gsap.core.Tween | null = null;
  let cancelled = false;

  /* A page title (the h1) is the biggest text on the first screen, so it's
     what the browser times as the page having loaded. It can't sit hidden
     behind a mask until the script and fonts arrive, so it paints at full
     opacity from the first frame, a little low (motion.css), and settles
     up into place line by line. Transform only. */
  const settle = el.tagName === 'H1';

  const build = () => {
    if (cancelled) return;
    if (settle) {
      const from = settleOffset(el);
      const create = () => SplitText.create(el, { type: by, linesClass: 'split-line', wordsClass: 'split-word', aria: 'auto' });
      split = by === 'words' ? holdLineBreaks(el, create) : create();
      const pieces = by === 'lines' ? split.lines : split.words;
      gsap.set(pieces, { y: from });
      el.classList.add('is-revealed');
      /* Longer and gentler than the mask reveal: the type is already
         readable, so this is a glide into place, not an entrance. */
      tween = gsap.to(pieces, {
        y: 0,
        duration: duration.reveal + 0.1,
        stagger,
        ease: 'power2.out',
        onComplete: () => {
          split?.revert();
          split = null;
        },
      });
      return;
    }
    split = maskSplit(el, by);
    const pieces = by === 'lines' ? split.lines : split.words;
    tween = gsap.from(pieces, {
      yPercent: 110,
      duration: d,
      stagger,
      ease: ease.outStrata,
      scrollTrigger: { trigger: el, start, once: true },
      onComplete: () => {
        split?.revert();
        split = null;
      },
    });
    el.classList.add('is-revealed');
  };

  /* Line breaks depend on the web font's metrics. Splitting before it has
     loaded measures the fallback face and the lines come out wrong — for a
     words split too, since it holds the breaks it reads at split time. */
  if (document.fonts && document.fonts.status !== 'loaded') {
    document.fonts.ready.then(build);
  } else {
    build();
  }

  onTeardown(() => {
    cancelled = true;
    tween?.scrollTrigger?.kill();
    tween?.kill();
    /* revert() puts the original text node back. Skipping it would leave the
       DOM full of orphaned spans after every navigation. */
    split?.revert();
  });
};

type ParallaxOptions = {
  /** Total travel in pixels across the scroll range. Negative moves up. */
  distance?: number;
  /** Element whose scroll range drives the movement. Defaults to the layer. */
  trigger?: string | Element;
};

/** Drift an element against the scroll. The building block of the strata hero. */
export const parallaxLayer = (
  target: string | Element,
  options: ParallaxOptions = {},
): void => {
  const [el] = toElements(target);
  if (!el || prefersReducedMotion()) return;

  const { distance = -80, trigger } = options;
  const [triggerEl] = trigger ? toElements(trigger) : [el.parentElement ?? el];

  const tween = gsap.to(el, {
    y: distance,
    ease: 'none',
    scrollTrigger: {
      trigger: triggerEl,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  onTeardown(() => {
    tween.scrollTrigger?.kill();
    tween.kill();
  });
};

type MagneticOptions = {
  /** Fraction of the cursor offset the element follows. */
  strength?: number;
};

/**
 * Pull an element gently toward the cursor on hover.
 *
 * Pointer-based, so it's skipped entirely on touch — on a coarse pointer there
 * is no hover to respond to, and the listeners would just cost battery.
 */
export const magnetic = (
  target: string | Element | Iterable<Element>,
  options: MagneticOptions = {},
): void => {
  if (prefersReducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return;
  }

  const { strength = 0.35 } = options;

  toElements(target).forEach((el) => {
    const quickX = gsap.quickTo(el, 'x', { duration: duration.fast, ease: ease.outSoft });
    const quickY = gsap.quickTo(el, 'y', { duration: duration.fast, ease: ease.outSoft });

    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      quickX((event.clientX - (box.left + box.width / 2)) * strength);
      quickY((event.clientY - (box.top + box.height / 2)) * strength);
    };

    const reset = () => {
      quickX(0);
      quickY(0);
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', reset);

    onTeardown(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', reset);
      gsap.killTweensOf(el);
      gsap.set(el, { x: 0, y: 0 });
    });
  });
};

/**
 * Count a number up when it scrolls into view.
 *
 * Reads the number out of the element's own text and puts back the same string
 * shape it found — so "109" counts, "8/8" counts the first figure and keeps the
 * "/8", and "Weeks → hours" is left alone because there is nothing to count.
 * The alternative is a `data-value` attribute duplicating the number in the
 * markup, which is a second place for it to be wrong.
 *
 * The element is width-locked before it animates. Digits are not the same width
 * in most faces, so a counter running 0 → 109 reflows its own row on nearly
 * every frame and shoves the layout around while it does.
 */
export const countUp = (target: string | Element | Iterable<Element>): void => {
  toElements(target).forEach((el) => {
    const raw = el.textContent ?? '';
    const match = raw.match(/^(\D*?)([\d,]+(?:\.\d+)?)(.*)$/s);
    if (!match) return;

    const [, prefix, digits, suffix] = match;
    const decimals = digits.includes('.') ? digits.split('.')[1].length : 0;
    const grouped = digits.includes(',');
    const value = parseFloat(digits.replace(/,/g, ''));
    if (!Number.isFinite(value)) return;

    const render = (n: number) => {
      const fixed = n.toFixed(decimals);
      const shown = grouped ? Number(fixed).toLocaleString('en-US') : fixed;
      el.textContent = `${prefix}${shown}${suffix}`;
    };

    /* Boxless counters keep their real number (see hasBox). */
    if (prefersReducedMotion() || !hasBox(el)) {
      el.classList.add('is-revealed');
      return;
    }

    const width = el.getBoundingClientRect().width;
    if (width) (el as HTMLElement).style.minWidth = `${Math.ceil(width)}px`;

    const counter = { n: 0 };
    const tween = gsap.to(counter, {
      n: value,
      duration: duration.slow,
      ease: ease.outStrata,
      onUpdate: () => render(counter.n),
      onComplete: () => render(value),
      scrollTrigger: { trigger: el, start: revealStart('top 88%'), once: true },
    });

    onTeardown(() => {
      tween.scrollTrigger?.kill();
      tween.kill();
      render(value);
      (el as HTMLElement).style.removeProperty('min-width');
    });
  });
};

/**
 * Scroll a strip of content forever, seamlessly.
 *
 * The content is duplicated once and the track translated by exactly half its
 * width, so the loop point lands on identical pixels. The clone is hidden from
 * the accessibility tree — a screen reader hearing the whole list twice is the
 * usual cost of this effect, and it is avoidable.
 */
export const marquee = (
  target: string | Element | Iterable<Element>,
  options: { speed?: number; reverse?: boolean } = {},
): void => {
  toElements(target).forEach((el) => {
    if (prefersReducedMotion()) return;

    const track = el.querySelector<HTMLElement>('[data-marquee-track]');
    if (!track || track.dataset.marqueeReady === 'true') return;

    const { speed = 55, reverse = false } = options;

    const clone = track.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('data-marquee-track');
    track.parentElement?.appendChild(clone);
    track.dataset.marqueeReady = 'true';

    const distance = track.scrollWidth;
    if (!distance) return;

    const tween = gsap.fromTo(
      [track, clone],
      { x: reverse ? -distance : 0 },
      {
        x: reverse ? 0 : -distance,
        duration: distance / speed,
        ease: 'none',
        repeat: -1,
      },
    );

    onTeardown(() => {
      tween.kill();
      clone.remove();
      delete track.dataset.marqueeReady;
      gsap.set(track, { clearProps: 'transform' });
    });
  });
};

/**
 * Wipe an element into view behind a moving mask, with its contents drifting
 * inside the frame so the image arrives rather than appears.
 *
 * The mask is a clip-path on the element and the drift is a transform on its
 * first child, which is why markup using this needs a wrapper: animating both
 * on one node would mean the transform moved the clip region too, and the mask
 * would travel with the thing it is supposed to be revealing.
 *
 * Content is left fully visible under reduced motion rather than merely
 * un-wiped — a clip-path that never animates is an invisible element.
 */
export const maskReveal = (
  target: string | Element | Iterable<Element>,
  options: { duration?: number; start?: string; y?: number } = {},
): void => {
  const elements = toElements(target);
  if (!elements.length) return;

  if (prefersReducedMotion()) {
    elements.forEach((el) => {
      el.style.clipPath = 'none';
      el.classList.add('is-revealed');
    });
    return;
  }

  const { duration: d = duration.reveal, start = revealStart('top 82%'), y = 56 } = options;

  elements.forEach((el) => {
    /* A clip-path does nothing on a `display: contents` node anyway. */
    if (!hasBox(el)) {
      el.style.clipPath = 'none';
      el.classList.add('is-revealed');
      return;
    }

    const inner = el.firstElementChild as HTMLElement | null;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: el, start, once: true },
      onStart: () => el.classList.add('is-revealed'),
    });

    tl.fromTo(
      el,
      { clipPath: 'inset(100% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: d, ease: ease.outStrata },
    );

    if (inner) tl.from(inner, { y, duration: d, ease: ease.outStrata }, 0);

    onTeardown(() => {
      tl.scrollTrigger?.kill();
      tl.kill();
    });
  });
};

/**
 * Animate a container whose children are about to be reordered.
 *
 * FLIP: record where every child is, let the caller mutate (which changes CSS
 * `order` and so relayouts), then read the new positions and animate the delta
 * away. Reading a rect immediately after the mutation forces the synchronous
 * layout this depends on, so no rAF is needed between the two measurements.
 *
 * Only the vertical axis is animated, because the only thing that reorders on
 * this site is a single flex column — a general-purpose FLIP would carry
 * transform and scale interpolation the layout can never produce.
 *
 * `apply` is always called, exactly once, including under reduced motion. A
 * mode switch that silently didn't happen would be far worse than one that
 * happened without animation.
 */
export const flipChildren = (container: HTMLElement, apply: () => void): void => {
  const items = Array.from(container.children) as HTMLElement[];

  if (prefersReducedMotion() || !items.length) {
    apply();
    return;
  }

  const before = new Map(items.map((el) => [el, el.getBoundingClientRect().top]));

  apply();

  items.forEach((el) => {
    const start = before.get(el);
    if (start === undefined) return;

    const delta = start - el.getBoundingClientRect().top;
    if (Math.abs(delta) < 1) return;

    const tween = gsap.fromTo(
      el,
      { y: delta },
      {
        y: 0,
        duration: duration.base,
        ease: ease.outStrata,
        overwrite: 'auto',
        /* The element's resting state is untransformed. Leaving y: 0 inline
           would fight any parallax that later targets the same node. */
        clearProps: 'transform',
      },
    );

    onTeardown(() => tween.kill());
  });

  /* Section positions just moved, so every trigger measured against them is
     now wrong. Without this, reveals fire at the old scroll offsets. */
  ScrollTrigger.refresh();
};

/* -------------------------------------------------------------------------
   Declarative wiring

   Components add attributes; they don't write JavaScript. Keeping the wiring
   here means there's one place to audit when motion misbehaves.
   ---------------------------------------------------------------------- */

const wireDeclarative = (): void => {
  /* Every element is wired on its own, through guard(): one that throws is
     shown un-animated and the rest of the page carries on. */
  const shown = (els: Element[]) => els.forEach((el) => el.classList.add('is-revealed'));

  /* Group [data-reveal] elements by their shared [data-reveal-group] ancestor
     so siblings stagger together rather than each firing on its own. */
  const grouped = new Set<Element>();

  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const children = Array.from(
      group.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal="manual"])'),
    );
    if (!children.length) return;
    children.forEach((child) => grouped.add(child));
    if (
      guard('data-reveal-group', () => {
        revealOnScroll(children, { stagger: Number(group.dataset.revealStagger) || undefined });
        return true;
      }) === undefined
    )
      shown(children);
  });

  /* data-reveal="manual" keeps the hidden-until-revealed CSS gate but leaves
     the choreography to a bespoke setup (the hero, the work rows). */
  document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal="manual"])').forEach((el) => {
    if (grouped.has(el)) return;
    if (
      guard('data-reveal', () => {
        revealOnScroll(el, { y: Number(el.dataset.revealY) || undefined });
        return true;
      }) === undefined
    )
      shown([el]);
  });

  document.querySelectorAll<HTMLElement>('[data-mask]').forEach((el) => {
    if (
      guard('data-mask', () => {
        maskReveal(el, { y: Number(el.dataset.mask) || undefined });
        return true;
      }) === undefined
    ) {
      el.style.clipPath = 'none';
      shown([el]);
    }
  });

  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => guard('data-count', () => countUp(el)));

  document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((el) =>
    guard('data-marquee', () =>
      marquee(el, {
        speed: Number(el.dataset.marquee) || undefined,
        reverse: el.dataset.marqueeReverse !== undefined,
      }),
    ),
  );

  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) =>
    guard('data-parallax', () => parallaxLayer(el, { distance: Number(el.dataset.parallax) || undefined })),
  );

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) =>
    guard('data-magnetic', () => magnetic(el, { strength: Number(el.dataset.magnetic) || undefined })),
  );
};

/* Split headings are wired after the registered setups, not with the rest:
   a split holds the line breaks it reads (holdLineBreaks), so anything a
   setup does to a heading's size has to happen first. (fitHeadings used to;
   headings are a fixed scale now, but the order is kept for any setup that
   changes layout.) */
const wireSplits = (): void => {
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) =>
    guard('data-split', () => splitHeadline(el, { by: el.dataset.split === 'lines' ? 'lines' : 'words' })),
  );
};

/* -------------------------------------------------------------------------
   Lifecycle
   ---------------------------------------------------------------------- */

const startLenis = (): void => {
  if (lenis || prefersReducedMotion()) return;

  lenis = new Lenis({
    duration: 1.05,
    /* Slightly softer than the default so long case-study pages don't feel
       like they're sliding out from under the cursor. */
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    /* Touch devices already have momentum scrolling. Doubling it feels wrong
       and costs a frame budget we'd rather spend on the hero. */
    syncTouch: false,
  });

  /* Without this, ScrollTrigger never learns the page moved. */
  lenis.on('scroll', ScrollTrigger.update);

  /* One ticker, not two RAF loops fighting each other. */
  gsap.ticker.add(rafDriver);
  gsap.ticker.lagSmoothing(0);

  document.documentElement.classList.add('lenis-active');
};

const rafDriver = (time: number): void => {
  /* GSAP's ticker reports seconds; Lenis expects milliseconds. */
  lenis?.raf(time * 1000);
};

const stopLenis = (): void => {
  if (!lenis) return;
  gsap.ticker.remove(rafDriver);
  gsap.ticker.lagSmoothing(500, 33);
  lenis.destroy();
  lenis = null;
  document.documentElement.classList.remove('lenis-active');
};

/** Tear down everything belonging to the page that's on its way out. */
const teardownPage = (): void => {
  built = false;
  /* The next page builds every setup again from scratch. */
  builtSetups.clear();
  pageCleanups.forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      /* A failing teardown must not stop the others from running. */
    }
  });
  pageCleanups = [];

  /* The backstop. Anything that escaped the registry dies here — this is the
     line that keeps the trigger count from climbing across navigations. */
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
};

/*
  Back/Forward and #hash links. The router scrolls to the saved position (or
  the anchor) as soon as the new DOM is in, but that page isn't the one that
  was left yet: the pin spacers don't exist, so a pinned section above the
  saved spot is missing (all-in came back ~10,000px off once the pins arrived
  and scroll anchoring followed the content) and a spot near the bottom is
  clamped against a page that is still too short (prolook came back 350px
  low). Once the setups have built the real layout, put the saved position
  back — before paint, and before ScrollTrigger measures, so reveals fire
  against the right offset. An anchor drifts the same way (#role on a
  desktop case study landed 240px past its heading), so it is measured
  again. Lenis is told too, or its next frame drags the page back.
*/
const restoreLanding = (): void => {
  if (landing === null) return;
  let y = landing;
  if (typeof y === 'string') {
    const el = document.getElementById(y);
    if (!el) return;
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    y = Math.round(el.getBoundingClientRect().top + window.scrollY - margin);
  }
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo(window.scrollX, y);
  if (lenis) {
    lenis.resize();
    lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  }
};

/**
 * Build everything for the page that just arrived.
 *
 * Idempotent. On the initial load this can be reached twice — once from the
 * direct call in initMotion and once from `astro:page-load` — and building
 * twice would double every trigger on the first page, which is precisely the
 * leak this module exists to prevent. Tearing down first makes the race moot
 * instead of relying on the events arriving in a particular order.
 */
const buildPage = (): void => {
  if (built) teardownPage();
  built = true;

  const root = document.documentElement;

  if (prefersReducedMotion()) {
    /*
      Reveal-on-scroll content must be visible, not merely un-animated.

      Killing a tween does not undo what it already wrote. Anything caught
      mid-reveal still carries an inline opacity of 0, and an inline style
      beats the class below every time — so the inline props have to be cleared
      before the class is added, or someone who switches Reduce Motion on
      part-way down the page is left looking at blank space.
    */
    root.classList.remove('motion-ok');

    const animated = document.querySelectorAll('[data-reveal], [data-parallax]');
    if (animated.length) gsap.set(animated, { clearProps: 'opacity,transform' });

    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
    runSetups();
    restoreLanding();
    landing = null;
    return;
  }

  root.classList.add('motion-ok');
  startLenis();
  wireDeclarative();

  runSetups();
  wireSplits();

  /* Twice: refresh() sizes the pin spacers, so a position that was clamped
     against the shorter page only fits once it has run. refresh() keeps the
     scroll it started from, so the first call is what it measures against. */
  restoreLanding();
  /* Layout has settled by now; make sure trigger positions match reality. */
  guard('ScrollTrigger.refresh', () => ScrollTrigger.refresh());
  restoreLanding();
  landing = null;
  watchPageHeight();
};

/*
  Below 1024, lazy images, the step viewers and the eras settle their heights
  after the triggers were measured (WebKit especially, where a Lincoln
  section moved 165px after load). Every reveal under that point then fired
  late or not at all, leaving a band of blank page. When the page's height
  changes, the triggers are measured again. Desktop keeps its own timing.
*/
let heightWatch: ResizeObserver | null = null;
const watchPageHeight = (): void => {
  heightWatch?.disconnect();
  heightWatch = null;
  if (typeof ResizeObserver !== 'function' || !matchMedia('(max-width: 63.999rem)').matches) return;
  let last = document.body.offsetHeight;
  let timer = 0;
  heightWatch = new ResizeObserver(() => {
    const h = document.body.offsetHeight;
    if (Math.abs(h - last) < 2) return;
    last = h;
    clearTimeout(timer);
    timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
  });
  heightWatch.observe(document.body);
  pageCleanups.push(() => {
    clearTimeout(timer);
    heightWatch?.disconnect();
    heightWatch = null;
  });
};

/** Run every registered setup not yet built for this page (under reduced
    motion, only the ones registered with `reduced: true`). */
const runSetups = (): void => {
  setups.forEach((setup) => {
    if (builtSetups.has(setup) || !runsNow(setup)) return;
    builtSetups.add(setup);
    /* One setup throwing must not stop the ones after it. */
    const cleanup = guard('a registered setup', setup);
    if (cleanup) pageCleanups.push(cleanup);
  });
};

const handleMotionPreferenceChange = (): void => {
  teardownPage();
  if (prefersReducedMotion()) {
    stopLenis();
    /* Undo any transforms left mid-flight by the animations just killed. */
    gsap.globalTimeline.clear();
  }
  buildPage();
};

/**
 * Rebuild the page's motion around a change to its content, the same path
 * a reduced-motion change takes: tear everything down (triggers, pins,
 * splits, the setups' own listeners), let `apply` change the DOM, then build
 * every setup again against what is now there. For content that swaps in
 * place — the case study's Quick overview / Full case study switch — where
 * pins and reveals measured against the old content would be wrong.
 */
export const rebuildPage = (apply: () => void): void => {
  /* Build from the top of the page and put the scroll back afterwards
     (restoreLanding, the Back/Forward path). Building far down the page
     created run-once triggers that had already passed; each fired and
     killed itself inside ScrollTrigger's refresh loop and broke it ("reading
     'end' of undefined"), leaving every later reveal hidden. All of this
     happens in one task, so nothing paints at the top. */
  const y = window.scrollY;
  teardownPage();
  guard('rebuildPage apply', apply);
  window.scrollTo(window.scrollX, 0);
  lenis?.resize();
  lenis?.scrollTo(0, { immediate: true, force: true });
  landing = y;
  buildPage();
};

/*
  Keyboard focus landing in content that hasn't revealed yet (Tab to a link
  far down the page, before its scroll trigger has fired) would put a focus
  ring on blank space: the element is still at opacity 0, clipped or below
  its mask. So on focusin, every reveal target around the focused element
  that is still mid-reveal or waiting for its trigger is finished on the
  spot: its tween (or the timeline it sits in) is jumped to the end and its
  scroll trigger dropped, which only affects that one reveal. Split headings
  and masks are included, through the words or lines they animate.
  `is-revealed` alone isn't the signal: some setups (the homepage
  Experience rows) add it up front and then hide the element with their own
  tween. Scrubbed tweens are left alone; they follow the scroll position.
*/
const REVEAL_TARGETS = '[data-reveal], [data-split], [data-mask], [data-settle], [data-count]';

const finishReveal = (el: HTMLElement): void => {
  const pieces = [el, ...Array.from(el.querySelectorAll<HTMLElement>('.split-word, .split-line'))];
  gsap.getTweensOf(pieces).forEach((tween) => {
    const parent = tween.parent;
    const owner = parent && parent !== gsap.globalTimeline ? parent : tween;
    if (owner.progress() >= 1 || owner.scrollTrigger?.vars.scrub) return;
    owner.scrollTrigger?.kill();
    owner.progress(1);
  });
  el.classList.add('is-revealed');
  if (el.matches('[data-mask]')) el.style.clipPath = 'none';
};

const revealOnFocus = (event: FocusEvent): void => {
  if (!built || prefersReducedMotion()) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
    if (node instanceof HTMLElement && node.matches(REVEAL_TARGETS)) {
      guard('reveal on focus', () => finishReveal(node as HTMLElement));
    }
  }
};

/**
 * Boot the motion system. Called once from the base layout.
 *
 * Safe to call more than once — Astro fires `astro:page-load` on the initial
 * load as well as after every view transition, and the guard below keeps the
 * lifecycle listeners from stacking up.
 */
export const initMotion = (): void => {
  if (started) return;
  started = true;

  /* The head script hides reveal targets before first paint and arms a
     failsafe in case this module never loads. It has, so disarm it. */
  window.clearTimeout(window.__motionFailsafe);

  /* Focus never lands on content that's still hidden (revealOnFocus). */
  document.addEventListener('focusin', revealOnFocus);

  /*
    Only build on page-load if this page hasn't been built yet. On the first
    load the frame-later safety net below almost always wins the race — in dev
    page-load arrives ~800ms later — and rebuilding then tore down the hero
    entrance mid-flight and played it a second time. After a swap,
    teardownPage has cleared `built`, so navigations still build normally.
  */
  document.addEventListener('astro:page-load', () => {
    if (!built) buildPage();
  });
  let swapWasTraverse = false;
  document.addEventListener('astro:before-swap', (event) => {
    swapWasTraverse = (event as Event & { navigationType?: string }).navigationType === 'traverse';
    teardownPage();
  });

  /* The new document is in place but hasn't painted, and the router has
     already put the window where it belongs: the top for a new page, the
     anchor for a #hash link, the saved spot for Back/Forward. Lenis has to
     follow that, not the other way round. Forcing 0 here would break the
     back button. */
  document.addEventListener('astro:after-swap', () => {
    /* On Back/Forward, history.state is already the entry being returned to. */
    const saved = (history.state as { scrollY?: unknown } | null)?.scrollY;
    const hash = decodeURIComponent(location.hash.slice(1));
    landing = swapWasTraverse ? (typeof saved === 'number' ? saved : null) : hash || null;
    if (!lenis) return;

    /* A link clicked within a second of the last wheel turn arrives while
       Lenis is still easing toward that wheel's target. resize() and an
       immediate scrollTo() both leave that tween running (scrollTo even
       returns early once resize() has synced the target to 0), so on the
       next frame it carried on and dragged the new page back down to the
       old page's scroll position. stop() + start() is the public way to
       run Lenis's reset(): it cancels the tween and re-reads window.scrollY.
       The menu's lock is released on before-swap, so Lenis isn't stopped
       here for any other reason. */
    if (!lenis.isStopped) {
      lenis.stop();
      lenis.start();
    }
    lenis.resize();
    lenis.scrollTo(window.scrollY, { immediate: true, force: true });

    /* ClientRouter copies the new page's <html> attributes over, which
       strips Lenis's classes (and with them lenis.css's height and
       overscroll rules). Lenis only rewrites them when its state changes,
       so put them back now. */
    const root = document.documentElement;
    lenis.className.split(' ').forEach((name) => root.classList.add(name));
    root.classList.add('lenis-active');
  });

  reduceQuery?.addEventListener('change', handleMotionPreferenceChange);

  /* A page going into the back/forward cache comes back exactly as it was
     left, and nothing rebuilds it on the way back (no page-load fires).
     Tearing it down here left a restored page with dead controls and no
     Lenis, so only a page that is really unloading is torn down. */
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    teardownPage();
    stopLenis();
  });

  /*
    ClientRouter fires `astro:page-load` for the initial document as well as
    after every swap, so building here unconditionally would build the first
    page twice — harmless for triggers, since buildPage tears down first, but
    it restarts intro animations mid-flight and runs teardown against elements
    the user is currently looking at.

    So: build directly only when the router is absent, and keep a frame-later
    safety net for the case where the event never arrives at all.
  */
  const routed = document.querySelector('meta[name="astro-view-transitions-enabled"]');

  if (!routed) {
    buildPage();
  } else {
    requestAnimationFrame(() => {
      if (!built) buildPage();
    });
  }
};

declare global {
  interface Window {
    /** Failsafe timer armed by the head script in Base.astro. */
    __motionFailsafe?: number;
  }
}

/** Escape hatch for bespoke work that genuinely needs the raw instances. */
export const motion = {
  gsap,
  ScrollTrigger,
  SplitText,
  get lenis() {
    return lenis;
  },
  /** Live ScrollTrigger count. Climbing across navigations means a leak. */
  get triggerCount() {
    return ScrollTrigger.getAll().length;
  },
};

/*
  Development-only debug handle, so the trigger count can be watched from the
  console and asserted by the verification script. Stripped from production
  builds — the site itself has no business shipping a global.
*/
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __motion: typeof motion }).__motion = motion;
}
