import { NextRequest, NextResponse } from 'next/server';
import { StripeProvider } from '@/lib/payments/stripe';
import { createClient } from '@supabase/supabase-js';
import { makeToken } from '@/lib/review-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function ensureOrderReviewToken(orderId: string) {
  const { data: o } = await supabase.from('orders').select('id, review_token').eq('id', orderId).maybeSingle();
  if (o?.review_token) return o.review_token;

  let token = makeToken();
  for (let i=0;i<6;i++) {
    const { data: clash } = await supabase.from('orders').select('id').eq('review_token', token).maybeSingle();
    if (!clash) break; token = makeToken();
  }
  const exp = new Date(Date.now() + 60*24*3600e3).toISOString(); // 60 days
  await supabase.from('orders').update({
    review_token: token,
    review_token_issued_at: new Date().toISOString(),
    review_token_expires: exp
  }).eq('id', orderId);
  return token;
}

async function applyInventoryDecrements(orderId: string, quantity: number) {
    // Read order with lock-ish behavior via row status check
    const { data: order } = await supabase.from('orders')
      .select('id, status, inventory_applied')
      .eq('id', orderId).single();
    if (!order) return;
    if (order.inventory_applied) return; // already applied
  
    // Only decrement if paid
    if (order.status !== 'paid') return;
  
    // Get items
    const { data: items } = await supabase.from('order_items')
      .select('meal_id, quantity')
      .eq('order_id', orderId);
  
    if (!items || !items.length) {
      // Mark applied anyway to avoid retry loops
      await supabase.from('orders').update({ inventory_applied: true }).eq('id', orderId);
      return;
    }
  
    // Decrement each meal's qty_available if not null
    for (const it of items) {
        await supabase.rpc('dec_meal_qty', { _meal: it.meal_id, _by: quantity });

        //   await supabase.from('meals')
        //      .update({ qty_available: supabase.rpc as any }) // TS silence — we’ll use SQL style update below instead
        //   }
    }
  
  // Better: do decrements with one SQL statement per item
//   async function decrementMealQty(mealId: string, by: number) {
//     // qty_available = GREATEST(qty_available - by, 0) when not null
//     const { error } = await supabase
//       .from('meals')
//       .update({})
//       .eq('id', mealId)
//       .neq('qty_available', null); // will modify below via raw SQL
  
//     // Supabase client can't express arithmetic easily in update(); use RPC instead in production.
//     // For portability in this snippet, we fall back to a single-row select + update:
//     const { data: m } = await supabase.from('meals').select('qty_available').eq('id', mealId).maybeSingle();
//     if (m && m.qty_available != null) {
//       const next = Math.max(0, (m.qty_available as number) - by);
//       await supabase.from('meals').update({ qty_available: next }).eq('id', mealId);
//     }
//   }
  
}
  export async function POST(req: NextRequest) {
    try {
      const raw = Buffer.from(await req.arrayBuffer());
      const headers = Object.fromEntries(req.headers.entries());
      const results = await StripeProvider.handleWebhook(raw, headers);
  
      for (const r of results) {
        if (!r.orderId) continue;
  
        // Update order status as before
        if (r.newStatus) {
          await supabase.from('orders').update({
            status: r.newStatus,
            provider_payment_id: r.providerPaymentId,
            raw: r.raw
          }).eq('id', r.orderId);
        }
  
        // If paid: decrement inventory once
        if (r.newStatus === 'paid') {
          // Re-read items and apply decrements once
          const { data: order } = await supabase.from('orders')
            .select('id, status, inventory_applied')
            .eq('id', r.orderId).single();
  
            if (order && order.status === 'paid' && !order.inventory_applied) {
                const { data: items } = await supabase
                  .from('order_items')
                  .select('meal_id, quantity')
                  .eq('order_id', r.orderId);
              
                if (items?.length) {
                  for (const it of items) {
                    await supabase.rpc('dec_meal_qty', { _meal: it.meal_id, _by: it.quantity });
                  }
                }
                await supabase.from('orders').update({ inventory_applied: true }).eq('id', r.orderId);
              }
        }
      }
      return new NextResponse(null, { status: 200 });
    } catch (e:any) {
      console.error('Stripe webhook error', e);
      return new NextResponse(`Webhook error: ${e.message}`, { status: 400 });
    }
  }
