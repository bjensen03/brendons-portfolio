/*
  The gallery on /twilight-trekkers/: every unique photograph in the
  library, once each (136). The library already holds only the kept
  file of each near-duplicate group (165 masters → 136 scenes; the 29
  skipped ones are listed in the library manifest), so this is the whole
  library, grouped in the manifest's seven categories.

  Each row: file (under images/twilight-trekkers/library/), its real
  pixel size, `best` (the Best tier, 20), `big` (a Best pick whose
  source is at least 1500px on its short side, so it can be shown large
  without upscaling; the low-res Best picks stay small), the manifest's
  focus point where it has one, and the alt text: the manifest's "Shows"
  line with the brand and privacy notes taken out. Place names only where
  the published case study already names the place.

  Order inside a group: big tiles first, then the other Best picks, then
  the rest in manifest order.

  To add a photo: put the converted .webp in the library folder and add a
  row here.
*/

export type GalleryPhoto = {
  f: string;
  w: number;
  h: number;
  best?: boolean;
  big?: boolean;
  focus?: string;
  alt: string;
};

export const GALLERY_GROUPS = [
  { id: 'canyons', label: 'Canyons & slots' },
  { id: 'desert', label: 'Desert, arches & overlooks' },
  { id: 'mountains', label: 'Mountains, lakes & forests' },
  { id: 'water', label: 'Waterfalls & water' },
  { id: 'coast', label: 'Coast & islands' },
  { id: 'aerial', label: 'Drone & aerial' },
  { id: 'us', label: 'The two of us' },
] as const;

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  { f: 'canyons/zion-subway-01.webp', w: 1800, h: 2400, best: true, big: true, focus: '50% 68%', alt: 'The Subway: a keyhole pool of green water under curving sandstone, a tiny hiker behind.' },
  { f: 'canyons/double-arch-slot-01.webp', w: 1800, h: 2400, best: true, big: true, focus: '50% 45%', alt: 'A double arch inside a deep red slot canyon, a tiny person below.' },
  { f: 'canyons/coyote-gulch-arch-01.webp', w: 2400, h: 1338, best: true, focus: '60% 40%', alt: 'A huge sandstone arch over a creek with green trees, a small figure in the water.' },
  { f: 'canyons/angels-landing-01.webp', w: 1320, h: 2318, best: true, focus: '42% 75%', alt: 'A hiker on the chained ridge of Angels Landing above Zion Canyon.' },
  { f: 'canyons/canyon-window-01.webp', w: 900, h: 1600, alt: 'A climber on a sandstone wall under a sky-window opening in a canyon.' },
  { f: 'canyons/slot-rappel-pack-01.webp', w: 1200, h: 1600, alt: 'A climber rappelling a sandstone bowl, a branded "slot" canyon pack in the foreground.' },
  { f: 'canyons/sandstone-arch-hiker-01.webp', w: 1200, h: 1600, alt: 'A massive glowing sandstone arch with a small hiker beneath it.' },
  { f: 'canyons/slot-canyon-hiker-01.webp', w: 1200, h: 1600, alt: 'A hiker in a cap walking through a sculpted red canyon.' },
  { f: 'canyons/slot-light-beam-01.webp', w: 900, h: 1600, alt: 'A hiker lit by a shaft of light in a dark curved slot canyon over green water.' },
  { f: 'canyons/slot-stemming-01.webp', w: 1067, h: 1600, alt: 'A climber stemming between pink slot-canyon walls.' },
  { f: 'canyons/zion-entrance-sign-01.webp', w: 1600, h: 1200, alt: 'Black-and-white Zion National Park entrance sign.' },
  { f: 'canyons/slot-rappel-white-01.webp', w: 900, h: 1600, alt: 'A climber rappelling a pale fluted slot canyon.' },
  { f: 'canyons/zion-canyon-overlook-01.webp', w: 1600, h: 1067, alt: 'A man on an overlook between big sandstone canyon walls.' },
  { f: 'canyons/sandstone-cave-01.webp', w: 1200, h: 1600, alt: 'A sandstone cave tunnel with footprints in the sand.' },
  { f: 'canyons/sandstone-alcove-01.webp', w: 1067, h: 1600, alt: 'A small figure in a huge sandstone alcove.' },
  { f: 'canyons/slot-climb-01.webp', w: 1067, h: 1600, alt: 'A climber with a rope working up a narrow slot canyon.' },
  { f: 'canyons/zion-narrows-turquoise-01.webp', w: 1067, h: 1600, alt: 'A hiker in red wading turquoise water through a narrow canyon.' },
  { f: 'canyons/zion-narrows-01.webp', w: 997, h: 1600, alt: 'A hiker wading the Narrows between tall glowing walls.' },
  { f: 'canyons/dark-slot-water-01.webp', w: 1600, h: 1200, alt: 'A hiker silhouetted at the bright exit of a dark water-filled slot.' },
  { f: 'canyons/zion-watchman-autumn-01.webp', w: 1066, h: 1600, alt: 'A pointed sandstone peak above a stream lined with autumn trees.' },
  { f: 'canyons/slot-rappel-pool-01.webp', w: 919, h: 1600, alt: 'A canyoneer rappelling into a green pool in a smooth slot.' },
  { f: 'canyons/antelope-canyon-sky-01.webp', w: 1600, h: 1067, alt: 'Looking up through a glowing orange slot to blue sky.' },
  { f: 'canyons/slot-canyon-light-01.webp', w: 1067, h: 1600, alt: 'Tall narrow orange slot with light at the far end.' },
  { f: 'canyons/sandstone-pothole-01.webp', w: 1600, h: 1067, alt: 'A pothole of red water in a pale sandstone bowl.' },
  { f: 'canyons/slot-canyon-backpack-01.webp', w: 1200, h: 1600, alt: 'A man with a backpack facing a glowing slot canyon.' },
  { f: 'canyons/arch-window-rappel-01.webp', w: 1200, h: 1600, alt: 'A climber rappelling out of a sandstone window over the desert.' },
  { f: 'desert/reflection-canyon-01.webp', w: 2400, h: 1600, best: true, big: true, focus: '58% 55%', alt: 'A man at the rim of Reflection Canyon, water winding below, sunbeams.' },
  { f: 'desert/delicate-arch-01.webp', w: 1284, h: 2282, best: true, focus: '48% 45%', alt: 'Delicate Arch against a pink and violet sunset sky, a tiny person at its base.' },
  { f: 'desert/mesa-arch-glow-01.webp', w: 1920, h: 1280, best: true, focus: '52% 58%', alt: 'Mesa Arch glowing orange at sunrise, framing towers and canyon below.' },
  { f: 'desert/desert-overlook-sunset-01.webp', w: 1600, h: 1122, alt: 'A man sitting on a rocky point above a hazy desert valley at sunset.' },
  { f: 'desert/mesa-arch-sitting-01.webp', w: 2400, h: 1600, alt: 'A person sitting beside Mesa Arch, its underside glowing orange.' },
  { f: 'desert/druid-arch-01.webp', w: 1067, h: 1600, alt: 'A tall slotted sandstone arch on a ridge, a tiny hiker below.' },
  { f: 'desert/arch-utv-01.webp', w: 1067, h: 1600, alt: 'A side-by-side off-road vehicle framed through a red rock opening.' },
  { f: 'desert/red-rock-tower-01.webp', w: 1067, h: 1600, alt: 'A woman with arms raised at the foot of a glowing red rock tower.' },
  { f: 'desert/arch-valley-overlook-01.webp', w: 1067, h: 1600, alt: 'A person standing on a natural bridge above a wide red-rock valley.' },
  { f: 'desert/canyon-overlook-sunset-01.webp', w: 1067, h: 1600, alt: 'A person at a canyon rim at sunset over layered canyons.' },
  { f: 'desert/grand-canyon-bridge-01.webp', w: 916, h: 1600, alt: 'A suspension bridge over a muddy river deep in a red canyon.' },
  { f: 'desert/grand-canyon-sunset-01.webp', w: 904, h: 1600, alt: 'A vast canyon at sunset under pink clouds.' },
  { f: 'desert/bryce-hoodoos-01.webp', w: 1600, h: 1067, alt: 'Glowing orange hoodoos and a balanced rock tower at sunrise.' },
  { f: 'desert/horseshoe-bend-01.webp', w: 1200, h: 1600, alt: 'A sunburst over a deep river bend in a red canyon.' },
  { f: 'desert/badlands-sunset-01.webp', w: 1600, h: 1200, alt: 'Gray eroded badlands under an orange and pink sunset.' },
  { f: 'desert/arch-top-pair-01.webp', w: 900, h: 1600, alt: 'Two people standing on top of a large sandstone arch.' },
  { f: 'desert/railroad-canyon-01.webp', w: 1600, h: 1067, alt: 'Railroad tracks running between orange canyon walls.' },
  { f: 'desert/canyon-sunburst-01.webp', w: 1067, h: 1600, alt: 'A sunburst over dark canyon walls.' },
  { f: 'desert/cliff-edge-overlook-01.webp', w: 1067, h: 1600, alt: 'Two tiny figures on a cliff edge above a vast desert basin.' },
  { f: 'desert/badlands-spire-01.webp', w: 902, h: 1600, alt: 'A person standing on top of a pale badlands spire.' },
  { f: 'desert/badlands-towers-01.webp', w: 1600, h: 911, alt: 'Two people below a tall dark badlands tower at dusk.' },
  { f: 'desert/dune-ridge-01.webp', w: 1067, h: 1600, alt: 'A lone hiker on a sweeping sand dune ridge.' },
  { f: 'desert/dunes-sunset-01.webp', w: 1600, h: 1270, alt: 'Orange sand dunes in low light below dark mountains.' },
  { f: 'desert/badlands-ridges-01.webp', w: 1067, h: 1600, alt: 'Golden eroded badland ridges in sharp light.' },
  { f: 'desert/cholla-sunset-01.webp', w: 1200, h: 1600, alt: 'Backlit cholla cactus at sunset, a person behind.' },
  { f: 'desert/heart-rock-01.webp', w: 1200, h: 1600, alt: 'A heart-shaped boulder among desert rocks.' },
  { f: 'desert/palm-oasis-01.webp', w: 1200, h: 1600, alt: 'A desert palm oasis in sun.' },
  { f: 'mountains/half-dome-light-01.webp', w: 2400, h: 1600, best: true, big: true, focus: '30% 35%', alt: 'Half Dome with light rays across the valley at sunrise.' },
  { f: 'mountains/diablo-lake-01.webp', w: 2400, h: 1600, best: true, big: true, focus: '50% 55%', alt: 'A turquoise lake with islands between forested mountains.' },
  { f: 'mountains/sawtooth-lake-01.webp', w: 2400, h: 1800, best: true, big: true, focus: '50% 50%', alt: 'Jagged snowy peaks mirrored in a green alpine lake.' },
  { f: 'mountains/teton-barn-01.webp', w: 1920, h: 1280, best: true, focus: '45% 58%', alt: 'A weathered barn under pink-lit Teton peaks at sunrise.' },
  { f: 'mountains/snowy-forest-climb-01.webp', w: 1200, h: 1600, alt: 'A hiker in a dark jacket climbing a steep snowy slope through frosted trees.' },
  { f: 'mountains/sequoia-grove-01.webp', w: 1200, h: 1600, alt: 'Two hikers on a sunlit trail between giant redwood trunks.' },
  { f: 'mountains/storm-reflection-01.webp', w: 900, h: 1600, alt: 'Dark storm clouds lit pink over jagged peaks, mirrored in a still lake.' },
  { f: 'mountains/autumn-fog-peak-01.webp', w: 1600, h: 1113, alt: 'Golden leaves framing a snowy, fog-wrapped mountain.' },
  { f: 'mountains/alpine-lake-reflection-01.webp', w: 1600, h: 1200, alt: 'A clear alpine lake with rocks underwater and a snowy peak reflected.' },
  { f: 'mountains/granite-spires-01.webp', w: 1600, h: 1067, alt: 'A wall of jagged granite spires above a rocky basin.' },
  { f: 'mountains/summit-view-01.webp', w: 1600, h: 1067, alt: 'A summit view over high granite ridges and a small blue lake.' },
  { f: 'mountains/lake-sunset-01.webp', w: 1600, h: 1067, alt: 'A mountain lake at sunset with pink clouds and a pine-covered shore.' },
  { f: 'mountains/teton-road-01.webp', w: 1067, h: 1600, alt: 'A road leading toward the jagged Teton peaks.' },
  { f: 'mountains/alpine-lake-wade-01.webp', w: 1600, h: 1067, alt: 'A woman wading in a turquoise alpine lake below a granite peak.' },
  { f: 'mountains/alpine-lake-granite-01.webp', w: 1600, h: 1067, alt: 'A hiker on a rock at a blue alpine lake under granite peaks.' },
  { f: 'mountains/autumn-clouds-01.webp', w: 1600, h: 955, alt: 'Fall color forest under a cloud-wrapped mountain.' },
  { f: 'mountains/autumn-canyon-road-01.webp', w: 1066, h: 1600, alt: 'A road through bright green and yellow autumn trees in a canyon.' },
  { f: 'mountains/glacier-lake-hiker-01.webp', w: 1600, h: 1067, alt: 'A hiker at a lake shore under steep forested mountain walls.' },
  { f: 'mountains/forest-lake-01.webp', w: 1200, h: 1600, alt: 'A turquoise lake seen through tall pine trunks.' },
  { f: 'mountains/wildflower-peaks-01.webp', w: 1600, h: 1067, alt: 'Pink wildflowers below sharp sunlit peaks.' },
  { f: 'mountains/glacier-lake-01.webp', w: 1600, h: 1067, alt: 'A hiker at a glacier lake with icebergs below cliffs.' },
  { f: 'mountains/fireweed-lake-01.webp', w: 1067, h: 1600, alt: 'Fireweed in front of a turquoise lake in a mountain valley.' },
  { f: 'mountains/lupine-sunset-01.webp', w: 1067, h: 1600, alt: 'Purple lupine in front of ridges under pink sunset clouds.' },
  { f: 'mountains/aspen-valley-01.webp', w: 1600, h: 1067, alt: 'Golden aspens and a mountain valley under white clouds.' },
  { f: 'mountains/blue-lake-01.webp', w: 914, h: 1600, alt: 'A bright turquoise lake in a green alpine valley.' },
  { f: 'mountains/ice-lake-wade-01.webp', w: 914, h: 1600, alt: 'A woman in red wading a turquoise mountain lake.' },
  { f: 'mountains/valley-road-dusk-01.webp', w: 1067, h: 1600, alt: 'A curving road at dusk with Half Dome and a tall pine.' },
  { f: 'mountains/heather-lake-01.webp', w: 1600, h: 1067, alt: 'Pink heather in front of an alpine lake and blue ridges.' },
  { f: 'mountains/cascade-ridge-hiker-01.webp', w: 2400, h: 1600, alt: 'A hiker on a green ridge facing snowy jagged peaks.' },
  { f: 'mountains/snowy-cirque-lake-01.webp', w: 1600, h: 1067, alt: 'A dark lake below snowy peaks.' },
  { f: 'mountains/forest-log-bridge-01.webp', w: 1067, h: 1600, alt: 'A woman crossing a log bridge in a sunlit forest.' },
  { f: 'mountains/tunnel-log-01.webp', w: 900, h: 1600, alt: 'A person walking through a tunnel cut in a fallen giant tree.' },
  { f: 'mountains/taft-point-01.webp', w: 1600, h: 1067, alt: 'Light rays over a granite valley, tiny people on a cliff point.' },
  { f: 'water/havasu-falls-01.webp', w: 2400, h: 1519, best: true, big: true, focus: '52% 62%', alt: 'Mooney Falls plunging over red cliffs into a turquoise pool, two people on the shore.' },
  { f: 'water/kayak-falls-01.webp', w: 1536, h: 2048, best: true, big: true, focus: '45% 50%', alt: 'A kayaker paddling toward a wide waterfall.' },
  { f: 'water/havasu-cascades-01.webp', w: 1280, h: 1920, best: true, focus: '45% 55%', alt: 'Turquoise travertine pools and cascades, a woman in red on a ledge.' },
  { f: 'water/calf-creek-falls-01.webp', w: 1067, h: 1600, alt: 'Two people wading at the foot of a tall ribbon waterfall on streaked canyon walls.' },
  { f: 'water/underwater-pair-01.webp', w: 1600, h: 1065, alt: 'Two people seen from underwater in clear blue water, legs and splashes.' },
  { f: 'water/river-canyon-sunset-01.webp', w: 1200, h: 1600, alt: 'A green river winding through a deep basalt canyon under a sunset sky.' },
  { f: 'water/freedive-pool-01.webp', w: 900, h: 1600, alt: 'A swimmer gliding underwater over a sandy turquoise pool.' },
  { f: 'water/canyon-waterfall-01.webp', w: 900, h: 1600, alt: 'A small waterfall spilling over mossy rock in a green canyon.' },
  { f: 'water/havasu-falls-tall-01.webp', w: 1067, h: 1600, alt: 'A waterfall pouring between red cliffs into a vivid turquoise pool.' },
  { f: 'water/grand-prismatic-01.webp', w: 1600, h: 1112, alt: 'Steam rising over a rainbow-colored hot spring.' },
  { f: 'water/yellowstone-falls-01.webp', w: 1015, h: 1600, alt: 'A powerful waterfall into a yellow canyon, framed by a pine.' },
  { f: 'water/clear-river-rocks-01.webp', w: 1200, h: 1600, alt: 'A man sitting on black rocks beside a clear turquoise river.' },
  { f: 'water/yosemite-falls-01.webp', w: 1600, h: 1067, alt: 'A tall waterfall off a granite wall with Half Dome behind.' },
  { f: 'water/cave-waterfall-01.webp', w: 1067, h: 1600, alt: 'A waterfall falling through a dark cave opening.' },
  { f: 'water/vernal-fall-01.webp', w: 1067, h: 1600, alt: 'A big waterfall with a rainbow at its base.' },
  { f: 'water/mooney-falls-01.webp', w: 1067, h: 1600, alt: 'A tall waterfall into a turquoise pool, one person at the edge.' },
  { f: 'water/forest-falls-01.webp', w: 1016, h: 1600, alt: 'A waterfall in a mossy forest gorge with a footbridge above.' },
  { f: 'coast/sea-stacks-cove-01.webp', w: 1600, h: 1067, alt: 'Rocky sea stacks in a deep blue cove framed by trees.' },
  { f: 'coast/sea-stack-beach-reflection-01.webp', w: 1600, h: 1067, alt: 'Tree-topped sea stacks reflected on a wet sand beach at dusk.' },
  { f: 'coast/sea-stack-hiker-01.webp', w: 1600, h: 1067, alt: 'A person looking at a tall sea stack with an arch on a pebble beach.' },
  { f: 'coast/lava-rock-coast-01.webp', w: 1600, h: 1067, alt: 'A man standing on black lava rocks by the ocean, palms behind, at dusk.' },
  { f: 'coast/tropical-beach-01.webp', w: 1600, h: 1067, alt: 'Waves on a sandy beach with green mountains behind.' },
  { f: 'coast/sea-arch-01.webp', w: 1066, h: 1600, alt: 'A sandstone sea arch over a calm ocean.' },
  { f: 'coast/turtle-beach-01.webp', w: 1600, h: 1067, alt: 'Sea turtles resting on a sandy beach by the surf.' },
  { f: 'aerial/painted-badlands-drone-01.webp', w: 2263, h: 1284, best: true, focus: '48% 55%', alt: 'Drone view of the Bentonite Hills, Utah: swirling purple, blue and orange clay with a tiny person lying in it.' },
  { f: 'aerial/painted-hills-drone-01.webp', w: 1320, h: 2315, best: true, focus: '50% 40%', alt: 'Drone view of striped red and white hills with two tiny people.' },
  { f: 'aerial/autumn-trail-drone-01.webp', w: 908, h: 1600, alt: 'Drone view of a trail through red and orange autumn trees toward a peak.' },
  { f: 'aerial/salt-flat-drone-sunset-01.webp', w: 1600, h: 1067, alt: 'A drone silhouetted over a flat lake at sunset.' },
  { f: 'aerial/autumn-canopy-drone-01.webp', w: 920, h: 1600, alt: 'Drone view straight down onto red and orange autumn trees.' },
  { f: 'aerial/painted-swirl-drone-01.webp', w: 912, h: 1600, alt: 'Drone view of concentric red, white and green rock swirls.' },
  { f: 'aerial/mudflat-drone-01.webp', w: 917, h: 1600, alt: 'Drone view over a wet mudflat with a person and long shadow.' },
  { f: 'aerial/scenic-flight-01.webp', w: 1200, h: 1600, alt: 'View from a small plane wing over red canyons and blue ponds.' },
  { f: 'us/antelope-canyon-couple-01.webp', w: 1800, h: 2400, best: true, big: true, focus: '50% 58%', alt: 'Brendon and Kaylee standing together in a glowing orange slot canyon.' },
  { f: 'us/curved-palm-beach-01.webp', w: 1920, h: 2400, best: true, big: true, focus: '55% 75%', alt: 'A curved palm over a beach with Brendon and Kaylee at the water.' },
  { f: 'us/salt-flat-reflection-01.webp', w: 1284, h: 2243, best: true, focus: '38% 62%', alt: 'Brendon and Kaylee walking on a mirror-like salt flat at sunset.' },
  { f: 'us/mountain-lake-couple-01.webp', w: 1284, h: 2248, best: true, focus: '45% 80%', alt: 'Brendon and Kaylee on a slope above a lake that mirrors a green peak.' },
  { f: 'us/cliff-ledge-walk-01.webp', w: 1067, h: 1600, alt: 'Two people walking a narrow red-rock ledge inside a cave mouth, green canyon below.' },
  { f: 'us/autumn-trail-couple-01.webp', w: 1067, h: 1600, alt: 'A couple on a trail framed by red autumn maples, a peak behind.' },
  { f: 'us/beach-hug-01.webp', w: 1066, h: 1600, alt: 'One lifting the other in a hug on a beach, waves behind.' },
  { f: 'us/canyon-overlook-couple-01.webp', w: 1067, h: 1600, alt: 'Brendon and Kaylee at a canyon overlook above a winding river.' },
  { f: 'us/alpine-lake-couple-01.webp', w: 1067, h: 1600, alt: 'Brendon and Kaylee kissing in front of a turquoise lake under a granite peak.' },
  { f: 'us/meadow-hug-01.webp', w: 1280, h: 919, alt: 'A joyful hug in an autumn meadow below a mountain.' },
  { f: 'us/autumn-lake-couple-01.webp', w: 909, h: 1600, alt: 'Brendon and Kaylee at a lake shore with fall color and a granite peak.' },
  { f: 'us/palm-silhouette-01.webp', w: 1067, h: 1600, alt: 'Two people dancing in silhouette under tall palms on a beach.' },
  { f: 'us/butte-overlook-pair-01.webp', w: 909, h: 1600, alt: 'Two people holding hands on a rock edge facing a big butte.' },
  { f: 'us/cabin-silhouette-01.webp', w: 1067, h: 1600, alt: 'Brendon and Kaylee dancing in silhouette in a cabin window at sunset.' },
  { f: 'us/half-dome-climbers-01.webp', w: 1067, h: 1600, alt: 'Brendon and Kaylee in climbing harnesses on a granite dome; other hikers on the cables behind.' },
  { f: 'us/badlands-pair-01.webp', w: 1067, h: 1600, alt: 'Brendon and Kaylee on a trail in eroded tan badlands.' },
  { f: 'us/joshua-tree-couple-01.webp', w: 1200, h: 1600, alt: 'Brendon and Kaylee in silhouette under a Joshua tree at dusk.' },
  { f: 'us/rainforest-pair-01.webp', w: 1067, h: 1600, alt: 'Two people on a trail through a tall mossy forest.' },
];
