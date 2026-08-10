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

let lenis: Lenis | null = null;
let started = false;
let built = false;

const reduceQuery =
  typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;

/** The single source of truth. Nothing else reads the media query. */
export const prefersReducedMotion = (): boolean => reduceQuery?.matches ?? false;

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
 */
export const registerMotion = (setup: Setup): void => {
  setups.add(setup);
  /* If pages have already loaded, run it now so late registration still works
     (a component below the fold, hydrated after `astro:page-load` fired). */
  if (started && !prefersReducedMotion()) {
    const cleanup = setup();
    if (cleanup) pageCleanups.push(cleanup);
  }
};

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
  const elements = toElements(target);
  if (!elements.length || prefersReducedMotion()) {
    elements.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const { y = 28, stagger = 0.08, start = 'top 85%', duration: d = duration.reveal } = options;

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
  stagger?: number;
  start?: string;
  duration?: number;
};

/**
 * Reveal a headline character by character.
 *
 * SplitText's `aria: 'auto'` puts an aria-label carrying the original text on
 * the parent and hides the generated spans from the accessibility tree. Without
 * it, a screen reader announces the headline one letter at a time.
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

  const { stagger = 0.018, start = 'top 80%', duration: d = duration.base } = options;

  const split = new SplitText(el, {
    type: 'chars,words',
    charsClass: 'split-char',
    wordsClass: 'split-word',
    aria: 'auto',
  });

  el.classList.add('is-revealed');

  const tween = gsap.from(split.chars, {
    opacity: 0,
    yPercent: 120,
    duration: d,
    stagger,
    ease: ease.outStrata,
    scrollTrigger: { trigger: el, start, once: true },
  });

  onTeardown(() => {
    tween.scrollTrigger?.kill();
    tween.kill();
    /* revert() puts the original text node back. Skipping it would leave the
       DOM full of orphaned character spans after every navigation. */
    split.revert();
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

/* -------------------------------------------------------------------------
   Declarative wiring

   Components add attributes; they don't write JavaScript. Keeping the wiring
   here means there's one place to audit when motion misbehaves.
   ---------------------------------------------------------------------- */

const wireDeclarative = (): void => {
  /* Group [data-reveal] elements by their shared [data-reveal-group] ancestor
     so siblings stagger together rather than each firing on its own. */
  const grouped = new Set<Element>();

  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    const children = group.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!children.length) return;
    children.forEach((child) => grouped.add(child));
    revealOnScroll(children, {
      stagger: Number(group.dataset.revealStagger) || undefined,
    });
  });

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    if (grouped.has(el)) return;
    revealOnScroll(el, { y: Number(el.dataset.revealY) || undefined });
  });

  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => splitHeadline(el));

  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    parallaxLayer(el, { distance: Number(el.dataset.parallax) || undefined });
  });

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    magnetic(el, { strength: Number(el.dataset.magnetic) || undefined });
  });
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
    return;
  }

  root.classList.add('motion-ok');
  startLenis();
  wireDeclarative();

  setups.forEach((setup) => {
    const cleanup = setup();
    if (cleanup) pageCleanups.push(cleanup);
  });

  /* Layout has settled by now; make sure trigger positions match reality. */
  ScrollTrigger.refresh();
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

  document.addEventListener('astro:page-load', buildPage);
  document.addEventListener('astro:before-swap', teardownPage);

  /* The new document is in place but hasn't painted. documentElement survives
     the swap, so Lenis only needs re-measuring — but its internal scroll value
     still points at the old page, so it has to be snapped to wherever Astro
     restored the scroll position. Forcing 0 here would break the back button. */
  document.addEventListener('astro:after-swap', () => {
    lenis?.resize();
    lenis?.scrollTo(window.scrollY, { immediate: true, force: true });
  });

  reduceQuery?.addEventListener('change', handleMotionPreferenceChange);

  window.addEventListener('pagehide', () => {
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
