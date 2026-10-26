/*
  Whether unapproved case studies are built.

  Always in development, so they can be written and reviewed. In a production
  build only when PUBLIC_SHOW_DRAFTS=true is set explicitly — so the default
  `npm run build` cannot contain client work that hasn't been signed off, and
  shipping a draft takes a deliberate flag rather than a forgotten one.
*/
export const showDrafts = (): boolean =>
  import.meta.env.DEV || import.meta.env.PUBLIC_SHOW_DRAFTS === 'true';
