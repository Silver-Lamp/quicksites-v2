// app/api/admin/prospects/mail-evolve-postcards/route.ts
//
// The Evolve postcard for restaurants with a site and no online ordering (lib/outreach/
// evolvePostcardSend.ts): GET counts what could go out and why some cannot; POST previews
// (first three cards' HTML), test-mails one card to the operator's own address, or mails for
// real. Admin-gated; real sends double-gated (LOB_* + POSTCARD_MAIL_ENABLED) because they spend.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { lobConfigured, postcardMailEnabled, MAX_POSTCARD_PIECES_PER_SEND } from '@/lib/outreach/mail/lob';
import { getSenderProfile, senderProfileReady } from '@/lib/outreach/senderProfile';
import { selectEvolveMailable, sendEvolvePostcards, renderEvolvePostcardFor } from '@/lib/outreach/evolvePostcardSend';
import { loadCardResponse } from '@/lib/outreach/cardResponseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function filters(body: any) {
  return {
    city: typeof body?.city === 'string' && body.city.trim() ? body.city.trim() : null,
    region: typeof body?.region === 'string' && body.region.trim() ? body.region.trim() : null,
  };
}

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const drafts = await selectEvolveMailable({ city: url.searchParams.get('city'), region: url.searchParams.get('region') });
  const blocked: Record<string, number> = {};
  for (const d of drafts) if (d.blocked) blocked[d.blocked] = (blocked[d.blocked] ?? 0) + 1;
  // The Evolve card's own funnel (mailed → arrived → scanned → claimed), the same numbers the ops
  // dashboard shows, so the page you mail from is the page you read the response on.
  const funnel = await loadCardResponse(undefined, 'evolve');
  return NextResponse.json({
    ok: true,
    funnel,
    mailable: drafts.filter((d) => !d.blocked).map((d) => ({ prospectId: d.prospect.id, businessName: d.prospect.business_name })),
    blocked,
    blockedRows: drafts.filter((d) => d.blocked).map((d) => ({ prospectId: d.prospect.id, businessName: d.prospect.business_name, reason: d.blocked })),
    lobConfigured: lobConfigured(),
    mailEnabled: postcardMailEnabled(),
    senderReady: senderProfileReady(await getSenderProfile()),
  });
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  let drafts = await selectEvolveMailable({ ...filters(body), limit: 200 });
  const only: string[] = Array.isArray(body.prospectIds) ? body.prospectIds.map(String) : [];
  if (only.length) drafts = drafts.filter((d) => only.includes(d.prospect.id));

  if (body.preview === true) {
    const first = drafts.filter((d) => !d.blocked).slice(0, 3);
    const cards = [];
    for (const d of first) {
      const { frontHtml, backHtml } = await renderEvolvePostcardFor(d);
      cards.push({ prospectId: d.prospect.id, businessName: d.prospect.business_name, evolveUrl: d.evolveUrl, frontHtml, backHtml });
    }
    return NextResponse.json({
      ok: true,
      mailable: drafts.filter((d) => !d.blocked).length,
      blocked: drafts.filter((d) => d.blocked).map((d) => ({ prospectId: d.prospect.id, businessName: d.prospect.business_name, reason: d.blocked })),
      cards,
    });
  }

  if (!lobConfigured()) return NextResponse.json({ error: 'Lob is not configured (LOB_API_KEY + LOB_FROM_* required).', code: 'not_configured' }, { status: 501 });
  if (!postcardMailEnabled()) return NextResponse.json({ error: 'Postcard mail is disabled. Set POSTCARD_MAIL_ENABLED=1 to send.', code: 'disabled' }, { status: 403 });

  const isTest = body.test === true;
  const max = Math.min(Number(body.limit) || MAX_POSTCARD_PIECES_PER_SEND, MAX_POSTCARD_PIECES_PER_SEND);
  const report = await sendEvolvePostcards({ drafts, sentBy: admin.id, test: isTest, max });
  if (report.reason) {
    const status = report.reason === 'sender_profile_incomplete' || report.reason === 'no_test_recipient' ? 409 : 403;
    return NextResponse.json({ error: report.reason, code: report.reason }, { status });
  }
  return NextResponse.json({ ok: true, test: isTest, ...report });
}
