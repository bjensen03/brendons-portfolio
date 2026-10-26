/*
  Phone and tablet choreography — the touch versions of the big desktop
  moments. Same contract as home-motion.ts and study-motion.ts: every export
  is a setup handed to registerMotion() by the component that owns the
  markup, it returns its own cleanup, and nothing here sets a colour.

  Everything below 1024 only (or on a coarse pointer, where it says so), via
  gsap.matchMedia, so a desktop window never runs any of it and resizing
  across the breakpoint tears it down cleanly.

    workCarousel      Selected Work as a swipeable, snapping carousel
    stepSwipe         step viewers (Buy Now, portal) swipe between steps
    erasMobile        the eras' screenshots swipe; a sticky year scrubber
    scrollerMobile    the page scroller's window: the note under it follows
                      the marker crossing the window's middle
    studyProgress     a reading pill for long case studies: the section
                      you're in, how far through, and a jump list
    heroTouch         the hero's code field lights up under a finger

  fitHeadings (section headings sized to the screen) lives in
  fit-headings.ts: Base.astro runs it on every page, and importing it from
  here made every page download this whole file.

  The tracks are native horizontal scrollers with CSS scroll-snap — the
  browser does the physics, momentum and accessibility (they scroll with a
  keyboard and a screen reader like any other overflow). Scripts only read
  where a track has got to and keep the counters, dots and tabs in step,
  from passive listeners, one rAF per burst of scroll events.
*/

import { motion, prefersReducedMotion } from './motion';

const { gsap } = motion;

const touchLayout = '(max-width: 63.999rem)';

/* ---------------------------------------------------------------------------
   Snap track — the shared piece. Knows which item is current, moves to an
   item, and tells the caller when the current one changes.
   ------------------------------------------------------------------------ */

type Track = {
  index: () => number;
  go: (i: number, instant?: boolean) => void;
  destroy: () => void;
};

export const snapTrack = (
  track: HTMLElement,
  items: HTMLElement[],
  onChange: (i: number, prev: number) => void,
): Track => {
  let current = -1;
  let raf = 0;

  /* Where the track has to scroll to for `el` to sit at its snap point —
     from the rects, so it's right whether or not the track is the items'
     offset parent. */
  const offsetOf = (el: HTMLElement) => {
    const pad = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0;
    const t = track.getBoundingClientRect();
    return el.getBoundingClientRect().left - t.left - (track.clientLeft || 0) + track.scrollLeft - pad;
  };

  /* The item whose start is nearest the track's scroll position. Measured
     from offsets rather than divided widths, so items of any width work. */
  const nearest = () => {
    const x = track.scrollLeft;
    let best = 0;
    let bestD = Infinity;
    items.forEach((el, i) => {
      const d = Math.abs(offsetOf(el) - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    /* At the very end the last item may not be able to reach the start. */
    if (x >= track.scrollWidth - track.clientWidth - 2) best = items.length - 1;
    return best;
  };

  const sync = () => {
    raf = 0;
    const i = nearest();
    if (i !== current) {
      const prev = current;
      current = i;
      onChange(i, prev);
    }
  };

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(sync);
  };
  track.addEventListener('scroll', onScroll, { passive: true });

  const go = (i: number, instant = false) => {
    const k = Math.max(0, Math.min(items.length - 1, i));
    track.scrollTo({
      left: offsetOf(items[k]),
      behavior: instant || prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  /* Re-align after a width change (rotation, resize). Height changes are
     ignored: the step and era tracks animate their own height. */
  let width = track.clientWidth;
  const ro = new ResizeObserver(() => {
    if (track.clientWidth === width) return;
    width = track.clientWidth;
    if (current >= 0) go(current, true);
  });
  ro.observe(track);

  sync();

  return {
    index: () => Math.max(current, 0),
    go,
    destroy: () => {
      track.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
};

/* A one-time nudge: the cards slide a little way left and settle back, so
   it's obvious they move sideways. Only once per session, only with motion,
   and only when the track arrives on screen.

   It moves the items with a transform and never touches scrollLeft, so the
   track's scroll position (and its snap point) is never anything but where
   the browser or the visitor left it. The old version scrolled the track
   with snap switched off; stop the page mid-nudge and card 1 sat cut off at
   the left with nothing to snap it back. Any touch, wheel or scroll on the
   track ends the nudge at once and puts the cards back. */
const HINT_PX = 24;

const swipeHint = (track: HTMLElement, key: string): (() => void) => {
  if (prefersReducedMotion()) return () => {};
  try {
    if (sessionStorage.getItem(key)) return () => {};
  } catch {
    /* Storage blocked: hint every time, it's harmless. */
  }
  const items = Array.from(track.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
  if (!items.length) return () => {};

  let tl: gsap.core.Timeline | null = null;
  const reset = () => gsap.set(items, { clearProps: 'transform' });
  const cancel = () => {
    if (!tl) return;
    tl.kill();
    tl = null;
    reset();
    off();
  };
  const events = ['pointerdown', 'touchstart', 'wheel', 'scroll'] as const;
  const off = () => events.forEach((e) => track.removeEventListener(e, cancel));

  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
      io.disconnect();
      /* Already swiped: they know. */
      if (track.scrollLeft > 4) return;
      try {
        sessionStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
      events.forEach((e) => track.addEventListener(e, cancel, { passive: true }));
      tl = gsap
        .timeline({
          delay: 0.35,
          onComplete: () => {
            tl = null;
            reset();
            off();
          },
        })
        .to(items, { x: -HINT_PX, duration: 0.45, ease: 'power2.out' })
        .to(items, { x: 0, duration: 0.6, ease: 'power3.inOut' });
    },
    { threshold: [0, 0.6] },
  );
  io.observe(track);
  return () => {
    io.disconnect();
    tl?.kill();
    tl = null;
    off();
    reset();
  };
};

/* ---------------------------------------------------------------------------
   Selected Work — the carousel (SelectedWork.astro)
   ------------------------------------------------------------------------ */

export const workCarousel = () => {
  const root = document.querySelector<HTMLElement>('[data-work]');
  const track = root?.querySelector<HTMLElement>('[data-work-track]');
  if (!root || !track) return;

  const mm = gsap.matchMedia();
  mm.add(touchLayout, () => {
    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-work-card]'));
    const count = root.querySelector<HTMLElement>('[data-work-count]');
    const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-work-dot]'));
    const prev = root.querySelector<HTMLButtonElement>('[data-work-prev]');
    const next = root.querySelector<HTMLButtonElement>('[data-work-next]');
    if (cards.length < 2) return;

    const t = snapTrack(track, cards, (i) => {
      if (count) count.textContent = String(i + 1);
      dots.forEach((d, k) => (k === i ? d.setAttribute('data-current', 'true') : d.removeAttribute('data-current')));
      cards.forEach((c, k) => c.classList.toggle('is-current', k === i));
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === cards.length - 1;
    });

    const onPrev = () => t.go(t.index() - 1);
    const onNext = () => t.go(t.index() + 1);
    prev?.addEventListener('click', onPrev);
    next?.addEventListener('click', onNext);

    const unhint = swipeHint(track, 'bj:hint-work');

    return () => {
      unhint();
      t.destroy();
      prev?.removeEventListener('click', onPrev);
      next?.removeEventListener('click', onNext);
      cards.forEach((c) => c.classList.remove('is-current'));
    };
  });

  return () => mm.revert();
};

/* ---------------------------------------------------------------------------
   Hero — the code field comes alive on a phone (Hero.astro, CodeField.astro)

   The desktop spotlight follows the mouse (codeField, home-motion.ts). A
   phone has no mouse, so here the same light (the bright copy of the field,
   seen through a soft circle at --cf-x / --cf-y) moves on its own: it drifts
   along a slow Lissajous path through the code, dimming as it passes behind
   the name so it never competes with the type. Touch the hero and it comes
   to the finger and follows the drag (a little above the fingertip, so the
   finger doesn't hide it); lift and it eases back into its drift. As the
   hero scrolls away the light sinks with it.

   Touch listeners are passive, so the page always scrolls. Touch events
   rather than pointer events: a pointer is cancelled as soon as a drag
   becomes a scroll, touches keep reporting. The loop runs only while the
   hero is on screen and the tab is visible. Not registered for reduced
   motion: the field stays still and unlit.
   ------------------------------------------------------------------------ */

export const heroTouch = () => {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const field = hero?.querySelector<HTMLElement>('[data-code-field]');
  const base = field?.querySelector<HTMLElement>('[data-cf-layer="base"]');
  const title = hero?.querySelector<HTMLElement>('[data-hero-title]');
  if (!hero || !field || !base) return;

  const mm = gsap.matchMedia();
  mm.add(`${touchLayout} and (pointer: coarse)`, () => {
    const lit = base.cloneNode(true) as HTMLElement;
    lit.dataset.cfLayer = 'touch';
    lit.classList.add('code-field__layer--lit');
    lit.style.transition = 'none';
    lit.style.opacity = '0';
    base.after(lit);
    /* Same drift, same moment. */
    const a = base.getAnimations({ subtree: true });
    const b = lit.getAnimations({ subtree: true });
    a.forEach((anim, i) => {
      if (b[i]) b[i].currentTime = anim.currentTime;
    });

    /* The field's scramble (codeField) rewrites lines of the dim layer;
       the bright copy follows, so the two never disagree under the light. */
    const baseLines = Array.from(base.querySelectorAll<HTMLElement>('.code-field__line'));
    const litLines = Array.from(lit.querySelectorAll<HTMLElement>('.code-field__line'));
    const mirror = new MutationObserver((records) => {
      for (const r of records) {
        const line = (r.target instanceof HTMLElement ? r.target : r.target.parentElement)?.closest<HTMLElement>(
          '.code-field__line',
        );
        const twin = line ? litLines[baseLines.indexOf(line)] : undefined;
        if (line && twin) twin.textContent = line.textContent;
      }
    });
    mirror.observe(base, { subtree: true, childList: true, characterData: true });

    let raf = 0;
    let onScreen = true;
    let finger: { x: number; y: number } | null = null;
    let release = 0;
    /* Where the light is, where it's heading, how bright it is. */
    let x = -1;
    let y = -1;
    let glow = 0;
    let t0 = 0;
    let last = 0;
    /* The name's lines, in field coordinates, measured on resize. */
    let words: DOMRect[] = [];
    let box = field.getBoundingClientRect();

    const measure = () => {
      box = field.getBoundingClientRect();
      words = title
        ? Array.from(title.querySelectorAll<HTMLElement>(':scope > span')).map((el) => {
            const r = el.getBoundingClientRect();
            return new DOMRect(r.left - box.left, r.top - box.top, r.width, r.height);
          })
        : [];
    };

    /* 1 clear of the name, down to 0.4 right behind a letter. */
    const clearOfName = (px: number, py: number) => {
      let d = Infinity;
      for (const r of words) {
        const dx = Math.max(r.left - px, 0, px - r.right);
        const dy = Math.max(r.top - py, 0, py - r.bottom);
        d = Math.min(d, Math.hypot(dx, dy));
      }
      return 0.4 + 0.6 * Math.min(1, d / 56);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!t0) t0 = now;
      const dt = Math.min(64, now - (last || now));
      last = now;
      const t = (now - t0) / 1000;
      const w = box.width;
      const h = box.height;

      let tx: number;
      let ty: number;
      let want: number;
      if (finger) {
        tx = finger.x;
        ty = finger.y;
        want = 1;
      } else {
        /* A slow figure through the upper two-thirds of the hero, where the
           code is; one loop takes the better part of a minute. */
        tx = w * (0.48 + 0.36 * Math.sin(t * 0.23));
        ty = h * (0.3 + 0.24 * Math.sin(t * 0.31 + 1.2)) + Math.min(window.scrollY, h) * 0.45;
        want = 0.9;
      }
      if (x < 0) {
        x = tx;
        y = ty;
      }
      /* Quick to a finger, unhurried back to the drift. */
      const k = 1 - Math.pow(finger ? 0.7 : 0.965, dt / 16.7);
      x += (tx - x) * k;
      y += (ty - y) * k;
      const target = want * (finger ? 1 : clearOfName(x, y));
      glow += (target - glow) * (1 - Math.pow(0.94, dt / 16.7));

      field.style.setProperty('--cf-x', `${x.toFixed(1)}px`);
      field.style.setProperty('--cf-y', `${y.toFixed(1)}px`);
      lit.style.opacity = glow.toFixed(3);

      if (onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const run = () => {
      if (!raf && onScreen && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    const at = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      box = field.getBoundingClientRect();
      finger = { x: touch.clientX - box.left, y: touch.clientY - box.top - 48 };
    };
    const start = (e: TouchEvent) => {
      clearTimeout(release);
      at(e);
      run();
    };
    const end = () => {
      clearTimeout(release);
      release = window.setTimeout(() => {
        finger = null;
        box = field.getBoundingClientRect();
      }, 700);
    };

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      run();
    });
    io.observe(hero);
    const onVisibility = () => run();
    const onResize = () => measure();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize, { passive: true });
    measure();
    /* Fonts can still be settling the name's width. */
    document.fonts?.ready.then(measure);
    /* And the entrance may still be splitting it. */
    const settle = window.setTimeout(measure, 2500);

    hero.addEventListener('touchstart', start, { passive: true });
    hero.addEventListener('touchmove', at, { passive: true });
    hero.addEventListener('touchend', end, { passive: true });
    hero.addEventListener('touchcancel', end, { passive: true });
    run();

    return () => {
      hero.removeEventListener('touchstart', start);
      hero.removeEventListener('touchmove', at);
      hero.removeEventListener('touchend', end);
      hero.removeEventListener('touchcancel', end);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      io.disconnect();
      mirror.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(release);
      clearTimeout(settle);
      field.style.removeProperty('--cf-x');
      field.style.removeProperty('--cf-y');
      lit.remove();
    };
  });

  return () => mm.revert();
};

/* ---------------------------------------------------------------------------
   Page scroller on phones (PageScroller.astro)

   The window scrolls with the thumb. Whichever marker is nearest the middle
   of the window is the active one: its number lights in the row under the
   window and its note shows beneath. A hairline over the frame tracks how
   far down the page the window is. Tapping a number is handled by
   pageScroller (study-motion.ts), which scrolls the window to its marker —
   the scroll then lands here like any other.
   ------------------------------------------------------------------------ */

export const scrollerMobile = () => {
  const root = document.querySelector<HTMLElement>('[data-scroller]');
  if (!root) return;

  const mm = gsap.matchMedia();
  mm.add(touchLayout, () => {
    const offs: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>('[data-ps-run]').forEach((run) => {
      const view = run.querySelector<HTMLElement>('[data-ps-view]');
      const bar = run.querySelector<HTMLElement>('[data-ps-progress]');
      const notes = Array.from(run.querySelectorAll<HTMLElement>('[data-ps-note]'));
      const marks = Array.from(run.querySelectorAll<HTMLElement>('[data-ps-mark]'));
      const bodies = Array.from(run.querySelectorAll<HTMLElement>('[data-ps-body]'));
      if (!view) return;

      let active = -1;
      let raf = 0;

      const update = () => {
        raf = 0;
        const max = view.scrollHeight - view.clientHeight;
        const top = view.scrollTop;
        bar?.style.setProperty('--ps-p', max > 0 ? (top / max).toFixed(4) : '0');
        if (!marks.length) return;
        /* A reading line that sweeps down the window as you scroll — at its
           top edge when the capture is at the top, at its bottom edge at the
           end — so every marker gets its turn, even several bunched at the
           top of the page. The active note is the last marker the line has
           passed; before the first, the first (an empty space under the
           window reads as broken). */
        const p = max > 0 ? top / max : 1;
        const line = top + view.clientHeight * p;
        let best = 0;
        marks.forEach((m, k) => {
          if (m.offsetTop <= line) best = k;
        });
        if (best !== active) {
          active = best;
          notes.forEach((b, j) => b.classList.toggle('is-active', j === best));
          marks.forEach((b, j) => b.classList.toggle('is-active', j === best));
          bodies.forEach((b, j) => b.classList.toggle('is-active', j === best));
        }
      };
      const onScroll = () => {
        if (!raf) raf = requestAnimationFrame(update);
      };

      view.addEventListener('scroll', onScroll, { passive: true });
      /* The capture's height (and so every marker's offset) is only known
         once it has loaded. */
      const img = view.querySelector('img');
      const pageEl = run.querySelector<HTMLElement>('[data-ps-page]');
      const loaded = () => pageEl?.classList.add('is-loaded');
      const onLoad = () => {
        loaded();
        update();
      };
      if (!img || (img.complete && img.naturalWidth > 0)) loaded();
      img?.addEventListener('load', onLoad);
      /* A failed image still gets its numbers rather than hiding them. */
      img?.addEventListener('error', loaded);
      update();

      offs.push(() => {
        view.removeEventListener('scroll', onScroll);
        img?.removeEventListener('load', onLoad);
        img?.removeEventListener('error', loaded);
        pageEl?.classList.remove('is-loaded');
        cancelAnimationFrame(raf);
        [...notes, ...marks, ...bodies].forEach((el) => el.classList.remove('is-active'));
        bar?.style.removeProperty('--ps-p');
      });
    });

    return () => offs.forEach((off) => off());
  });

  return () => mm.revert();
};

/* ---------------------------------------------------------------------------
   Step viewers on phones (StepViewer.astro)

   The tabs stay the source of truth: stepViewers (study-motion.ts) owns
   which step is selected. This keeps the track and the tabs in step both
   ways — a swipe that settles on a new step clicks its tab; a tab, a dot,
   Previous / Next or the keyboard selecting a step slides the track to it.
   A tap on the screenshot is "next". The track's height follows the step on
   screen.
   ------------------------------------------------------------------------ */

const PANEL_EVENT = 'study:panel';

export const stepSwipe = () => {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-viewer]'));
  if (!roots.length) return;

  const mm = gsap.matchMedia();
  mm.add(touchLayout, () => {
    const offs: Array<() => void> = [];

    roots.forEach((root) => {
      const track = root.querySelector<HTMLElement>('.sv-panels');
      const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-viewer-panel]'));
      const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-viewer-tab]'));
      const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-viewer-dot]'));
      const tabRow = root.querySelector<HTMLElement>('[data-viewer-tabs]');
      if (!track || panels.length < 2 || tabs.length !== panels.length) return;

      const selected = () => Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
      /* Where a scripted slide is headed; swipes passing other steps on the
         way there mustn't select them. */
      let target = -1;

      const fit = () => {
        const p = panels[selected()];
        if (p) track.style.height = `${p.offsetHeight}px`;
      };

      const t = snapTrack(track, panels, (i) => {
        if (target >= 0) {
          if (i !== target) return;
          target = -1;
        }
        if (i !== selected()) tabs[i].click();
      });

      /* The steps either side of the selected one peek in at the track's
         edges, but WebKit doesn't start a lazy image in a sideways-scrolled
         panel until it's swiped into place, so the peeking step showed an
         empty frame (BUG-035). Once the viewer is within a screen of view,
         the selected step's neighbours load straight away. */
      let near = false;
      const prime = () => {
        if (!near) return;
        const i = selected();
        [i - 1, i, i + 1].forEach((k) =>
          panels[k]?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager')),
        );
      };
      const nearIo = new IntersectionObserver(
        ([entry]) => {
          near = entry.isIntersecting;
          prime();
        },
        { root: document, rootMargin: '100% 0px' },
      );
      nearIo.observe(track);

      const onPanel = () => {
        const i = selected();
        dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
        fit();
        prime();
        /* Keep the selected chip in view in its scrolling row. */
        const tab = tabs[i];
        if (tabRow && tab) {
          const left =
            tabRow.scrollLeft +
            (tab.getBoundingClientRect().left - tabRow.getBoundingClientRect().left) -
            tabRow.clientWidth / 2 +
            tab.offsetWidth / 2;
          tabRow.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        }
        if (i !== t.index()) {
          target = i;
          t.go(i);
        }
      };
      /* The event is global; only react when this viewer changed. */
      let last = selected();
      const onAny = () => {
        const i = selected();
        if (i === last && i === t.index()) return;
        last = i;
        onPanel();
      };
      document.addEventListener(PANEL_EVENT, onAny);

      const cancelTarget = () => (target = -1);
      track.addEventListener('pointerdown', cancelTarget, { passive: true });

      /* Which ends of the tab row are cut off, for the edge fades. */
      let moreRaf = 0;
      const more = () => {
        moreRaf = 0;
        if (!tabRow) return;
        const max = tabRow.scrollWidth - tabRow.clientWidth;
        const x = tabRow.scrollLeft;
        const start = x > 4;
        const end = max - x > 4;
        if (start && end) tabRow.dataset.more = 'both';
        else if (start) tabRow.dataset.more = 'start';
        else if (end) tabRow.dataset.more = 'end';
        else delete tabRow.dataset.more;
      };
      const onTabScroll = () => {
        if (!moreRaf) moreRaf = requestAnimationFrame(more);
      };
      tabRow?.addEventListener('scroll', onTabScroll, { passive: true });
      const tabRo = new ResizeObserver(more);
      if (tabRow) tabRo.observe(tabRow);

      /* Tap the screenshot for the next step (not on a video's own button). */
      const onTap = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el.closest('button, a') || !el.closest('.sv-media')) return;
        const i = selected();
        tabs[(i + 1) % tabs.length].click();
      };
      track.addEventListener('click', onTap);

      const ro = new ResizeObserver(fit);
      panels.forEach((p) => ro.observe(p));
      onPanel();
      t.go(selected(), true);

      offs.push(() => {
        t.destroy();
        ro.disconnect();
        nearIo.disconnect();
        document.removeEventListener(PANEL_EVENT, onAny);
        track.removeEventListener('pointerdown', cancelTarget);
        track.removeEventListener('click', onTap);
        tabRow?.removeEventListener('scroll', onTabScroll);
        tabRo.disconnect();
        cancelAnimationFrame(moreRaf);
        if (tabRow) delete tabRow.dataset.more;
        track.style.removeProperty('height');
      });
    });

    return () => offs.forEach((off) => off());
  });

  return () => mm.revert();
};

/* ---------------------------------------------------------------------------
   Eras on phones (Eras.astro)

   One era per screen on a snapping track, with the year scrubber over it.
   The scrubber's line follows the track continuously (it's a timeline, not
   a set of pages), the current year is marked, and a tap on a year slides
   there. If a swipe lands on an era while you're far down the previous
   one's text, the page eases back up to the scrubber so the new era starts
   at its top.
   ------------------------------------------------------------------------ */

export const erasMobile = () => {
  const root = document.querySelector<HTMLElement>('[data-eras]');
  const track = root?.querySelector<HTMLElement>('[data-er-track]');
  const scrub = root?.querySelector<HTMLElement>('[data-er-scrub]');
  if (!root || !track || !scrub) return;

  const mm = gsap.matchMedia();
  mm.add(touchLayout, () => {
    const items = Array.from(track.querySelectorAll<HTMLElement>('[data-er-item]'));
    const years = Array.from(scrub.querySelectorAll<HTMLButtonElement>('[data-er-year]'));
    if (items.length < 2) return;

    let raf = 0;
    const fill = () => {
      raf = 0;
      const max = track.scrollWidth - track.clientWidth;
      scrub.style.setProperty('--er-p', max > 0 ? (track.scrollLeft / max).toFixed(4) : '0');
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(fill);
    };
    track.addEventListener('scroll', onScroll, { passive: true });

    const fit = (i: number) => {
      const el = items[i];
      if (el) track.style.height = `${el.offsetHeight}px`;
    };

    const t = snapTrack(track, items, (i, prev) => {
      years.forEach((y, k) => (k === i ? y.setAttribute('aria-current', 'true') : y.removeAttribute('aria-current')));
      fit(i);
      /* Highlights and videos in the newly visible era. */
      document.dispatchEvent(new CustomEvent(PANEL_EVENT));
      if (prev < 0) return;
      /* Back to the top of the era if the reader was deep in the last one:
         past the middle of its screenshots, reading the story under them.
         Only the track's top being under the scrubber isn't enough. That
         fired 50-70px into the era, while the screenshots being swiped were
         still in full view, and jumped the page under the reader's finger
         (BUG-033). */
      const top = scrub.getBoundingClientRect().bottom;
      const lead = track.getBoundingClientRect().top;
      const shots = (items[i].querySelector<HTMLElement>('.er-stack__shots') ?? items[i]).getBoundingClientRect();
      if (lead < top - 40 && shots.top + shots.height / 2 < top) {
        const y = window.scrollY + (lead - top) - 8;
        const lenis = motion.lenis;
        if (lenis) lenis.scrollTo(y, { duration: 0.8 });
        else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    });

    const yearOffs = years.map((y, k) => {
      const on = () => t.go(k);
      y.addEventListener('click', on);
      return () => y.removeEventListener('click', on);
    });

    const ro = new ResizeObserver(() => fit(t.index()));
    items.forEach((el) => ro.observe(el));
    fit(0);
    fill();

    return () => {
      t.destroy();
      ro.disconnect();
      cancelAnimationFrame(raf);
      track.removeEventListener('scroll', onScroll);
      yearOffs.forEach((off) => off());
      track.style.removeProperty('height');
      scrub.style.removeProperty('--er-p');
    };
  });

  return () => mm.revert();
};

/* ---------------------------------------------------------------------------
   Reading pill — long case studies on phones (CaseStudy.astro, mobile.css)

   A small pill floating at the bottom centre: a ring that fills as you read,
   and the name of the section you're in. Tap it and the list of sections
   opens above it; tap one to go there. Like the header (and the browser's
   own toolbar) it tucks away while you scroll down and comes back as soon
   as you scroll up, so it never sits on the text you're reading. It only
   shows between the end of the hero and the end of the study's text: it
   goes before the last line of the last section can reach it, so scrolling
   back up from Next project never parks it on that line, and a small
   nudge back up (under UNTUCK_PX) doesn't bring it out over the bottom
   line you were just reading.
   ------------------------------------------------------------------------ */

/* Room kept between the end of the study's text and the bottom of the
   screen while the pill shows: the pill's height, its offset from the edge,
   the home indicator, and a line. */
const PILL_CLEAR = 120;
/* How far you scroll back up before the pill comes back. */
const UNTUCK_PX = 48;

export const studyProgress = () => {
  const pill = document.querySelector<HTMLElement>('[data-cs-pill]');
  const article = pill?.closest<HTMLElement>('.cs');
  if (!pill || !article) return;

  const mm = gsap.matchMedia();
  mm.add(touchLayout, () => {
    const btn = pill.querySelector<HTMLButtonElement>('[data-cs-pill-btn]');
    const sheet = pill.querySelector<HTMLElement>('[data-cs-pill-sheet]');
    const list = pill.querySelector<HTMLElement>('[data-cs-pill-list]');
    const label = pill.querySelector<HTMLElement>('[data-cs-pill-label]');
    const ring = pill.querySelector<SVGCircleElement>('[data-cs-pill-ring]');
    if (!btn || !sheet || !list || !label) return;

    const heads = Array.from(article.querySelectorAll<HTMLElement>('h2[id]')).filter(
      (h) => !h.closest('[data-cs-pill]'),
    );
    if (heads.length < 3) return;
    const sections = heads.map((h) => h.closest<HTMLElement>('section, .cs-sec') ?? h);
    const next = article.querySelector<HTMLElement>('.nx');
    /* The last block of the study's text: whatever sits before Next project
       (or before the pill itself on a study without one). */
    let last = (next ?? pill).previousElementSibling as HTMLElement | null;
    while (last && last.matches('[data-cs-pill], script, style')) last = last.previousElementSibling as HTMLElement | null;
    const original = label.textContent ?? '';

    /* The list, built from the headings actually on the page. */
    const links = heads.map((h, i) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.className = 'cs-pill__link';
      a.textContent = (h.textContent ?? '').trim();
      a.dataset.i = String(i);
      li.append(a);
      list.append(li);
      return a;
    });

    pill.hidden = false;

    let current = -1;
    const setCurrent = (i: number) => {
      if (i === current) return;
      current = i;
      label.textContent = i >= 0 ? links[i].textContent : original;
      links.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    };

    /* Which section crosses a line 40% down the screen. */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setCurrent(sections.indexOf(e.target as HTMLElement));
        });
      },
      { rootMargin: '-40% 0px -59% 0px' },
    );
    sections.forEach((s) => io.observe(s));

    /* Shown from the first section to the Next project block. */
    let inRange = false;
    let tucked = false;
    let open = false;
    const render = () => {
      pill.classList.toggle('is-shown', inRange || open);
      pill.classList.toggle('is-tucked', tucked && !open);
    };

    let lastY = window.scrollY;
    let upRun = 0;
    let raf = 0;
    /* After a jump from the list the page glides down by itself; that isn't
       the reader scrolling, so the pill stays put until shortly after. */
    let holdUntil = 0;
    const tick = () => {
      raf = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      ring?.style.setProperty('stroke-dashoffset', String(100 - Math.min(100, (y / Math.max(1, max)) * 100)));
      const firstTop = sections[0].getBoundingClientRect().top;
      const nextTop = next ? next.getBoundingClientRect().top : Infinity;
      /* Where the text ends: the last block's bottom, less its padding. The
         pill (bottom ~4.5rem of the screen) is gone before that line can get
         under it — PILL_CLEAR px of room below the screen edge. */
      const lastRect = last?.getBoundingClientRect();
      const textEnd = last && lastRect ? lastRect.bottom - parseFloat(getComputedStyle(last).paddingBottom) : Infinity;
      inRange = firstTop < innerHeight * 0.6 && nextTop > innerHeight * 0.75 && textEnd > innerHeight + PILL_CLEAR;
      const dy = y - lastY;
      lastY = y;
      if (performance.now() < holdUntil) {
        tucked = false;
        upRun = 0;
      } else if (dy > 4) {
        tucked = true;
        upRun = 0;
      } else if (dy < 0) {
        upRun -= dy;
        if (upRun > UNTUCK_PX) tucked = false;
      }
      if (!inRange && open) setOpen(false);
      render();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const scrim = article.querySelector<HTMLElement>('[data-cs-pill-scrim]');
    const setOpen = (on: boolean) => {
      open = on;
      sheet.hidden = !on;
      if (scrim) scrim.hidden = !on;
      btn.setAttribute('aria-expanded', String(on));
      pill.classList.toggle('is-open', on);
      /* Bring the current section into view inside the list — by hand:
         scrollIntoView would also scroll the page. */
      const cur = links[Math.max(current, 0)];
      if (on && cur) sheet.scrollTop = cur.offsetTop - sheet.clientHeight / 2 + cur.offsetHeight / 2;
      render();
    };
    const onBtn = () => setOpen(!open);
    btn.addEventListener('click', onBtn);

    const onLink = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.cs-pill__link');
      if (!a) return;
      e.preventDefault();
      const h = heads[Number(a.dataset.i)];
      setOpen(false);
      btn.focus({ preventScroll: true });
      /* Land the heading below the bar (which comes back on the way up),
         the same gap scroll-margin-top gives a plain #link (mobile.css). */
      const y = h.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(h).scrollMarginTop) || 24);
      holdUntil = performance.now() + 1000 + 800;
      const lenis = motion.lenis;
      if (lenis) lenis.scrollTo(y, { duration: 1 });
      else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    };
    list.addEventListener('click', onLink);

    /* Escape or a tap anywhere else closes the list. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        btn.focus();
      }
    };
    const onOutside = (e: PointerEvent) => {
      /* The scrim covers the page while the list is open, so a tap outside
         lands on it and only closes the list. */
      if (open && !pill.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside, { passive: true });

    tick();

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      btn.removeEventListener('click', onBtn);
      list.removeEventListener('click', onLink);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
      setOpen(false);
      list.replaceChildren();
      label.textContent = original;
      pill.hidden = true;
      pill.classList.remove('is-shown', 'is-tucked', 'is-open');
    };
  });

  return () => mm.revert();
};

/* ---------------------------------------------------------------------------
   Strips of secondary work on phones (Strip.astro): one nudge on arrival.
   The row itself is CSS scroll-snap.
   ------------------------------------------------------------------------ */

export const stripSwipe = () => {
  const tracks = Array.from(document.querySelectorAll<HTMLElement>('[data-st-track]'));
  /* Feature swipe rows (Feature.astro, two or three pieces) get the same
     height-follow as the strips below. */
  const featureRows = Array.from(document.querySelectorAll<HTMLElement>('.ft--many .ft-media'));
  if (!tracks.length && !featureRows.length) return;
  const mm = gsap.matchMedia();
  mm.add('(max-width: 47.999rem)', () => {
    /* A wide capture in a stacked strip (Strip.astro) opens on its middle,
       where a banner's content is; cut at both edges, it reads as a pan. */
    document.querySelectorAll<HTMLElement>('.st-item--wide [data-st-track]').forEach((frame) => {
      frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2;
    });
    const offs = tracks.map((t, i) => swipeHint(t, `bj:hint-strip-${i}`));

    /* A swipe row of mixed shapes (a desktop capture beside a tall phone
       capture) was as tall as its tallest piece, so a short slide sat over
       ~200px of nothing. The row now takes the height
       of the piece at its left edge and eases to the next one's as you
       swipe; a taller neighbour peeking in is cut at the row's bottom. */
    const rows = [...tracks.filter((t) => t.matches('ul.st-list')), ...featureRows];
    const fits = rows.map((row) => {
      const items = Array.from(row.querySelectorAll<HTMLElement>(':scope > .st-item, :scope > .ft-item'));
      if (items.length < 2) return () => {};
      let raf = 0;
      const fit = () => {
        raf = 0;
        const hs = items.map((it) => it.offsetHeight);
        if (Math.max(...hs) - Math.min(...hs) < 40) {
          row.style.removeProperty('height');
          return;
        }
        const left = row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft);
        let best = 0;
        let dist = Infinity;
        items.forEach((it, i) => {
          const d = Math.abs(it.getBoundingClientRect().left - left);
          if (d < dist) {
            dist = d;
            best = i;
          }
        });
        row.style.height = `${hs[best]}px`;
      };
      const queue = () => {
        if (!raf) raf = requestAnimationFrame(fit);
      };
      if (!prefersReducedMotion()) row.style.transition = 'height var(--duration-base) var(--ease-out-soft)';
      row.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', queue, { passive: true });
      const ro = new ResizeObserver(queue);
      items.forEach((it) => ro.observe(it));
      fit();
      return () => {
        cancelAnimationFrame(raf);
        row.removeEventListener('scroll', queue);
        window.removeEventListener('resize', queue);
        ro.disconnect();
        row.style.removeProperty('height');
        row.style.removeProperty('transition');
      };
    });

    return () => {
      offs.forEach((off) => off());
      fits.forEach((off) => off());
    };
  });
  return () => mm.revert();
};
