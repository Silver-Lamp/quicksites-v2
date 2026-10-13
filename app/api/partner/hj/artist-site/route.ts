// app/api/partner/hj/artist-site/route.ts
//
// POST — HiveJournal hands QuickSites a Perfect Loops artist profile; we answer with a draft
// site and the claim link (crosstalk/contracts/artist-profile.md, AGREED 2026-10-13).
//
// Auth: `X-Partner-Id: hivejournal` + `X-Partner-Signature` = hex HMAC-SHA256 of the raw body
// with PARTNER_QUICKSITES_SECRET, constant-time. FAIL CLOSED: no secret configured → 503, never
// "accept anything". Even a verified partner gets a ceiling (a runaway loop on their side must
// not mint drafts), and the body is validated to the contract shape — in particular the embed
// URL must be HJ's own host, because it becomes an iframe src on a customer page.
//
// Idempotent on the artist slug: a second POST returns the existing draft and a fresh claim
// link rather than building a twin.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { resolveOperatorId } from '@/lib/outreach/defaultOperator';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { ArtistProfileSchema, buildArtistDraft, verifyPartnerSignature } from '@/lib/partners/artistSite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.PARTNER_QUICKSITES_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'receiver_not_configured' }, { status: 503 });

  const raw = await req.text();
  if (req.headers.get('x-partner-id') !== 'hivejournal' || !verifyPartnerSignature(raw, req.headers.get('x-partner-signature'), secret)) {
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 403 });
  }

  const limited = await rateLimitOr429(req, 'hj-artist-site', 30, 3600);
  if (limited) return limited;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = ArtistProfileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_profile', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
  }

  const operatorId = await resolveOperatorId();
  if (!operatorId) return NextResponse.json({ ok: false, error: 'no_operator' }, { status: 503 });

  try {
    const r = await buildArtistDraft(parsed.data, operatorId, publicBaseUrl());
    return NextResponse.json({ ok: true, ...r }, { status: r.existing ? 200 : 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'build_failed', detail: e instanceof Error ? e.message.slice(0, 200) : 'error' }, { status: 500 });
  }
}
