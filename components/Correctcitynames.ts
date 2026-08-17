import { US_CITIES } from "./UScities";

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

function normalizedDistance(a: string, b: string) {
  if (!a.length || !b.length) return 1;
  return levenshtein(a.toLowerCase(), b.toLowerCase()) / Math.max(a.length, b.length);
}

// Given a matched city name and (optionally) a state token spoken right
// after it, pick the right entry when the city name is ambiguous
// (e.g. "Cleveland" -> Cleveland, OH or Cleveland, TN).
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

  while (i < words.length) {
    let matched = false;

    // try 3-word, then 2-word, then 1-word city name windows
    for (const windowSize of [3, 2, 1]) {
      if (i + windowSize > words.length) continue;
      const candidate = words.slice(i, i + windowSize).join(" ");

      let bestCity = "";
      let bestDist = Infinity;
      for (const city of CITY_NAMES) {
        const d = normalizedDistance(candidate, city);
        if (d < bestDist) {
          bestDist = d;
          bestCity = city;
        }
      }

      const threshold = windowSize === 1 ? 0.2 : 0.3;
      if (bestDist < threshold) {
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