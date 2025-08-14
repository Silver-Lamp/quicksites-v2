import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const merchantId = url.searchParams.get('merchantId')!;
  const siteId = url.searchParams.get('siteId') || null;

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: acct } = await db.from('merchant_payment_accounts')
    .select('provider_account_id').eq('merchant_id', merchantId).eq('provider','stripe').maybeSingle();

  let platformFeeBps: number | null = null;
  if (siteId) {
    const { data: s } = await db.from('sites').select('platform_fee_bps').eq('id', siteId).maybeSingle();
    platformFeeBps = s?.platform_fee_bps ?? null;
  }
  if (platformFeeBps == null) {
    const { data: m } = await db.from('merchants').select('default_platform_fee_bps').eq('id', merchantId).single();
    platformFeeBps = m?.default_platform_fee_bps ?? 75;
  }

  return NextResponse.json({ stripeAccountId: acct?.provider_account_id ?? null, platformFeeBps });
}
