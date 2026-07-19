// app/api/porchhearth/orders/route.ts
//
// QS proxy over PorchHearth's proxy-authed MEAL order-create (crosstalk/contracts/
// neighborhood-meals-embed.md, LIVE). Meal orders DO take payment → the response carries a Stripe
// PaymentIntent clientSecret to confirm client-side (unlike the v1 rental booking). Browser posts
// here; we attach X-QS-Proxy-Secret + X-QS-Site-Ref server-side and forward. Fail-closed 503 until
// PORCHHEARTH_PROXY_SECRET is set. Buyer PII + payment stay PorchHearth-side.

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { createOrder, PorchHearthError } from '@/lib/porchhearth/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const numOr = (v: any): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'ph-orders', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const listingId = s(body.listingId);
  const portions = Number(body.portions);
  const buyer = body.buyer ?? {};
  const name = s(buyer.name);
  const email = s(buyer.email);
  const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : body.fulfillment === 'pickup' ? 'pickup' : undefined;

  if (!listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
  if (!Number.isFinite(portions) || portions < 1) {
    return NextResponse.json({ error: 'portions must be a positive integer' }, { status: 400 });
  }
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'buyer.name and a valid buyer.email are required' }, { status: 400 });
  }
  if (fulfillment === 'delivery' && !s(body.deliveryAddress)) {
    return NextResponse.json({ error: 'deliveryAddress is required for delivery' }, { status: 400 });
  }

  const siteRef = s(req.headers.get('x-qs-site-ref')) || s(body.siteRef);

  try {
    const result = await createOrder({
      listingId,
      portions,
      ...(fulfillment ? { fulfillment } : {}),
      ...(s(body.deliveryAddress) ? { deliveryAddress: s(body.deliveryAddress) } : {}),
      ...(numOr(body.deliveryLatitude) != null ? { deliveryLatitude: numOr(body.deliveryLatitude) } : {}),
      ...(numOr(body.deliveryLongitude) != null ? { deliveryLongitude: numOr(body.deliveryLongitude) } : {}),
      buyer: { name, email, ...(s(buyer.phone) ? { phone: s(buyer.phone) } : {}) },
      ...(siteRef ? { siteRef } : {}),
    });
    return NextResponse.json(result);
  } catch (e: any) {
    const status = e instanceof PorchHearthError ? e.status : 502;
    return NextResponse.json({ error: e?.message || 'Order request failed' }, { status });
  }
}
