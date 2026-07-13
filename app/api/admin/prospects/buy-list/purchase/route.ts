// app/api/admin/prospects/buy-list/purchase/route.ts
//
// Phase 2 of the domain buy-list planner: BUY the accepted domains and mint a geo-campaign
// (pitch site + pricing) for each. Spends real money — double-gated (admin +
// VERCEL_DOMAIN_REGISTER_ENABLED) and budget-capped. `dryRun` re-checks availability/price
// and mints nothing. Idempotent per domain (skips domains that already have a campaign).
// Uses the Vercel registrar (purchaseDomain) — the automation path; Namecheap needs a
// static IP. See docs/DOMAIN_ACQUISITION_PLAN.md §7.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { toIndustryKey, type IndustryKey } from '@/lib/industries';
import { checkAvailability, purchaseDomain, readRegistrantContact } from '@/lib/domains/registrar';
import { suggestPricing } from '@/lib/outreach/geoPricing';
import { geoDomainFor } from '@/lib/outreach/geoDomain';
import {
  buildGeoPitchSite,
  createGeoCampaign,
  setCampaignPricing,
  setCampaignTracking,
  getGeoCampaignByDomain,
} from '@/lib/outreach/geoCampaigns';
import {
  callTrackingEnabled,
  provisionTrackingNumber,
  areaCodeFromPhone,
} from '@/lib/outreach/callTracking';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { connectDomainToGsc, gscAutoConnectEnabled } from '@/lib/gsc/connectDomain';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // sequential buys + pitch-site builds across a batch

type Item = {
  city: string;
  region?: string | null;
  industryKey: string;
  /** Price the operator approved (guards against a mid-flight price change). */
  expectedPriceUsd?: number | null;
};

type Body = {
  items?: Item[];
  /** Hard cap on total spend for the batch (USD). Stops accepting once exceeded. */
  budgetUsd?: number;
  /** Re-check availability/price only — buy + mint nothing. */
  dryRun?: boolean;
  /** Attach apex + www to the Vercel project after purchase (default true). */
  attach?: boolean;
  /** Provision a Twilio call-tracking number per bought domain (recurring cost). Default false. */
  provisionNumbers?: boolean;
  /** Auto-connect each bought domain to Search Console (DNS-TXT verify + add). Default false. */
  connectGsc?: boolean;
  tld?: string;
};

type ItemResult = {
  domain: string;
  city: string;
  industryKey: IndustryKey;
  status: 'bought' | 'would_buy' | 'exists' | 'skipped' | 'failed';
  reason?: string;
  priceUsd?: number | null;
  campaignId?: string;
  templateId?: string;
  claimUrl?: string;
  trackingNumber?: string | null;
  /** 'connected' | 'pending' | 'skipped' | 'failed' — GSC auto-connect outcome. */
  gsc?: string;
};

function flagEnabled(): boolean {
  return (
    process.env.VERCEL_DOMAIN_REGISTER_ENABLED === '1' ||
    process.env.VERCEL_DOMAIN_REGISTER_ENABLED === 'true'
  );
}

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: 'no items' }, { status: 400 });

  const dryRun = body.dryRun === true;
  const attach = body.attach !== false;
  const provisionNumbers = body.provisionNumbers === true;
  const connectGsc = body.connectGsc === true;
  const tld = (body.tld || 'com').replace(/[^a-z0-9]/gi, '') || 'com';
  const budgetUsd = Number.isFinite(body.budgetUsd) ? Math.max(0, Number(body.budgetUsd)) : Infinity;

  // A real purchase batch requires the kill-switch on + a complete registrant contact.
  if (!dryRun) {
    if (!flagEnabled()) {
      return NextResponse.json(
        { error: 'registration_disabled', detail: 'Set VERCEL_DOMAIN_REGISTER_ENABLED=1 to enable purchases.' },
        { status: 403 },
      );
    }
    const contact = readRegistrantContact();
    if (!contact.ok) {
      return NextResponse.json(
        { error: 'missing_registrant_contact', missing: contact.missing },
        { status: 400 },
      );
    }
  }

  const results: ItemResult[] = [];
  let spentUsd = 0;

  // Sequential — buying spends money and we cap on a running total.
  for (const raw of items) {
    const city = String(raw?.city || '').trim();
    const region = raw?.region ? String(raw.region).trim() : null;
    const industryKey = toIndustryKey(String(raw?.industryKey || ''));
    if (!city || industryKey === 'other') {
      results.push({ domain: '', city, industryKey, status: 'failed', reason: 'invalid_city_or_industry' });
      continue;
    }
    const { domain, slug } = geoDomainFor(city, industryKey, tld);
    const expectedPriceUsd = Number.isFinite(raw?.expectedPriceUsd) ? Number(raw!.expectedPriceUsd) : null;

    // Idempotency: never re-buy a domain that already backs a campaign.
    const existing = await getGeoCampaignByDomain(domain);
    if (existing) {
      results.push({ domain, city, industryKey, status: 'exists', campaignId: existing.id });
      continue;
    }

    // Availability + price (re-checked here regardless — purchaseDomain re-checks too).
    let avail;
    try {
      avail = await checkAvailability(domain);
    } catch (e: any) {
      results.push({ domain, city, industryKey, status: 'failed', reason: e?.message || 'availability_check_failed' });
      continue;
    }
    if (!avail.available) {
      results.push({ domain, city, industryKey, status: 'skipped', reason: 'unavailable', priceUsd: avail.priceUsd });
      continue;
    }
    if (avail.premium) {
      results.push({ domain, city, industryKey, status: 'skipped', reason: 'premium', priceUsd: avail.priceUsd });
      continue;
    }

    const priceUsd = avail.priceUsd ?? 0;
    if (spentUsd + priceUsd > budgetUsd) {
      results.push({ domain, city, industryKey, status: 'skipped', reason: 'over_budget', priceUsd });
      continue;
    }

    if (dryRun) {
      results.push({ domain, city, industryKey, status: 'would_buy', priceUsd });
      spentUsd += priceUsd;
      continue;
    }

    // 1) Buy + attach via the Vercel registrar (never throws).
    const bought = await purchaseDomain(domain, { expectedPriceUsd, attach });
    if (!bought.ok || !bought.purchased) {
      results.push({ domain, city, industryKey, status: 'failed', reason: bought.reason || 'purchase_failed', priceUsd: bought.priceUsd });
      continue;
    }
    spentUsd += bought.priceUsd ?? priceUsd;

    // 2) Mint the claimable pitch site (slug == apex label).
    let pitch;
    try {
      pitch = await buildGeoPitchSite({ city, region, industryKey, slug, operatorId: operator.id });
    } catch (e: any) {
      // Domain is bought + attached; the campaign can be minted later from the panel.
      results.push({ domain, city, industryKey, status: 'failed', reason: `bought_but_pitch_failed: ${e?.message || e}`, priceUsd: bought.priceUsd });
      continue;
    }

    // 3) Record the campaign + set suggested pricing.
    try {
      const campaign = await createGeoCampaign({
        city,
        region,
        industryKey,
        domain,
        slug,
        templateId: pitch.templateId,
        domainStatus: bought.attached ? 'attached' : 'registered',
        createdBy: operator.id,
      });
      await setCampaignPricing(campaign.id, suggestPricing(industryKey));

      // 4) Optional: a call-tracking number from day one (the rental proof/retention engine).
      // Best-effort — a provisioning failure never fails the buy. Pre-claim, calls forward to
      // the platform fallback line. Recurring Twilio cost, so opt-in + flag-gated.
      let trackingNumber: string | null = null;
      if (provisionNumbers && callTrackingEnabled()) {
        const forwardTo = process.env.CALL_TRACKING_FALLBACK_NUMBER || null;
        if (forwardTo) {
          try {
            const { phoneNumber, sid } = await provisionTrackingNumber({
              voiceUrl: `${publicBaseUrl()}/api/twilio/geo/${campaign.id}`,
              areaCode: areaCodeFromPhone(forwardTo),
            });
            await setCampaignTracking(campaign.id, { number: phoneNumber, sid, forwardTo });
            trackingNumber = phoneNumber;
          } catch {
            trackingNumber = null;
          }
        }
      }

      // 5) Optional: connect the domain to Search Console so rank measurement starts day one.
      // Best-effort; DNS propagation may leave it 'pending' (retry via the gsc-connect route).
      let gsc: string | undefined;
      if (connectGsc && gscAutoConnectEnabled()) {
        try {
          const r = await connectDomainToGsc(domain, operator.id);
          gsc = r.verified && !r.pending ? 'connected' : r.pending ? 'pending' : `failed:${r.reason ?? ''}`;
        } catch {
          gsc = 'failed';
        }
      }

      results.push({
        domain,
        city,
        industryKey,
        status: 'bought',
        priceUsd: bought.priceUsd,
        campaignId: campaign.id,
        templateId: pitch.templateId,
        claimUrl: `/claim-site/${pitch.templateId}?token=${encodeURIComponent(mintSiteClaimToken(pitch.templateId))}`,
        trackingNumber,
        gsc,
      });
    } catch (e: any) {
      results.push({ domain, city, industryKey, status: 'failed', reason: `bought_but_campaign_failed: ${e?.message || e}`, templateId: pitch.templateId, priceUsd: bought.priceUsd });
    }
  }

  const summary = {
    bought: results.filter((r) => r.status === 'bought').length,
    wouldBuy: results.filter((r) => r.status === 'would_buy').length,
    exists: results.filter((r) => r.status === 'exists').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    numbersProvisioned: results.filter((r) => r.trackingNumber).length,
    gscConnected: results.filter((r) => r.gsc === 'connected').length,
    gscPending: results.filter((r) => r.gsc === 'pending').length,
  };

  return NextResponse.json({
    ok: true,
    dryRun,
    flagEnabled: flagEnabled(),
    budgetUsd: budgetUsd === Infinity ? null : budgetUsd,
    spentUsd: Math.round(spentUsd * 100) / 100,
    summary,
    results,
  });
}
