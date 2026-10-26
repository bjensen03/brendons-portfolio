# brendonjensen.dev

My portfolio. Built with Astro 7, Tailwind CSS 4 and GSAP, deployed as a static
site.

## Running it

```bash
npm install
npm run dev        # http://localhost:4321
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build to `dist/`, then prunes unreferenced images |
| `npm run preview` | Serve the built site |
| `npm run check` | Astro + TypeScript diagnostics |
| `npm run verify` | Contrast and motion-sequence checks in a real browser (needs `npm run dev` running) |
| `npm run verify:images` | Every image on every built page loads (run against a build) |
| `npm run verify:links` | Off-site links open in a new tab with a safe `rel` (needs `npm run dev`) |

The browser checks drive the Chrome already installed on the machine through
`playwright-core`, so there's no browser download.

## Structure

```
src/
  config.ts            Site constants, nav, contact details
  content.config.ts    Zod schemas for projects and case studies
  styles/              Design tokens (global.css), mobile, motion and study styles
  scripts/             Motion: the shared system (motion.ts) and per-page setups
  layouts/Base.astro   Head, view transitions, brightness, motion boot
  components/          Nav, MenuOverlay, ThemeSlider, Logo, Section, Container
  components/home/     Homepage sections
  components/footer/   The site footer
  components/study/    Case study blocks
  components/twilight/ The Twilight Trekkers page
  lib/                 Study lookups, image resolution, markdown helpers
  pages/               Routes
  content/studies/     Case studies (YAML) and their images
  content/projects/    Project and design-concept entries (MDX) and images
public/video/          Looping recordings used in the case studies
scripts/               Build and QA scripts
```

## Design tokens

`src/styles/global.css` is the only place a colour, duration or easing curve is
defined. One number, `--lum` on `<html>`, drives the whole palette: the
brightness slider writes it and a head script restores it before first paint.
Components reference tokens, never literals.

## Motion

`src/scripts/motion.ts` owns Lenis, GSAP and ScrollTrigger. Components opt in
with data attributes, and bespoke work registers a setup through
`registerMotion()`, which returns its own cleanup. That keeps three things in
one place: teardown across view transitions, Lenis wired to ScrollTrigger, and
a single reduced-motion check. Content only starts hidden while `html.motion-ok`
is set, and a failsafe removes that class if the motion module never boots.

## Case studies

Each study is one YAML file in `src/content/studies/`, validated by the schema
in `src/content.config.ts`. A study renders the same core sections (hero, in
short, situation, role, decisions, hard problem, result, full stack, next
project), and an optional `layout` list picks and orders blocks:

`inShort`, `situation`, `role`, `glance`, `decisions`, `hardProblem`, `result`,
`differently`, `fullStack`, `gallery`, `beforeAfter`, `eras`, `scroller`,
`story:<n>`, and `mockup:`, `viewer:`, `strip:`, `feature:`, `photos:`,
`reels:` and `list:` followed by an id.

Image paths are relative to `src/content/studies/images/`; videos are public
URLs under `/video/<study>/`. A study only builds in production once it has
`approved: true`.
