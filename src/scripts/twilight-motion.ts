/*
  Motion for the homepage Twilight section (components/home/TwilightSection).
  Goes through the motion module
  like everything else (registerMotion + its gsap/ScrollTrigger), so teardown
  on navigation and the reduced-motion switch are handled in one place.
  Transform, opacity and clip-path only: the page is re-themed live.
*/

import { motion, ease, prefersReducedMotion } from './motion';

const { gsap, ScrollTrigger } = motion;

/*
  The cover: the photo settles from a slight zoom to rest as the
  cover comes up the screen (scrubbed, on its own layer, so it never
  fights the mask's wipe or the parallax drift).
*/
export const twilightCoverZoom = () => {
  const zoom = document.querySelector<HTMLElement>('[data-td-zoom]');
  if (!zoom) return;
  const tween = gsap.fromTo(
    zoom,
    { scale: 1.12 },
    {
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: zoom.closest('.td-cover') ?? zoom, start: 'top bottom', end: 'center 45%', scrub: 0.4 },
    },
  );
  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
    gsap.set(zoom, { clearProps: 'transform' });
  };
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/*
  The gallery stage (1024+, motion on). Sets data-stage on the gallery,
  which turns the swipe into a sticky stage (CSS). Scroll position picks
  the item — round(progress × (n − 1)) — and a change of item plays a
  timed wipe: the new item rises in behind a mask while its picture
  settles from a slight zoom, the old one fades back, the caption and the
  count roll over. Because the wipe is timed and not scrubbed, the item on
  screen is always whole and at rest once the scroll stops. Dots scroll
  to their item's position. Only the item on show may play its reel.
*/
export const twilightStage = () => {
  const root = document.querySelector<HTMLElement>('[data-tdg]');
  if (!root) return;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 64rem)', () => {
    const stage = root.querySelector<HTMLElement>('.td-gal__stage');
    const view = root.querySelector<HTMLElement>('[data-tdg-view]');
    const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-tdg-slide]'));
    const masks = slides.map((s) => s.querySelector<HTMLElement>('[data-tdg-mask]')!);
    const cat = root.querySelector<HTMLElement>('[data-tdg-cat]');
    const cap = root.querySelector<HTMLElement>('[data-tdg-cap]');
    const num = root.querySelector<HTMLElement>('[data-tdg-num]');
    const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tdg-dot]'));
    if (!stage || !view || !slides.length || !cat || !cap || !num) return;
    const n = slides.length;

    root.setAttribute('data-stage', '');
    view.scrollLeft = 0;
    view.removeAttribute('tabindex');

    let current = -1;
    let tl: gsap.core.Timeline | null = null;

    const setText = (i: number) => {
      cat.textContent = slides[i].dataset.cat ?? '';
      cap.textContent = slides[i].dataset.cap ?? '';
      num.textContent = pad2(i + 1);
    };
    const mark = (i: number) => {
      slides.forEach((s, j) => s.toggleAttribute('data-reel-hold', j !== i));
      document.dispatchEvent(new Event('reel:gate'));
      dots.forEach((d, j) => (j === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    };

    const show = (i: number) => {
      if (i === current) return;
      const prev = current;
      current = i;
      tl?.progress(1).kill();
      mark(i);

      if (prev < 0) {
        gsap.set(slides, { autoAlpha: 0, zIndex: 0 });
        gsap.set(slides[i], { autoAlpha: 1, zIndex: 2 });
        gsap.set(masks[i], { clipPath: 'inset(0% 0% 0% 0%)' });
        setText(i);
        return;
      }

      const down = i > prev;
      const media = masks[i].firstElementChild as HTMLElement | null;
      tl = gsap.timeline({ defaults: { ease: ease.outStrata } });
      tl.set(slides, { zIndex: 0 })
        .set(slides[prev], { zIndex: 1 })
        .set(slides[i], { autoAlpha: 1, zIndex: 2 })
        .fromTo(
          masks[i],
          { clipPath: down ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75 },
          0,
        )
        .to(slides[prev], { autoAlpha: 0, scale: 0.96, duration: 0.6, ease: 'power2.out' }, 0.1)
        .set(slides[prev], { scale: 1 })
        .to([cat, cap], { yPercent: down ? -40 : 40, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, 0)
        .to(num, { yPercent: down ? -100 : 100, duration: 0.18, ease: 'power2.in' }, 0)
        .add(() => setText(i), 0.18)
        .fromTo([cat, cap], { yPercent: down ? 40 : -40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.45, stagger: 0.05 }, 0.2)
        .fromTo(num, { yPercent: down ? 100 : -100 }, { yPercent: 0, duration: 0.45 }, 0.2);
      if (media) tl.fromTo(media, { scale: 1.08 }, { scale: 1, duration: 0.9 }, 0);
    };

    const navOffset = () => parseFloat(getComputedStyle(stage).top) || 0;
    const st = ScrollTrigger.create({
      trigger: root,
      start: () => `top ${navOffset()}px`,
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => show(Math.round(self.progress * (n - 1))),
    });
    show(Math.round(st.progress * (n - 1)));

    const go = (event: Event) => {
      const i = Number((event.currentTarget as HTMLElement).dataset.tdgDot);
      const y = st.start + (i / (n - 1)) * (st.end - st.start) + 1;
      if (motion.lenis) motion.lenis.scrollTo(y);
      else window.scrollTo({ top: y, behavior: 'smooth' });
    };
    dots.forEach((d) => d.addEventListener('click', go));

    return () => {
      tl?.kill();
      st.kill();
      dots.forEach((d) => d.removeEventListener('click', go));
      root.removeAttribute('data-stage');
      view.setAttribute('tabindex', '0');
      gsap.set([...slides, ...masks, cat, cap, num], { clearProps: 'all' });
      masks.forEach((m) => gsap.set(m.firstElementChild, { clearProps: 'transform' }));
      slides.forEach((s) => s.removeAttribute('data-reel-hold'));
      document.dispatchEvent(new Event('reel:gate'));
      setText(0);
      mark(0);
    };
  });

  return () => mm.revert();
};

/*
  The gallery swipe (phones, tablets, reduced motion, no stage). Keeps
  the count and the dots in step with the row, and makes the dots scroll
  it. Registered with reduced: true. Does nothing while the stage is on.
*/
export const twilightSwipe = () => {
  const root = document.querySelector<HTMLElement>('[data-tdg]');
  const view = root?.querySelector<HTMLElement>('[data-tdg-view]');
  if (!root || !view) return;
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-tdg-slide]'));
  const num = root.querySelector<HTMLElement>('[data-tdg-num]');
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tdg-dot]'));
  const staged = () => root.hasAttribute('data-stage');

  const current = () => {
    const max = view.scrollWidth - view.clientWidth;
    if (view.scrollLeft >= max - 2) return slides.length - 1;
    const x = view.scrollLeft;
    let best = 0;
    slides.forEach((s, i) => {
      if (Math.abs(s.offsetLeft - slides[0].offsetLeft - x) < Math.abs(slides[best].offsetLeft - slides[0].offsetLeft - x)) best = i;
    });
    return best;
  };
  let last = -1;
  const update = () => {
    if (staged()) return;
    const i = current();
    if (i === last) return;
    last = i;
    if (num) num.textContent = pad2(i + 1);
    dots.forEach((d, j) => (j === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
  };
  const go = (event: Event) => {
    if (staged()) return;
    const i = Number((event.currentTarget as HTMLElement).dataset.tdgDot);
    view.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  view.addEventListener('scroll', update, { passive: true });
  dots.forEach((d) => d.addEventListener('click', go));
  update();

  return () => {
    view.removeEventListener('scroll', update);
    dots.forEach((d) => d.removeEventListener('click', go));
  };
};
