import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSupabaseClient } from '@/lib/supabase/serverClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(req.url);
  const siteId = url.searchParams.get('siteId');

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!merchant) return NextResponse.json({ meals: [] });

  let q = supabase.from('meals')
    .select('id, title, price_cents, is_active, qty_available, max_per_order, created_at, site_id, cuisines')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (siteId) q = q.eq('site_id', siteId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meals: data ?? [] });
}
