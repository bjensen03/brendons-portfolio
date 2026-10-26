/*
  How wide a word is in the display face, in em — so a phone layout can size
  a heading to make its longest word run the full width of its column
  without measuring anything in the browser.

  Advance widths per character for Archivo at the display setting (900
  weight, 115% width, display tracking included), measured in Chrome. Names
  are set uppercase, so only capitals, digits and the punctuation names use
  are listed; anything else counts as wider than any capital, so an estimate
  can only err small. Kerning makes real words ~1% narrower than the sum.
*/

export const ADVANCE: Record<string, number> = {
  A: 0.859, B: 0.844, C: 0.85, D: 0.846, E: 0.78, F: 0.726, G: 0.915, H: 0.914, I: 0.36, J: 0.7, K: 0.901,
  L: 0.713, M: 1.071, N: 0.912, O: 0.913, P: 0.783, Q: 0.913, R: 0.852, S: 0.793, T: 0.79, U: 0.902, V: 0.849,
  W: 1.113, X: 0.863, Y: 0.866, Z: 0.79, '0': 0.728, '1': 0.68, '2': 0.727, '3': 0.73, '4': 0.733, '5': 0.73,
  '6': 0.731, '7': 0.686, '8': 0.739, '9': 0.731, '&': 0.97, '.': 0.337, ',': 0.337, '-': 0.358, '/': 0.283,
  "'": 0.281, '’': 0.281, '!': 0.343, '?': 0.665, ':': 0.331,
};

/** The word space at the display setting, in em. */
export const SPACE_EM = 0.243;

/** Width of one word, uppercased, in em. */
export const wordEm = (word: string): number =>
  [...word.toUpperCase()].reduce((sum, ch) => sum + (ADVANCE[ch] ?? 1.12), 0);

/** Width of the longest word of `text`, uppercased, in em (3 decimals). */
export const longestWordEm = (text: string): string =>
  Math.max(
    ...text
      .toUpperCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => [...w].reduce((sum, ch) => sum + (ADVANCE[ch] ?? 1.12), 0)),
  ).toFixed(3);
