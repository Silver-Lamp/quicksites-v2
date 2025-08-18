// /app/api/orders/issue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime='nodejs'; export const dynamic='force-dynamic';

export async function POST(req: NextRequest) {
  const store = await cookies();
  const supa = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { orderId, orderItemId, category, message, photos, refundCents } = await req.json();
  if (!orderId || !category || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const { data: order } = await supa
    .from('orders')
    .select('id, merchant_id, user_id, payment_provider, stripe_payment_intent_id, square_payment_id, total_cents')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: mealLink } = orderItemId ? await supa
    .from('order_items').select('meal_id').eq('id', orderItemId).eq('order_id', orderId).maybeSingle() : { data: null };

  const t = await supa.from('support_tickets').insert({
    order_id: orderId, order_item_id: orderItemId || null,
    meal_id: mealLink?.meal_id || null,
    merchant_id: order.merchant_id, user_id: user.id,
    category, message, photos: Array.isArray(photos) ? photos.slice(0,6) : null,
    status: 'open'
  }).select('id').single();

  // Optional: auto-create a pending refund record (kept for triage)
  if (refundCents && refundCents > 0) {
    await supa.from('refunds').insert({
      order_id: orderId, order_item_id: orderItemId || null,
      merchant_id: order.merchant_id, user_id: user.id,
      reason: category, requested_cents: refundCents,
      status: 'pending',
      payment_provider: order.payment_provider,
      provider_payment_id: order.payment_provider === 'stripe' ? order.stripe_payment_intent_id : order.square_payment_id
    });
  }

  // Notify merchant/admin via your email_outbox if you like

  return NextResponse.json({ ok: true, ticketId: t.data?.id });
}
