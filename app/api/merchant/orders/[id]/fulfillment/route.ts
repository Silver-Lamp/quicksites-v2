// app/api/merchant/orders/[id]/fulfillment/route.ts
//
// Move an order through the kitchen. Owner-gated.
//
// ⚠️ THE MERCHANT IS DERIVED FROM THE ORDER, NOT FROM THE REQUEST. The body carries only the target
// status; `merchant_id` is read off the order row and passed to requireMerchantOwner. A body-supplied
// merchant id would let any signed-in user name a merchant they own and move somebody else's ticket
// — the same shape as the open-relay bug in send-contact-email (#268).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireMerchantOwner } from '@/lib/auth/requireUser';
import { isFulfillmentStatus, transitionPatch, FULFILLMENT_STATES } from '@/lib/commerce/fulfillment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body → invalid status below */
  }

  const to = body?.status;
  if (!isFulfillmentStatus(to)) {
    // Names the valid set: a kitchen tablet failing at 7pm should say what it wanted.
    return NextResponse.json(
      { error: `status must be one of: ${FULFILLMENT_STATES.join(', ')}` },
      { status: 400 },
    );
  }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, merchant_id, fulfillment_status')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!order.merchant_id) {
    return NextResponse.json({ error: 'Order has no merchant' }, { status: 409 });
  }

  const gate = await requireMerchantOwner(order.merchant_id);
  if (gate instanceof NextResponse) return gate;

  const patch = transitionPatch(to, new Date().toISOString());
  const { data: updated, error } = await supabaseAdmin
    .from('orders')
    .update(patch)
    .eq('id', id)
    .select('id, fulfillment_status, accepted_at, ready_at, completed_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    order: updated,
    // Echo what it was, so a double-tap on a laggy tablet is legible in the response rather than
    // looking like the first tap did nothing.
    previous: order.fulfillment_status ?? 'new',
  });
}
