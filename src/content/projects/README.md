# Case studies

One `.mdx` file per project. The schema in `src/content.config.ts` is the authority —
it will tell you exactly what's missing.

Images go in `src/content/projects/images/` and are referenced relatively, so
Astro's image pipeline can emit AVIF/WebP at the right sizes.

Three depths:

- `study` — a full case study page. Requires an `underTheHood` block. Reserve
  these for the three strongest pieces; they outrank everything else visually,
  and that only works if there are few of them.
- `card` — a one-sentence entry on the work index.
- `concept` — self-directed or spec work. Always labelled as such on the page.

Client work needs `clientApproved: true`, which means permission to publish the
details and the numbers has actually been confirmed. The build fails without it.

Body sections, in order: Situation · Approach · Under the hood · Result.
