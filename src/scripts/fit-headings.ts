/*
  Section headings sized to the screen, below 1024 (Base.astro, every page).
  Its own module so the pages that only need this don't load the rest of
  the phone choreography in mobile-motion.ts.
*/

import { motion } from './motion';
import { wordEm, SPACE_EM } from '../lib/display-fit';

const { gsap } = motion;

const touchLayout = '(max-width: 63.999rem)';

/* ---------------------------------------------------------------------------
   Section headings sized to the phone or tablet (Base.astro, every page)

   On desktop the section headings (Archivo, wide, uppercase) are a fixed
   step. On a phone that step is 36px whatever the heading says, so
   "EXPERTISE" sits in a third of the screen's width and "MY ROLE" in half.
   Here each heading is sized so its longest word runs the full width of
   its column — a poster, not a label — capped at the page title's size so
   that stays the biggest thing on the page, and stepped down if that
   would stack a long heading more than three lines deep (case-study
   headings on a phone also stop at about 2.1rem). Words never break
   (the longest word is what decides the size). Below 1024 only; tablets get
   a higher cap.
   ------------------------------------------------------------------------ */

const FIT_MAX_PX = 48;
/* Tablets have the room for bigger posters. */
const FIT_MAX_PX_TABLET = 72;
/* Case-study block headings on a phone stop at about 2.1rem and never run
   past three lines; a long one steps down (to 24px at the least) until it
   fits three. */
const FIT_STUDY_MAX_PX = 34;
const FIT_MIN_PX = 24;
const FIT_MAX_LINES = 3;

export const fitHeadings = () => {
  const mm = gsap.matchMedia();
  mm.add(touchLayout, () => {
    const phone = matchMedia('(max-width: 47.999rem)').matches;
    const maxPx = phone ? FIT_MAX_PX : FIT_MAX_PX_TABLET;
    const heads = Array.from(
      document.querySelectorAll<HTMLElement>('main h2.text-heading, main h2.cs-h2, main h2.text-display'),
    ).filter((h) => !h.classList.contains('sr-only') && h.offsetParent !== null);
    if (!heads.length) return;

    /* Word widths come from the advance table (lib/display-fit), not from
       measuring in the page: no layout per word, so the whole pass is one
       read phase and one write phase. */
    const texts = heads.map((h) => (h.textContent ?? '').trim().split(/\s+/).filter(Boolean));
    const model = texts.map((t) => t.map(wordEm));
    let words = model;

    /* The table runs a little narrow for some words ("ONE-DAY" came out
       ~10% wider than predicted and ran off a 390 screen once the reveal
       made each word an unbreakable box). Each heading's longest word is
       measured once in the page and the whole heading's widths scaled to
       match. One probe per heading, all appended, then all read. */
    const calibrate = () => {
      const probes = heads.map((h, i) => {
        const longest = texts[i].reduce((a, w, j) => (model[i][j] > wordEm(a) ? w : a), texts[i][0] ?? '');
        const probe = document.createElement('span');
        probe.textContent = longest;
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;display:inline-block;left:0;top:0;';
        h.append(probe);
        return { probe, em: wordEm(longest) };
      });
      words = heads.map((h, i) => {
        const { probe, em } = probes[i];
        const real = probe.getBoundingClientRect().width / parseFloat(getComputedStyle(h).fontSize);
        const k = em > 0 && real > 0 ? Math.max(1, real / em) : 1;
        return model[i].map((w) => w * k);
      });
      probes.forEach(({ probe }) => probe.remove());
    };

    const fit = () => {
      heads.forEach((h) => h.style.removeProperty('font-size'));
      calibrate();
      const h1 = document.querySelector<HTMLElement>('main h1');
      const cap = Math.max(36, Math.min(maxPx, h1 ? parseFloat(getComputedStyle(h1).fontSize) : maxPx));
      /* Reads. */
      const sizes = heads.map((h, i) => {
        const cs = getComputedStyle(h);
        const base = parseFloat(cs.fontSize);
        const avail = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const widths = words[i];
        if (!base || !avail || !widths.length) return 0;
        const lines = (px: number) => {
          let n = 1;
          let run = 0;
          widths.forEach((w) => {
            const add = (run ? SPACE_EM : 0) + w;
            if (run && (run + add) * px > avail) {
              n += 1;
              run = w;
            } else run += add;
          });
          return n;
        };
        const study = phone && h.classList.contains('cs-h2');
        let size = Math.floor(Math.min(study ? FIT_STUDY_MAX_PX : cap, (avail * 0.995) / Math.max(...widths)));
        while (size > FIT_MIN_PX && lines(size) > FIT_MAX_LINES) size -= 1;
        return Math.abs(size - base) > 0.5 ? size : 0;
      });
      /* Writes. */
      heads.forEach((h, i) => {
        if (sizes[i]) h.style.fontSize = `${sizes[i]}px`;
      });
    };

    let timer = 0;
    const onResize = () => {
      clearTimeout(timer);
      timer = window.setTimeout(fit, 150);
    };
    fit();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      heads.forEach((h) => h.style.removeProperty('font-size'));
    };
  });
  return () => mm.revert();
};
