/*
  The homepage Twilight Trekkers section (TwilightSection.astro): its
  cover photo, the follower count and the link. The photos below are the
  ranked picks from our library, kept here so swapping the cover is a
  one-line change. The reels live with ReelSlot in
  src/components/media/reels.ts.

  Photos come from our own library, sorted into
  src/content/projects/images/twilight-trekkers/library/<category>/ and
  ranked, best first. `focus` is each photo's focus point (object-position).
  Alt text describes what is in the frame; place names only where the file
  name already names the landmark.

  Facts only: Kaylee and I run it, started 2021, and the follower count as
  written in ../twilight/data.
*/

import { FOLLOWERS } from '../twilight/data';

export { FOLLOWERS };
export const TWILIGHT_PAGE = '/twilight-trekkers/';

const LIBRARY = import.meta.glob<ImageMetadata>(
  '../../content/projects/images/twilight-trekkers/library/*/*.webp',
  { eager: true, import: 'default' },
);
const lib = (path: string): ImageMetadata => {
  const img = LIBRARY[`../../content/projects/images/twilight-trekkers/library/${path}`];
  if (!img) throw new Error(`Twilight library image not found: ${path}`);
  return img;
};

export type Shot = {
  src: ImageMetadata;
  alt: string;
  /** object-position for the crop (the photo's focus point) */
  focus: string;
};

const shot = (path: string, alt: string, focus: string): Shot => ({ src: lib(path), alt, focus });

/* Best tier first (rank in brackets), then the rest used here. */
export const SHOTS = {
  /* [1] */ subway: shot('canyons/zion-subway-01.webp', 'The Subway in Zion: a keyhole pool of green water under curving sandstone, a tiny hiker behind.', '50% 68%'),
  /* [2] */ reflection: shot('desert/reflection-canyon-01.webp', 'Brendon at the rim of Reflection Canyon, water winding far below under sunbeams.', '58% 55%'),
  /* [3] small only */ mesaArch: shot('desert/mesa-arch-glow-01.webp', 'Mesa Arch glowing orange at sunrise, framing towers and canyon below.', '52% 58%'),
  /* [4] The file is named havasu-falls, but it's Mooney Falls. */ mooney: shot('water/havasu-falls-01.webp', 'Mooney Falls pouring over red cliffs into a turquoise pool, two people on the shore.', '52% 62%'),
  /* [5] */ antelope: shot('us/antelope-canyon-couple-01.webp', 'Brendon and Kaylee standing together in a glowing orange slot canyon.', '50% 58%'),
  /* [6] small only */ saltFlat: shot('us/salt-flat-reflection-01.webp', 'Brendon and Kaylee walking on a mirror-like salt flat at sunset.', '38% 62%'),
  /* [8] */ halfDome: shot('mountains/half-dome-light-01.webp', 'Half Dome with light rays across the valley at sunrise.', '30% 35%'),
  /* [9] */ delicate: shot('desert/delicate-arch-01.webp', 'Delicate Arch against a pink and violet sunset sky, a tiny person at its base.', '48% 45%'),
  /* [10] */ coyote: shot('canyons/coyote-gulch-arch-01.webp', 'A huge sandstone arch over a creek in Coyote Gulch, a small figure in the water.', '60% 40%'),
  /* [11] */ badlandsDrone: shot('aerial/painted-badlands-drone-01.webp', 'Drone view of the Bentonite Hills: swirling purple, blue and orange clay with a tiny person lying in it.', '48% 55%'),
  /* [12] */ hillsDrone: shot('aerial/painted-hills-drone-01.webp', 'Drone view of striped red and white hills with two tiny people.', '50% 40%'),
  /* [14] */ angels: shot('canyons/angels-landing-01.webp', 'A hiker on the chained ridge of Angels Landing above Zion Canyon.', '42% 75%'),
  /* [15] */ sawtooth: shot('mountains/sawtooth-lake-01.webp', 'Jagged snowy peaks mirrored in a green alpine lake.', '50% 50%'),
  /* [16] */ diablo: shot('mountains/diablo-lake-01.webp', 'A turquoise lake with islands between forested mountains.', '50% 55%'),
  /* [17] */ kayak: shot('water/kayak-falls-01.webp', 'A kayaker paddling toward a wide waterfall.', '45% 50%'),
  /* [18] */ palm: shot('us/curved-palm-beach-01.webp', 'A curved palm over a beach, Brendon and Kaylee at the water.', '55% 75%'),
  /* [20] */ doubleArch: shot('canyons/double-arch-slot-01.webp', 'A double arch inside a deep red slot canyon, a tiny person below.', '50% 45%'),
  /* Section cover (chosen 2026-10-25). */
  archSunrise: shot('desert/mesa-arch-sitting-01.webp', 'A person in a beanie sitting on slickrock under a long sandstone arch, its underside glowing orange at sunrise, a canyon of rock towers beyond.', '62% 62%'),
  seaStacks: shot('coast/sea-stack-beach-reflection-01.webp', 'Tree-topped sea stacks reflected on a wet sand beach at dusk.', '50% 50%'),
} satisfies Record<string, Shot>;
