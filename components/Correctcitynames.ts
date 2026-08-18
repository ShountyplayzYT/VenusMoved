import { US_CITIES } from "./UScities";
import { phoneticDistance } from "./phonetic";

// Parse "City, ST" entries into { city, state } once at module load.
const PARSED_CITIES = US_CITIES.map((entry) => {
  const [city, state] = entry.split(",").map((s) => s.trim());
  return { city, state, full: entry };
});

// Unique city names (for matching the spoken city word(s) alone)
const CITY_NAMES = Array.from(new Set(PARSED_CITIES.map((c) => c.city)));

// Map lowercase state abbreviation -> canonical abbreviation, and also
// support full state names being spoken instead of abbreviations.
const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

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

function spellingDistance(a: string, b: string) {
  if (!a.length || !b.length) return 1;
  return levenshtein(a.toLowerCase(), b.toLowerCase()) / Math.max(a.length, b.length);
}

// Combined score: take the BETTER of spelling-distance or phonetic-distance.
// This is what catches cases like "Syareville" -> "Sayreville" where the
// spelling drifted a lot but it still sounds the same.
function combinedDistance(a: string, b: string) {
  return Math.min(spellingDistance(a, b), phoneticDistance(a, b));
}

// Given a matched city name and (optionally) a state token spoken right
// after it, pick the right entry when the city name is ambiguous
// (e.g. "Cleveland" -> Cleveland, OH or Cleveland, TN).
// Manual escape valve: pairs that phonetic matching tends to confuse but
// that you know should NOT auto-correct into each other. Add to this as
// you notice bad corrections in real usage — cheaper than re-tuning the
// global threshold and risking new false positives elsewhere.
// Format: spoken word (lowercase) -> city name it should NOT match to.
const NEVER_MATCH: Record<string, string> = {
  hillsborough: "Harrisburg",
  // "sant loo ees": "Reading",  // example of another pair to exclude
};

function isExcluded(candidate: string, matchedCity: string): boolean {
  const blocked = NEVER_MATCH[candidate.toLowerCase()];
  return blocked !== undefined && blocked === matchedCity;
}

function resolveCity(cityName: string, spokenState?: string): string {
  const matches = PARSED_CITIES.filter((c) => c.city === cityName);
  if (matches.length === 1 || !spokenState) return matches[0].full;

  const spokenAbbr =
    STATE_NAME_TO_ABBR[spokenState.toLowerCase()] ?? spokenState.toUpperCase();

  const stateMatch = matches.find((c) => c.state === spokenAbbr);
  return stateMatch ? stateMatch.full : matches[0].full;
}

/**
 * Slides word windows across the transcript, replacing any window that's
 * a close match to a known city (optionally followed by a state name or
 * abbreviation) with the canonical "City, ST" form from your city list.
 */
export function correctCityNames(
  transcript: string,
  returnScore = false
): any {
  const words = transcript.split(/\s+/).filter(Boolean);
  const result: string[] = [];
  let totalDistance = 0;
  let i = 0;

  // Common short filler/function words that should never be treated as
  // a candidate for city matching, no matter how close the score comes out.
  // Without this, 1-2 letter overlaps on short words ("in", "at", "is",
  // "to") can accidentally score close to short city names.
  const STOPWORDS = new Set([
    "in", "at", "is", "to", "up", "on", "the", "a", "an", "of", "for",
    "and", "or", "going", "load", "loading", "dropping", "picking",
    "heading", "through", "that",
  ]);

  while (i < words.length) {
    let matched = false;

    // try 3-word, then 2-word, then 1-word city name windows
    for (const windowSize of [3, 2, 1]) {
      if (i + windowSize > words.length) continue;
      const candidate = words.slice(i, i + windowSize).join(" ");

      // never treat a candidate as a city match if it contains a stopword —
      // this blocks both single filler words ("at") and phrases where a
      // filler word is glued to the next real word ("dropping at")
      const candidateWords = candidate.toLowerCase().split(/\s+/);
      if (candidateWords.some((w) => STOPWORDS.has(w))) {
        continue;
      }

      let bestCity = "";
      let bestDist = Infinity;
      for (const city of CITY_NAMES) {
        const d = combinedDistance(candidate, city);
        if (d < bestDist) {
          bestDist = d;
          bestCity = city;
        }
      }

      // phonetic matches can legitimately have a slightly higher "distance"
      // than pure spelling matches since the key alphabet is smaller, so
      // thresholds are a touch looser than the spelling-only version
      const threshold = windowSize === 1 ? 0.22 : 0.35;

      // guard against short words/city names producing deceptively low
      // normalized distances (e.g. "at" vs "AL" is 1 edit on 2 chars = 0.5,
      // but "in" vs a 3-letter city key can still slip under a loose threshold)
      const longEnough = candidate.replace(/\s/g, "").length >= (windowSize === 1 ? 4 : 6);

      if (longEnough && bestDist < threshold && !isExcluded(candidate, bestCity)) {
        // check if the next word(s) look like a state, e.g. "..., Ohio" or "..., OH"
        let consumed = windowSize;
        let spokenState: string | undefined;

        const nextWord = words[i + windowSize]?.replace(/,$/, "");
        const nextTwo = words
          .slice(i + windowSize, i + windowSize + 2)
          .join(" ")
          .replace(/,$/, "");

        if (nextWord && /^[A-Za-z]{2}$/.test(nextWord)) {
          spokenState = nextWord;
          consumed += 1;
        } else if (nextTwo && STATE_NAME_TO_ABBR[nextTwo.toLowerCase()]) {
          spokenState = nextTwo;
          consumed += 2;
        } else if (nextWord && STATE_NAME_TO_ABBR[nextWord.toLowerCase()]) {
          spokenState = nextWord;
          consumed += 1;
        }

        result.push(resolveCity(bestCity, spokenState));
        totalDistance += bestDist;
        i += consumed;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result.push(words[i]);
      i += 1;
    }
  }

  const text = result.join(" ");
  return returnScore ? { text, distance: totalDistance } : text;
}