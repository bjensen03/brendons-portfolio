/*
  Delete every built image that nothing in the build references.

  Why this exists: `import.meta.glob` makes Vite emit every file the pattern
  matches, whether or not any page ends up using it. That is fine for approved
  work and a real problem for case studies that aren't approved yet — their
  pages are correctly left out of a production build, but their screenshots
  were still being emitted into dist/_astro, unlinked and publicly reachable by
  URL. The first check of this found 22 unreleased QuickStrike captures in a
  default build.

  Rather than trying to make every glob clever enough to know what's approved,
  this enforces the rule that actually matters, at the last possible moment:
  an image ships only if a built page, stylesheet or script names it. That
  holds no matter how the image got pulled in, and it can't be undone by a
  future glob somebody adds without reading this.

  Scoped to dist/_astro, where Astro puts processed assets. public/ is copied
  verbatim on purpose and is never touched.
*/
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const ASSETS = path.join(DIST, '_astro');
const IMAGE = /\.(webp|png|jpe?g|avif|gif|svg)$/i;
const TEXT = /\.(html|css|js|mjs|xml|json|txt|webmanifest)$/i;

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

if (!fs.existsSync(ASSETS)) {
  console.log('prune: no dist/_astro, nothing to do');
  process.exit(0);
}

const files = walk(DIST);
const corpus = files.filter((f) => TEXT.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

let removed = 0;
let bytes = 0;
for (const file of walk(ASSETS).filter((f) => IMAGE.test(f))) {
  if (corpus.includes(path.basename(file))) continue;
  bytes += fs.statSync(file).size;
  fs.rmSync(file);
  removed += 1;
}

console.log(`prune: removed ${removed} unreferenced image(s), ${(bytes / 1048576).toFixed(1)} MB`);
