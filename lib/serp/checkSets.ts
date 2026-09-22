// lib/serp/checkSets.ts
//
// The searches a niche is judged on, and the one set that is not a niche at all.
//
// ⚠️ THE `worksheet` SET IS A CALIBRATION FIXTURE, NOT A MEASUREMENT. It is exactly the ten
// searches in docs/SERP_CHECK_WORKSHEET.md, in the same order, so a person's hand-scored run and
// this code's run can be compared row for row. Where they disagree, the CODE is wrong — most
// likely `MIXED_MAX_BLOCKS`, which stands in for "did you have to scroll" and is the one number
// in classify.ts that was chosen rather than measured. Do not edit these ten to make the
// comparison come out even; that would delete the only ground truth this tool has.
//
// ⚠️ And keep the towing control. It is the search we KNOW loses (position 10.9, 69 impressions,
// zero clicks). If an automated run ever calls it anything but `skip`, the classifier is broken
// and every other verdict in the run is suspect.

export type SerpCheck = { nicheKey: string | null; query: string; location: string };

/** DataForSEO wants "City,Region,Country" spelled out. */
export const LOC = {
  asheville: 'Asheville,North Carolina,United States',
  austin: 'Austin,Texas,United States',
  seattle: 'Seattle,Washington,United States',
  denver: 'Denver,Colorado,United States',
  bonneyLake: 'Bonney Lake,Washington,United States',
} as const;

/** The ten from the worksheet, plus the towing control that must come back `skip`. */
export const WORKSHEET_CHECKS: SerpCheck[] = [
  { nicheKey: 'treehouse', query: 'treehouse builder asheville nc', location: LOC.asheville },
  { nicheKey: 'treehouse', query: 'treehouse builders near me', location: LOC.asheville },
  { nicheKey: 'treehouse', query: 'custom treehouse company north carolina', location: LOC.asheville },
  { nicheKey: 'treehouse', query: 'treehouse builder austin tx', location: LOC.austin },
  { nicheKey: 'treehouse', query: 'treehouse builders near me', location: LOC.austin },
  { nicheKey: 'storm_shelter', query: 'storm shelter installer austin tx', location: LOC.austin },
  { nicheKey: 'storm_shelter', query: 'storm shelters near me', location: LOC.austin },
  { nicheKey: 'storm_shelter', query: 'safe room contractor texas', location: LOC.austin },
  { nicheKey: 'storm_shelter', query: 'storm shelter installer asheville nc', location: LOC.asheville },
  { nicheKey: 'storm_shelter', query: 'tornado shelter installation near me', location: LOC.austin },
  // The control. Not optional.
  { nicheKey: 'towing', query: 'towing service near me', location: LOC.bonneyLake },
];

/** Build a niche's checks for a metro: "<query> <city>" plus the bare near-me form. */
export function checksFor(
  nicheKey: string,
  queries: readonly string[],
  city: string,
  location: string,
): SerpCheck[] {
  const out: SerpCheck[] = [];
  for (const q of queries) {
    out.push({ nicheKey, query: `${q} ${city.toLowerCase()}`, location });
    out.push({ nicheKey, query: `${q}s near me`, location });
  }
  // Same query twice (two phrasings can collide) buys nothing but a second charge.
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.query}|${c.location}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
