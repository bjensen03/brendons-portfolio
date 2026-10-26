#!/usr/bin/env python3
"""
Subset the three self-hosted variable fonts to the characters the site uses.

  python3 scripts/subset-fonts.py

Reads the full files in src/assets/fonts/source/ and writes the subsets the
build uses to src/assets/fonts/ (same names astro.config.mjs points at).
Needs fontTools and brotli (pip install fonttools brotli).

What's kept, for every face:
  - Basic Latin and Latin-1 (so accented names and ¼ ¾ × · work), plus the
    punctuation and symbols the content uses: – — ‘ ’ “ ” … · → ↗ ← ↑ and
    friends, € ™ − ≤ ≥.
  - Every OpenType feature (tabular figures, fractions, kerning, the
    stylistic sets) and the variable axes (Geist's weight; Archivo's weight
    and width), so nothing renders differently.
  - Hinting and the name table.

What's dropped: Cyrillic, Vietnamese/extended Latin, box drawing and the
other blocks no page uses. If the content gains a character outside this
list it falls back to the next font in the stack, so add it to UNICODES and
re-run before shipping it.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src/assets/fonts/source'
OUT = ROOT / 'src/assets/fonts'
FONTS = ['Geist-Variable.woff2', 'GeistMono-Variable.woff2', 'Archivo-Variable.woff2']

UNICODES = ','.join(
    [
        'U+0020-007E',  # Basic Latin
        'U+00A0-00FF',  # Latin-1: nbsp, · × ¼ ¾ é …
        'U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC',  # dotless i, Œ œ, spacing accents
        'U+2010-2027',  # dashes, quotes, bullets, ellipsis
        'U+202F-203A',  # narrow nbsp, ‰, primes, ‹ ›
        'U+2044,U+20AC,U+2122',  # fraction slash, €, ™
        'U+2190-2199',  # arrows: ← ↑ → ↓ ↔ ↗ …
        'U+2212,U+2248,U+2260,U+2264-2265',  # − ≈ ≠ ≤ ≥
    ]
)


def main() -> int:
    for name in FONTS:
        src = SRC / name
        out = OUT / name
        subprocess.run(
            [
                sys.executable,
                '-m',
                'fontTools.subset',
                str(src),
                f'--unicodes={UNICODES}',
                "--layout-features=*",
                '--name-IDs=*',
                '--name-languages=*',
                '--notdef-outline',
                # Leave OS/2's coverage bits as the full font had them.
                '--no-prune-unicode-ranges',
                '--no-prune-codepage-ranges',
                '--flavor=woff2',
                f'--output-file={out}',
            ],
            check=True,
        )
        print(f'{name}: {src.stat().st_size / 1024:.1f} KiB -> {out.stat().st_size / 1024:.1f} KiB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
