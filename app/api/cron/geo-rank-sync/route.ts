// app/api/cron/geo-rank-sync/route.ts
//
// Sync each geo-domain campaign's GSC rank, and auto-step a rented domain's price from
// the locked founder rate to the full rate the moment it reaches page 1 (see
// docs/GEO_DOMAIN_MONETIZATION.md). Cron-authorized; best-effort per domain.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getValidOAuthClient } from '@/lib/gsc/getValidOAuthClient';
import { loadGscPropertyMap, gscPropertyFor } from '@/lib/gsc/resolveProperty';
import { listGeoCampaignsForRankSync, setCampaignRank } from '@/lib/outreach/geoCampaigns';
import { computeCampaignRecommendations } from '@/lib/outreach/computeRecommendations';
import { deriveRankStatus } from '@/lib/outreach/geoPricing';
import { computeRankTrend, type RankSnapshot } from '@/lib/outreach/rankTrend';
import { stripe } from '@/lib/stripe/server';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * 28-day GSC totals for a connected property, or null. `property` is the exact gsc_tokens
 * property string (e.g. "sc-domain:boston-towing.com") — used for BOTH the token lookup and
 * the searchanalytics siteUrl, so domain properties actually resolve.
 */
async function gscPosition(property: string): Promise<RankSnapshot | null> {
  try {
    const end = new Date();
    end.setDate(end.getDate() - 3);
    const start = new Date(end);
    start.setDate(start.getDate() - 28);
    const oauth2Client = await getValidOAuthClient(property);
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    const res = await searchconsole.searchanalytics.query({
      siteUrl: property,
      requestBody: { startDate: ymd(start), endDate: ymd(end) },
    });
    const row = res.data.rows?.[0];
    return {
      position: Math.round((row?.position ?? 0) * 10) / 10,
      impressions: Math.round(row?.impressions ?? 0),
      clicks: Math.round(row?.clicks ?? 0),
      ctr: typeof row?.ctr === 'number' ? row.ctr : null,
    };
  } catch {
    return null;
  }
}

/** Step a live subscription's price up to `fullCents`/mo (prorated). Best-effort. */
async function stepSubscriptionUp(subId: string, fullCents: number, domain: string) {
  const sub = await stripe.subscriptions.retrieve(subId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) return;
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: fullCents,
    recurring: { interval: 'month' },
    product_data: { name: `${domain} — local lead site` },
  });
  await stripe.subscriptions.update(subId, {
    items: [{ id: itemId, price: price.id }],
    proration_behavior: 'create_prorations',
    metadata: { ...(sub.metadata || {}), rank_stepped_up: '1' },
  });
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('geo-rank-sync', async () => {
    const campaigns = await listGeoCampaignsForRankSync();
    const propertyMap = await loadGscPropertyMap(); // normalizedDomain → GSC property string
    let synced = 0;
    let steppedUp = 0;
    let recced = 0;

    for (const c of campaigns) {
      const property = gscPropertyFor(propertyMap, c.domain);
      const g = property ? await gscPosition(property) : null;
      let rankStatus = c.rank_status;
      let rankPosition = c.rank_position;
      let trend = null as ReturnType<typeof computeRankTrend> | null;

      if (g) {
        const next = deriveRankStatus(g.position, g.impressions);
        const was = c.rank_status;
        await setCampaignRank(c.id, { rank_status: next, rank_position: g.position || null });
        rankStatus = next;
        rankPosition = g.position || null;
        synced += 1;

        // Trend: compare to the prior snapshot, log this one, store the compact delta.
        try {
          const { data: prevRow } = await admin
            .from('geo_rank_history')
            .select('position, impressions, clicks, ctr')
            .eq('campaign_id', c.id)
            .order('captured_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          trend = computeRankTrend((prevRow as RankSnapshot) ?? null, g);
          await admin.from('geo_rank_history').insert({
            campaign_id: c.id,
            position: g.position || null,
            impressions: g.impressions,
            clicks: g.clicks,
            ctr: g.ctr,
          });
          await admin.from('geo_industry_campaigns').update({ rank_trend: trend }).eq('id', c.id);
        } catch {
          /* best-effort */
        }

        // Auto-step-up: a rented, flat-priced domain that just reached page 1.
        const crossedToPage1 = next === 'page1' && was !== 'page1';
        if (
          crossedToPage1 &&
          c.pricing_model === 'flat' &&
          c.subscription_status === 'active' &&
          c.stripe_subscription_id &&
          c.price_cents &&
          process.env.STRIPE_SECRET_KEY
        ) {
          try {
            await stepSubscriptionUp(c.stripe_subscription_id, c.price_cents, c.domain);
            steppedUp += 1;
          } catch {
            /* best-effort — leave at the locked rate if the step-up fails */
          }
        }
      }

      // Recompute "next steps" recommendations (runs even when GSC has no data yet).
      try {
        await computeCampaignRecommendations(
          { ...c, rank_status: rankStatus, rank_position: rankPosition },
          { impressions: g?.impressions ?? null, trend },
        );
        recced += 1;
      } catch {
        /* best-effort — recommendations are advisory */
      }
    }

    return NextResponse.json({ ok: true, campaigns: campaigns.length, synced, steppedUp, recced });
  });
}

export const GET = handle;
export const POST = handle;
