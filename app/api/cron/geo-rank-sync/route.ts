// app/api/cron/geo-rank-sync/route.ts
//
// Sync each geo-domain campaign's GSC rank, and auto-step a rented domain's price from
// the locked founder rate to the full rate the moment it reaches page 1 (see
// docs/GEO_DOMAIN_MONETIZATION.md). Cron-authorized; best-effort per domain.

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getValidOAuthClient } from '@/lib/gsc/getValidOAuthClient';
import { listGeoCampaignsForRankSync, setCampaignRank } from '@/lib/outreach/geoCampaigns';
import { deriveRankStatus } from '@/lib/outreach/geoPricing';
import { stripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** 28-day GSC totals row for a domain, or null if it can't be read. */
async function gscPosition(domain: string): Promise<{ position: number; impressions: number } | null> {
  try {
    const end = new Date();
    end.setDate(end.getDate() - 3);
    const start = new Date(end);
    start.setDate(start.getDate() - 28);
    const oauth2Client = await getValidOAuthClient(domain);
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    const res = await searchconsole.searchanalytics.query({
      siteUrl: domain,
      requestBody: { startDate: ymd(start), endDate: ymd(end) },
    });
    const row = res.data.rows?.[0];
    return { position: Math.round((row?.position ?? 0) * 10) / 10, impressions: Math.round(row?.impressions ?? 0) };
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
    let synced = 0;
    let steppedUp = 0;

    for (const c of campaigns) {
      const g = await gscPosition(c.domain);
      if (!g) continue;
      const next = deriveRankStatus(g.position, g.impressions);
      const was = c.rank_status;
      await setCampaignRank(c.id, { rank_status: next, rank_position: g.position || null });
      synced += 1;

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

    return NextResponse.json({ ok: true, campaigns: campaigns.length, synced, steppedUp });
  });
}

export const GET = handle;
export const POST = handle;
