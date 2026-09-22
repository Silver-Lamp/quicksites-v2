// lib/serp/runChecks.ts
//
// Run a set of SERP checks, classify each, and record the rows. The script and the cron both call
// this — one code path, so a scheduled re-run and a hand-run can never drift apart.
//
// ⚠️ EVERY CHECK COSTS MONEY. The caller passes its own list and the runner never invents one;
// there is no "and while we're here" expansion, and `limit` is a hard stop, not a hint.

import { readSerp, type SerpReading } from '@/lib/serp/classify';
import type { SerpCheck } from '@/lib/serp/checkSets';
import type { SerpProvider } from '@/lib/serp/types';

export type CheckOutcome =
  | { ok: true; check: SerpCheck; reading: SerpReading }
  | { ok: false; check: SerpCheck; error: string };

export type RunOptions = {
  provider: SerpProvider;
  /** Hard cap on provider calls for this run. */
  limit?: number;
  /** Persist rows. Omit for a dry run that still costs the fetch but writes nothing. */
  record?: (check: SerpCheck, reading: SerpReading, raw: unknown) => Promise<void>;
  onProgress?: (done: number, total: number, last: CheckOutcome) => void;
};

export async function runChecks(checks: readonly SerpCheck[], opts: RunOptions): Promise<CheckOutcome[]> {
  const limit = Math.max(0, opts.limit ?? checks.length);
  const slice = checks.slice(0, limit);
  const out: CheckOutcome[] = [];

  for (const check of slice) {
    let outcome: CheckOutcome;
    try {
      const snapshot = await opts.provider.fetchSerp(check.query, check.location);
      const reading = readSerp(snapshot);
      // A failed write must not lose the reading we already paid for — record, then report.
      if (opts.record) await opts.record(check, reading, snapshot.raw);
      outcome = { ok: true, check, reading };
    } catch (e) {
      outcome = { ok: false, check, error: e instanceof Error ? e.message : String(e) };
    }
    out.push(outcome);
    opts.onProgress?.(out.length, slice.length, outcome);
  }
  return out;
}

/** Readings only, for tallying. Failures are dropped here and reported separately by the caller. */
export const readingsOf = (outcomes: readonly CheckOutcome[]): SerpReading[] =>
  outcomes.flatMap((o) => (o.ok ? [o.reading] : []));
