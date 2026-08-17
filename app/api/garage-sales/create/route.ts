// app/api/garage-sales/create/route.ts
//
// The front door. Create a yard sale page without a printed sticker.
//
// ⚠️ THIS IS THE ROUTE WHOSE ABSENCE MADE THE PRODUCT UNUSABLE BY STRANGERS. Until now the only
// way to have a sale page was to hold a physical sticker and claim its code, so anyone arriving
// at yardsalesites.com could look at other people's sales and do nothing.
//
// Guest-friendly on purpose (`allowAnonymous`). The same reasoning as guest build: someone
// deciding on Thursday to hold a sale on Saturday will not create an account first, and the sale
// page is worth something to them whether or not they ever do. The anonymous session owns the
// sale and upgrades in place if they sign up later — same uid, so `owner_id` still matches.
//
// Rate-limited per IP because it mints a short public code and writes two rows: unthrottled, it
// is a way to exhaust readable codes and fill a public directory with noise.

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { createSelfServeSale } from '@/lib/garageSales/createSale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 6 sales per IP per hour: generous for a household, useless for filling a directory.
  const limited = await rateLimitOr429(req, 'garage-sale-create', 6, 60 * 60);
  if (limited) return limited;

  const gate = await requireUser({ allowAnonymous: true });
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const res = await createSelfServeSale({
    ownerId: gate.user.id,
    title: String(body?.title ?? ''),
    description: body?.description ?? null,
    addressLine: body?.addressLine ?? null,
    blockLabel: body?.blockLabel ?? null,
    city: body?.city ?? null,
    state: body?.state ?? null,
    postalCode: body?.postalCode ?? null,
    startsAt: String(body?.startsAt ?? ''),
    endsAt: String(body?.endsAt ?? ''),
    paymentHandles: body?.paymentHandles ?? null,
    listed: body?.listed,
  });

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  // Return the code, not just an id: the code IS the shareable thing — /s/<code>, the QR, and
  // the printable signs all key on it.
  return NextResponse.json({ ok: true, code: res.code, saleId: res.saleId, path: `/s/${res.code}` });
}
