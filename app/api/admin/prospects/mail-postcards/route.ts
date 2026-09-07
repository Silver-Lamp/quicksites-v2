// app/api/admin/prospects/mail-postcards/route.ts
//
// Mail the competition poster (+ QR claim link) to every competing business in a
// geo-industry campaign via Lob. GATED behind POSTCARD_MAIL_ENABLED + LOB_API_KEY —
// it spends money per piece. Marks each prospect postcard_sent_at.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign, markOutreachSent } from '@/lib/outreach/prospects';
import { proofForDomain } from '@/lib/outreach/postcardProof';
import { buildPosterModel, renderPersonalizedPostcard, claimDeadlineLabel } from '@/lib/outreach/competitionPoster';
import { resolveCampaignBrand } from '@/lib/outreach/campaignBrand';
import { getTestRecipient } from '@/lib/outreach/mail/testRecipient';
import { sendPostcard, parseUsAddress, postcardMailEnabled, lobConfigured, MAX_POSTCARD_PIECES_PER_SEND } from '@/lib/outreach/mail/lob';
import { recordMailing } from '@/lib/outreach/mail/mailings';
import { outreachReadinessGateEnabled } from '@/lib/flags/outreachReadinessGate';

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

  // Refine-before-postcard gate (flag-gated). A live-test send (one card to the operator's
  // own test address) is exempt — it validates the pipeline, not the prospects.
  if (outreachReadinessGateEnabled() && body.test !== true && !campaign.outreach_ready_at) {
    return NextResponse.json(
      { error: 'This site isn’t marked ready for outreach. Refine it and mark it ready first.', code: 'not_ready' },
      { status: 409 },
    );
  }

  // ⚠️ PROVEN-DOMAIN TRIAL GATE. A card may only go out claiming page one when the domain holds
  // it TODAY, read live at send time from the same data the rate card reads. Founder-tier copy
  // (no ranking claim at all) is a deliberate opt-in via allowFounderTier, so the default cannot
  // quietly become "mail anything" — the failure that matters here is a claim in someone's
  // mailbox that was true when a spreadsheet was written and is not true when it is read.
  const proofLookup = await proofForDomain(campaign.domain);
  const allowFounderTier = body.allowFounderTier === true;
  if (!proofLookup.proven && !allowFounderTier && body.test !== true) {
    return NextResponse.json(
      {
        error: proofLookup.detail,
        code: `proof_${proofLookup.reason.replace(/-/g, '_')}`,
        hint: 'Send founder-tier copy with allowFounderTier:true — it makes no ranking claim.',
      },
      { status: 409 },
    );
  }

  // Unmailed only, so consecutive sends work THROUGH the list rather than re-picking its head.
  const prospects = await listProspectsByCampaign(campaignId, { unmailedOn: 'postcard' });
  if (prospects.length === 0) {
    return NextResponse.json(
      { error: 'Every prospect on this campaign has already been mailed a postcard.', code: 'all_mailed' },
      { status: 409 },
    );
  }
  const brand = await resolveCampaignBrand(campaign.org_id);
  const model = await buildPosterModel(campaign, prospects, {
    baseUrl: brand.baseUrl,
    brandName: brand.orgId ? brand.name : null,
    proof: proofLookup.proven ? proofLookup.proof : null,
  });
  if (!model) return NextResponse.json({ error: 'Campaign has no pitch site.' }, { status: 400 });

  // A concrete claim deadline (~2 weeks out) shared across this batch, so the printed
  // "Claim by {date}" matches what the operator sends today.
  const deadline = claimDeadlineLabel(14);

  // Live-test mode: mail exactly ONE real, personalized piece to the configured test
  // address instead of the prospects — validates render → Lob → webhook end to end.
  const isTest = body.test === true;
  const testTo = isTest ? await getTestRecipient() : null;
  if (isTest && !testTo) {
    return NextResponse.json(
      { error: 'No test address is configured. Set one under "Test address" first.', code: 'no_test_recipient' },
      { status: 400 },
    );
  }

  const results: Array<Record<string, unknown>> = [];
  const mailedIds: string[] = [];
  for (const p of prospects.slice(0, MAX_PIECES)) {
    // In test mode we override the destination with the test address (keeping the prospect's
    // name + personalized artwork so the card is realistic); otherwise use the prospect's.
    const to = isTest
      ? { name: p.business_name, line1: testTo!.line1, city: testTo!.city, state: testTo!.state, zip: testTo!.zip }
      : (() => {
          const a = parseUsAddress(p.address, p.city, p.region);
          return a ? { name: p.business_name, ...a } : null;
        })();
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
        to,
        frontHtml,
        backHtml,
        description: `${isTest ? '[TEST] ' : ''}Geo-competition ${campaign.domain}`,
        metadata: { campaign_id: campaign.id, prospect_id: p.id, ...(isTest ? { test: '1' } : {}) },
        // One piece per (campaign, prospect); a real send is idempotent, a test varies so
        // you can re-mail the same card to yourself.
        idempotencyKey: isTest ? `test_${campaign.id}_${p.id}_${Date.now()}` : `pc_${campaign.id}_${p.id}`,
      });
      mailedIds.push(p.id);
      // Persist the Lob id so the delivery webhook can advance this piece's status.
      try {
        await recordMailing({
          lobId: r.id,
          prospectId: p.id,
          campaignId: campaign.id,
          sentBy: operator.id,
          toName: to.name,
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
    if (isTest) break; // one piece is enough to validate the pipeline
  }
  // Only mark real prospects as mailed — a test send didn't reach them.
  if (!isTest && mailedIds.length) await markOutreachSent(mailedIds, 'postcard');

  return NextResponse.json({ ok: true, test: isTest, mailed: mailedIds.length, results });
}
