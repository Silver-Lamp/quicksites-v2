// app/api/admin/prospects/mail-postcards/preview/route.ts
//
// Dry-run for a postcard send: NO Lob call, NO spend. Given a campaignId it returns the
// deliverability breakdown (which prospects will actually mail vs get dropped for a bad
// address), an estimated cost, and a rendered sample of the ACTUAL personalized card the
// first recipient would receive — so an operator confirms with eyes open before paying.
// Admin-gated; safe to call without POSTCARD_MAIL_ENABLED (it never sends).

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign } from '@/lib/outreach/prospects';
import { buildPosterModel, renderPersonalizedPostcard, claimDeadlineLabel } from '@/lib/outreach/competitionPoster';
import { resolveCampaignBrand } from '@/lib/outreach/campaignBrand';
import { parseUsAddress, MAX_POSTCARD_PIECES_PER_SEND } from '@/lib/outreach/mail/lob';
import { estimatePostcardCents, postcardUnitCents } from '@/lib/outreach/mail/postcardCost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

  const prospects = await listProspectsByCampaign(campaignId);
  const brand = await resolveCampaignBrand(campaign.org_id);
  const model = await buildPosterModel(campaign, prospects, {
    baseUrl: brand.baseUrl,
    brandName: brand.orgId ? brand.name : null,
  });
  if (!model) return NextResponse.json({ error: 'Campaign has no pitch site.' }, { status: 400 });

  const considered = prospects.slice(0, MAX_POSTCARD_PIECES_PER_SEND);
  const mailable: { id: string; name: string }[] = [];
  const undeliverable: { id: string; name: string; reason: string }[] = [];
  let firstMailable: (typeof prospects)[number] | null = null;

  for (const p of considered) {
    const to = parseUsAddress(p.address, p.city, p.region);
    if (to) {
      mailable.push({ id: p.id, name: p.business_name });
      if (!firstMailable) firstMailable = p;
    } else {
      undeliverable.push({ id: p.id, name: p.business_name, reason: 'unparseable_address' });
    }
  }

  const deadline = claimDeadlineLabel(14);

  // Render the real card the first deliverable recipient would get (personalized artwork).
  let sample: { toName: string; frontHtml: string; backHtml: string } | null = null;
  if (firstMailable) {
    const { frontHtml, backHtml } = await renderPersonalizedPostcard(model, {
      campaignId: campaign.id,
      prospectId: firstMailable.id,
      recipientName: firstMailable.business_name,
      deadline,
      baseUrl: brand.baseUrl,
    });
    sample = { toName: firstMailable.business_name, frontHtml, backHtml };
  }

  return NextResponse.json({
    ok: true,
    domain: campaign.domain,
    totalProspects: prospects.length,
    considered: considered.length,
    capped: prospects.length > MAX_POSTCARD_PIECES_PER_SEND,
    maxPerSend: MAX_POSTCARD_PIECES_PER_SEND,
    mailableCount: mailable.length,
    undeliverable, // names + reasons, so bad addresses are visible (not silently dropped)
    deadline,
    estimate: {
      unitCents: postcardUnitCents('6x9'),
      totalCents: estimatePostcardCents(mailable.length, '6x9'),
      isEstimate: true,
    },
    sample,
  });
}
