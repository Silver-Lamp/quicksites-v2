import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code')?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const { data: c } = await db
    .from('coupons')
    .select('id, merchant_id, percent, amount_cents, type, min_subtotal_cents, currency, expires_at, status, uses_count, uses_allowed, merchants!inner(id, display_name, name)')
    .eq('code', code)
    .maybeSingle();

  if (!c) return NextResponse.json({ found: false }, { status: 200 });

  return NextResponse.json({
    found: true,
    coupon: {
      merchant_id: c.merchant_id,
      merchant_name: c.merchants[0]?.display_name || c.merchants[0]?.name || 'Chef',
      type: c.type,
      percent: c.percent,
      amount_cents: c.amount_cents,
      min_subtotal_cents: c.min_subtotal_cents,
      currency: c.currency,
      expires_at: c.expires_at,
      status: c.status,
      remaining_uses: Math.max(0, (c.uses_allowed || 1) - (c.uses_count || 0)),
    }
  });
}
