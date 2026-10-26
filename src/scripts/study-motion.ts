/*
  Case-study choreography — the JS half of the blocks in
  src/components/study/.

  Same contract as home-motion.ts: every export is a setup handed to
  registerMotion() by CaseStudy.astro, returns its own cleanup, and builds
  its ScrollTriggers inside a gsap.context() or gsap.matchMedia() so one
  revert() tears everything down on a view transition. Nothing here sets a
  colour; motion is transform, opacity, clip-path and visibility only.

    studyVideos   play while on screen, pause offscreen; the play/pause button
                  (reduced motion: never starts on its own)
    stepViewers   the tabbed before/after and portal viewers (runs with
                  reduced motion; swaps are instant then)
    studyZoom     media easing back from a slight zoom as it crosses the screen
    erasStage     the pinned three-websites stage (1024+)
    pageScroller  the browser window that scrolls a full-page capture (1024+
                  pinned; otherwise the window scrolls itself and the callouts
                  jump inside it)
    hardBeats     lights the hard-problem index as each beat passes (1024+)
    studyHighlights  draws the underline under each ==highlight== as it
                  scrolls into view
                                  (adds .is-lit; the stroke itself is CSS in study.css)
*/

import { motion, ease, duration, prefersReducedMotion, rebuildPage } from './motion';

const { gsap, ScrollTrigger } = motion;

const desktopMotion = '(min-width: 64rem) and (prefers-reduced-motion: no-preference)';

/* Lenis owns the scroll when it's running; ask it, so the jump is smooth and
   ScrollTrigger hears about it. */
const scrollToY = (y: number) => {
  const lenis = motion.lenis;
  if (lenis) lenis.scrollTo(y, { duration: 1.1 });
  else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
};

/* -------------------------------------------------------------------------
   Videos
   ---------------------------------------------------------------------- */

const PANEL_EVENT = 'study:panel';

export const studyVideos = () => {
  const figs = Array.from(document.querySelectorAll<HTMLElement>('[data-study-video]'));
  if (!figs.length) return;

  const still = prefersReducedMotion();
  type State = { fig: HTMLElement; video: HTMLVideoElement; button: HTMLButtonElement; label: HTMLElement | null; inView: boolean; userPaused: boolean; once: boolean; ended: boolean };
  const states: State[] = [];

  /* A step-viewer panel being switched away from is still visible for the
     length of its fade, so it counts as hidden as soon as it stops being the
     active one — otherwise its clip keeps playing behind the new panel until
     the next switch. */
  const visible = (el: HTMLElement) =>
    !el.closest('[data-viewer-panel]:not(.is-active)') &&
    (typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true }) : true);

  const render = (s: State) => {
    const playing = !s.video.paused;
    s.button.setAttribute('aria-pressed', String(playing));
    if (s.label) s.label.textContent = playing ? 'Pause video' : 'Play video';
  };

  const sync = (s: State) => {
    /* A play-once clip that has finished holds its last frame. */
    const should = s.inView && !s.userPaused && !(s.once && s.ended) && visible(s.video);
    if (should && s.video.paused) {
      s.video.play().catch(() => {}).finally(() => render(s));
    } else if (!should && !s.video.paused) {
      s.video.pause();
    }
    render(s);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const s = states.find((x) => x.fig === entry.target);
        if (!s) return;
        s.inView = entry.isIntersecting && entry.intersectionRatio >= 0.33;
        sync(s);
      });
    },
    { threshold: [0, 0.33, 0.6] },
  );

  const offs: Array<() => void> = [];

  figs.forEach((fig) => {
    const video = fig.querySelector<HTMLVideoElement>('[data-study-video-el]');
    const button = fig.querySelector<HTMLButtonElement>('[data-study-video-toggle]');
    if (!video || !button) return;
    const s: State = {
      fig,
      video,
      button,
      label: fig.querySelector('[data-study-video-label]'),
      inView: false,
      /* Under reduced motion nothing starts on its own; the button still
         plays it. */
      userPaused: still,
      once: fig.hasAttribute('data-once'),
      ended: false,
    };
    states.push(s);
    io.observe(fig);

    const toggle = () => {
      if (s.video.paused) {
        s.userPaused = false;
        if (s.ended) {
          s.ended = false;
          s.video.currentTime = 0;
        }
        s.video.play().catch(() => {}).finally(() => render(s));
      } else {
        s.userPaused = true;
        s.video.pause();
        render(s);
      }
    };
    const onState = () => render(s);
    const onEnded = () => {
      s.ended = true;
      render(s);
    };
    button.addEventListener('click', toggle);
    video.addEventListener('play', onState);
    video.addEventListener('pause', onState);
    video.addEventListener('ended', onEnded);
    offs.push(() => {
      button.removeEventListener('click', toggle);
      video.removeEventListener('play', onState);
      video.removeEventListener('pause', onState);
      video.removeEventListener('ended', onEnded);
    });
  });

  /* A step viewer switching panels changes what's visible without moving
     anything, so the observer won't fire — re-check on its event. */
  const resync = () => states.forEach(sync);
  document.addEventListener(PANEL_EVENT, resync);

  return () => {
    io.disconnect();
    document.removeEventListener(PANEL_EVENT, resync);
    offs.forEach((off) => off());
    states.forEach((s) => s.video.pause());
  };
};

/* -------------------------------------------------------------------------
   Step viewers — WAI-ARIA tabs with previous / next
   ---------------------------------------------------------------------- */

export const stepViewers = () => {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-viewer]'));
  if (!roots.length) return;

  const offs: Array<() => void> = [];

  roots.forEach((root) => {
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-viewer-tab]'));
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-viewer-panel]'));
    const prev = root.querySelector<HTMLButtonElement>('[data-viewer-prev]');
    const next = root.querySelector<HTMLButtonElement>('[data-viewer-next]');
    const status = root.querySelector<HTMLElement>('[data-viewer-status]');
    const list = root.querySelector<HTMLElement>('[data-viewer-tabs]');
    if (!tabs.length || tabs.length !== panels.length) return;

    let current = 0;

    const select = (i: number, focus = false) => {
      current = Math.max(0, Math.min(tabs.length - 1, i));
      tabs.forEach((t, k) => {
        const on = k === current;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((p, k) => {
        const on = k === current;
        p.classList.toggle('is-active', on);
        p.inert = !on;
      });
      if (status) status.textContent = `Step ${current + 1} of ${tabs.length}`;
      if (prev) prev.disabled = current === 0;
      if (next) next.disabled = current === tabs.length - 1;
      if (focus) tabs[current].focus();
      document.dispatchEvent(new CustomEvent(PANEL_EVENT));
    };

    const onTab = (e: Event) => {
      const i = tabs.indexOf(e.currentTarget as HTMLButtonElement);
      if (i >= 0) select(i);
    };
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = {
        ArrowRight: current + 1,
        ArrowDown: current + 1,
        ArrowLeft: current - 1,
        ArrowUp: current - 1,
        Home: 0,
        End: tabs.length - 1,
      };
      if (!(e.key in map)) return;
      e.preventDefault();
      const n = tabs.length;
      select(((map[e.key] % n) + n) % n, true);
    };
    const onPrev = () => select(current - 1);
    const onNext = () => select(current + 1);

    tabs.forEach((t) => t.addEventListener('click', onTab));
    list?.addEventListener('keydown', onKey);
    prev?.addEventListener('click', onPrev);
    next?.addEventListener('click', onNext);

    select(0);

    offs.push(() => {
      tabs.forEach((t) => t.removeEventListener('click', onTab));
      list?.removeEventListener('keydown', onKey);
      prev?.removeEventListener('click', onPrev);
      next?.removeEventListener('click', onNext);
    });
  });

  return () => offs.forEach((off) => off());
};

/* -------------------------------------------------------------------------
   Zoom — hero media, mockups, viewer leads
   ---------------------------------------------------------------------- */

export const studyZoom = () => {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-study-zoom]'));
  if (!els.length) return;

  const ctx = gsap.context(() => {
    els.forEach((el) => {
      gsap.fromTo(
        el,
        { scale: 1.1 },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement ?? el,
            start: 'top bottom',
            end: 'center center',
            scrub: true,
          },
        },
      );
    });
  });

  return () => ctx.revert();
};

/* -------------------------------------------------------------------------
   Eras — the same site over time (Eras.astro)
   ---------------------------------------------------------------------- */

export const erasStage = () => {
  const root = document.querySelector<HTMLElement>('[data-eras]');
  if (!root) return;

  const mm = gsap.matchMedia();

  mm.add(desktopMotion, () => {
    const run = root.querySelector<HTMLElement>('[data-eras-run]');
    const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-eras-slide]'));
    const years = Array.from(root.querySelectorAll<HTMLElement>('[data-eras-year]'));
    const texts = Array.from(root.querySelectorAll<HTMLElement>('[data-eras-text]'));
    const jumps = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-eras-jump]'));
    const bar = root.querySelector<HTMLElement>('[data-eras-progress]');
    if (!run || !slides.length) return;

    root.dataset.ready = '';
    const n = slides.length;
    const eraOf = (i: number) => Number(slides[i].dataset.era ?? 0);
    const imgOf = (s: HTMLElement) => s.querySelector<HTMLElement>('img');

    let current = -1;
    let currentEra = -1;

    const setEra = (e: number, dir: number) => {
      if (e === currentEra) return;
      const prevEra = currentEra;
      currentEra = e;
      jumps.forEach((b, k) => b.setAttribute('aria-current', String(k === e)));
      texts.forEach((t, k) => (t.style.visibility = k === e ? 'visible' : 'hidden'));
      /* What's visible changed without anything moving (videos, highlights). */
      document.dispatchEvent(new CustomEvent(PANEL_EVENT));

      /* The year rolls: the old one up and out of its mask, the new one up
         into it (or down, scrolling back). */
      years.forEach((y, k) => {
        gsap.killTweensOf(y);
        if (k === e) {
          y.style.visibility = 'visible';
          if (dir === 0) gsap.set(y, { yPercent: 0 });
          else gsap.fromTo(y, { yPercent: dir * 105 }, { yPercent: 0, duration: 0.8, ease: ease.outStrata });
        } else if (k === prevEra && dir !== 0) {
          gsap.to(y, {
            yPercent: -dir * 105,
            duration: 0.5,
            ease: ease.inOutSoft,
            onComplete: () => {
              if (currentEra !== k) y.style.visibility = 'hidden';
            },
          });
        } else {
          y.style.visibility = 'hidden';
        }
      });
    };

    const show = (i: number) => {
      if (i === current) return;
      const prev = current;
      current = i;
      const dir = prev === -1 ? 0 : i > prev ? 1 : -1;

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
      } else {
        gsap.fromTo(
          inc,
          { clipPath: dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: ease.outStrata },
        );
        gsap.fromTo(imgOf(inc), { scale: 1.08, yPercent: dir * 3 }, { scale: 1, yPercent: 0, duration: 1.1, ease: ease.outStrata });
        const out = slides[prev];
        gsap.killTweensOf(out);
        gsap.set(out, { clipPath: 'inset(0% 0% 0% 0%)' });
        gsap.to(imgOf(out), { scale: 1.04, yPercent: -dir * 3, duration: 0.9, ease: ease.outStrata, overwrite: true });
      }

      setEra(eraOf(i), dir);
    };

    show(0);

    const st = ScrollTrigger.create({
      trigger: run,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        show(Math.min(n - 1, Math.floor(self.progress * n)));
        if (bar) gsap.set(bar, { scaleX: self.progress });
      },
    });

    const offs = jumps.map((b, e) => {
      const go = () => {
        const first = slides.findIndex((_, k) => eraOf(k) === e);
        scrollToY(st.start + ((first + 0.5) / n) * (st.end - st.start));
      };
      b.addEventListener('click', go);
      return () => b.removeEventListener('click', go);
    });

    return () => {
      offs.forEach((off) => off());
      const touched = [...slides, ...slides.map(imgOf), ...years, ...texts, bar].filter(Boolean) as HTMLElement[];
      gsap.killTweensOf(touched);
      gsap.set(touched, { clearProps: 'all' });
      jumps.forEach((b) => b.removeAttribute('aria-current'));
      delete root.dataset.ready;
    };
  });

  return () => mm.revert();
};

/* -------------------------------------------------------------------------
   Page scroller (PageScroller.astro)
   ---------------------------------------------------------------------- */

export const pageScroller = () => {
  const root = document.querySelector<HTMLElement>('[data-scroller]');
  if (!root) return;

  const runs = Array.from(root.querySelectorAll<HTMLElement>('[data-ps-run]')).map((run) => ({
    run,
    view: run.querySelector<HTMLElement>('[data-ps-view]'),
    page: run.querySelector<HTMLElement>('[data-ps-page]'),
    notes: Array.from(run.querySelectorAll<HTMLButtonElement>('[data-ps-note]')),
    marks: Array.from(run.querySelectorAll<HTMLElement>('[data-ps-mark]')),
    bodies: Array.from(run.querySelectorAll<HTMLElement>('[data-ps-body]')),
  }));

  const setActive = (r: (typeof runs)[number], k: number) => {
    r.notes.forEach((b, j) => b.classList.toggle('is-active', j === k));
    r.marks.forEach((m, j) => m.classList.toggle('is-active', j === k));
    r.bodies.forEach((b, j) => b.classList.toggle('is-active', j === k));
  };

  const mm = gsap.matchMedia();

  /* Pinned: scrolling the run scrolls the capture. */
  mm.add(desktopMotion, () => {
    root.dataset.ready = '';
    const offs: Array<() => void> = [];

    runs.forEach((r) => {
      const { run, view, page, notes } = r;
      if (!view || !page) return;
      const at = notes.map((b) => Number(b.dataset.at ?? 0));
      let travel = 0;
      let active = -1;

      const measure = () => {
        travel = Math.max(0, page.offsetHeight - view.clientHeight);
      };

      const update = (p: number) => {
        gsap.set(page, { y: -p * travel });
        if (!at.length) return;
        let best = 0;
        at.forEach((a, k) => {
          if (Math.abs(a - p) < Math.abs(at[best] - p)) best = k;
        });
        if (best !== active) {
          active = best;
          setActive(r, best);
        }
      };

      const st = ScrollTrigger.create({
        trigger: run,
        start: 'top top',
        end: 'bottom bottom',
        onRefresh: (self) => {
          measure();
          update(self.progress);
        },
        onUpdate: (self) => update(self.progress),
      });

      measure();
      update(0);

      notes.forEach((b, k) => {
        const go = () => scrollToY(st.start + at[k] * (st.end - st.start));
        b.addEventListener('click', go);
        offs.push(() => b.removeEventListener('click', go));
      });

      /* The capture may still be loading; its height decides the travel. */
      const img = page.querySelector('img');
      if (img && !img.complete) {
        const onLoad = () => ScrollTrigger.refresh();
        img.addEventListener('load', onLoad, { once: true });
        offs.push(() => img.removeEventListener('load', onLoad));
      }
    });

    return () => {
      offs.forEach((off) => off());
      runs.forEach((r) => {
        if (r.page) gsap.set(r.page, { clearProps: 'transform' });
        setActive(r, -1);
      });
      delete root.dataset.ready;
    };
  });

  /* Static: the window scrolls itself; a callout scrolls it to its marker. */
  mm.add('(max-width: 63.999rem), (prefers-reduced-motion: reduce)', () => {
    const offs: Array<() => void> = [];
    runs.forEach((r) => {
      r.notes.forEach((b, k) => {
        const go = () => {
          const mark = r.marks[k];
          if (!r.view || !mark) return;
          r.view.scrollTo({
            top: mark.offsetTop - r.view.clientHeight / 2,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          });
          setActive(r, k);
        };
        b.addEventListener('click', go);
        offs.push(() => b.removeEventListener('click', go));
      });
    });
    return () => {
      offs.forEach((off) => off());
      runs.forEach((r) => setActive(r, -1));
    };
  });

  return () => mm.revert();
};

/* -------------------------------------------------------------------------
   Hard problem — the index beside the beats
   ---------------------------------------------------------------------- */

export const hardBeats = () => {
  const root = document.querySelector<HTMLElement>('[data-hard]');
  if (!root) return;

  const mm = gsap.matchMedia();
  mm.add(desktopMotion, () => {
    const beats = Array.from(root.querySelectorAll<HTMLElement>('[data-hard-beat]'));
    const index = Array.from(root.querySelectorAll<HTMLElement>('[data-hard-index]'));
    const light = (i: number) => index.forEach((el, k) => el.classList.toggle('is-active', k === i));
    beats.forEach((beat, i) => {
      ScrollTrigger.create({
        trigger: beat,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => {
          if (self.isActive) light(i);
        },
      });
    });
    return () => light(-1);
  });

  return () => mm.revert();
};

/* -------------------------------------------------------------------------
   Highlights — <mark class="hl"> from ==phrase== in the yaml
   ---------------------------------------------------------------------- */

/*
  One observer for every mark on the page. A mark is lit once, when it is
  on screen and actually visible: the era texts and the inactive step-viewer
  panels sit in the viewport while hidden, so a mark that intersects while
  hidden waits in `pending` and is re-checked whenever a panel or era
  changes (PANEL_EVENT). Marks that arrive together (several in one
  paragraph, or the In short lines on load) are staggered in reading order.

  CSS does the drawing (study.css, .hl): this only adds .is-lit and the
  per-mark delay. Under reduced motion this setup doesn't run and the CSS
  leaves every mark fully highlighted.
*/
export const studyHighlights = () => {
  const marks = Array.from(document.querySelectorAll<HTMLElement>('.cs mark.hl'));
  if (!marks.length) return;

  const pending = new Set<HTMLElement>();
  const visible = (el: HTMLElement) =>
    typeof el.checkVisibility === 'function' ? el.checkVisibility({ visibilityProperty: true }) : true;

  const light = (batch: HTMLElement[]) => {
    const step = duration.fast * 1.5;
    batch
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .forEach((m, n) => {
        /* A beat after arrival, so the paragraph's own fade is under way first. */
        m.style.setProperty('--hl-delay', `${duration.fast + Math.min(n, 5) * step}s`);
        m.classList.add('is-lit');
        io.unobserve(m);
        pending.delete(m);
      });
  };

  const io = new IntersectionObserver(
    (entries) => {
      const ready: HTMLElement[] = [];
      entries.forEach((entry) => {
        const m = entry.target as HTMLElement;
        if (!entry.isIntersecting) {
          pending.delete(m);
        } else if (visible(m)) {
          ready.push(m);
        } else {
          pending.add(m);
        }
      });
      if (ready.length) light(ready);
    },
    /* Lit a little above the bottom edge, once the paragraph has started
       its own reveal. */
    { rootMargin: '0px 0px -20% 0px' },
  );

  const recheck = () => {
    const ready = [...pending].filter(visible);
    if (ready.length) light(ready);
  };

  marks.forEach((m) => io.observe(m));
  document.addEventListener(PANEL_EVENT, recheck);

  return () => {
    io.disconnect();
    document.removeEventListener(PANEL_EVENT, recheck);
    /* Leave nothing half-drawn if motion is switched off mid-page. */
    marks.forEach((m) => {
      m.classList.add('is-lit');
      m.style.removeProperty('--hl-delay');
    });
  };
};

/* -------------------------------------------------------------------------
   Highlight shapes — which marks sit on a single line

   The scribble under a ==highlight== is a mask, and WebKit renders a masked
   mark that wraps onto two lines as nothing at all (study.css). There the
   mask is only applied to marks tagged .hl--single, which this keeps up to
   date: once on load and again whenever the text reflows (resize, fonts).
   Runs with reduced motion too — it's about the drawing, not the motion.
   ------------------------------------------------------------------------ */

export const highlightShapes = () => {
  const marks = Array.from(document.querySelectorAll<HTMLElement>('.cs mark.hl'));
  if (!marks.length) return;

  let raf = 0;
  const tag = () => {
    raf = 0;
    const single = marks.map((m) => m.getClientRects().length <= 1);
    marks.forEach((m, i) => m.classList.toggle('hl--single', single[i]));
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(tag);
  };

  tag();
  const ro = new ResizeObserver(queue);
  marks.forEach((m) => ro.observe(m.parentElement ?? m));
  document.fonts?.ready.then(queue);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    marks.forEach((m) => m.classList.remove('hl--single'));
  };
};

/* -------------------------------------------------------------------------
   Quick overview / Full case study (ViewSwitch)

   The two views share one URL: bare is the overview, ?view=full the full
   study. The inline script after the panels has already parked the view
   that isn't showing outside the document (window.__csView), so every
   other setup only ever sees the visible one.

   Switching goes through rebuildPage: tear every trigger, pin and split
   down, swap the panels, build everything again against the new content.
   Pins and reveals measured against the old view would be wrong, and the
   parked panel was never measured at all. Then land at the top of the new
   view, under the sticky switch — unless the switch hasn't been reached
   yet (still reading the hero), when the scroll position is kept.

   A click or key pushes a history entry; Back/Forward (popstate) switch
   without adding one. The tabs work with motion off (registered with
   { reduced: true }); only the fade-in is motion.
   ---------------------------------------------------------------------- */

type ViewId = 'overview' | 'full';
type ViewStore = {
  current: ViewId;
  path: string;
  panels: Partial<Record<ViewId, HTMLElement>>;
  markers: Partial<Record<ViewId, Comment>>;
};

const viewStore = (): ViewStore | undefined => (window as unknown as { __csView?: ViewStore }).__csView;
const viewFromUrl = (): ViewId => (new URLSearchParams(location.search).get('view') === 'full' ? 'full' : 'overview');
const urlFor = (view: ViewId): string => {
  const url = new URL(location.href);
  if (view === 'full') url.searchParams.set('view', 'full');
  else url.searchParams.delete('view');
  return url.pathname + url.search + url.hash;
};

/* Swap the panels in the DOM and sync the tabs. No motion here. */
const applyView = (store: ViewStore, view: ViewId) => {
  const next = store.panels[view];
  const prev = store.panels[store.current];
  if (!next) return;
  if (prev && prev !== next && prev.isConnected) {
    prev.hidden = true;
    prev.remove();
  }
  const marker = store.markers[view];
  if (!next.isConnected && marker?.parentNode) marker.parentNode.insertBefore(next, marker.nextSibling);
  next.hidden = false;
  store.current = view;
  document.documentElement.dataset.view = view;
  document.querySelectorAll<HTMLButtonElement>('[data-vw-tab]').forEach((tab) => {
    const on = tab.dataset.vwTab === view;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  });
};

/* The store the inline script made. If a page swap brought the panels in
   without it running (or both are in the document for any other reason),
   park the one that isn't showing now. */
const ensureStore = (): ViewStore | undefined => {
  const els = (['overview', 'full'] as ViewId[]).map((id) => document.getElementById(`cs-${id}`));
  const existing = viewStore();
  if (existing && existing.path === location.pathname && !(els[0] && els[1])) return existing;
  if (!els[0] && !els[1]) return existing?.path === location.pathname ? existing : undefined;
  const view = viewFromUrl();
  const store: ViewStore = { current: view, path: location.pathname, panels: {}, markers: {} };
  (['overview', 'full'] as ViewId[]).forEach((id, i) => {
    const el = els[i];
    if (!el) return;
    const marker = document.createComment(`cs-${id}`);
    el.parentNode?.insertBefore(marker, el);
    store.panels[id] = el;
    store.markers[id] = marker;
    if (id !== view) {
      el.hidden = true;
      el.remove();
    }
  });
  (window as unknown as { __csView?: ViewStore }).__csView = store;
  return store;
};

export const viewSwitch = () => {
  const store = ensureStore();
  const bar = document.querySelector<HTMLElement>('[data-vw]');
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-vw-tab]'));
  if (!store || !bar || tabs.length !== 2) return;

  /* The URL is the truth: a stale store (back/forward cache) or an unknown
     ?view= value is put right without adding history. */
  const wanted = viewFromUrl();
  if (store.current !== wanted) applyView(store, wanted);
  else applyView(store, store.current);
  if (location.search.includes('view=') && wanted !== 'full') history.replaceState(history.state, '', urlFor(wanted));

  /* Where the new view should start: the panel's top, under the nav and
     the sticky bar. */
  const landingY = (panel: HTMLElement) => {
    /* Under the bar. The nav hides on the way down and comes back on the
       way up, and the bar rides with it, so the offset depends on which
       way the jump goes. */
    const top = panel.getBoundingClientRect().top + window.scrollY;
    const navH = document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 72;
    const up = top - bar.offsetHeight < window.scrollY;
    return Math.max(0, Math.round(top - bar.offsetHeight - (up ? navH : 0)));
  };

  const go = (view: ViewId, how: 'push' | 'pop', focusPanel = false) => {
    if (view === store.current) return;
    /* Past the switch already? Then land at the top of the new view. */
    const barTop = bar.getBoundingClientRect().top;
    const navH = parseFloat(getComputedStyle(bar).top) || 0;
    const reading = barTop <= navH + 1;

    /* Our own history entries, marked so the popstate handler knows them.
       The router's state is kept (it reads the index), but our capture-phase
       handler below stops the router from treating a view change as a page
       navigation. */
    if (how === 'push') history.pushState({ ...(history.state ?? {}), csView: view }, '', urlFor(view));

    rebuildPage(() => applyView(store, view));

    const panel = store.panels[view];
    if (!panel) return;
    if (reading) {
      const y = landingY(panel);
      const lenis = motion.lenis;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      motion.ScrollTrigger.update();
    }
    if (!prefersReducedMotion()) {
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    }
    /* Only the in-page link moves focus (the tabs keep it, per the tabs
       pattern): to the new view's first heading, so a screen reader starts
       reading there. */
    if (focusPanel) {
      const heading = panel.querySelector<HTMLElement>('h2, h3') ?? panel;
      if (heading !== panel && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  };

  const onClick = (e: Event) => go(((e.currentTarget as HTMLElement).dataset.vwTab as ViewId) ?? 'overview', 'push');
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.indexOf(e.currentTarget as HTMLButtonElement);
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j < 0) return;
    e.preventDefault();
    const tab = tabs[j];
    go(tab.dataset.vwTab as ViewId, 'push');
    /* The rebuild re-renders nothing in the bar, so the same node is there. */
    tab.focus();
  };
  /* Back/Forward between this page's own views: Base's head script stops
     Astro's router (it would reload the page for the changed ?view) and
     hands the move here. */
  const onPop = () => go(viewFromUrl(), 'pop');
  /* "Read the full case study" style links: any link to ?view=full on this
     page switches in place and lands on the new view. */
  const onLink = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="view=full"]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname) return;
    /* Capture phase, ahead of the router's click handler. */
    e.preventDefault();
    e.stopPropagation();
    go('full', 'push', true);
  };

  tabs.forEach((t) => {
    t.addEventListener('click', onClick);
    t.addEventListener('keydown', onKey);
  });
  document.addEventListener('cs:view-pop', onPop);
  document.addEventListener('click', onLink, true);

  return () => {
    tabs.forEach((t) => {
      t.removeEventListener('click', onClick);
      t.removeEventListener('keydown', onKey);
    });
    document.removeEventListener('cs:view-pop', onPop);
    document.removeEventListener('click', onLink, true);
  };
};
