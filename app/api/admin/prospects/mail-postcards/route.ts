// app/api/admin/prospects/mail-postcards/route.ts
//
// Mail the competition poster (+ QR claim link) to every competing business in a
// geo-industry campaign via Lob. GATED behind POSTCARD_MAIL_ENABLED + LOB_API_KEY —
// it spends money per piece. Marks each prospect postcard_sent_at.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign, markOutreachSent } from '@/lib/outreach/prospects';
import { buildPosterModel, renderPersonalizedPostcard, claimDeadlineLabel } from '@/lib/outreach/competitionPoster';
import { resolveCampaignBrand } from '@/lib/outreach/campaignBrand';
import { sendPostcard, parseUsAddress, postcardMailEnabled, lobConfigured, MAX_POSTCARD_PIECES_PER_SEND } from '@/lib/outreach/mail/lob';
import { recordMailing } from '@/lib/outreach/mail/mailings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PIECES = MAX_POSTCARD_PIECES_PER_SEND;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!lobConfigured()) {
    return NextResponse.json({ error: 'Lob is not configured (LOB_API_KEY + LOB_FROM_* required).', code: 'not_configured' }, { status: 501 });
  }
  if (!postcardMailEnabled()) {
    return NextResponse.json({ error: 'Postcard mail is disabled. Set POSTCARD_MAIL_ENABLED=1 to send.', code: 'disabled' }, { status: 403 });
  }

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

  // A concrete claim deadline (~2 weeks out) shared across this batch, so the printed
  // "Claim by {date}" matches what the operator sends today.
  const deadline = claimDeadlineLabel(14);

  const results: Array<Record<string, unknown>> = [];
  const mailedIds: string[] = [];
  for (const p of prospects.slice(0, MAX_PIECES)) {
    const to = parseUsAddress(p.address, p.city, p.region);
    if (!to) {
      results.push({ prospectId: p.id, ok: false, error: 'unparseable_address' });
      continue;
    }
    try {
      // Per-prospect QR + personalization (highlighted in the list, greeted on the back).
      // Same renderer the preview uses, so what the operator confirmed is what mails.
      const { frontHtml, backHtml } = await renderPersonalizedPostcard(model, {
        campaignId: campaign.id,
        prospectId: p.id,
        recipientName: p.business_name,
        deadline,
        baseUrl: brand.baseUrl,
      });
      const r = await sendPostcard({
        to: { name: p.business_name, ...to },
        frontHtml,
        backHtml,
        description: `Geo-competition ${campaign.domain}`,
        metadata: { campaign_id: campaign.id, prospect_id: p.id },
        // One piece per (campaign, prospect) send — a retry won't double-mail at Lob.
        idempotencyKey: `pc_${campaign.id}_${p.id}`,
      });
      mailedIds.push(p.id);
      // Persist the Lob id so the delivery webhook can advance this piece's status.
      try {
        await recordMailing({
          lobId: r.id,
          prospectId: p.id,
          campaignId: campaign.id,
          sentBy: operator.id,
          toName: p.business_name,
          toAddress: `${to.line1}, ${to.city}, ${to.state} ${to.zip}`,
          expectedDeliveryDate: r.expectedDeliveryDate,
          carrier: r.carrier,
          trackingNumber: r.trackingNumber,
          thumbnailUrl: r.thumbnailUrl,
          pdfUrl: r.pdfUrl,
        });
      } catch {
        /* tracking is best-effort — never fail a successful mail on a record error */
      }
      results.push({ prospectId: p.id, ok: true, lobId: r.id, expectedDelivery: r.expectedDeliveryDate });
    } catch (e: any) {
      results.push({ prospectId: p.id, ok: false, error: e?.message || 'send_failed' });
    }
  }
  if (mailedIds.length) await markOutreachSent(mailedIds, 'postcard');

  return NextResponse.json({ ok: true, mailed: mailedIds.length, results });
}
