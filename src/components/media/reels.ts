/* The Twilight Trekkers reels, shared by ReelSlot and every layout that
   shows one (the homepage Twilight section, the Twilight page and study).
   The loops in public/video/twilight/: 720×1280, about 2 MB, no audio, fast-start, each with a
   same-name .webp poster that is its first frame. These three are the
   cleanest (no burned-in caption beyond the small handle), so they take
   the lead spots. To swap one, change the name: the others are
   painted-hills-drone and canyoneering-slot (both carry captions),
   big-island, parks-montage and olympic-forest. Setting `video` to null
   leaves the poster as a still. */
export type Reel = {
  poster: ImageMetadata | string;
  alt: string;
  focus: string;
  video: string | null;
  /** The whole reel with sound, in public/video/twilight/full/. */
  fullSrc?: string;
};

const loop = (name: string, alt: string): Reel => ({
  poster: `/video/twilight/${name}.webp`,
  alt,
  focus: '50% 50%',
  video: `/video/twilight/${name}.mp4`,
  fullSrc: `/video/twilight/full/${name}.mp4`,
});

export const REELS: Reel[] = [
  loop('utah-fall-drone', 'Reel: drone footage over red and orange fall maples on a steep mountainside, ending on a rocky peak at dusk.'),
  loop('canyon-alcove-water', 'Reel: one slow shot of the Golden Cathedral in Neon Canyon, a towering sandstone alcove reflected in still water.'),
  loop('north-cascades', 'Reel: jagged peaks, a turquoise lake from above, a hiker on a ridge, a swim and an alpine lake.'),
];
export const REEL = REELS[0];

/* Every reel by name, for layouts that pick their own. */
export const LOOPS = {
  utahFall: REELS[0],
  alcove: REELS[1],
  cascades: REELS[2],
};

/* All 19 reels at full length with sound (2026-10-25), for the full-reel
   player. Files in public/video/twilight/full/: 720×1280 H.264 + AAC 128k
   with 40 ms fades, fast-start, 3.2–5.5 MB each. Each runs to the end of the
   source, so it includes the reel's Instagram end card (about 1.8 s, silent).
   `shortSrc` is the existing muted loop where there is one. `notes` lists
   burned-in text, maps and other people, to check before publishing. */
export type FullReel = {
  slug: string;
  title: string;
  /** seconds */
  duration: number;
  poster: string;
  fullSrc: string;
  shortSrc: string | null;
  notes: string;
};

export const REELS_FULL: FullReel[] = [
  { slug: "us-montage", title: "The two of us, a montage", duration: 14.6, poster: "/video/twilight/full/us-montage.webp", fullSrc: "/video/twilight/full/us-montage.mp4", shortSrc: null, notes: "small \"everywhere\" text; close selfie of Brendon and Kaylee" },
  { slug: "canyon-overlook-views", title: "Views from a canyon overlook", duration: 15.8, poster: "/video/twilight/full/canyon-overlook-views.webp", fullSrc: "/video/twilight/full/canyon-overlook-views.mp4", shortSrc: null, notes: "caption (permits joke, location pin)" },
  { slug: "big-island", title: "Island trip: snorkel, lava coast and waterfalls", duration: 20.7, poster: "/video/twilight/full/big-island.webp", fullSrc: "/video/twilight/full/big-island.mp4", shortSrc: "/video/twilight/big-island.mp4", notes: "opening caption" },
  { slug: "slickrock-walk-reveal", title: "A walk across slickrock to a canyon view", duration: 14.46, poster: "/video/twilight/full/slickrock-walk-reveal.webp", fullSrc: "/video/twilight/full/slickrock-walk-reveal.mp4", shortSrc: null, notes: "caption" },
  { slug: "painted-hills-drone", title: "The Bentonite Hills from the drone", duration: 17.86, poster: "/video/twilight/full/painted-hills-drone.webp", fullSrc: "/video/twilight/full/painted-hills-drone.mp4", shortSrc: "/video/twilight/painted-hills-drone.mp4", notes: "caption box \"the drive:\"" },
  { slug: "road-trip-montage", title: "Road-trip montage", duration: 19.6, poster: "/video/twilight/full/road-trip-montage.webp", fullSrc: "/video/twilight/full/road-trip-montage.mp4", shortSrc: null, notes: "captions and location pins; car dashboard" },
  { slug: "sandstone-pothole", title: "A sandstone bowl with a red-water pothole", duration: 16.7, poster: "/video/twilight/full/sandstone-pothole.webp", fullSrc: "/video/twilight/full/sandstone-pothole.mp4", shortSrc: null, notes: "caption" },
  { slug: "olympic-forest", title: "Rainforest, waterfalls and elk", duration: 18.06, poster: "/video/twilight/full/olympic-forest.webp", fullSrc: "/video/twilight/full/olympic-forest.mp4", shortSrc: "/video/twilight/olympic-forest.mp4", notes: "small caption" },
  { slug: "canyoneering-slot", title: "Canyoneering through slot canyons", duration: 36.7, poster: "/video/twilight/full/canyoneering-slot.webp", fullSrc: "/video/twilight/full/canyoneering-slot.mp4", shortSrc: "/video/twilight/canyoneering-slot.mp4", notes: "caption; other canyoneers in helmets" },
  { slug: "granite-waterfall", title: "A waterfall off a granite wall", duration: 13.6, poster: "/video/twilight/full/granite-waterfall.webp", fullSrc: "/video/twilight/full/granite-waterfall.mp4", shortSrc: null, notes: "caption" },
  { slug: "canyon-alcove-water", title: "The Golden Cathedral, Neon Canyon", duration: 12.66, poster: "/video/twilight/full/canyon-alcove-water.webp", fullSrc: "/video/twilight/full/canyon-alcove-water.mp4", shortSrc: "/video/twilight/canyon-alcove-water.mp4", notes: "small caption" },
  { slug: "parks-montage", title: "National parks montage", duration: 28.5, poster: "/video/twilight/full/parks-montage.webp", fullSrc: "/video/twilight/full/parks-montage.mp4", shortSrc: "/video/twilight/parks-montage.mp4", notes: "title text" },
  { slug: "fall-color-drone", title: "Fall colour from the drone", duration: 13.3, poster: "/video/twilight/full/fall-color-drone.webp", fullSrc: "/video/twilight/full/fall-color-drone.mp4", shortSrc: null, notes: "title text" },
  { slug: "hoodoos-in-snow", title: "Red rock hoodoos in snow", duration: 17.89, poster: "/video/twilight/full/hoodoos-in-snow.webp", fullSrc: "/video/twilight/full/hoodoos-in-snow.mp4", shortSrc: null, notes: "title text and location pin" },
  { slug: "red-rock-arch-walk", title: "A trail walk to a red rock arch at sunset", duration: 12.5, poster: "/video/twilight/full/red-rock-arch-walk.webp", fullSrc: "/video/twilight/full/red-rock-arch-walk.mp4", shortSrc: null, notes: "chat-style captions" },
  { slug: "utah-fall-drone", title: "Fall colour on a mountainside, from the drone", duration: 17.6, poster: "/video/twilight/full/utah-fall-drone.webp", fullSrc: "/video/twilight/full/utah-fall-drone.mp4", shortSrc: "/video/twilight/utah-fall-drone.mp4", notes: "title text" },
  { slug: "road-trip-map", title: "A road trip on the map: salt flats to red rock", duration: 18.93, poster: "/video/twilight/full/road-trip-map.webp", fullSrc: "/video/twilight/full/road-trip-map.mp4", shortSrc: null, notes: "animated map and place labels" },
  { slug: "itinerary-map", title: "An eight-day road-trip itinerary", duration: 17.16, poster: "/video/twilight/full/itinerary-map.webp", fullSrc: "/video/twilight/full/itinerary-map.mp4", shortSrc: null, notes: "animated map, day-by-day place lists" },
  { slug: "north-cascades", title: "The North Cascades", duration: 16.86, poster: "/video/twilight/full/north-cascades.webp", fullSrc: "/video/twilight/full/north-cascades.mp4", shortSrc: "/video/twilight/north-cascades.mp4", notes: "small caption" },
];
