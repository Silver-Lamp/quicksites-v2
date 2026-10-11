// lib/outreach/defaultOperator.ts
//
// The account that owns an outreach draft until the business claims it. `TRADE_PIPELINE_OPERATOR_ID`
// names it when set — and it is NOT set in production (checked 2026-10-11), so every prospect the
// public "Sweep where I am" inserted carried `discovered_by: null`, and "Build their ordering page"
// on those rows failed with `no_operator` ("Couldn't build it … tell Sandon"). Fallback: the
// operator who owns the oldest listing-import draft — the one account the whole programme has
// always used — read once per process. Deterministic, data-grounded, never a guess from a name.
import { supabaseAdmin } from '@/lib/supabase/admin';

let cached: string | null | undefined;

export async function resolveOperatorId(): Promise<string | null> {
  const env = process.env.TRADE_PIPELINE_OPERATOR_ID?.trim();
  if (env) return env;
  if (cached !== undefined) return cached;
  const { data } = await (supabaseAdmin as any)
    .from('templates')
    .select('owner_id')
    .eq('claim_source', 'listing_import')
    .not('owner_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  cached = (data?.owner_id as string | undefined) ?? null;
  return cached;
}
