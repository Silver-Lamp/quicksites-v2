import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Platform fee cap: 10% == 1000 bps (mirrors MAX_PLATFORM_FEE_PERCENT).
const MAX_FEE_BPS = 1000;

export async function POST(req: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { merchantId, siteId, platformFeeBps } = await req.json().catch(() => ({}));

  // Validate + clamp the fee so a bad/hostile payload can't set an out-of-policy rate.
  const bps = Number(platformFeeBps);
  if (!Number.isFinite(bps) || bps < 0) {
    return NextResponse.json({ error: 'platformFeeBps must be a non-negative number' }, { status: 400 });
  }
  const clamped = Math.min(Math.round(bps), MAX_FEE_BPS);

  if (!siteId && !merchantId) {
    return NextResponse.json({ error: 'siteId or merchantId is required' }, { status: 400 });
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!);

  const { error } = siteId
    ? await db.from('sites').update({ platform_fee_bps: clamped }).eq('id', siteId)
    : await db.from('merchants').update({ default_platform_fee_bps: clamped }).eq('id', merchantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, platformFeeBps: clamped });
}
