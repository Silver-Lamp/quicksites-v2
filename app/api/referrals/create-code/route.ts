// app/api/referrals/create-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = await getServerSupabase({ serviceRole: true });

  const { code, ownerType, ownerId, plan } = body || {};
  if (!code || !ownerType || !ownerId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const { error } = await supabase.from('referral_codes').upsert({
    code, owner_type: ownerType, owner_id: ownerId, plan
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
