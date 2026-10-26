/*
  Home page choreography.

  Each section's motion is its own setup, registered by the component that
  owns the markup (see the <script> at the bottom of Opening, Hero,
  WhatIBuild, SelectedWork, Expertise and Experience). They are separate on
  purpose: any one can be removed by deleting one line, and a bug in one
  section can't take the others down with it.

  Every setup runs inside a gsap.context(), so its teardown is one revert():
  tweens and ScrollTriggers die, splits go back to plain text, and the inline
  styles GSAP wrote are removed. None of these run under reduced motion — the
  motion module never calls setups then — except workStage, which is
  registered with { reduced: true } and swaps instantly when motion is off.
  Everything they animate is visible by default, hidden only by the
  html.motion-ok gate.

  Nothing here sets a colour. The page is re-themed live, so motion is
  transform, opacity and clip-path only.
*/

import { motion, ease, maskSplit, prefersReducedMotion, revealStart, settleOffset } from './motion';

const { gsap, ScrollTrigger } = motion;

const desktopQuery = '(min-width: 64rem)';
const fineHover = '(hover: hover) and (pointer: fine)';
const isMobile = () => !matchMedia('(min-width: 48rem)').matches;

/* -------------------------------------------------------------------------
   Opening — the portfolio opens through the mark. First load of a session
   only (Opening.astro decides that before paint and sets
   html[data-opening="play"]); everything else goes straight to the page.

   0.00–0.60  the outline draws itself
   0.50–0.75  it fills
   0.80       the mark becomes a hole in the cover, edged by a hairline; the
              fill fades so the page shows through it
   0.85–1.65  the hole scales ~55× about a point beside the J's peak and
              rushes past the camera; the hero's intro sentence, already
              painted under the cover, settles up as it comes into view
              (opening:open)
   ~1.25      the hero's own type reveal is told to start (opening:reveal)
   ---------------------------------------------------------------------- */

/* A point in the B's bowl just right of the J's stem, in the mark's own
   1554 × 1728 units. It has to be inside the filled shape — zooming about a
   filled point is what makes the hole swallow the screen — and this is the
   widest solid area next to the J, so the cut sweeps past the camera on the
   left while the screen clears evenly. (The wedge by the peak was tried
   first; it is so narrow the reveal read as a hard vertical wipe.) */
const MARK = { w: 1554, h: 1728, ox: 1120, oy: 1060 };
const ZOOM = 55;

const OPENING_EVENT = 'opening:reveal';
const OPENING_OPEN = 'opening:open';
const openingPlaying = () => document.documentElement.dataset.opening === 'play';

export const opening = () => {
  const root = document.documentElement;
  const cover = document.querySelector<HTMLElement>('[data-opening]');
  if (!cover || !openingPlaying()) return;

  const fill = cover.querySelector<SVGPathElement>('[data-opening-fill]');
  const stroke = cover.querySelector<SVGPathElement>('[data-opening-stroke]');
  const hole = cover.querySelector<SVGPathElement>('[data-opening-hole]');
  if (!fill || !stroke || !hole) {
    root.removeAttribute('data-opening');
    return;
  }

  const vw = innerWidth;
  const vh = innerHeight;
  /* The mark's height on screen: a third of the viewport, smaller on phones
     held upright so it never touches the sides. */
  const k = Math.min((vh * 0.3) / MARK.h, (vw * 0.42) / MARK.w);
  /* Where the zoom origin sits when the mark is centred. */
  const Ox = vw / 2 + (MARK.ox - MARK.w / 2) * k;
  const Oy = vh / 2 + (MARK.oy - MARK.h / 2) * k;

  const place = (s: number) => {
    const t = `translate(${Ox} ${Oy}) scale(${s}) translate(${-MARK.ox} ${-MARK.oy})`;
    fill.setAttribute('transform', t);
    stroke.setAttribute('transform', t);
    hole.setAttribute('transform', t);
  };
  place(k);

  const len = stroke.getTotalLength();
  stroke.style.strokeWidth = `${1.5 / k}`;
  stroke.style.strokeDasharray = `${len}`;
  stroke.style.strokeDashoffset = `${len}`;

  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    document.dispatchEvent(new CustomEvent(OPENING_OPEN));
  };

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    document.dispatchEvent(new CustomEvent(OPENING_EVENT));
  };

  const zoom = { s: k };
  const finish = () => {
    open();
    reveal();
    root.removeAttribute('data-opening');
    removeSkips();
  };

  const tl = gsap.timeline({ onComplete: finish });
  tl.to(stroke, { opacity: 1, duration: 0.12, ease: 'none' }, 0)
    .to(stroke, { strokeDashoffset: 0, duration: 0.6, ease: ease.inOutSoft }, 0)
    .to(fill, { opacity: 1, duration: 0.25, ease: 'none' }, 0.5)
    .call(() => {
      hole.setAttribute('visibility', 'visible');
      /* The cover and the page share the ground colour, so the hole needs its
         edge drawn to read as a window. A hairline that stays a hairline
         however far the zoom goes, fading as the mark passes the camera. */
      stroke.style.strokeDasharray = 'none';
      stroke.style.strokeWidth = '1.5';
      stroke.setAttribute('vector-effect', 'non-scaling-stroke');
    }, [], 0.8)
    .to(fill, { opacity: 0, duration: 0.15, ease: 'none' }, 0.8)
    .to(stroke, { opacity: 0, duration: 0.5, ease: 'power1.in' }, 0.95)
    .to(zoom, { s: k * ZOOM, duration: 0.8, ease: 'power3.in', onUpdate: () => place(zoom.s) }, 0.85)
    .call(open, [], 0.85)
    .call(reveal, [], 1.25);

  /* Anything the visitor does means "let me in". */
  const skip = () => tl.progress(1);
  const skipEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  const removeSkips = () => skipEvents.forEach((e) => window.removeEventListener(e, skip));
  skipEvents.forEach((e) => window.addEventListener(e, skip, { passive: true }));

  return () => {
    tl.kill();
    finish();
  };
};

/* -------------------------------------------------------------------------
   Hero entrance — the giant type word-masks up, the sentence and actions
   follow. Under a second. When the opening is playing it waits for the
   opening's cue instead of starting straight away, so the type starts moving
   just as the mark clears.

   The sentence is the largest text on a phone's first screen, so it is the
   page's LCP: it is never hidden. It paints at full opacity from the first
   frame, a little low ([data-settle] in motion.css), and only settles up —
   transform, no fade. With the opening playing it is already there under
   the cover and settles as the hole sweeps open, so the visitor sees it
   arrive with the zoom; the name then rises over it.
   ---------------------------------------------------------------------- */

export const heroEntrance = () => {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (!root) return;

  const q = (sel: string) => root.querySelector<HTMLElement>(sel);
  const title = q('[data-hero-title]');
  const line = q('[data-hero-line]');
  const actions = q('[data-hero-actions]');
  const cue = q('[data-hero-cue]');
  const cueLink = q('[data-hero-cue-link]');
  const cueLine = q('.hero-cue__line');
  if (!title) return;

  const light = isMobile();
  const waitForOpening = openingPlaying();
  let fallback = 0;
  let unlisten = () => {};

  const ctx = gsap.context(() => {
    const split = maskSplit(title, 'words');
    const tl = gsap.timeline({ paused: waitForOpening, defaults: { ease: ease.outStrata } });

    const words = split.words.length;
    tl.from(split.words, { yPercent: 110, duration: 0.75, stagger: 0.07 }, 0)
      /* The split is only needed while the words are moving. Put the plain
         text back as soon as they land, not after the cue: the browser
         counts the restored text as a fresh paint of the name, and on a
         wide screen the name is the largest text there (LCP). */
      .call(() => split.revert(), [], 0.75 + 0.07 * (words - 1))
      .from(actions, { opacity: 0, y: light ? 8 : 14, duration: 0.5 }, 0.38);

    /* The sentence takes over from the CSS offset, so there is no jump. */
    let lineSettle: ReturnType<typeof gsap.fromTo> | null = null;
    if (line) {
      const from = { y: settleOffset(line) };
      if (waitForOpening) {
        lineSettle = gsap.fromTo(line, from, { y: 0, duration: 0.9, ease: ease.outStrata, paused: true });
      } else {
        tl.fromTo(line, from, { y: 0, duration: 0.6 }, 0.3);
      }
    }

    /* The scroll cue comes last: the button lands with a small overshoot,
       the hairline draws down out of it, and only then does the idle loop
       start (the CSS waits for data-entered). */
    if (cue && cueLink) {
      tl.from(cueLink, { opacity: 0, scale: 0.6, duration: 0.6, ease: ease.snap }, 0.62);
      if (cueLine) tl.from(cueLine, { scaleY: 0, transformOrigin: '50% 0%', duration: 0.9 }, 0.8);
      tl.call(() => cue.setAttribute('data-entered', ''), [], 1.05);
    }

    /* From-states are applied now, so the CSS gate can come off this frame. */
    [title, line, actions, cue].forEach((el) => el?.classList.add('is-revealed'));

    if (waitForOpening) {
      const settleLine = () => lineSettle?.play();
      const go = () => {
        settleLine();
        tl.play();
      };
      document.addEventListener(OPENING_OPEN, settleLine, { once: true });
      document.addEventListener(OPENING_EVENT, go, { once: true });
      unlisten = () => {
        document.removeEventListener(OPENING_OPEN, settleLine);
        document.removeEventListener(OPENING_EVENT, go);
      };
      /* Belt and braces: never leave the hero unrevealed. */
      fallback = window.setTimeout(go, 2600);
    }
  }, root);

  return () => {
    clearTimeout(fallback);
    unlisten();
    ctx.revert();
    cue?.removeAttribute('data-entered');
  };
};

/* -------------------------------------------------------------------------
   Hero on scroll — as the next section comes up, the giant type shrinks a
   touch, drifts up and fades. Scrubbed, so it tracks the scroll exactly and
   reverses on the way back. Desktop and tablet only.

   The scroll cue goes first and faster: it fades and drops away over the
   first third of a screen of scroll, at every width, and is hidden
   (visibility too, so it can't be tabbed to or clicked) once it's gone.
   ---------------------------------------------------------------------- */

export const heroScroll = () => {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  const title = root?.querySelector<HTMLElement>('[data-hero-title]');
  const cue = root?.querySelector<HTMLElement>('[data-hero-cue]');
  if (!root || !title) return;

  const ctx = gsap.context(() => {
    if (!isMobile()) {
      gsap.to(title, {
        scale: 0.92,
        yPercent: -18,
        opacity: 0.12,
        ease: 'none',
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
      });
    }
    if (cue) {
      gsap.to(cue, {
        autoAlpha: 0,
        y: 48,
        ease: 'none',
        scrollTrigger: { trigger: root, start: 'top top', end: '+=30%', scrub: true },
      });
    }
  }, root);

  return () => ctx.revert();
};

/* -------------------------------------------------------------------------
   Hero scroll cue — the click and the idle loop. The entrance is in
   heroEntrance and the fade-out in heroScroll; the loop itself is CSS
   (Hero.astro), switched on with .is-looping only while the hero is on
   screen and the tab is visible, so it costs nothing the rest of the time.

   The cue is a plain link to #what-i-build, which is what it stays under
   reduced motion and without JS (an instant jump). Here the jump becomes a
   Lenis glide, and focus follows it so the next Tab carries on from the
   section rather than from the top of the page.
   ---------------------------------------------------------------------- */

export const heroCue = () => {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const cue = hero?.querySelector<HTMLElement>('[data-hero-cue]');
  const link = cue?.querySelector<HTMLAnchorElement>('[data-hero-cue-link]');
  if (!hero || !cue || !link) return;

  const id = decodeURIComponent(link.hash.slice(1));

  const onClick = (event: MouseEvent) => {
    const target = id ? document.getElementById(id) : null;
    if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const land = () => {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };
    const lenis = motion.lenis;
    if (lenis && !prefersReducedMotion()) {
      /* Lenis works out the destination once, at the click. Very rarely —
         seen only on a first load, clicked straight after the entrance — it
         lands exactly one header height (73px) past the section; the cause
         wasn't pinned down. Check on arrival and settle any difference. */
      const settle = () => {
        if (Math.abs(target.getBoundingClientRect().top) > 1) {
          lenis.scrollTo(target, { duration: 0.35, easing: ease.outSoft, onComplete: land });
        } else land();
      };
      lenis.scrollTo(target, { duration: 1.2, easing: ease.inOutSoft, onComplete: settle });
    } else {
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      land();
    }
  };
  link.addEventListener('click', onClick);

  let inView = true;
  const sync = () => cue.classList.toggle('is-looping', inView && !document.hidden);
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  });
  observer.observe(hero);
  document.addEventListener('visibilitychange', sync);
  sync();

  return () => {
    link.removeEventListener('click', onClick);
    observer.disconnect();
    document.removeEventListener('visibilitychange', sync);
    cue.classList.remove('is-looping');
  };
};

/* -------------------------------------------------------------------------
   Code field — the spotlight and the scramble. The drift is CSS.

   Spotlight: a brighter clone of the field, masked to a circle at
   --cf-x/--cf-y. Pointer moves only record the position; one rAF writes it,
   so a burst of pointer events costs one style write per frame.

   Scramble: every so often a few characters of a visible line flicker
   through random glyphs and resolve back. Both stop when the hero is off
   screen or the tab is hidden; the drift pauses with them.
   ---------------------------------------------------------------------- */

const GLYPHS = '{}[]()<>/\\=+-*_;:$#@!?&|%01';

export const codeField = () => {
  const field = document.querySelector<HTMLElement>('[data-code-field]');
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const base = field?.querySelector<HTMLElement>('[data-cf-layer="base"]');
  if (!field || !hero || !base) return;

  const spotlight = matchMedia(`${desktopQuery} and ${fineHover}`).matches;

  let lit: HTMLElement | null = null;
  if (spotlight) {
    lit = base.cloneNode(true) as HTMLElement;
    lit.dataset.cfLayer = 'lit';
    lit.classList.add('code-field__layer--lit');
    base.after(lit);
  }

  /* Keep the clone's drift in lockstep with the original. */
  const syncDrift = () => {
    if (!lit) return;
    const a = base.getAnimations({ subtree: true });
    const b = lit.getAnimations({ subtree: true });
    a.forEach((anim, i) => {
      if (b[i]) b[i].currentTime = anim.currentTime;
    });
  };
  requestAnimationFrame(syncDrift);

  const baseLines = Array.from(base.querySelectorAll<HTMLElement>('.code-field__line'));
  const litLines = lit ? Array.from(lit.querySelectorAll<HTMLElement>('.code-field__line')) : [];

  /* --- spotlight --- */
  let px = 0;
  let py = 0;
  let raf = 0;
  const write = () => {
    raf = 0;
    field.style.setProperty('--cf-x', `${px}px`);
    field.style.setProperty('--cf-y', `${py}px`);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const box = field.getBoundingClientRect();
    px = e.clientX - box.left;
    py = e.clientY - box.top;
    field.classList.add('is-lit');
    if (!raf) raf = requestAnimationFrame(write);
  };
  const leave = () => field.classList.remove('is-lit');
  if (lit) {
    hero.addEventListener('pointermove', move);
    hero.addEventListener('pointerleave', leave);
  }

  /* --- scramble --- */
  let timer = 0;
  let running = false;
  const scrambleOnce = () => {
    const box = field.getBoundingClientRect();
    const visible = baseLines.filter((l) => {
      if (!l.textContent?.trim()) return false;
      const r = l.getBoundingClientRect();
      return r.bottom > box.top && r.top < box.top + box.height * 0.6;
    });
    const i = Math.floor(Math.random() * visible.length);
    const line = visible[i];
    if (!line) return;
    const twin = litLines[baseLines.indexOf(line)];
    const original = line.textContent ?? '';
    const start = Math.floor(Math.random() * Math.max(1, original.length - 8));
    const span = 4 + Math.floor(Math.random() * 6);
    let frame = 0;
    const step = () => {
      frame += 1;
      if (frame > 9 || !running) {
        line.textContent = original;
        if (twin) twin.textContent = original;
        return;
      }
      const chars = original.split('');
      for (let c = start; c < Math.min(chars.length, start + span); c += 1) {
        if (chars[c] !== ' ' && (frame < 6 || Math.random() < 0.5)) {
          chars[c] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      const text = chars.join('');
      line.textContent = text;
      if (twin) twin.textContent = text;
      window.setTimeout(step, 55);
    };
    step();
  };
  const schedule = () => {
    if (!running) return;
    timer = window.setTimeout(() => {
      scrambleOnce();
      schedule();
    }, 260 + Math.random() * 520);
  };

  const setRunning = (on: boolean) => {
    if (on === running) return;
    running = on;
    field.classList.toggle('is-paused', !on);
    clearTimeout(timer);
    if (on) schedule();
  };

  let inView = true;
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    setRunning(inView && !document.hidden);
  });
  observer.observe(hero);
  const onVisibility = () => setRunning(inView && !document.hidden);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    setRunning(false);
    field.classList.remove('is-paused', 'is-lit');
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    hero.removeEventListener('pointermove', move);
    hero.removeEventListener('pointerleave', leave);
    cancelAnimationFrame(raf);
    lit?.remove();
  };
};

/* -------------------------------------------------------------------------
   What I build — the line crossing the middle of the screen lights up, and
   the panel types out the matching snippet.

   Lighting is computed from the lines' positions on every scroll update
   (one ScrollTrigger for the whole list) and written as a --lit variable the CSS mixes into the line's colour, so it
   follows the live theme.

   Typing walks the snippet's text nodes and reveals them in bursts of a few
   dozen characters. Changing line cancels the current run and starts the
   new one.
   ---------------------------------------------------------------------- */

export const whatIBuild = () => {
  const section = document.querySelector<HTMLElement>('[data-build]');
  if (!section) return;

  const lines = Array.from(section.querySelectorAll<HTMLElement>('[data-build-line]'));
  const panel = section.querySelector<HTMLElement>('[data-build-panel]');
  const snippets = Array.from(section.querySelectorAll<HTMLElement>('[data-build-snippet]'));
  if (!lines.length || !panel) return;

  /* Each snippet's text nodes and their full text, captured once. */
  const sources = snippets.map((fig) => {
    const code = fig.querySelector('[data-build-code]');
    const nodes: Text[] = [];
    if (code) {
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    }
    return { nodes, full: nodes.map((n) => n.data) };
  });

  const restore = (i: number) => {
    sources[i]?.nodes.forEach((n, j) => {
      n.data = sources[i].full[j];
    });
    snippets[i]?.querySelector('[data-build-code]')?.classList.remove('is-typing');
  };

  let active = -1;
  let typing = 0;

  const type = (i: number) => {
    cancelAnimationFrame(typing);
    const src = sources[i];
    if (!src) return;
    src.nodes.forEach((n) => (n.data = ''));
    const code = snippets[i]?.querySelector('[data-build-code]');
    code?.classList.add('is-typing');
    let node = 0;
    let char = 0;
    let last = 0;
    const tick = (now: number) => {
      /* Bursts of 25–40 characters roughly every 90ms (~350 a second): a
         ten-line snippet lands in under a second and still reads as typed. */
      if (now - last < 90) {
        typing = requestAnimationFrame(tick);
        return;
      }
      last = now;
      let budget = 25 + Math.floor(Math.random() * 16);
      while (budget > 0 && node < src.nodes.length) {
        const full = src.full[node];
        const take = Math.min(budget, full.length - char);
        char += take;
        budget -= take;
        src.nodes[node].data = full.slice(0, char);
        if (char >= full.length) {
          node += 1;
          char = 0;
        }
      }
      if (node < src.nodes.length) {
        typing = requestAnimationFrame(tick);
      } else {
        typing = 0;
        code?.classList.remove('is-typing');
      }
    };
    typing = requestAnimationFrame(tick);
  };

  const activate = (i: number) => {
    if (i === active) return;
    if (active >= 0) restore(active);
    active = i;
    snippets.forEach((fig, n) => fig.classList.toggle('is-active', n === i));
    type(i);
  };

  const update = () => {
    /* All reads first, then all writes, so this costs one layout per frame
       rather than one per line. Cached document offsets were tried and went
       stale whenever anything above (fonts, the hero's split) reflowed. */
    /* Below 1024 the snippet panel is docked over the bottom of the screen,
       so the middle is the middle of what's left above it. */
    const dock = !matchMedia(desktopQuery).matches ? panel.offsetHeight : 0;
    const mid = (innerHeight - dock) / 2;
    const spread = (lines[0]?.offsetHeight || 100) * 1.1;
    const lit = lines.map((line) => {
      const r = line.getBoundingClientRect();
      return Math.max(0, 1 - Math.abs(r.top + r.height / 2 - mid) / spread);
    });
    let best = 0;
    lit.forEach((v, i) => {
      lines[i].style.setProperty('--lit', v.toFixed(3));
      if (v > lit[best]) best = i;
    });
    /* Phones: past the last line (or before the first) nothing is lit, and
       the dock fell back to the first snippet under PERFORMANCE. Keep the
       nearest line's snippet instead. */
    if (dock && lit[best] === 0) {
      const last = lines[lines.length - 1].getBoundingClientRect();
      best = last.top + last.height / 2 < mid ? lines.length - 1 : 0;
    }
    /* Phones: the dock rises once the first line is on its way to the
       reading line, not as soon as the section peeks in under the hero —
       there it covered the list's first lines on the opening screen. */
    if (dock) {
      const first = lines[0].getBoundingClientRect();
      panel.classList.toggle('is-docked', first.top < innerHeight * 0.45);
    }
    activate(best);
  };

  panel.classList.add('is-ready');

  const ctx = gsap.context(() => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onRefresh: update,
      onUpdate: update,
    });
  }, section);

  update();

  return () => {
    cancelAnimationFrame(typing);
    if (active >= 0) restore(active);
    ctx.revert();
    panel.classList.remove('is-ready', 'is-docked');
    snippets.forEach((fig) => fig.classList.remove('is-active'));
    lines.forEach((l) => l.style.removeProperty('--lit'));
  };
};

/* -------------------------------------------------------------------------
   Selected Work — index and stage (SelectedWork.astro).

   1024+ only. Turns the stacked rows into the sticky stage by setting
   data-ready on the section, then keeps one project active: scrolling
   through the section walks it down the list, hovering or focusing a name
   jumps to it. Switching wipes the new screenshot in vertically (direction
   of travel) over a slight zoom, and rolls the number and meta lines through
   their masks.

   Registered with { reduced: true }: under reduced motion the stage still
   runs, but every change is an instant swap — no wipe, no roll, no marker
   glide. Below 1024 nothing runs and the rows stay stacked.
   ---------------------------------------------------------------------- */

export const workStage = () => {
  const root = document.querySelector<HTMLElement>('[data-work]');
  if (!root) return;

  const mm = gsap.matchMedia();

  mm.add(desktopQuery, () => {
    const still = prefersReducedMotion();
    root.dataset.ready = '';

    const desk = root.querySelector<HTMLElement>('[data-work-desk]');
    const list = root.querySelector<HTMLElement>('[data-work-list]');
    const marker = root.querySelector<HTMLElement>('[data-work-marker]');
    const stage = root.querySelector<HTMLAnchorElement>('[data-work-stage]');
    const items = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-work-item]'));
    const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-work-slide]'));
    const metas = Array.from(root.querySelectorAll<HTMLElement>('[data-work-meta]'));
    if (!desk || !list || !marker || !stage || !items.length) {
      delete root.dataset.ready;
      return;
    }

    /* A slide with no screenshot yet carries a placeholder panel instead;
       it takes the same scale and drift so the wipe reads the same. */
    const imgOf = (s: HTMLElement) => s.querySelector<HTMLElement>('img, [data-work-media]');
    const linesOf = (g: HTMLElement) => Array.from(g.querySelectorAll<HTMLElement>('[data-work-line]'));
    const allImgs = slides.map(imgOf).filter((x): x is HTMLElement => !!x);
    const allLines = metas.flatMap(linesOf);
    const n = items.length;

    let current = -1;

    const placeMarker = (i: number, instant = false) => {
      const name = items[i].querySelector<HTMLElement>('.work-item__name') ?? items[i];
      const box = list.getBoundingClientRect();
      const r = name.getBoundingClientRect();
      gsap.to(marker, {
        y: r.top - box.top,
        height: r.height,
        duration: instant || still ? 0 : 0.6,
        ease: ease.outStrata,
        overwrite: true,
      });
    };

    const show = (i: number) => {
      if (i === current) return;
      const prev = current;
      current = i;
      /* 0 = no transition (first paint, or reduced motion). */
      const dir = prev === -1 || still ? 0 : i > prev ? 1 : -1;

      items.forEach((a, k) => a.toggleAttribute('data-active', k === i));
      stage.href = items[i].href;
      placeMarker(i, prev === -1);

      /* Stage: only the incoming slide and the one it covers stay visible. */
      slides.forEach((s, k) => {
        s.style.zIndex = k === i ? '2' : k === prev ? '1' : '0';
        if (k !== i && (k !== prev || dir === 0)) {
          gsap.killTweensOf([s, imgOf(s)]);
          gsap.set(s, { visibility: 'hidden', clipPath: 'none' });
          gsap.set(imgOf(s), { scale: 1, yPercent: 0 });
        }
      });

      const inc = slides[i];
      gsap.killTweensOf([inc, imgOf(inc)]);
      gsap.set(inc, { visibility: 'visible' });
      if (dir === 0) {
        gsap.set(inc, { clipPath: 'inset(0% 0% 0% 0%)' });
        gsap.set(imgOf(inc), { scale: 1, yPercent: 0 });
      } else {
        gsap.fromTo(
          inc,
          { clipPath: dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.95, ease: ease.outStrata },
        );
        gsap.fromTo(
          imgOf(inc),
          { scale: 1.1, yPercent: dir * 4 },
          { scale: 1, yPercent: 0, duration: 1.2, ease: ease.outStrata },
        );
        const out = slides[prev];
        /* If the covered slide was still wiping in itself (fast hovering),
           finish it, or the frame's background would show above or below. */
        gsap.killTweensOf(out);
        gsap.set(out, { clipPath: 'inset(0% 0% 0% 0%)' });
        gsap.to(imgOf(out), {
          scale: 1.05,
          yPercent: -dir * 5,
          duration: 0.95,
          ease: ease.outStrata,
          overwrite: true,
        });
      }

      /* Meta: the outgoing lines roll up out of their masks, then the
         incoming ones roll up into them. Inactive groups are inert, so a
         link that can't be seen can't be tabbed to. */
      metas.forEach((g, k) => {
        const lines = linesOf(g);
        gsap.killTweensOf(lines);
        if (k === i) {
          g.style.visibility = 'visible';
          g.inert = false;
          if (dir === 0) gsap.set(lines, { yPercent: 0 });
          else
            gsap.fromTo(
              lines,
              { yPercent: dir * 140 },
              { yPercent: 0, duration: 0.7, stagger: 0.06, delay: 0.26, ease: ease.outStrata },
            );
        } else if (k === prev && dir !== 0) {
          g.inert = true;
          gsap.to(lines, {
            yPercent: -dir * 140,
            duration: 0.3,
            stagger: 0.02,
            ease: ease.inOutSoft,
            onComplete: () => {
              if (current !== k) g.style.visibility = 'hidden';
            },
          });
        } else {
          g.style.visibility = 'hidden';
          g.inert = true;
        }
      });
    };

    show(0);

    /* Scroll walks the list. Only a change of the scroll-derived index calls
       show(), so a hover holds until the reader moves on to the next
       project's stretch of the section. */
    let scrollIdx = 0;
    ScrollTrigger.create({
      trigger: desk,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const idx = Math.min(n - 1, Math.floor(self.progress * n));
        if (idx !== scrollIdx) {
          scrollIdx = idx;
          show(idx);
        }
      },
      onRefresh: () => placeMarker(Math.max(current, 0), true),
    });

    const offs = items.map((a, k) => {
      const on = () => show(k);
      a.addEventListener('pointerenter', on);
      a.addEventListener('focus', on);
      return () => {
        a.removeEventListener('pointerenter', on);
        a.removeEventListener('focus', on);
      };
    });

    return () => {
      offs.forEach((off) => off());
      const touched = [marker, ...slides, ...allImgs, ...allLines];
      gsap.killTweensOf(touched);
      gsap.set(touched, { clearProps: 'all' });
      slides.forEach((s) => (s.style.zIndex = ''));
      metas.forEach((g) => {
        g.style.visibility = '';
        g.inert = false;
      });
      items.forEach((a) => a.removeAttribute('data-active'));
      stage.href = items[0].href;
      delete root.dataset.ready;
    };
  });

  return () => mm.revert();
};

/* -------------------------------------------------------------------------
   Expertise — the tool rows stagger in on arrival, and switching tabs
   crossfades the panels instead of cutting.
   ---------------------------------------------------------------------- */

export const expertisePanels = () => {
  const root = document.querySelector<HTMLElement>('[data-tabs]');
  if (!root) return;

  /* Heading, intro, sub-headings and each list row — not the wrappers, or the
     rows would fade twice. */
  const rowsOf = (panel: Element) =>
    Array.from(panel.querySelectorAll<HTMLElement>(':scope > h3, :scope > p, h4, li'));

  let swap: gsap.core.Timeline | null = null;

  const ctx = gsap.context(() => {
    const active = root.querySelector<HTMLElement>('[role="tabpanel"]:not([data-inactive])');
    if (active) {
      gsap.from(active.querySelectorAll('li'), {
        opacity: 0,
        y: 10,
        duration: 0.6,
        stagger: 0.04,
        ease: ease.outSoft,
        scrollTrigger: { trigger: active, start: revealStart('top 80%'), once: true },
      });
    }
  }, root);

  const onChange = (event: Event) => {
    const { from, to } = (event as CustomEvent<{ from: HTMLElement | null; to: HTMLElement }>).detail;
    swap?.progress(1).kill();

    swap = gsap.timeline({ defaults: { ease: ease.outSoft } });
    if (from && from !== to) {
      /* The outgoing panel is already marked inactive (visibility: hidden);
         an inline visibility keeps it on screen just long enough to leave. */
      swap.fromTo(
        from,
        { autoAlpha: 1, y: 0 },
        { autoAlpha: 0, y: -8, duration: 0.2, ease: 'power1.in', clearProps: 'opacity,visibility,transform' },
        0,
      );
    }
    swap.from(rowsOf(to), { opacity: 0, y: 8, duration: 0.45, stagger: 0.025, clearProps: 'opacity,transform' }, 0.12);
  };

  root.addEventListener('tabs:change', onChange);

  return () => {
    root.removeEventListener('tabs:change', onChange);
    swap?.progress(1).kill();
    swap = null;
    ctx.revert();
  };
};

/* -------------------------------------------------------------------------
   Experience — the rule draws down with the scroll, and each role fades up
   as the drawn tip reaches its dot. Both are keyed to the same line across
   the viewport (70%), which is what makes them read as one motion.
   ---------------------------------------------------------------------- */

export const experienceTimeline = () => {
  const list = document.querySelector<HTMLElement>('[data-exp]');
  if (!list) return;

  const rule = list.querySelector<HTMLElement>('[data-exp-rule]');
  const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-exp-row]'));
  const light = isMobile();
  /* Below 1024 the line starts drawing, and the rows arriving, as they come
     up from the bottom of the screen: keyed to 70% the heading sat over a
     screen of nothing. Desktop keeps its 70% line. */
  const line = matchMedia(desktopQuery).matches ? '70%' : '88%';

  const ctx = gsap.context(() => {
    if (rule) {
      gsap.fromTo(
        rule,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: { trigger: list, start: `top ${line}`, end: `bottom ${line}`, scrub: 0.4 },
        },
      );
    }

    rows.forEach((row) => {
      /* Hand the row over from the CSS pre-hide before tweening, and tween to
         explicit values — a plain from() would read the pre-hidden opacity 0
         as its end state and finish invisible. */
      row.classList.add('is-revealed');
      gsap.fromTo(
        row,
        { opacity: 0, y: light ? 10 : 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: ease.outSoft,
          /* The dot sits about 3rem into the row. */
          scrollTrigger: { trigger: row, start: `top+=40 ${line}`, once: true },
        },
      );
    });
  }, list);

  return () => ctx.revert();
};
