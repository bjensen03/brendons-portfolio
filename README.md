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
  config.ts            Site constants, nav, contact details, font switch
  content.config.ts    Zod schemas for case studies and lab demos
  styles/global.css    Every design token in the project
  styles/fonts.css     Font loading, currently on system fallbacks
  scripts/motion.ts    The entire motion system
  layouts/Base.astro   Head, view transitions, motion boot
  components/          Section, Container, StrataBand, Nav, Footer
  content/             MDX case studies and lab entries
```

### Design tokens

`src/styles/global.css` is the only file that defines a colour, a duration or an
easing curve. Components reference tokens; if a component needs a value that
doesn't exist, the fix is a new token, not a literal.

Contrast ratios for every foreground against every surface are computed and
recorded in the comment at the top of that file. Amber and teal both clear WCAG
AA on the core surfaces; the two combinations that only clear it at large sizes
are called out there.

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

## Still to do

- Fonts are on system fallbacks. `src/styles/fonts.css` has the switch-on steps;
  the `size-adjust` values are placeholders that need measuring against the real
  faces.
- Domain, domain email and social URLs are placeholders in `src/config.ts` and
  `astro.config.mjs`.
- The home page is a foundation placeholder — the layered hero, case studies,
  about page, contact form and lab all come later.
