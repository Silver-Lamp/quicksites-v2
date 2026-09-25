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

import { googleSearchUrl } from './uule';
import { WORKSHEET_CHECKS, checksFor, locationFor, type SerpCheck } from '@/lib/serp/checkSets';
import { isControlReading, type SerpReading, type SerpVerdict } from '@/lib/serp/classify';

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
  /** The IANA timezone id Sensors asks for alongside them. */
  timezoneId?: string;
};

/**
 * What Chrome's Sensors panel asks for, per city: coordinates AND an IANA timezone ID.
 *
 * ⚠️ THE TIMEZONE FIELD IS NOT OPTIONAL-LOOKING BUT IS EASY TO GET WRONG, and a wrong one is
 * silent: the search still runs, Google still localises by coordinates, and nothing says the
 * clock disagrees. Three of these are the ones people guess wrong —
 *   - Phoenix has its OWN id (`America/Phoenix`), because Arizona skips DST; `America/Denver`
 *     is an hour out for half the year.
 *   - Boise has its own id too, rather than folding into `America/Denver`.
 *   - Portland here is MAINE, not Oregon. `America/Los_Angeles` would be a different city.
 * All eleven verified against /usr/share/zoneinfo on 2026-09-22.
 */
export type CityLocale = { coords: string; timezoneId: string };

export const CITY_LOCALES: Record<string, CityLocale> = {
  seattle: { coords: '47.6062, -122.3321', timezoneId: 'America/Los_Angeles' },
  austin: { coords: '30.2672, -97.7431', timezoneId: 'America/Chicago' },
  asheville: { coords: '35.5951, -82.5515', timezoneId: 'America/New_York' },
  denver: { coords: '39.7392, -104.9903', timezoneId: 'America/Denver' },
  orlando: { coords: '28.5383, -81.3792', timezoneId: 'America/New_York' },
  // ⚠️ Portland, MAINE — the probe metro. Not Oregon.
  portland: { coords: '43.6591, -70.2568', timezoneId: 'America/New_York' },
  madison: { coords: '43.0731, -89.4012', timezoneId: 'America/Chicago' },
  boise: { coords: '43.6150, -116.2023', timezoneId: 'America/Boise' },
  phoenix: { coords: '33.4484, -112.0740', timezoneId: 'America/Phoenix' },
  nashville: { coords: '36.1627, -86.7816', timezoneId: 'America/Chicago' },
  'bonney lake': { coords: '47.1854, -122.1868', timezoneId: 'America/Los_Angeles' },
};

/** Kept for callers that only want the coordinates. */
export const CITY_COORDS: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_LOCALES).map(([k, v]) => [k, v.coords]),
);

/**
 * ⚠️ THE LOCATION NOW TRAVELS IN THE URL, replacing the DevTools → Sensors step.
 *
 * Sensors failed silently TWICE in two days on the same niche: one run stamped `28801, Asheville,
 * NC` and the next `East Renton Highlands, Washington`, both while checking queries meant to be
 * Austin's. The searches ran, the results looked plausible, and only the footer at the very bottom
 * of the page disagreed. A setup step that fails invisibly and is verified LAST is the wrong shape.
 *
 * `uule` cannot fail quietly in the same way — a malformed one is ignored and the footer then shows
 * the IP city, which is the same visible receipt. And because it is built from the SAME canonical
 * name the API check uses, the hand check and the machine check point at one place by construction
 * rather than by someone retyping a city into a panel.
 */
const googleUrl = (query: string, location: string) => googleSearchUrl(query, location);

/**
 * Control first, then the rest GROUPED BY CITY.
 *
 * ⚠️ The grouping is not cosmetic. A Chrome Sensors location override lives with the DevTools
 * session, so it survives retyping a query in the same tab but not a new tab — which means every
 * change of city is a fresh trip through the Sensors panel. Interleaving cities turns an
 * eleven-row run into eleven overrides; grouping turns it into one per city. The run is twenty
 * minutes of repetitive work already, and every avoidable step is a chance to stop at row six.
 */
export function buildWorklist(checks: readonly SerpCheck[]): WorklistStep[] {
  const control = checks.filter((c) => c.nicheKey === 'towing');
  const rest = checks.filter((c) => c.nicheKey !== 'towing');

  // Stable: cities keep the order they first appear in, and rows keep their order within a city.
  const order = new Map<string, number>();
  for (const c of rest) if (!order.has(c.location)) order.set(c.location, order.size);
  const grouped = [...rest].sort(
    (a, b) => (order.get(a.location)! - order.get(b.location)!),
  );

  return [...control, ...grouped].map((c, i) => {
    const needsLocationOverride = /\bnear me\b/i.test(c.query);
    const city = c.location.split(',')[0].trim().toLowerCase();
    return {
      ...c,
      index: i + 1,
      isControl: c.nicheKey === 'towing',
      searchUrl: googleUrl(c.query, c.location),
      needsLocationOverride,
      ...(needsLocationOverride && CITY_LOCALES[city]
        ? { coords: CITY_LOCALES[city].coords, timezoneId: CITY_LOCALES[city].timezoneId }
        : {}),
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
  // Same definition as tally()'s, so the console and the CLI cannot drift apart again.
  const controlRow = rows.find((r) => r.check.nicheKey === 'towing' || isControlReading(r.human));
  const controlOk = controlRow ? controlRow.human.verdict === 'skip' : null;
  const scored = rows.filter((r) => r.check.nicheKey !== 'towing' && !isControlReading(r.human));
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
