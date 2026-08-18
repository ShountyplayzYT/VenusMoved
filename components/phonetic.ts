/**
 * Lightweight phonetic key generator (Metaphone-inspired, simplified for
 * place names). Converts a word into a consonant-skeleton code so that
 * words that *sound* alike collapse to the same or similar key, even
 * when the spelling drifted quite a bit — e.g. "Syareville" and
 * "Sayreville" both reduce to roughly "SRFL".
 *
 * This is intentionally simpler than full Double Metaphone — good enough
 * for short place names, cheap to run per-window on every transcript.
 */
export function phoneticKey(input: string): string {
  let s = input.toUpperCase().replace(/[^A-Z]/g, "");
  if (!s) return "";

  // Drop duplicate adjacent letters (SAYREVILLE -> SAYREVILE doesn't matter,
  // but VILLLE -> VILE style artifacts do get collapsed)
  s = s.replace(/([A-Z])\1+/g, "$1");

  // Common digraph/silent-letter normalizations that speech-to-text
  // frequently garbles or that spelling variants commonly differ on
  const rules: [RegExp, string][] = [
    [/PH/g, "F"],
    [/GH/g, "G"],
    [/CK/g, "K"],
    [/SH/g, "X"],
    [/CH/g, "X"],
    [/TH/g, "0"],
    [/WR/g, "R"],
    [/WH/g, "W"],
    [/QU/g, "KW"],
    [/X/g, "KS"],
    [/Z/g, "S"],
    [/C(?=[IEY])/g, "S"], // soft C
    [/C/g, "K"], // hard C
    [/^KN/, "N"],
    [/^GN/, "N"],
    [/^PN/, "N"],
    [/MB$/, "M"],
  ];
  for (const [pattern, replacement] of rules) {
    s = s.replace(pattern, replacement);
  }

  // Drop vowels except at the very start (vowels are what speech
  // recognizers mangle the most — "Syare" vs "Sayre" differ only in
  // vowel order/position)
  const first = s[0];
  const rest = s.slice(1).replace(/[AEIOU]/g, "");
  s = first + rest;

  // Collapse any repeats introduced by the rules above
  s = s.replace(/([A-Z0])\1+/g, "$1");

  return s;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Normalized distance between the phonetic keys of two words/phrases.
 * 0 = sounds identical, 1 = nothing in common.
 */
export function phoneticDistance(a: string, b: string): number {
  const ka = phoneticKey(a);
  const kb = phoneticKey(b);
  if (!ka.length || !kb.length) return 1;
  return levenshtein(ka, kb) / Math.max(ka.length, kb.length);
}