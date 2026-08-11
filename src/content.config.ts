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

const DISCIPLINES = ['development', 'design', 'marketing'] as const;

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
  loader: glob({ pattern: '**/[!_]*.mdx', base: './src/content/projects' }),
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

        cover: image(),
        coverAlt: z.string(),
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

const lab = defineCollection({
  loader: glob({ pattern: '**/[!_]*.mdx', base: './src/content/lab' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    /* Required. A lab demo without readable source is a screenshot with extra
       steps — the source is the whole reason a developer clicks through. */
    sourceUrl: z.string(),
    date: z.coerce.date(),
    order: z.number().default(99),
  }),
});

export const collections = { projects, lab };

export type Discipline = (typeof DISCIPLINES)[number];
export { DISCIPLINES };
