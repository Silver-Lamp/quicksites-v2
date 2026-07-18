// lib/partners/audioProvisioning/usageFeed.ts
//
// Pulls HiveJournal's partner usage feed and upserts it into partner_audio_usage — the
// rollup ledger QS uses for per-agent attribution + tier-billing reconciliation.
//
// PROPOSED (contract §2, billing-rollup half — pending HJ ratification). The endpoint
// shape below matches what QS proposed; if HJ ratifies a different shape, only the parse
// + the GET path change. Everything is flag-gated + fail-soft, so this is inert and
// harmless until the feed is live.

import { createClient } from '@supabase/supabase-js';
import { hjBackendUrl, partnerSecret, partnerAudioEnabled, PARTNER_ID } from './config';
import { templateForEmbed } from './grants';
import type { PartnerUsageFeed, PartnerUsageRow } from './types';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** GET the partner usage feed for a window. Null on any failure (fail-soft). */
export async function fetchPartnerUsage(sinceIso: string, untilIso: string): Promise<PartnerUsageFeed | null> {
  if (!partnerAudioEnabled()) return null;
  try {
    const url = `${hjBackendUrl()}/api/partner/usage?since=${encodeURIComponent(sinceIso)}&until=${encodeURIComponent(untilIso)}`;
    const res = await fetch(url, {
      headers: { 'X-Partner-Id': PARTNER_ID, 'X-Partner-Key': partnerSecret() },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as PartnerUsageFeed;
    if (!Array.isArray(body?.owners)) return null;
    return body;
  } catch {
    return null;
  }
}

export type SyncSummary = { pulled: number; upserted: number; skipped: number; window: { since: string; until: string } };

/**
 * Pull the feed for [now-lookbackDays, now] and upsert each owner/embed row into
 * partner_audio_usage (resolving template_id via the stored grant). Idempotent on the
 * (embed, period) unique index. Returns a summary; never throws on partial failure.
 */
export async function syncPartnerUsage(lookbackDays = 35): Promise<SyncSummary> {
  const until = new Date();
  const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const window = { since: ymd(since), until: ymd(until) };
  const empty: SyncSummary = { pulled: 0, upserted: 0, skipped: 0, window };

  const feed = await fetchPartnerUsage(since.toISOString(), until.toISOString());
  if (!feed) return empty;

  const db = admin();
  let upserted = 0;
  let skipped = 0;

  for (const row of feed.owners as PartnerUsageRow[]) {
    if (!row?.embed_id) {
      skipped++;
      continue;
    }
    const templateId = await templateForEmbed(row.embed_id);
    const rec = {
      hj_owner_id: row.owner_id ?? null,
      hj_embed_id: row.embed_id,
      template_id: templateId,
      period_start: feed.period?.since ? feed.period.since.slice(0, 10) : window.since,
      period_end: feed.period?.until ? feed.period.until.slice(0, 10) : window.until,
      renders: Math.max(0, Math.round(Number(row.renders) || 0)),
      render_chars: Math.max(0, Math.round(Number(row.render_chars) || 0)),
      est_cost_usd: Math.max(0, Number(row.est_cost_usd) || 0),
      last_render_at: row.last_render_at ?? null,
      synced_at: new Date().toISOString(),
    };
    const { error } = await db
      .from('partner_audio_usage')
      .upsert(rec, { onConflict: 'hj_embed_id,period_start,period_end' });
    if (error) skipped++;
    else upserted++;
  }

  return { pulled: feed.owners.length, upserted, skipped, window };
}
