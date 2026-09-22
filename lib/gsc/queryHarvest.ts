// lib/gsc/queryHarvest.ts
//
// The query dimension we never asked for. Every GSC call in this repo used
// `dimensions: ['page']` (performance) or none at all (summary), so we knew our domains had
// 2,903 impressions and 18 clicks and not one word anyone had typed to get there.
//
// Two things come out of a query harvest, and only the second is new information:
//   1. What our sites are actually found FOR — often not what the domain says.
//   2. STRIKING DISTANCE: a query where we already place 11–40 with real impressions. That is
//      demand Google has confirmed exists, on a page that already exists, which we are not
//      winning. It is the cheapest lead in SEO and it is measured, not guessed.
//
// ⚠️ An average position is not a rank. GSC averages over every impression in the window, so a
// query that shows at #3 for one search and #40 for nine reads as ~36 — and a query with 3
// impressions reads as whatever those three happened to be. `MIN_IMPRESSIONS` exists because a
// tiny sample is noise, not a finding; do not lower it to make the list longer.

export type GscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** Below this, an "average position" is one or two lucky impressions. */
export const MIN_IMPRESSIONS = 10;

/** Page 2–4. Above 10 we already rank; past 40 the page is not in the running. */
export const STRIKING_MIN_POSITION = 10.5;
export const STRIKING_MAX_POSITION = 40;

export type HarvestWindow = { startDate: string; endDate: string };

/** The 28-day window ending 3 days ago — GSC data lags ~2–3 days (same rule as summary). */
export function defaultWindow(now: Date = new Date()): HarvestWindow {
  const end = new Date(now);
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: ymd(start), endDate: ymd(end) };
}

/** Google returns `keys: [query]` plus the metrics; anything malformed is dropped, never guessed. */
export function parseQueryRows(rows: unknown): GscQueryRow[] {
  if (!Array.isArray(rows)) return [];
  const out: GscQueryRow[] = [];
  for (const r of rows) {
    const row = r as { keys?: unknown[]; clicks?: unknown; impressions?: unknown; ctr?: unknown; position?: unknown };
    const query = typeof row?.keys?.[0] === 'string' ? (row.keys[0] as string).trim() : '';
    if (!query) continue;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    out.push({
      query,
      clicks: Math.round(num(row.clicks)),
      impressions: Math.round(num(row.impressions)),
      ctr: Math.round(num(row.ctr) * 10000) / 10000,
      position: Math.round(num(row.position) * 100) / 100,
    });
  }
  return out;
}

/**
 * Queries worth acting on: enough impressions to mean something, and ranked on page 2–4.
 * Sorted by impressions — the most demand we are closest to, first.
 */
export function pickStrikingDistance(
  rows: readonly GscQueryRow[],
  opts: { minImpressions?: number } = {},
): GscQueryRow[] {
  const min = opts.minImpressions ?? MIN_IMPRESSIONS;
  return rows
    .filter(
      (r) =>
        r.impressions >= min &&
        r.position > STRIKING_MIN_POSITION &&
        r.position <= STRIKING_MAX_POSITION,
    )
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * Is this query the domain's own name? `bonneylake-towing.com` ranking for "bonney lake towing"
 * proves nothing about demand we could win elsewhere — it is us being looked up. Compared on
 * letters only, so "bonney lake towing" matches "bonneylaketowing".
 */
export function isSelfReferential(query: string, domain: string): boolean {
  const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const host = letters(domain.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\.(com|net|org|ai|co|us)$/, ''));
  const q = letters(query);
  if (!host || !q) return false;
  return host.includes(q) || q.includes(host);
}

export type QuerySummary = {
  queries: number;
  impressions: number;
  clicks: number;
  /** Rows that cleared MIN_IMPRESSIONS — the ones any average is safe to read from. */
  measurable: number;
  strikingDistance: number;
  /** Measurable, non-self-referential queries where we place past 40 — demand we do not serve. */
  outOfRunning: number;
};

export function summariseQueries(rows: readonly GscQueryRow[], domain = ''): QuerySummary {
  const measurable = rows.filter((r) => r.impressions >= MIN_IMPRESSIONS);
  return {
    queries: rows.length,
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    measurable: measurable.length,
    strikingDistance: pickStrikingDistance(rows).length,
    outOfRunning: measurable.filter(
      (r) => r.position > STRIKING_MAX_POSITION && !(domain && isSelfReferential(r.query, domain)),
    ).length,
  };
}
