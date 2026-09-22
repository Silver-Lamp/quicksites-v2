// lib/serp/worklist.ts
//
// Turning a check set into a sequence a person can actually get through. PURE.
//
// ⚠️ THE DESIGN CONSTRAINT IS BOREDOM, NOT CORRECTNESS. Ten searches is twenty minutes of
// repetitive work, and the failure mode is not a wrong answer — it is someone stopping at row
// six, or getting sloppy from row four onward. So: one search on screen at a time, the query
// ready to copy, two questions per row, and the control placed FIRST rather than last.
//
// ⚠️ The control goes first on purpose. Buried at the end it gets answered by a tired person, and
// it is the one row whose job is to catch a broken reading — including a broken human reading. A
// run whose control disagrees is a run nobody should act on, and we want to know that at row one.

import { WORKSHEET_CHECKS, checksFor, locationFor, type SerpCheck } from '@/lib/serp/checkSets';
import type { SerpReading, SerpVerdict } from '@/lib/serp/classify';

export type WorklistStep = SerpCheck & {
  /** 1-based position in the run. */
  index: number;
  /** The control exists to catch a broken reading; the UI says so rather than hiding it. */
  isControl: boolean;
  /** A ready-made Google URL with the location spelled out in the query, for the copy button. */
  searchUrl: string;
  /**
   * Does this row need the browser's location faked?
   *
   * ⚠️ ONLY "near me" ROWS DO, and saying so per row matters more than it sounds: the first
   * version told people to set a location for all ten, most of which name the city in the query
   * and do not need it. A setup step that is unnecessary two-thirds of the time is one people
   * skip on the rows where it IS load-bearing — and a "near me" search from the wrong city is a
   * measurement of the wrong market that looks exactly like a measurement of the right one.
   */
  needsLocationOverride: boolean;
  /** Coordinates to paste into DevTools → Sensors, when this row needs them. */
  coords?: string;
};

/** Lat/long per city we run checks in, for the Sensors panel. */
export const CITY_COORDS: Record<string, string> = {
  seattle: '47.6062, -122.3321',
  austin: '30.2672, -97.7431',
  asheville: '35.5951, -82.5515',
  denver: '39.7392, -104.9903',
  orlando: '28.5383, -81.3792',
  portland: '43.6591, -70.2568',
  madison: '43.0731, -89.4012',
  boise: '43.6150, -116.2023',
  phoenix: '33.4484, -112.0740',
  nashville: '36.1627, -86.7816',
  'bonney lake': '47.1854, -122.1868',
};

const googleUrl = (query: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(query)}&pws=0`;

/** Control first, then the rest in their given order. */
export function buildWorklist(checks: readonly SerpCheck[]): WorklistStep[] {
  const control = checks.filter((c) => c.nicheKey === 'towing');
  const rest = checks.filter((c) => c.nicheKey !== 'towing');
  return [...control, ...rest].map((c, i) => {
    const needsLocationOverride = /\bnear me\b/i.test(c.query);
    const city = c.location.split(',')[0].trim().toLowerCase();
    return {
      ...c,
      index: i + 1,
      isControl: c.nicheKey === 'towing',
      searchUrl: googleUrl(c.query),
      needsLocationOverride,
      ...(needsLocationOverride && CITY_COORDS[city] ? { coords: CITY_COORDS[city] } : {}),
    };
  });
}

export function worksheetWorklist(): WorklistStep[] {
  return buildWorklist(WORKSHEET_CHECKS);
}

/** A niche across one or more cities, plus the control appended so every run has one. */
export function nicheWorklist(
  nicheKey: string,
  queries: readonly string[],
  cities: readonly string[],
): WorklistStep[] {
  const checks = cities.flatMap((city) => checksFor(nicheKey, queries, city, locationFor(city)));
  const control = WORKSHEET_CHECKS.find((c) => c.nicheKey === 'towing');
  return buildWorklist(control ? [...checks, control] : checks);
}

export type RunSummary = {
  done: number;
  total: number;
  green: number;
  /** null until the control has been answered. */
  controlOk: boolean | null;
  /** Rows where a person and the machine reached different verdicts. */
  disagreements: Array<{ query: string; location: string; human: SerpVerdict; machine: SerpVerdict }>;
  recommendation: string;
};

/**
 * ⚠️ A RUN WHOSE CONTROL FAILED HAS NO RECOMMENDATION, and must not be given one. `towing service
 * near me` is known to lose; scoring it anything but `skip` means the reading is wrong, and a
 * tally computed on top of a wrong reading is worse than no tally because it looks like an answer.
 */
export function summarise(
  rows: ReadonlyArray<{ check: SerpCheck; human: SerpReading; machine?: SerpReading | null }>,
  total: number,
): RunSummary {
  const controlRow = rows.find((r) => r.check.nicheKey === 'towing');
  const controlOk = controlRow ? controlRow.human.verdict === 'skip' : null;
  const scored = rows.filter((r) => r.check.nicheKey !== 'towing');
  const green = scored.filter((r) => r.human.verdict === 'best' || r.human.verdict === 'good').length;
  const disagreements = rows
    .filter((r) => r.machine && r.machine.verdict !== r.human.verdict)
    .map((r) => ({
      query: r.check.query,
      location: r.check.location,
      human: r.human.verdict,
      machine: r.machine!.verdict,
    }));

  let recommendation: string;
  if (controlOk === false) {
    recommendation =
      'The control scored something other than “skip”, so this run cannot be read. `towing service near me` is a query we know loses — position 10.9, 69 impressions, zero clicks. Check how the pack was counted on that row before trusting anything else here.';
  } else if (rows.length < total) {
    recommendation = `${rows.length} of ${total} done.`;
  } else {
    const ratio = scored.length ? green / scored.length : 0;
    recommendation =
      ratio >= 0.7
        ? 'Real cohort — worth pricing domains and drafting the page structure.'
        : ratio >= 0.4
          ? 'Split result. One part of this is probably good and another is not; probe the stronger half alone before spending.'
          : 'The supply-density proxy did not hold here. That is a useful result: fix the scoring before buying anything.';
  }

  return { done: rows.length, total, green, controlOk, disagreements, recommendation };
}
