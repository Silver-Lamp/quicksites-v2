// app/api/admin/prospects/geo-campaign/set-pricing/route.ts
//
// Apply a flat rental plan to a geo-domain campaign — suggested from the industry tier
// (full rate + pre-rank founder rate), or explicit cents. See lib/outreach/geoPricing.ts.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign, setCampaignPricing } from '@/lib/outreach/geoCampaigns';
import { suggestPricing } from '@/lib/outreach/geoPricing';
import { toIndustryKey } from '@/lib/industries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const campaignId = String(body.campaignId ?? '');
  if (!campaignId) return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

  const suggested = suggestPricing(toIndustryKey(campaign.industry_key));
  const priceCents = Number.isFinite(body.priceCents) ? Math.round(Number(body.priceCents)) : suggested.price_cents;
  const lockedCents = Number.isFinite(body.lockedCents) ? Math.round(Number(body.lockedCents)) : suggested.locked_rate_cents;

  // Monthly is the product. 'day'/'week' exist so the rental rail can be PROVEN end-to-end
  // (a renewal in 24h rather than 30 days) without waiting a billing month to find out that
  // recurring charges were broken all along.
  const interval = ['day', 'week', 'month', 'year'].includes(body.interval) ? String(body.interval) : 'month';

  await setCampaignPricing(campaignId, {
    pricing_model: 'flat',
    price_cents: priceCents,
    locked_rate_cents: lockedCents,
    billing_interval: interval,
  });

  return NextResponse.json({
    ok: true,
    pricing: { price_cents: priceCents, locked_rate_cents: lockedCents, billing_interval: interval },
  });
}
