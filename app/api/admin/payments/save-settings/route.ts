import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { merchantId, siteId, platformFeeBps } = await req.json();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (siteId) {
    await db.from('sites').update({ platform_fee_bps: platformFeeBps }).eq('id', siteId);
  } else {
    await db.from('merchants').update({ default_platform_fee_bps: platformFeeBps }).eq('id', merchantId);
  }
  return NextResponse.json({ ok: true });
}
