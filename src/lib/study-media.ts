import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadStudyImage } from './study-images';

/*
  Media helpers for the case-study blocks.

  Images and videos are allowed to be missing while a study is being laid
  out: a block asks for its file through these, and gets `undefined` back
  instead of a thrown build error, so it can render an obvious [NEED …]
  placeholder in that spot. Once the file lands, the same yaml renders the
  real thing with no other change.
*/

export const tryStudyImage = async (rel: string | undefined): Promise<ImageMetadata | undefined> => {
  if (!rel) return undefined;
  try {
    return await loadStudyImage(rel);
  } catch {
    console.warn(`[case study] missing image ${rel} — rendering a placeholder`);
    return undefined;
  }
};

/** Whether a file under public/ exists and isn't empty (a half-copied
    video is zero bytes for a moment). */
export const publicFileExists = (url: string | undefined): boolean => {
  if (!url || !url.startsWith('/')) return false;
  const file = join(process.cwd(), 'public', url);
  try {
    return existsSync(file) && statSync(file).size > 0;
  } catch {
    return false;
  }
};

/*
  A public/ URL with a short content hash on it (`?v=…`). Files in public/
  keep their names when they're replaced, so a browser, a CDN or the dev
  server's visitors can go on playing an old copy under the same URL. The
  reels were re-encoded with sound under the same names and the old silent
  copies kept playing: the Sound button showed "on" over a file with no
  audio track. A new file now means a new URL.
*/
const publicHashes = new Map<string, string>();
export const versionedPublic = (url: string): string => {
  if (!url.startsWith('/') || url.includes('?')) return url;
  const file = join(process.cwd(), 'public', url);
  try {
    const st = statSync(file);
    const key = `${file}|${st.size}|${st.mtimeMs}`;
    let hash = publicHashes.get(key);
    if (!hash) {
      hash = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 10);
      publicHashes.set(key, hash);
    }
    return `${url}?v=${hash}`;
  } catch {
    return url;
  }
};

export type Crop = { x: number; y: number; w: number; h: number };

/*
  A crop as CSS: the frame takes the aspect ratio of the cropped region, and
  the media inside is scaled up and shifted so only that region shows. Used
  for mockups exported with empty space round the device, and to trim the
  WordPress admin bar off the top of screen recordings.
*/
export const cropStyle = (crop: Crop | undefined, width: number, height: number): string => {
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const ratio = (c.w * width) / (c.h * height);
  return [
    `--crop-ratio: ${ratio.toFixed(4)}`,
    `--crop-w: ${(100 / c.w).toFixed(4)}%`,
    `--crop-h: ${(100 / c.h).toFixed(4)}%`,
    `--crop-x: ${((-c.x / c.w) * 100).toFixed(4)}%`,
    `--crop-y: ${((-c.y / c.h) * 100).toFixed(4)}%`,
  ].join('; ');
};

/** Source widths that never exceed the file, so nothing is upscaled. 1920
    is the ceiling: nothing on a study page is drawn wider than ~1920 CSS px
    at 1x, or ~62vw at 2x. */
export const widthsFor = (w: number, steps = [480, 720, 960, 1280, 1600, 1920]): number[] => {
  const out = steps.filter((x) => x <= w);
  return out.length ? out : [w];
};

/** The crop's aspect ratio (width / height) for a source of this size. */
export const cropRatio = (crop: Crop | undefined, width: number, height: number): number => {
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  return (c.w * width) / (c.h * height);
};

/*
  `sizes` for a cropped image. The caller describes how wide the visible
  frame is drawn; the <img> inside is that divided by crop.w (a phone cropped
  to a quarter of its canvas is drawn four frames wide), so each length is
  scaled to match. Without this the browser picks a file sized for the frame
  and the crop shows a quarter of it, blown up. The widths list caps it at
  the source, so nothing is upscaled.
*/
export const scaleSizes = (sizes: string, crop: Crop | undefined): string => {
  const w = crop?.w ?? 1;
  if (w >= 0.999) return sizes;
  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < sizes.length; i++) {
    const ch = sizes[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      entries.push(sizes.slice(start, i));
      start = i + 1;
    }
  }
  entries.push(sizes.slice(start));
  return entries
    .map((raw) => {
      const e = raw.trim();
      let cond = '';
      let len = e;
      if (e.startsWith('(')) {
        let d = 0;
        let j = 0;
        for (; j < e.length; j++) {
          if (e[j] === '(') d++;
          else if (e[j] === ')' && --d === 0) break;
        }
        cond = e.slice(0, j + 1) + ' ';
        len = e.slice(j + 1).trim();
      }
      return `${cond}calc(${len} / ${w.toFixed(4)})`;
    })
    .join(', ');
};
