// app/api/admin/prospects/gsc-connect/route.ts
//
// Connect (or retry verifying) a geo-domain to Google Search Console. Used to finish
// domains left `pending` by the buy-time auto-connect once their DNS TXT has propagated,
// or to connect a domain on demand. Admin-gated; needs the operator's GSC re-consent with
// the webmasters read-write + siteverification scopes (see /api/gsc/auth-url).

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import {
  connectDomainToGsc,
  verifyPendingGscDomain,
  gscAutoConnectConfigured,
} from '@/lib/gsc/connectDomain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Body = {
  domain?: string;
  campaignId?: string;
  /** true = retry verification only (TXT already published); false = full connect (publish + verify + add). */
  retry?: boolean;
};

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  if (!gscAutoConnectConfigured()) {
    return NextResponse.json(
      { error: 'gsc_not_configured', detail: 'Set GOOGLE_CLIENT_ID/SECRET (or GSC_*).' },
      { status: 400 },
    );
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  let domain = (body.domain || '').trim();
  if (!domain && body.campaignId) {
    const c = await getGeoCampaign(body.campaignId);
    if (!c) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
    domain = c.domain;
  }
  if (!domain) return NextResponse.json({ error: 'domain or campaignId required' }, { status: 400 });

  const result = body.retry
    ? await verifyPendingGscDomain(domain, operator.id)
    : await connectDomainToGsc(domain, operator.id);

  return NextResponse.json({ ok: result.ok, result });
}
