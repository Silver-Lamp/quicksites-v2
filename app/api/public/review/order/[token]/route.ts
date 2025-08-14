// /app/api/public/review/order/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime='nodejs'; export const dynamic='force-dynamic';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(_: NextRequest, { params }:{ params:{ token:string } }) {
  const { data: o } = await db
    .from('orders')
    .select('id, review_token_expires, merchants!inner(display_name, name), order_items ( id, meals ( id, title, slug ) )')
    .eq('review_token', params.token).maybeSingle();

  if (!o) {
    await db.from('review_token_events').insert({ token: params.token, action:'invalid' });
    return NextResponse.json({ error: 'invalid' }, { status: 404 });
  }
  if (o.review_token_expires && new Date(o.review_token_expires) < new Date()) {
    await db.from('review_token_events').insert({ token: params.token, order_id: o.id, action:'expired' });
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  await db.from('review_token_events').insert({ token: params.token, order_id: o.id, action:'visit' });

  const items = (o.order_items || []).map((it:any) => ({
    id: it.id, meal_id: it.meals.id, title: it.meals.title, slug: it.meals.slug
  }));

  return NextResponse.json({
    order: { id: o.id, merchant_name: o.merchants[0].display_name || o.merchants[0].name || 'Chef' },
    items
  });
}
