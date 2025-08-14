import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const merchantId = url.searchParams.get('merchantId');
  const siteId = url.searchParams.get('siteId');
  const limit = parseInt(url.searchParams.get('limit') || '25', 10);

  if (!merchantId) return NextResponse.json({ error: 'merchantId required' }, { status: 400 });

  let q = db.from('orders')
    .select('id, amount_cents, currency, status, provider_payment_id, created_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (siteId) q = q.eq('site_id', siteId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [] });
}
