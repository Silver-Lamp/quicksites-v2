// app/api/porchhearth/bookings/route.ts
//
// QS proxy over PorchHearth's proxy-authed rental booking-create (crosstalk/contracts/
// neighborhood-stay-embed.md, LIVE). The browser posts an inquiry HERE; we attach the shared
// X-QS-Proxy-Secret server-side and forward. v1 = a no-charge PENDING inquiry (payment:null) — the
// neighborhood_stay CTA stays "inquire" until PorchHearth wires the rental PaymentIntent.
//
// Fail-closed: 503 until PORCHHEARTH_PROXY_SECRET is provisioned. Buyer PII + payment live on
// PorchHearth's side — QS never stores card data or cook/host PII.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { createBooking, PorchHearthError } from '@/lib/porchhearth/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'ph-bookings', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const propertyId = s(body.propertyId);
  const checkInDate = s(body.checkInDate);
  const checkOutDate = s(body.checkOutDate);
  const numberOfGuests = Number(body.numberOfGuests);
  const buyer = body.buyer ?? {};
  const name = s(buyer.name);
  const email = s(buyer.email);

  if (!propertyId || !checkInDate || !checkOutDate) {
    return NextResponse.json({ error: 'propertyId, checkInDate and checkOutDate are required' }, { status: 400 });
  }
  if (!Number.isFinite(numberOfGuests) || numberOfGuests < 1) {
    return NextResponse.json({ error: 'numberOfGuests must be a positive number' }, { status: 400 });
  }
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'buyer.name and a valid buyer.email are required' }, { status: 400 });
  }

  try {
    const result = await createBooking({
      propertyId,
      checkInDate,
      checkOutDate,
      numberOfGuests,
      buyer: { name, email, ...(s(buyer.phone) ? { phone: s(buyer.phone) } : {}) },
      ...(s(body.guestNotes) ? { guestNotes: s(body.guestNotes) } : {}),
      // site_ref: prefer the header the site sets, else a body field.
      ...((s(req.headers.get('x-qs-site-ref')) || s(body.siteRef))
        ? { siteRef: s(req.headers.get('x-qs-site-ref')) || s(body.siteRef) }
        : {}),
    });
    return NextResponse.json(result);
  } catch (e: any) {
    // Includes 503 (secret unset), 409 (existing account → sign in), 400 (validation) from the engine.
    const status = e instanceof PorchHearthError ? e.status : 502;
    return NextResponse.json({ error: e?.message || 'Booking request failed' }, { status });
  }
}
