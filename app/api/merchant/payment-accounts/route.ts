import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { merchantId, provider, accountRef } = await req.json();
  if (!merchantId || !provider) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  const supabase = await getServerSupabase(); // regular session; RLS checks owner
  const { error } = await supabase.from('payment_accounts').upsert({
    merchant_id: merchantId,
    provider,
    account_ref: accountRef,
    status: 'active',
  }, { onConflict: 'merchant_id,provider' });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
