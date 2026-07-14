// app/api/admin/prospects/geo-campaign/bulk-automate/route.ts
//
// Post-hoc automation across ALL existing geo-campaigns: connect each domain to Search
// Console and/or provision a call-tracking number — for campaigns bought without those
// toggles. Idempotent (skips already-connected / already-numbered), gated by the same flags
// as the per-buy path, best-effort per campaign. Admin-gated. See DOMAIN_ACQUISITION_PLAN.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { listGeoCampaigns, setCampaignTracking } from '@/lib/outreach/geoCampaigns';
import { connectDomainToGsc, gscAutoConnectEnabled } from '@/lib/gsc/connectDomain';
import { loadGscPropertyMap, gscPropertyFor } from '@/lib/gsc/resolveProperty';
import { callTrackingEnabled, provisionTrackingNumber, areaCodeFromPhone } from '@/lib/outreach/callTracking';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // sequential GSC verify + number provisioning across campaigns

type Body = { connectGsc?: boolean; provisionNumbers?: boolean; limit?: number };

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }
  const doGsc = body.connectGsc === true;
  const doNumbers = body.provisionNumbers === true;
  if (!doGsc && !doNumbers) return NextResponse.json({ error: 'nothing_to_do' }, { status: 400 });

  const limit = Math.min(Math.max(1, Number(body.limit) || 100), 500);
  const campaigns = (await listGeoCampaigns(500)).filter((c) => c.domain).slice(0, limit);

  const gscOn = gscAutoConnectEnabled();
  const numbersOn = callTrackingEnabled();
  const propertyMap = doGsc && gscOn ? await loadGscPropertyMap() : new Map<string, string>();
  const fallbackNumber = process.env.CALL_TRACKING_FALLBACK_NUMBER || null;

  const summary = {
    gscConnected: 0,
    gscPending: 0,
    gscSkipped: 0,
    gscFailed: 0,
    numbersProvisioned: 0,
    numbersSkipped: 0,
    numbersFailed: 0,
  };
  const results: any[] = [];

  for (const c of campaigns) {
    const r: any = { domain: c.domain, campaignId: c.id };

    if (doGsc) {
      if (!gscOn) r.gsc = 'disabled';
      else if (gscPropertyFor(propertyMap, c.domain)) { r.gsc = 'already'; summary.gscSkipped++; }
      else {
        try {
          const g = await connectDomainToGsc(c.domain, operator.id);
          r.gsc = g.verified && !g.pending ? 'connected' : g.pending ? 'pending' : `failed:${g.reason ?? ''}`;
          if (r.gsc === 'connected') summary.gscConnected++;
          else if (r.gsc === 'pending') summary.gscPending++;
          else summary.gscFailed++;
        } catch {
          r.gsc = 'failed';
          summary.gscFailed++;
        }
      }
    }

    if (doNumbers) {
      if (!numbersOn) r.number = 'disabled';
      else if (c.tracking_number) { r.number = 'already'; summary.numbersSkipped++; }
      else if (!fallbackNumber) { r.number = 'no_fallback'; summary.numbersFailed++; }
      else {
        try {
          const { phoneNumber, sid } = await provisionTrackingNumber({
            voiceUrl: `${publicBaseUrl()}/api/twilio/geo/${c.id}`,
            areaCode: areaCodeFromPhone(fallbackNumber),
          });
          await setCampaignTracking(c.id, { number: phoneNumber, sid, forwardTo: fallbackNumber });
          r.number = phoneNumber;
          summary.numbersProvisioned++;
        } catch {
          r.number = 'failed';
          summary.numbersFailed++;
        }
      }
    }

    results.push(r);
  }

  return NextResponse.json({
    ok: true,
    gscEnabled: gscOn,
    numbersEnabled: numbersOn,
    processed: campaigns.length,
    summary,
    results,
  });
}
