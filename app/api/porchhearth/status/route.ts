// app/api/porchhearth/status/route.ts
//
// A SAFE health check for the PorchHearth seam: reports whether the mutating proxy secret is
// configured — a BOOLEAN ONLY, never the secret value. Lets us verify a prod deploy actually
// picked up PORCHHEARTH_PROXY_SECRET WITHOUT POSTing a real order/booking (which would hit the
// engine and, in Stripe LIVE mode, be a real charge). Reads no user data; public + harmless.

import { NextResponse } from 'next/server';
import { PORCHHEARTH_BASE_URL, porchhearthMutatingEnabled } from '@/lib/porchhearth/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    baseUrl: PORCHHEARTH_BASE_URL,
    reads: 'public',
    // true = PORCHHEARTH_PROXY_SECRET is present in this deployment (bookings/orders can proxy).
    mutatingEnabled: porchhearthMutatingEnabled(),
  });
}
