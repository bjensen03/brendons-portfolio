/*
  Header motion. Registered from Nav.astro; the CSS half is the "Header"
  block in motion.css.

    logoEntrance   the mark draws (outline, then fill) and the name slides out
                   from behind it. Full page loads only — on the homepage it
                   waits for the opening to clear. Motion only.
    headerScroll   one ScrollTrigger for the whole page: the progress line
                   along the bar's bottom edge, the active bar, and (motion
                   only) hide on scroll down / back on scroll up. Runs under
                   reduced motion too, minus the hiding.

    headerHover    magnetic pull on the links and the Menu button, the mark's
                   tilt toward the pointer. Fine pointer, motion only.
    menuOpen /     the full-screen menu: a circle opens out of the Menu
    menuClose      button, the words rise through their masks; closing runs
                   it back into the button. Called by Nav.astro, which owns
                   the state; instant under reduced motion.
    menuPointer    the menu's hover preview following the cursor, and a
                   little parallax on the code behind. Fine pointer, motion
                   only.

  The rolling link labels and the peak's hover lift are CSS alone.
*/

import { motion, ease, duration, magnetic, prefersReducedMotion } from './motion';

const { gsap, ScrollTrigger } = motion;

/* -------------------------------------------------------------------------
   Logo entrance. Logo.astro's inline script sets html[data-logo-intro] before
   the bar paints on a real page load (motion allowed), which parks the mark
   and the name; this plays them in and lifts the attribute. Client-side
   navigations don't set it, so the header just appears as it is.

   0.00–0.35  both shapes trace their outline
   0.22–0.50  fill comes up, outline fades off
   0.18–0.75  the name slides out from behind the mark
   ---------------------------------------------------------------------- */

const OPENING_EVENT = 'opening:reveal';

export const logoEntrance = () => {
  const root = document.documentElement;
  if (!root.hasAttribute('data-logo-intro')) return;

  const logo = document.querySelector<HTMLElement>('header [data-logo]');
  const paths = logo ? Array.from(logo.querySelectorAll<SVGPathElement>('[data-logo-path]')) : [];
  const name = logo?.querySelector<HTMLElement>('[data-logo-name]');
  const svg = logo?.querySelector<SVGSVGElement>('svg');
  if (!logo || !paths.length || !name || !svg) {
    root.removeAttribute('data-logo-intro');
    return;
  }

  /* A 1.25px outline on screen, whatever size the mark renders at. */
  const units = svg.viewBox.baseVal.height / (svg.getBoundingClientRect().height || 28);
  const done = () => {
    root.removeAttribute('data-logo-intro');
    gsap.set(paths, { clearProps: 'all' });
    paths.forEach((path) => {
      path.removeAttribute('stroke-dasharray');
      path.removeAttribute('stroke-dashoffset');
    });
    gsap.set(name, { clearProps: 'transform' });
  };

  const tl = gsap.timeline({ paused: true, onComplete: done });
  /* The dash is set as attributes: paths carry pathLength="1", and GSAP's
     CSS side reads stroke-dashoffset back as "1px" and steps it instead of
     tweening. */
  tl.set(paths, {
    stroke: 'currentColor',
    strokeWidth: 1.25 * units,
    fillOpacity: 0,
    strokeOpacity: 1,
    attr: { 'stroke-dasharray': 1, 'stroke-dashoffset': 1 },
  })
    .call(() => root.removeAttribute('data-logo-intro'))
    .to(paths, { attr: { 'stroke-dashoffset': 0 }, duration: 0.35, ease: ease.inOutSoft, stagger: 0.04 }, 0)
    .to(paths, { fillOpacity: 1, duration: 0.28, ease: 'none' }, 0.22)
    .to(paths, { strokeOpacity: 0, duration: 0.2, ease: 'none' }, 0.36)
    .fromTo(name, { x: 0, xPercent: -104 }, { x: 0, xPercent: 0, duration: 0.57, ease: ease.outStrata }, 0.18);

  let fallback = 0;
  const go = () => {
    window.clearTimeout(fallback);
    tl.play();
  };

  if (root.dataset.opening === 'play') {
    /* The opening's cover is over the bar; start as it clears. */
    document.addEventListener(OPENING_EVENT, go, { once: true });
    fallback = window.setTimeout(go, 2600);
  } else {
    go();
  }

  return () => {
    window.clearTimeout(fallback);
    document.removeEventListener(OPENING_EVENT, go);
    tl.kill();
    done();
  };
};

/* -------------------------------------------------------------------------
   The active bar. One tan bar under the links, moved with transform only
   (translateX + scaleX of a 1px-wide element; motion.css transitions it).

   Off the homepage it sits under the link for the current page. On the
   homepage it follows the section under the middle of the screen: Work over
   Selected work, Contact over #contact, nowhere otherwise.

   The bar's last position is kept across view transitions, so going from
   About to Work slides it across instead of popping it in.
   ---------------------------------------------------------------------- */

type BarState = { x: number; w: number } | null;
let lastBar: BarState = null;

/* -------------------------------------------------------------------------
   Hide on scroll. Down past HIDE_AFTER hides the bar, any scroll up brings
   it straight back. Always shown near the top, while the menu or the
   brightness strip is open, and while anything in it has focus — a Tab
   into a hidden bar reveals it before the focus ring would be offscreen.
   ---------------------------------------------------------------------- */

const HIDE_AFTER = 120;
/* Ignore sub-pixel jitter from smooth scrolling settling. */
const DEAD_ZONE = 4;

export const headerScroll = () => {
  const header = document.querySelector<HTMLElement>('[data-nav]');
  if (!header) return;

  const reduced = prefersReducedMotion();
  const bar = header.querySelector<HTMLElement>('[data-nav-indicator]');
  const track = bar?.parentElement ?? null;
  const progress = header.querySelector<HTMLElement>('[data-nav-progress]');
  const links = Array.from(header.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'));
  const isHome = location.pathname === '/' || location.pathname === '';

  /* ---- active bar ---- */

  let target: HTMLAnchorElement | null = null;

  /* Layout offsets, not boxes: the links are magnetic (headerHover), and a
     link pulled toward the cursor mustn't drag the bar with it. The link is
     positioned, so the label's offsets are from it and the link's from the
     track. */
  const measure = (link: HTMLAnchorElement | null): BarState => {
    if (!link || !track) return null;
    const label = link.querySelector<HTMLElement>('[data-nav-label]') ?? link;
    if (!label.offsetWidth) return null;
    const x = link.offsetParent === track ? link.offsetLeft + label.offsetLeft : label.getBoundingClientRect().left - track.getBoundingClientRect().left;
    return { x, w: label.getBoundingClientRect().width };
  };

  const paint = (state: BarState, instant: boolean) => {
    if (!bar) return;
    bar.classList.toggle('is-instant', instant);
    if (state) {
      bar.style.transform = `translateX(${state.x}px) scaleX(${state.w})`;
      bar.classList.add('is-shown');
    } else {
      bar.classList.remove('is-shown');
    }
    lastBar = state;
  };

  const moveTo = (link: HTMLAnchorElement | null) => {
    const wasShown = bar?.classList.contains('is-shown') ?? false;
    target = link;
    const next = measure(link);
    /* Glide only between two visible positions; arriving from hidden it
       appears in place, so it never sweeps in from the left edge. */
    paint(next, reduced || !wasShown || !next);
  };

  if (bar) {
    const current = links.find((l) => l.getAttribute('aria-current') === 'page') ?? null;
    if (isHome) {
      paint(null, true);
    } else if (!reduced && lastBar && current) {
      /* Start where the previous page left it, then slide over. */
      paint(lastBar, true);
      void bar.offsetWidth;
      target = current;
      paint(measure(current), false);
    } else {
      target = current;
      paint(measure(current), true);
    }
  }

  const linkFor = (href: string) => links.find((l) => l.getAttribute('href') === href) ?? null;
  const sections: Array<[string, string]> = [
    ['#work', '/work/'],
    ['#contact', '/contact/'],
  ];
  const homeTriggers: ScrollTrigger[] = [];
  if (isHome && bar) {
    const active = new Set<string>();
    const update = () => {
      const href = sections.find(([, h]) => active.has(h))?.[1];
      const link = href ? linkFor(href) : null;
      if (link !== target || (!link && bar.classList.contains('is-shown'))) moveTo(link);
    };
    sections.forEach(([sel, href]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      homeTriggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top 50%',
          end: 'bottom 50%',
          onToggle: (self) => {
            if (self.isActive) active.add(href);
            else active.delete(href);
            update();
          },
        }),
      );
    });
  }

  /* Fonts or a resize move the links; keep the bar on its word. */
  const remeasure = () => {
    if (bar?.classList.contains('is-shown')) paint(measure(target), true);
  };
  const ro = track ? new ResizeObserver(remeasure) : null;
  if (track) ro?.observe(track);

  /* ---- hide on scroll + progress ---- */

  let hidden = false;
  let lastY = window.scrollY;

  const locked = () =>
    header.matches(':focus-within') ||
    header.querySelector('[data-nav-toggle][aria-expanded="true"], [data-lum-toggle][aria-expanded="true"]') !==
      null;

  const setHidden = (next: boolean) => {
    if (next === hidden) return;
    hidden = next;
    header.toggleAttribute('data-hidden', next);
    /* Mirrored on the root for things stuck below the bar (mobile.css
       --sticky-top), so they don't need a :has() over the whole page. */
    document.documentElement.toggleAttribute('data-header-hidden', next);
  };

  /* Keyboard focus arriving in a hidden bar: show it at once, not with the
     slide. The browser scrolls a focused element into view straight after
     focusing it, and a bar still sliding in from offscreen would make it
     scroll the page up to find it. */
  let snapFrame = 0;
  const onFocusIn = () => {
    if (!hidden) return;
    header.classList.add('is-snapping');
    setHidden(false);
    void header.offsetWidth;
    cancelAnimationFrame(snapFrame);
    snapFrame = requestAnimationFrame(() => header.classList.remove('is-snapping'));
  };
  header.addEventListener('focusin', onFocusIn);

  const scroller = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const p = self.progress;
      if (progress) {
        progress.style.transform = `scaleX(${p})`;
        progress.classList.toggle('is-shown', self.scroll() > 1);
      }

      if (reduced) return;
      const y = self.scroll();
      if (y <= HIDE_AFTER || locked()) {
        lastY = y;
        setHidden(false);
        return;
      }
      if (Math.abs(y - lastY) < DEAD_ZONE) return;
      setHidden(y > lastY);
      lastY = y;
    },
  });
  /* Land on the right state for wherever the page opened (back button,
     reload part-way down) rather than waiting for the first scroll. */
  if (progress) {
    progress.style.transform = `scaleX(${scroller.progress})`;
    progress.classList.toggle('is-shown', window.scrollY > 1);
  }

  return () => {
    scroller.kill();
    homeTriggers.forEach((t) => t.kill());
    ro?.disconnect();
    header.removeEventListener('focusin', onFocusIn);
    cancelAnimationFrame(snapFrame);
    header.classList.remove('is-snapping');
    header.removeAttribute('data-hidden');
    document.documentElement.removeAttribute('data-header-hidden');
  };
};

/* -------------------------------------------------------------------------
   Hover on the bar. The links and the Menu button lean toward the pointer
   (magnetic(), torn down with the page). The mark tilts a few degrees
   toward the pointer while it's over the logo, on top of the CSS lift.
   ---------------------------------------------------------------------- */

const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

export const headerHover = () => {
  if (!finePointer()) return;
  magnetic('header [data-nav-link]', { strength: 0.22 });
  magnetic('header [data-nav-toggle]', { strength: 0.3 });

  const logo = document.querySelector<HTMLElement>('header [data-logo]');
  const mark = logo?.querySelector<SVGSVGElement>('svg');
  if (!logo || !mark) return;

  const rot = gsap.quickTo(mark, 'rotation', { duration: duration.snap, ease: ease.outSoft });
  const lift = gsap.quickTo(mark, 'y', { duration: duration.snap, ease: ease.outSoft });
  const move = (event: PointerEvent) => {
    const box = mark.getBoundingClientRect();
    const dx = (event.clientX - (box.left + box.width / 2)) / Math.max(box.width, 1);
    rot(gsap.utils.clamp(-9, 9, dx * 7));
    lift(-2);
  };
  const leave = () => {
    rot(0);
    lift(0);
  };
  logo.addEventListener('pointermove', move);
  logo.addEventListener('pointerleave', leave);

  return () => {
    logo.removeEventListener('pointermove', move);
    logo.removeEventListener('pointerleave', leave);
    gsap.killTweensOf(mark);
    gsap.set(mark, { clearProps: 'transform' });
  };
};

/* -------------------------------------------------------------------------
   The menu. A circle grows out of the Menu button until it covers the
   screen, then the words rise through their masks, big ones first, the
   project names after, the foot last. Closing drops the words and pulls
   the circle back into the button.

   0.00–0.70  circle opens
   0.22–1.00  words rise, 60ms apart; project names from 0.42, 40ms apart
   0.30–0.90  code behind fades up
   0.55–1.05  foot fades up
   ---------------------------------------------------------------------- */

let menuTl: gsap.core.Timeline | null = null;

const menuParts = (menu: HTMLElement) => ({
  big: Array.from(menu.querySelectorAll<HTMLElement>('.menu__item [data-menu-word]')),
  small: Array.from(menu.querySelectorAll<HTMLElement>('.menu__sub [data-menu-word]')),
  foot: menu.querySelector<HTMLElement>('[data-menu-foot]'),
  code: menu.querySelector<HTMLElement>('[data-menu-code]'),
});

const resetMenu = (menu: HTMLElement) => {
  const { big, small, foot, code } = menuParts(menu);
  gsap.set([menu, ...big, ...small, foot].filter(Boolean), { clearProps: 'all' });
  /* The code's transform belongs to menuPointer's parallax. */
  if (code) gsap.set(code, { clearProps: 'opacity,visibility' });
};

/* The circle's centre (the Menu button) and the radius that reaches the
   farthest corner of the screen from it. */
const circleFrom = (toggle: HTMLElement) => {
  const box = toggle.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 2;
  return { x, y, r };
};

let lastOrigin = { x: 0, y: 0, r: 0 };

export const menuOpen = (menu: HTMLElement, toggle: HTMLElement, instant: boolean) => {
  menuTl?.kill();
  menuTl = null;
  const { big, small, foot, code } = menuParts(menu);

  if (instant) {
    resetMenu(menu);
    return;
  }

  /* The preview's screenshots are lazy so pages don't pay for them up
     front; start them now so they're in by the first hover. */
  /* Only where there is a preview to show: on touch it never appears, and a
     phone shouldn't download five screenshots it will never display. */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    menu.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'));
  }

  const { x, y, r } = (lastOrigin = circleFrom(toggle));
  const closed = `circle(0px at ${x}px ${y}px)`;
  const open = `circle(${r}px at ${x}px ${y}px)`;
  const midway = Boolean(menu.style.clipPath);

  menuTl = gsap.timeline({ onComplete: () => resetMenu(menu) });
  menuTl
    .fromTo(menu, { clipPath: midway ? menu.style.clipPath : closed }, { clipPath: open, duration: 0.7, ease: ease.inOutSoft }, 0)
    .fromTo(big, { yPercent: 112 }, { yPercent: 0, duration: 0.78, ease: ease.outStrata, stagger: 0.06 }, 0.22)
    .fromTo(small, { yPercent: 112 }, { yPercent: 0, duration: 0.6, ease: ease.outStrata, stagger: 0.04 }, 0.42);
  if (code) menuTl.fromTo(code, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'none' }, 0.3);
  if (foot) menuTl.fromTo(foot, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: ease.outSoft }, 0.55);
};

export const menuClose = (menu: HTMLElement, instant: boolean, done: () => void) => {
  menuTl?.kill();
  menuTl = null;
  const { big, small, foot, code } = menuParts(menu);

  if (instant || menu.hidden) {
    resetMenu(menu);
    done();
    return;
  }

  /* Back into the button: its position now, in case the page resized. */
  const toggle = document.querySelector<HTMLElement>('[data-nav-toggle]');
  const { x, y } = toggle ? circleFrom(toggle) : lastOrigin;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 2;

  menuTl = gsap.timeline({
    onComplete: () => {
      resetMenu(menu);
      done();
    },
  });
  menuTl
    .to([...big, ...small], { yPercent: -112, duration: 0.32, ease: ease.inOutSoft, stagger: 0.025 }, 0)
    .to([foot, code].filter(Boolean), { autoAlpha: 0, duration: 0.2, ease: 'none' }, 0)
    .fromTo(
      menu,
      { clipPath: menu.style.clipPath || `circle(${r}px at ${x}px ${y}px)` },
      { clipPath: `circle(0px at ${x}px ${y}px)`, duration: 0.55, ease: ease.inOutSoft },
      0.14,
    );
};

/* -------------------------------------------------------------------------
   The menu's cursor preview. Hovering a word shows its slide in a small
   frame that trails the pointer (to its right, or its left near the right
   edge), leaning a little with the pointer's speed. Changing word wipes the
   next slide up over the last. The code behind drifts a few pixels against
   the pointer.
   ---------------------------------------------------------------------- */

export const menuPointer = () => {
  if (!finePointer()) return;
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const list = menu?.querySelector<HTMLElement>('[data-menu-list]');
  const preview = menu?.querySelector<HTMLElement>('[data-menu-preview]');
  const code = menu?.querySelector<HTMLElement>('[data-menu-code]');
  if (!menu || !list || !preview) return;

  menu.dataset.preview = 'on';
  const slides = new Map(
    Array.from(preview.querySelectorAll<HTMLElement>('[data-preview-slide]')).map((el) => [el.dataset.previewSlide, el]),
  );

  const xTo = gsap.quickTo(preview, 'x', { duration: 0.55, ease: 'power3' });
  const yTo = gsap.quickTo(preview, 'y', { duration: 0.55, ease: 'power3' });
  const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.6, ease: 'power3' });
  const cx = code ? gsap.quickTo(code, 'x', { duration: 1.2, ease: 'power2' }) : null;
  const cy = code ? gsap.quickTo(code, 'y', { duration: 1.2, ease: 'power2' }) : null;

  let current: string | undefined;
  let shown = false;
  let lastX = 0;
  let placed = false;

  /* Beside the word under the pointer, never over it: x starts past the
     word's right edge and drifts a little with the pointer; y follows the
     pointer. Clamped to the screen. */
  let anchor: HTMLElement | null = null;
  const place = (event: PointerEvent) => {
    const w = preview.offsetWidth;
    const h = preview.offsetHeight;
    const gap = 32;
    let x = event.clientX + gap;
    if (anchor) {
      /* The union of the item's words: a wrapped name's link box can be as
         wide as the screen. */
      const rects = Array.from(anchor.querySelectorAll<HTMLElement>('[data-menu-word]'), (w) => w.getBoundingClientRect());
      if (!rects.length) rects.push(anchor.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left));
      const box = {
        left,
        right: Math.max(...rects.map((r) => r.right)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
        width: Math.max(...rects.map((r) => r.right)) - left,
      };
      const along = gsap.utils.clamp(0, 1, (event.clientX - box.left) / Math.max(box.width, 1));
      /* Work has its project list beside it at 1024+: clear that too. */
      const beside = anchor.matches('.menu__item') ? anchor.parentElement?.querySelector<HTMLElement>('.menu__subs') : null;
      const sub = beside?.getBoundingClientRect();
      const right = sub && sub.top < box.bottom && sub.left > box.left ? Math.max(box.right, sub.right) : box.right;
      x = Math.max(x, right + gap + along * 24);
      /* No room on the right (a project name near the edge): the left of
         the word instead. */
      if (x + w > window.innerWidth - 16 && box.left - gap - w >= 16) x = box.left - gap - w - along * 24;
    }
    x = gsap.utils.clamp(16, window.innerWidth - w - 16, x);
    const y = gsap.utils.clamp(16, window.innerHeight - h - 16, event.clientY - h / 2);
    if (!placed) {
      gsap.set(preview, { x, y });
      placed = true;
    }
    xTo(x);
    yTo(y);
    rTo(gsap.utils.clamp(-4, 4, (event.clientX - lastX) * 0.2));
    lastX = event.clientX;
  };

  const show = (key: string | undefined) => {
    if (key === current) return;
    const next = key ? slides.get(key) : undefined;
    if (!next) return hide();
    const prev = current ? slides.get(current) : undefined;
    current = key;
    gsap.killTweensOf(next);
    next.style.zIndex = '2';
    if (prev && prev !== next) prev.style.zIndex = '1';
    if (!shown) {
      slides.forEach((el) => el !== next && gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)', zIndex: 0 }));
      gsap.set(next, { clipPath: 'inset(0% 0% 0% 0%)' });
      gsap.fromTo(preview, { autoAlpha: 0, scale: 0.86 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: ease.outSoft, overwrite: 'auto' });
      shown = true;
    } else {
      gsap.fromTo(
        next,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.5,
          ease: ease.outStrata,
          /* Park the one underneath once it's covered. */
          onComplete: () => {
            if (prev && prev !== next && current !== prev.dataset.previewSlide) {
              gsap.set(prev, { clipPath: 'inset(100% 0% 0% 0%)', zIndex: 0 });
            }
          },
        },
      );
    }
    const img = next.querySelectorAll('img');
    if (img.length) gsap.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 0.7, ease: ease.outStrata, overwrite: 'auto' });
  };

  const hide = () => {
    if (!shown) return;
    shown = false;
    current = undefined;
    placed = false;
    gsap.to(preview, { autoAlpha: 0, scale: 0.9, duration: 0.25, ease: ease.outSoft, overwrite: 'auto' });
  };

  const over = (event: PointerEvent) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-menu-item]');
    if (item && list.contains(item)) {
      anchor = item;
      show(item.dataset.preview);
    } else {
      anchor = null;
      hide();
    }
  };
  const move = (event: PointerEvent) => {
    place(event);
    if (cx && cy) {
      cx((event.clientX / window.innerWidth - 0.5) * -24);
      cy((event.clientY / window.innerHeight - 0.5) * -16);
    }
  };
  const leave = () => hide();

  menu.addEventListener('pointermove', move);
  list.addEventListener('pointerover', over);
  list.addEventListener('pointerleave', leave);
  menu.addEventListener('click', leave);

  return () => {
    menu.removeEventListener('pointermove', move);
    list.removeEventListener('pointerover', over);
    list.removeEventListener('pointerleave', leave);
    menu.removeEventListener('click', leave);
    delete menu.dataset.preview;
    gsap.killTweensOf([preview, code, ...slides.values()].filter(Boolean));
    gsap.set(preview, { clearProps: 'all' });
    slides.forEach((el) => gsap.set(el, { clearProps: 'all' }));
    if (code) gsap.set(code, { clearProps: 'transform' });
  };
};
