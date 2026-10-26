import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
/* Astro 7 deprecates re-exporting `z` from astro:content — zod is a direct
   dependency instead, pinned to the same version Astro validates against. */
import { z } from 'zod';

/*
  Content schemas.

  These encode the structure the case studies are supposed to have, so a study
  that's missing the parts that make it persuasive fails the build instead of
  quietly shipping thin. In particular `underTheHood.problem` is required on
  every deep study — a named technical problem and how it was solved is the
  single most valuable paragraph on this site for a development role, and it's
  also the easiest one to skip when writing.
*/

/*
  'automation' earns its place because the work keeps producing it — Zapier
  pipelines, form routing, scheduling systems — and it is a genuinely separate
  skill from building the page that submits the form. Without it, that work has
  to be filed under development, which is where a client stops seeing it.

  Adding a value here adds a filter button on the work index automatically.
*/
const DISCIPLINES = ['development', 'design', 'marketing', 'automation'] as const;

/** Real, verifiable numbers only. If there aren't any, write the qualitative
    result in `outcome` and leave this off — invented metrics are worse than
    no metrics. */
const metric = z.object({
  value: z.string(),
  label: z.string(),
  note: z.string().optional(),
});

const lighthouse = z.object({
  performance: z.number().min(0).max(100),
  accessibility: z.number().min(0).max(100),
  bestPractices: z.number().min(0).max(100),
  seo: z.number().min(0).max(100),
  /* Which URL was measured and when — a score with no provenance is a claim,
     not evidence, and these move over time. */
  measuredUrl: z.url(),
  measuredOn: z.coerce.date(),
});

const projects = defineCollection({
  /* Underscore-prefixed files are ignored, so _template.mdx can document every
     field without shipping a fake case study to the live site. */
  loader: glob({ pattern: '**/[^_]*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        client: z.string(),
        year: z.number().int(),
        /* Drives filtering on the work index. Order matters — the first is the
           primary lens the piece is shown through. */
        disciplines: z.array(z.enum(DISCIPLINES)).nonempty(),
        role: z.array(z.string()).nonempty(),

        /* 'study' gets a full page and outranks everything visually.
           'card' is a one-sentence entry on the index.
           'concept' is self-directed or spec work — always labelled as such,
           never presented as client work. */
        depth: z.enum(['study', 'card', 'concept']),

        /** One line, for the hero. The result, not the activity. */
        outcome: z.string(),
        /** The situation: what the client needed, two or three sentences. */
        summary: z.string(),

        /* Optional at the field level, required for anything that renders one —
           see the refine below. Cards are a one-line row on the work index and
           never display an image, so demanding one made the cheap tier cost the
           same as the expensive tier, which defeated the point of having it. */
        cover: image().optional(),
        coverAlt: z.string().optional(),
        /** Desktop-only hover preview on work cards. Never autoplayed on mobile. */
        previewVideo: z.string().optional(),

        stack: z.array(z.string()).nonempty(),
        metrics: z.array(metric).default([]),
        testimonial: z
          .object({ quote: z.string(), name: z.string(), title: z.string() })
          .optional(),

        underTheHood: z
          .object({
            /** The genuinely hard problem, and how it was solved. */
            problem: z.string(),
            snippetLanguage: z.string().default('ts'),
            lighthouse: lighthouse.optional(),
            repo: z.url().optional(),
            liveUrl: z.url().optional(),
          })
          .optional(),

        /* The publication gate. Client work stays out of the build until
           permission to publish the details and numbers is actually confirmed —
           a checklist item is easy to forget, a required field is not. */
        clientApproved: z.boolean().default(false),
        featured: z.boolean().default(false),
        order: z.number().default(99),
      })
      /*
        A cover is no longer required at all. ProjectCover generates a
        topographic tile from the slug when one is missing, which is a real
        design decision rather than a placeholder — so a finished case study is
        no longer held hostage by a screenshot that hasn't been taken yet.

        coverAlt is still required whenever a real image is supplied, because a
        photograph carries information the generated tile does not.
      */
      .refine((data) => data.cover === undefined || data.coverAlt !== undefined, {
        message: 'A cover image needs coverAlt describing what the screenshot actually shows.',
        path: ['coverAlt'],
      })
      .refine((data) => data.depth !== 'study' || data.underTheHood !== undefined, {
        message:
          'A deep case study needs an `underTheHood` block — the hard problem is the point of it.',
        path: ['underTheHood'],
      })
      .refine((data) => data.depth === 'concept' || data.clientApproved, {
        message:
          'Client work needs `clientApproved: true` before it can be published. Confirm permission first.',
        path: ['clientApproved'],
      }),
});


/*
  Case studies, on the build sheet. The order and the optional visual blocks
  (heroMedia, layout, mockups, eras, scroller, viewers, strips) are
  defined below.

  Every study runs the same ten sections — hero, situation,
  role, at a glance, key decisions, hard problem, result, what I'd do
  differently, full stack, next project — and this schema is where that
  promise is kept. A study missing a section does not render a thinner page, it
  fails the build. That was the whole reason the old schema existed, applied
  now to a fixed skeleton instead of a loose set of fields.

  Counts are enforced where the sheet states them: two to six at-a-glance
  facts, two to four key decisions, all five beats of the hard problem. The
  60-words-per-beat cap on the hard problem is deliberately not enforced here —
  it is a writing target, and failing a build over one long sentence would make
  the rule get deleted rather than followed. The page reports it instead.

  `story` is the one allowance beyond the ten. Every study so far has had at
  least one section showing the build itself, and forcing that into Key
  Decisions made the decisions read as a feature list. Up to six, after the
  decisions by default, earlier when the rest of the study depends on it. Six is
  a ceiling, not a target — every extra section is one more place the skeleton
  stops being the same on every study.

  Prose fields are markdown. They are rendered at build time, so bold, code,
  lists and quotes all work and nothing ships a markdown parser to the browser.
  `==phrase==` highlights a phrase for skimmers (src/lib/highlight.ts) — one
  to three per section, phrases rather than paragraphs.

  Publication: `approved` defaults to false and unapproved studies only exist
  in development, or in a build made with PUBLIC_SHOW_DRAFTS=true. A default
  production build cannot contain them.
*/
const beat = z.string().min(1);

/*
  Building blocks for the visual sections of a case study (2026-10-22 template).
  Every one of them is optional, so a study that
  has none of them still validates and renders the plain sections.

  Image paths are relative to src/content/studies/images, like the gallery.
  Video paths are public URLs (/video/<study>/<name>.mp4). A file that isn't
  there yet renders as an obvious [NEED …] placeholder instead of failing the
  build, so a study can be laid out before its assets arrive.
*/
const shot = z.object({ src: z.string(), alt: z.string() });

/* Fractions of the source image to show — for mockups exported with empty
   space around the device. */
const crop = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
});

const video = z.object({
  src: z.string(),
  poster: z.string().optional(),
  /* What the recording shows, for people who can't watch it. */
  label: z.string(),
  /* Background colour baked into the recording, so the frame around it can
     match and the video's edge disappears. */
  matte: z.string().optional(),
  /** Play a single time and hold the last frame instead of looping. */
  once: z.boolean().optional(),
  /* Fractions of the frame to show (trims the admin bar off a recording, or
     the empty space round a device). */
  crop: crop.optional(),
  /* Source size in pixels — needed for the crop's aspect ratio. */
  width: z.number().optional(),
  height: z.number().optional(),
});

/* A section key in `layout`. Built-in sections by name, blocks by type:id. */
const layoutKey = z
  .string()
  .regex(
    /^(inShort|situation|role|glance|decisions|hardProblem|result|differently|fullStack|gallery|beforeAfter|eras|scroller|story:\d+|mockup:[\w-]+|viewer:[\w-]+|strip:[\w-]+|feature:[\w-]+|photos:[\w-]+|reels:[\w-]+|list:[\w-]+)$/,
    'Unknown layout key — see the README for the list.',
  );

const studies = defineCollection({
  loader: glob({ pattern: '**/[^_]*.yaml', base: './src/content/studies' }),
  schema: z.object({
    order: z.number(),
    /** Set for a study nested under another, e.g. 'prolook'. */
    parent: z.string().optional(),
    /* A study in a family that has grown big enough for its own page: it
       builds at /work/<id>/ instead of /work/<parent>/<id>/, stays in the
       family switcher and the parent's list, and the nested URL redirects
       to it (ALL IN, 2026-10-23). See studyHref in src/lib/studies.ts. */
    standalone: z.boolean().default(false),
    approved: z.boolean().default(false),

    /* How this study is described in its family's site switcher — a few words
       that say what kind of codebase it is. */
    kind: z.string().optional(),

    /* 1 · Hero */
    name: z.string(),
    label: z.string(),
    /* The page's meta description, when it should say more than `label`:
       what was built and one verified result. Pages fall back to `label`. */
    description: z.string().optional(),
    role: z.string(),
    company: z.string(),
    timeline: z.string(),
    team: z.string().optional(),
    stack: z.string().optional(),
    live: z.string().optional(),

    /* The image a card uses for this study on the home and work pages. */
    cover: z.string().optional(),
    coverAlt: z.string().optional(),

    /* What a card shows in place of a cover when there isn't one yet — a few
       named pieces of the work, taken from the study itself. */
    highlights: z.array(z.object({ name: z.string(), note: z.string() })).max(4).optional(),

    /*
      Visual proof. Paths are relative to src/content/studies/images and are
      resolved lazily by the layout, not declared with image() — see the note
      there. A path that doesn't exist fails the build when the page renders.
    */
    beforeAfter: z
      .object({
        before: z.string(),
        after: z.string(),
        beforeAlt: z.string(),
        afterAlt: z.string(),
        caption: z.string().optional(),
      })
      .optional(),
    gallery: z
      .object({
        heading: z.string(),
        intro: z.string().optional(),
        desktop: z.array(z.object({ src: z.string(), alt: z.string(), label: z.string() })).default([]),
        mobile: z.array(z.object({ src: z.string(), alt: z.string(), label: z.string() })).default([]),
      })
      .optional(),

    /* ── Template blocks (all optional) ─────────────────────────────────── */

    /* "In short": three or four lines for someone who reads nothing else —
       what it was, what was built, the result, the role. Markdown, so
       ==highlights== work. Shown in the hero, between the facts and the hero
       media, when it is first in `layout` (or there is no layout); anywhere
       else in `layout` it is its own section. Compose it from sentences the
       study already says — it is a summary, not new claims. */
    inShort: z.array(z.string().min(1)).min(3, 'In short is three or four lines.').max(4, 'In short is three or four lines.').optional(),

    /* The big visual under the hero: a looping recording or a still. */
    heroMedia: z
      .object({
        video: video.optional(),
        image: shot.optional(),
        crop: crop.optional(),
        /* How wide the hero visual runs. 'full' is edge to edge; 'large' and
           'medium' sit inside the page margins as a rounded panel in the
           media's matte colour, centred. Phones always get the full content
           width. */
        size: z.enum(['full', 'large', 'medium']).default('full'),
        /* The image has a transparent background (a device exported on an
           empty canvas): 'large' and 'medium' then drop the rounded panel
           behind it and the device sits straight on the page. */
        transparent: z.boolean().optional(),
      })
      .optional(),

    /* Section order. Leave it out and the page uses the default order (the
       ten sections, story placed by `placement`, then any blocks before the
       hard problem). Give it and only the listed sections render, in that
       order — hero and next project are always first and last. */
    layout: z.array(layoutKey).optional(),

    /* Device mockups shown big, full-bleed, between sections (mockup:<id>). */
    mockups: z
      .array(
        z.object({
          id: z.string(),
          src: z.string(),
          alt: z.string(),
          caption: z.string().optional(),
          crop: crop.optional(),
          /* Sit the mockup on a full-width sunken band. Off by default, so a
             transparent device floats on the page; turn it on when the crop
             cuts the device off (a stand running out of the frame) and the
             edge needs something to end against. */
          panel: z.boolean().optional(),
          /* A flat screenshot rather than a device: drawn inside the page
             margins with the media radius, like the other figures, instead
             of edge to edge. */
          inset: z.boolean().optional(),
        }),
      )
      .optional(),

    /* Versions of the same site over time. Pinned on desktop: one browser
       window, the year counting forward as the visitor scrolls. */
    eras: z
      .object({
        heading: z.string(),
        intro: z.string().optional(),
        items: z
          .array(
            z.object({
              year: z.string(),
              title: z.string(),
              /* Optional: a card can be its screenshots alone. */
              body: beat.optional(),
              /* Shown in the address bar. */
              url: z.string().optional(),
              shots: z.array(shot).min(1),
            }),
          )
          .min(2),
      })
      .optional(),

    /* A browser window that scrolls a full-page capture as the visitor
       scrolls, with numbered callouts. `at` is the point in the run (0–1)
       where a callout becomes active; x / y place its marker on the capture
       (fractions of its width and full height). */
    scroller: z
      .object({
        heading: z.string(),
        intro: z.string().optional(),
        pages: z
          .array(
            z.object({
              id: z.string(),
              label: z.string(),
              url: z.string().optional(),
              src: z.string(),
              alt: z.string(),
              clip: video.optional(),
              annotations: z
                .array(
                  z.object({
                    /* Optional: left out, the callout activates when its
                       marker reaches the middle of the window. */
                    at: z.number().min(0).max(1).optional(),
                    label: z.string(),
                    body: z.string(),
                    x: z.number().min(0).max(1),
                    y: z.number().min(0).max(1),
                  }),
                )
                .default([]),
            }),
          )
          .min(1),
      })
      .optional(),

    /* Click-through screens: a before/after flow, a set of portal screens.
       Steps sharing a `group` are shown under one heading on the tab row. */
    viewers: z
      .array(
        z.object({
          id: z.string(),
          heading: z.string(),
          intro: z.string().optional(),
          /* 'phone' shows each step's capture in a phone frame instead of a
             browser window — for an app captured at phone width. */
          device: z.enum(['browser', 'phone']).default('browser'),
          /* The app's own background colour, behind a phone capture cropped
             shorter than the screen, so the screen reads as one surface. */
          matte: z.string().optional(),
          lead: z.object({ src: z.string(), alt: z.string(), crop: crop.optional() }).optional(),
          steps: z
            .array(
              z.object({
                tab: z.string(),
                group: z.string().optional(),
                title: z.string(),
                body: beat,
                url: z.string().optional(),
                src: z.string().optional(),
                alt: z.string().optional(),
                video: video.optional(),
                /* Part of `src` to show, as fractions — a section further
                   down a full-page capture. */
                crop: crop.optional(),
                /* A phone-width capture of the same step, shown instead of
                   the desktop one on small screens. */
                narrow: z.string().optional(),
                /* A magnified crop of the screenshot shown beside it, for UI
                   that is too small to read at frame size. Fractions. */
                detail: crop.optional(),
              }),
            )
            .min(2),
        }),
      )
      .optional(),

    /* A compact strip of secondary screenshots at their own proportions. */
    strips: z
      .array(
        z.object({
          id: z.string(),
          heading: z.string(),
          intro: z.string().optional(),
          items: z
            .array(
              shot.extend({
                label: z.string(),
                /* Phones only, for a wide capture in a mostly-wide strip:
                   'pan' (the default) shows it at a height where its text
                   reads and pans sideways; 'fit' shows it whole at the
                   column width — a row of logos, where the whole row is
                   the point. */
                phone: z.enum(['pan', 'fit']).optional(),
              }),
            )
            .min(1),
        }),
      )
      .optional(),

    /* Text beside media: a heading, markdown in the author's words, and one
       to three images or recordings shown side by side at the same height
       (feature:<id>). `stack` puts the media under the text, centred, for a
       single wide recording. */
    features: z
      .array(
        z.object({
          id: z.string(),
          heading: z.string(),
          body: z.string().optional(),
          layout: z.enum(['split', 'stack']).default('split'),
          media: z
            .array(
              z
                .object({
                  src: z.string().optional(),
                  alt: z.string().optional(),
                  video: video.optional(),
                  caption: z.string().optional(),
                })
                .refine((m) => (m.src && m.alt) || m.video, {
                  message: 'A feature media item needs src + alt, or a video.',
                }),
            )
            .min(1)
            .max(3),
        }),
      )
      .optional(),

    /* Photographs sorted into categories (photos:<id>) — a photographer's
       own work, not screenshots. Each category leads with its `big` picks
       shown large, then the rest at a smaller size; with `tabs` (the
       default) one category shows at a time behind a tab row, otherwise
       they run one after another. `focus` is the object-position for a
       crop ("50% 68%"); without it the photo is centred. Paths as
       everywhere else, relative to src/content/studies/images
       (twilight-trekkers/library/… resolves to the shared photo library,
       src/lib/study-images.ts). */
    photoSets: z
      .array(
        z.object({
          id: z.string(),
          heading: z.string(),
          intro: z.string().optional(),
          tabs: z.boolean().default(true),
          categories: z
            .array(
              z.object({
                label: z.string(),
                items: z
                  .array(shot.extend({ focus: z.string().optional(), big: z.boolean().optional() }))
                  .min(1),
              }),
            )
            .min(1),
        }),
      )
      .optional(),

    /* Short vertical loops (reels:<id>), shown bare at the size of the
       photos around them — no phone frame. Muted, lazy, play only on
       screen, never under reduced motion, never more than two at once.
       `src` is a public URL (/video/<study>/<name>.mp4); `poster` a
       same-size still; `label` says what it shows. */
    reelSets: z
      .array(
        z.object({
          id: z.string(),
          heading: z.string(),
          intro: z.string().optional(),
          items: z
            .array(z.object({ src: z.string(), poster: z.string(), label: z.string() }))
            .min(1)
            .max(8),
        }),
      )
      .optional(),

    /* Named rows (list:<id>): a name on the left, a line beside it, ruled
       full-width rows — brand partners, services. Either `items` in the
       yaml, or `from`, a list kept in code so another page can share it
       (sources in src/lib/study-lists.ts). */
    lists: z
      .array(
        z
          .object({
            id: z.string(),
            heading: z.string(),
            intro: z.string().optional(),
            from: z.enum(['twilight-brands']).optional(),
            items: z.array(z.object({ name: z.string(), body: z.string() })).optional(),
          })
          .refine((l) => !!l.from !== !!l.items, { message: 'A list needs `items` or `from`, not both.' }),
      )
      .optional(),

    /* 2 · Situation */
    situation: beat,

    /* 3 · My role */
    myRole: beat,

    /* 4 · At a glance — scope, not results. */
    atAGlance: z
      .array(z.object({ value: z.string(), label: z.string(), note: z.string().optional() }))
      .min(2, 'At a glance needs two to six facts.')
      .max(6, 'At a glance needs two to six facts.'),

    /* 5 · Key decisions. Optional: a showcase study (Rally Rep) can leave
       them out; when present, two to four. */
    keyDecisions: z
      .array(z.object({ heading: z.string(), body: beat }))
      .min(2, 'Two to four key decisions.')
      .max(4, 'Two to four key decisions.')
      .optional(),

    story: z
      .array(
        z.object({
          heading: z.string(),
          body: beat,
          /* Where it sits. Most build sections belong after Key Decisions.
             Some have to come earlier: Rally's rebuild was the fourth stage of
             a longer story, so its decisions only make sense once the stages
             are read; Lincoln's survey is the reason for everything after it,
             so it comes straight after the situation. */
          placement: z
            .enum(['afterSituation', 'beforeDecisions', 'afterDecisions'])
            .default('afterDecisions'),
        }),
      )
      .max(6)
      .default([]),

    /* 6 · Hard problem — punchline first, then the five beats. Optional for
       a showcase study; when present, all five beats are required. */
    hardProblem: z
      .object({
      title: z.string().optional(),
      punchline: beat,
      problem: beat,
      assumption: beat,
      found: beat,
      fix: beat,
      verified: beat,
      /* Code shown with the fix, by export name from
         src/components/home/snippets.ts — the same excerpts the home page
         uses, so there is one copy of each. */
      code: z.array(z.object({ snippet: z.string(), caption: z.string().optional() })).optional(),
      })
      .optional(),

    /* 7 · Result */
    result: beat,
    testimonial: z
      .object({ quote: z.string(), name: z.string(), title: z.string() })
      .optional(),

    /* 8 · What I'd do differently (optional for a showcase study) */
    differently: beat.optional(),

    /* 9 · Full stack */
    fullStack: z
      .array(z.object({ group: z.string(), items: z.array(z.string()).min(1) }))
      .min(1),

    /* 10 · Next project */
    next: z.object({ href: z.string(), name: z.string(), line: z.string() }),

    /* Quick Overview. A study with this block gets a
       "Quick overview | Full case study" switch on the same URL; without
       it, the page is unchanged. The overview is a condensed read (2–3
       minutes) that still shows the work: up to six numbered sections,
       each with a short body, optional labels and image, and up to four
       of the study's own showcase blocks by layout key in total (`show`),
       rendered with the same components as the full study. At most one
       of the heavy pinned blocks (eras, scroller). `show: ['hardProblem']`
       renders the hard problem condensed: its punchline and code with the
       section's body in place of the five beats. */
    overview: z
      .object({
        /* The At a glance figures as a band above the sections. */
        glance: z.boolean().default(true),
        /* One line under the results band: the payoff in a sentence.
           Inline markdown (bold) is allowed. */
        hook: z.string().optional(),
        sections: z
          .array(
            z.object({
              heading: z.string(),
              body: z.string().optional(),
              labels: z.array(z.string()).optional(),
              image: z.object({ src: z.string(), alt: z.string(), crop: crop.optional() }).optional(),
              show: z.array(layoutKey).optional(),
            }),
          )
          .min(2, 'An overview needs two to six sections.')
          .max(6, 'An overview needs two to six sections.'),
      })
      .refine((o) => o.sections.flatMap((x) => x.show ?? []).length <= 4, {
        message: 'An overview shows at most four blocks — it is the condensed read.',
      })
      .refine((o) => o.sections.flatMap((x) => x.show ?? []).filter((k) => k === 'eras' || k === 'scroller').length <= 1, {
        message: 'An overview uses at most one pinned block (eras or scroller).',
      })
      .optional(),
  }),
});

export const collections = { projects, studies };

export type Discipline = (typeof DISCIPLINES)[number];
export { DISCIPLINES };
