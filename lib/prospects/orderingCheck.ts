// lib/prospects/orderingCheck.ts
//
// Read the ordering platform for swept restaurants that have a website and write it on the
// prospect row. Called after a sweep (best-effort, bounded) and from the admin route for a city.
//
// Only restaurants: the column means nothing for a plumber. Only rows with a website: a
// no-website row is the other segment. A failed read writes NOTHING — ordering_checked_at stays
// NULL so the row reads "not checked", never "no ordering".

import { supabaseAdmin } from '@/lib/supabase/admin';
import { readOrderingPlatform } from '@/lib/prospects/orderingDetect';

export type OrderingCheckInput = {
  city?: string | null;
  region?: string | null;
  /** Restrict to these prospect ids (the sweep passes what it just parked). */
  ids?: string[];
  /** Re-read rows already checked within this many days (default: only unchecked rows). */
  recheckAfterDays?: number | null;
  limit?: number;
  concurrency?: number;
  fetchImpl?: typeof fetch;
};

export type OrderingCheckResult = {
  considered: number;
  checked: number;
  unreachable: number;
  byPlatform: Record<string, number>;
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function checkOrderingForProspects(input: OrderingCheckInput = {}): Promise<OrderingCheckResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 60, 300));
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('id, website, ordering_checked_at')
    .eq('industry_key', 'restaurant')
    .not('website', 'is', null)
    .neq('website', '')
    .limit(limit);
  if (input.ids?.length) q = q.in('id', input.ids);
  if (input.city) q = q.eq('city', input.city);
  if (input.region) q = q.eq('region', input.region);
  if (input.recheckAfterDays && input.recheckAfterDays > 0) {
    const cutoff = new Date(Date.now() - input.recheckAfterDays * 86_400_000).toISOString();
    q = q.or(`ordering_checked_at.is.null,ordering_checked_at.lt.${cutoff}`);
  } else {
    q = q.is('ordering_checked_at', null);
  }
  const { data, error } = await q;
  if (error) throw new Error(`checkOrderingForProspects: ${error.message}`);
  const rows = (data ?? []) as Array<{ id: string; website: string }>;

  const result: OrderingCheckResult = { considered: rows.length, checked: 0, unreachable: 0, byPlatform: {} };
  await mapLimit(rows, input.concurrency ?? 4, async (r) => {
    const read = await readOrderingPlatform(r.website, input.fetchImpl ?? fetch);
    if (!read.ok) {
      result.unreachable += 1;
      return;
    }
    const { platform, evidence } = read.detection;
    const { error: upErr } = await supabaseAdmin
      .from('outreach_prospects')
      .update({ ordering_platform: platform, ordering_evidence: evidence, ordering_checked_at: new Date().toISOString() })
      .eq('id', r.id);
    if (upErr) return;
    result.checked += 1;
    result.byPlatform[platform] = (result.byPlatform[platform] ?? 0) + 1;
  });
  return result;
}
