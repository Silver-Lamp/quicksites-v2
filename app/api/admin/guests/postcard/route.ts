// app/api/admin/guests/postcard/route.ts
//
// Mail ONE apology postcard to ONE guest builder, at an address the operator typed or confirmed.
// Admin-gated; spends postage. There is deliberately no bulk form of this: a guest site records
// no city, so every address here is a person's judgement, and a card to the wrong "Joe's
// Bakery" is the invented-menu class with a stamp on it.
//
//   POST { templateId, to: { name, line1, line2?, city, state, zip }, preview?: true, test?: true }
//   → preview: { frontHtml, backHtml }   test: mails to the configured test address
//   → { ok, lobId, expectedDelivery, thumbnailUrl }
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSenderProfile, senderProfileReady } from '@/lib/outreach/senderProfile';
import { sendPostcard, lobConfigured, postcardMailEnabled, lobKeyIsTest, clampLobField, LOB_LIMITS } from '@/lib/outreach/mail/lob';
import { recordMailing } from '@/lib/outreach/mail/mailings';
import { getTestRecipient } from '@/lib/outreach/mail/testRecipient';
import { preflightSiteUrl } from '@/lib/outreach/claimPostcardSend';
import { publicSiteUrl } from '@/lib/sites/publicUrl';
import { printableSlug, type BaseSlugRow } from '@/lib/sites/baseSlug';
import { buildGuestApologyModel, renderGuestApologyFront, renderGuestApologyBack } from '@/lib/outreach/guestApologyCard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type To = { name: string; line1: string; line2?: string | null; city: string; state: string; zip: string };

function parseTo(raw: any): To | null {
  const s = (v: unknown) => String(v ?? '').trim();
  const to = { name: s(raw?.name), line1: s(raw?.line1), line2: s(raw?.line2) || null, city: s(raw?.city), state: s(raw?.state).toUpperCase(), zip: s(raw?.zip) };
  if (!to.name || !to.line1 || !to.city || !/^[A-Z]{2}$/.test(to.state) || !/^\d{5}(-\d{4})?$/.test(to.zip)) return null;
  return to;
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const templateId = String(body?.templateId ?? '').trim();
  if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });

  const { data: t } = await (supabaseAdmin as any)
    .from('templates')
    .select('id, slug, base_slug, business_name, template_name, published, custom_domain, claim_source, created_at')
    .eq('id', templateId)
    .maybeSingle();
  if (!t || t.claim_source !== 'guest_build') return NextResponse.json({ error: 'Not a guest-built site.' }, { status: 404 });

  const { data: sibs } = await (supabaseAdmin as any).from('templates').select('id, slug, base_slug, business_name, published, created_at').eq('base_slug', t.base_slug ?? '__none__');
  const siteUrl = publicSiteUrl({ custom_domain: t.custom_domain, slug: printableSlug(t as BaseSlugRow, (sibs ?? []) as BaseSlugRow[]) });
  if (!siteUrl) return NextResponse.json({ error: 'The site has no public address.' }, { status: 409 });

  const senderProfile = await getSenderProfile();
  const businessName = String(t.business_name || t.template_name || t.slug);
  const model = await buildGuestApologyModel({ templateId: t.id, businessName, siteUrl, senderProfile });
  const frontHtml = renderGuestApologyFront(model);
  const backHtml = renderGuestApologyBack(model);
  if (body?.preview === true) return NextResponse.json({ ok: true, frontHtml, backHtml, siteUrl, claimUrl: model.claimUrl });

  if (!lobConfigured()) return NextResponse.json({ error: 'Lob is not configured.', code: 'not_configured' }, { status: 501 });
  if (!postcardMailEnabled()) return NextResponse.json({ error: 'Postcard mail is disabled (POSTCARD_MAIL_ENABLED).', code: 'disabled' }, { status: 403 });
  if (!senderProfileReady(senderProfile)) return NextResponse.json({ error: 'Set the sender profile (name + email) first.', code: 'sender_profile_incomplete' }, { status: 409 });
  const isTest = body?.test === true;
  if (!isTest && lobKeyIsTest()) return NextResponse.json({ error: 'LOB_API_KEY is a test key — a real card cannot be sent.', code: 'lob_test_key' }, { status: 409 });

  let to: To | null;
  if (isTest) {
    const tr = await getTestRecipient();
    if (!tr) return NextResponse.json({ error: 'No test recipient configured.', code: 'no_test_recipient' }, { status: 409 });
    to = { name: businessName, line1: tr.line1, line2: tr.line2 ?? null, city: tr.city, state: tr.state, zip: tr.zip };
  } else {
    to = parseTo(body?.to);
    if (!to) return NextResponse.json({ error: 'A full US address is required: name, line1, city, 2-letter state, 5-digit zip.' }, { status: 400 });
  }

  // The printed address must answer before a card is printed — same rule as the claim card.
  const live = await preflightSiteUrl(siteUrl);
  if (!live.ok) return NextResponse.json({ error: `The site did not answer (${live.status}${live.detail ? ` ${live.detail}` : ''}); nothing mailed.`, code: 'site_not_reachable' }, { status: 409 });

  try {
    const r = await sendPostcard({
      to: { name: clampLobField(to.name, LOB_LIMITS.name), line1: to.line1, city: to.city, state: to.state, zip: to.zip },
      frontHtml,
      backHtml,
      description: `${isTest ? '[TEST] ' : ''}Guest apology card ${t.slug}`,
      metadata: { template_id: t.id, kind: 'guest_apology', ...(isTest ? { test: '1' } : {}) },
      idempotencyKey: isTest ? `test_guest_${t.id}_${Date.now()}` : `guest_apology_${t.id}`,
    });
    try {
      await recordMailing({ lobId: r.id, prospectId: null, campaignId: null, sentBy: admin.id, toName: to.name, toAddress: `${to.line1}, ${to.city}, ${to.state} ${to.zip}`, expectedDeliveryDate: r.expectedDeliveryDate, carrier: r.carrier, trackingNumber: r.trackingNumber, thumbnailUrl: r.thumbnailUrl, pdfUrl: r.pdfUrl });
    } catch { /* tracking is best-effort */ }
    return NextResponse.json({ ok: true, test: isTest, lobId: r.id, expectedDelivery: r.expectedDeliveryDate ?? null, thumbnailUrl: r.thumbnailUrl ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Lob refused the card.' }, { status: 502 });
  }
}
