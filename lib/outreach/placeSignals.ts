// lib/outreach/placeSignals.ts
//
// Backfill Google Place Details "signals" (rating + review_count) onto outreach_prospects,
// so the buy-list map-pack scoring (lib/prospects/buyList.ts) has competitor-review data as
// soon as a city is swept. Place Details is a paid Enterprise SKU, so this is bounded (a
// per-run cap), throttled (a 7-day TTL per prospect — re-sweeps don't re-charge fresh rows),
// and concurrency-limited. The on-sweep call is flag-gated in the discover route. See
// docs/DOMAIN_ACQUISITION_PLAN.md.

import { fetchPlaceDetails, placeDetailsConfigured } from '@/lib/places/placeDetails';
// NOTE: supabaseAdmin is imported lazily inside backfillPlaceSignals so the pure selector +
// flag helpers can be imported (and unit-tested) without booting the Supabase client.

/** Weekly refresh window — matches computeCampaignRecommendations' SIGNAL_TTL_MS. */
export const SIGNAL_TTL_MS = 7 * 86_400_000;

export type SignalRow = { id: string; place_id: string | null; place_signals_synced_at: string | null };

export type SelectOptions = { ttlMs?: number; limit?: number; now?: number };

export type BackfillResult = {
  /** Rows that were stale (needed a refresh). */
  eligible: number;
  /** Rows we actually fetched Place Details for (eligible capped by `limit`). */
  checked: number;
  /** Rows successfully updated with fresh signals. */
  updated: number;
  /** Eligible rows deferred past the per-run cap (not an error — pick them up next run). */
  deferred: number;
  configured: boolean;
};

/**
 * Pure: pick which prospect rows need a Place Details refresh — stale (no sync, or older
 * than the TTL) + have a place_id — capped at `limit`. Returns the targets plus the total
 * eligible so callers can report what was deferred.
 */
export function selectStaleSignalTargets(
  rows: SignalRow[],
  opts: SelectOptions = {},
): { targets: SignalRow[]; eligible: number } {
  const ttl = opts.ttlMs ?? SIGNAL_TTL_MS;
  const now = opts.now ?? Date.now();
  const stale = rows.filter(
    (r) =>
      !!r.place_id &&
      (!r.place_signals_synced_at || now - new Date(r.place_signals_synced_at).getTime() > ttl),
  );
  const limit = opts.limit == null ? stale.length : Math.max(0, opts.limit);
  return { targets: stale.slice(0, limit), eligible: stale.length };
}

/**
 * Backfill place signals for the given place_ids. Loads their current rows, refreshes the
 * stale ones (bounded + concurrency-limited), and writes rating/review_count/
 * place_signals_synced_at. No-op (zeros) when Place Details isn't configured.
 */
export async function backfillPlaceSignals(
  placeIds: string[],
  opts: { ttlMs?: number; limit?: number; concurrency?: number } = {},
): Promise<BackfillResult> {
  const configured = placeDetailsConfigured();
  const base: BackfillResult = { eligible: 0, checked: 0, updated: 0, deferred: 0, configured };
  if (!configured) return base;

  const ids = Array.from(new Set(placeIds.filter(Boolean)));
  if (!ids.length) return base;

  const limit = Math.max(0, opts.limit ?? 60);
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const { supabaseAdmin } = await import('@/lib/supabase/admin');

  // Load current sync state for these place_ids (chunk the IN list).
  const rows: SignalRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin
      .from('outreach_prospects')
      .select('id, place_id, place_signals_synced_at')
      .in('place_id', ids.slice(i, i + 200));
    if (data) rows.push(...(data as SignalRow[]));
  }

  const { targets, eligible } = selectStaleSignalTargets(rows, { ttlMs: opts.ttlMs, limit });

  let updated = 0;
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const r = targets[idx++];
      if (!r.place_id) continue;
      const sig = await fetchPlaceDetails(r.place_id);
      if (!sig) continue;
      const { error } = await supabaseAdmin
        .from('outreach_prospects')
        .update({
          rating: sig.rating,
          review_count: sig.reviewCount,
          place_signals_synced_at: new Date().toISOString(),
        })
        .eq('id', r.id);
      if (!error) updated++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));

  return { eligible, checked: targets.length, updated, deferred: eligible - targets.length, configured };
}

/** On-sweep backfill kill-switch (paid SKU — off by default). */
export function placeSignalsBackfillOnSweepEnabled(): boolean {
  const f = process.env.PLACE_SIGNALS_BACKFILL_ENABLED;
  return f === '1' || f === 'true';
}

/** Per-sweep cap on Place Details calls (bounds cost + fits the route's maxDuration). */
export function placeSignalsBackfillLimit(): number {
  const n = Number(process.env.PLACE_SIGNALS_BACKFILL_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 60;
}
