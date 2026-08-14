// app/api/garage-sales/activate/route.ts
//
// Claim a sticker and create the sale behind it.
//
// Anonymous sessions are allowed. A garage sale is decided on Friday night and run on Saturday
// morning; making someone create an account before they can put a price on a lamp would lose most
// of them at the one moment the product has their attention. The anon user owns the row and can
// upgrade in place later (same mechanism as guest build), so nothing is lost by starting fast.
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeCode, isPlausibleCode } from '@/lib/garageSales/codes';
import { normalizeHandle } from '@/lib/garageSales/payLinks';
import { blockLabelFor } from '@/lib/garageSales/address';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Per-IP throttle: the code is a bearer secret, so an unthrottled endpoint is a place to
  // guess codes. 6 chars of a 30-letter alphabet is ~5.9e8, which is only safe while guessing
  // is slow.
  const limited = await rateLimitOr429(req, 'garage_sale_activate', 20, 3600);
  if (limited) return limited;

  const gate = await requireUser({ allowAnonymous: true });
  if (gate instanceof NextResponse) return gate;
  const userId = gate.user.id;

  const body = await req.json().catch(() => ({}) as any);
  const code = normalizeCode(String(body?.code ?? ''));
  if (!isPlausibleCode(code)) {
    return NextResponse.json({ error: 'That code doesn’t look right — check the sticker.' }, { status: 400 });
  }

  const title = String(body?.title ?? '').trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: 'Give the sale a name.' }, { status: 400 });

  const startsAt = new Date(String(body?.startsAt ?? ''));
  const endsAt = new Date(String(body?.endsAt ?? ''));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return NextResponse.json({ error: 'Add a start and end time for the sale.' }, { status: 400 });
  }

  const addressLine = String(body?.addressLine ?? '').trim().slice(0, 200) || null;
  const precision = body?.addressPrecision === 'exact' ? 'exact' : 'block';

  const handles = {
    venmo: normalizeHandle('venmo', body?.handles?.venmo),
    cashapp: normalizeHandle('cashapp', body?.handles?.cashapp),
    paypal: normalizeHandle('paypal', body?.handles?.paypal),
  };

  // ⚠️ Claim the sticker with a CONDITIONAL update, not a read-then-write. Two people scanning
  // the same sticker within a second of each other must not both get a sale: the update only
  // matches while claimed_at is still null, so the loser gets 0 rows and a clear message rather
  // than silently taking over someone else's sticker.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from('garage_sale_stickers')
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq('code', code)
    .is('claimed_at', null)
    .select('code')
    .maybeSingle();

  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  if (!claimed) {
    // Either the code doesn't exist or somebody already claimed it. Deliberately the same
    // message: distinguishing them tells a guesser which codes are real.
    return NextResponse.json(
      { error: 'That sticker is already in use, or the code doesn’t match one of ours.' },
      { status: 409 },
    );
  }

  const { data: sale, error } = await supabaseAdmin
    .from('garage_sales')
    .insert({
      sticker_code: code,
      owner_id: userId,
      title,
      description: String(body?.description ?? '').trim().slice(0, 600) || null,
      address_line: addressLine,
      block_label: blockLabelFor(addressLine),
      city: String(body?.city ?? '').trim().slice(0, 80) || null,
      state: String(body?.state ?? '').trim().slice(0, 40) || null,
      postal_code: String(body?.postalCode ?? '').trim().slice(0, 20) || null,
      lat: Number.isFinite(Number(body?.lat)) ? Number(body.lat) : null,
      lng: Number.isFinite(Number(body?.lng)) ? Number(body.lng) : null,
      address_precision: precision,
      // Block-level until the sale starts. Set explicitly rather than left null so the intent is
      // legible in the row itself.
      address_public_from: precision === 'exact' ? null : startsAt.toISOString(),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      payment_handles: handles,
    })
    .select('id')
    .single();

  if (error) {
    // Roll the claim back so the sticker isn't burned by a failed insert — otherwise a transient
    // error turns a physical object in someone's hand into a permanently dead one.
    await supabaseAdmin
      .from('garage_sale_stickers')
      .update({ claimed_by: null, claimed_at: null })
      .eq('code', code);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: sale.id, code });
}
