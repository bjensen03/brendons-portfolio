# brendonjensen.com

My portfolio. Built with Astro, Tailwind and GSAP, deployed as a static site.

The site is partly the argument — it's meant to demonstrate the thing it claims
I can do — so the interesting parts are the motion system and the content
schemas rather than the page count.

## Running it

```bash
npm install
npm run dev        # http://localhost:4321
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built site |
| `npm run check` | Astro + TypeScript diagnostics |
| `npm run verify` | Browser checks for the motion system (needs `npm run dev` running) |
| `npm run verify:webkit` | The same smoke test under WebKit |

`npm run verify` drives the Chrome already installed on the machine via
`playwright-core`, so there's no browser download for it. `verify:webkit` needs
`npx playwright-core install webkit` once.

## How it's put together

```
src/
  config.ts            Site constants, nav, contact details
  content.config.ts    Zod schemas for case studies and lab demos
  styles/global.css    Every design token in the project
  scripts/motion.ts    The entire motion system
  layouts/Base.astro   Head, view transitions, motion boot
  components/Hero.astro  The slot-canyon hero
  components/          Section, Container, Nav, Footer
  content/             MDX case studies and lab entries
```

### Design tokens

`src/styles/global.css` is the only file that defines a colour, a duration or an
easing curve. Components reference tokens; if a component needs a value that
doesn't exist, the fix is a new token, not a literal.

The palette is monochrome apart from one colour: near-black rock, bone type, and
one blue. Two tokens keep that honest:

- `--color-accent` is **bone**. The hero holds no colour at all, because light
  through a slot canyon is just light.
- `--color-signal` is **azure `#3d9bff`**, and covers hover, focus, active nav,
  buttons and selection — nothing else. If everything is highlighted, nothing
  is. It also means a focus ring can't vanish into bone-coloured text.

  Deliberately not the indigo around `#5c6cf5`: that hue is the default accent
  of half the templates on the internet, and looking generated is the one thing
  this site cannot afford.

Contrast ratios for every foreground against every surface are computed and
recorded in the comment at the top of `global.css`. Azure clears AA in both
directions, as text on the surface and as a button background carrying
surface-coloured text.

### Motion

`src/scripts/motion.ts` owns all of it — Lenis, GSAP, ScrollTrigger, SplitText.
Components opt in with attributes (`data-reveal`, `data-split`, `data-parallax`,
`data-magnetic`) rather than writing their own scripts, and bespoke work
registers a setup function through `registerMotion()` instead of adding its own
`astro:page-load` listener.

That's centralised because three problems meet at the same seam:

- **View transitions.** `<ClientRouter />` swaps the DOM without a page load, so
  ScrollTriggers from the previous page survive pointing at elements that no
  longer exist. Everything created is registered for teardown and killed on
  `astro:before-swap`.
- **Smooth scrolling.** Lenis takes over scrolling, so ScrollTrigger stops being
  told the page moved. Lenis is driven from GSAP's ticker and wired to
  `ScrollTrigger.update`.
- **Reduced motion.** One `matchMedia` check, in one place, reactive to being
  toggled mid-session — and content is left visible rather than merely
  un-animated, including anything caught part-way through a reveal.

Content that animates in only starts hidden while `html.motion-ok` is set, which
requires both JavaScript running and motion being allowed. A head script arms a
three-second failsafe that removes the class if the motion module never boots,
so a bad bundle degrades to a plain page instead of a blank one.

`npm run verify` checks all of the above in a real browser, including navigating
back and forth repeatedly and asserting the ScrollTrigger count stays flat.

### Content

Case studies live in `src/content/projects` as MDX. The schema enforces the
things that are easy to skip and expensive to omit:

- a `study` fails the build without an `underTheHood` block, because the named
  technical problem is the point of it
- client work fails the build without `clientApproved: true`, so nothing ships
  before permission to publish the details and numbers is confirmed
- Lighthouse scores require the URL measured and the date, since a score with no
  provenance is a claim rather than evidence

### Fonts

Big Shoulders Display for the oversized condensed display type, Space Grotesk
for everything else. Both are self-hosted through Astro's fonts API, which
handles subsetting, `woff2`, preload and metric-matched fallbacks — see the
`fonts` block in `astro.config.mjs`.

Big Shoulders is ultra-condensed and only works very large. Anything under about
2rem should use the body face.

## Still to do

- Domain, domain email and social URLs are placeholders in `src/config.ts` and
  `astro.config.mjs`.
- The home page has a real hero; everything below it is scaffolding until there
  are case studies to put there.
- Case studies, about page, contact form and lab are all still to build.

Two rejected design directions (a light topographic one, and a photography-led
one) were prototyped and removed. They're recoverable from git at commit
`154e46c` if either idea is ever wanted — the topographic contour motion would
suit a Lab demo.
