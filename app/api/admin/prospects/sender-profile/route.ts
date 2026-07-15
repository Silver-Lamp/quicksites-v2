// app/api/admin/prospects/sender-profile/route.ts
//
// Read/set the operator's outreach sender identity — the human sign-off (name/title/headshot/
// signature), the "questions?" contact email, and the business city/state that powers the
// "local to me" signal. Stored in site_settings; admin-gated.
//   GET  -> { profile: SenderProfile, ready: boolean }
//   POST -> { name?, title?, email?, headshotUrl?, signatureUrl?, city?, state?, lat?, lng? }
//           (or { clear: true })

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import {
  getSenderProfile,
  setSenderProfile,
  senderProfileReady,
  type SenderProfileInput,
} from '@/lib/outreach/senderProfile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const profile = await getSenderProfile();
  return NextResponse.json({ ok: true, profile, ready: senderProfileReady(profile) });
}

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (body.clear) {
    await setSenderProfile(null, operator.id);
    const profile = await getSenderProfile();
    return NextResponse.json({ ok: true, profile, ready: senderProfileReady(profile) });
  }

  const input: SenderProfileInput = {
    name: body.name ?? null,
    title: body.title ?? null,
    email: body.email ?? null,
    headshotUrl: body.headshotUrl ?? null,
    signatureUrl: body.signatureUrl ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
  };
  try {
    await setSenderProfile(input, operator.id);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not save the sender profile.' }, { status: 400 });
  }
  const profile = await getSenderProfile();
  return NextResponse.json({ ok: true, profile, ready: senderProfileReady(profile) });
}
