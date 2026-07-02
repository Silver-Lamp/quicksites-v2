// app/api/referrals/create-code/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/requireUser';

export async function POST(req: NextRequest) {
  // Require a signed-in user. A platform admin may mint a code for any owner; a
  // normal user (rep) may only create one owned by themselves — the owner was
  // previously taken from the request body on trust.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const body = await req.json();
  const supabase = await getServerSupabase({ serviceRole: true });

  const { code, ownerType, ownerId, plan } = body || {};
  if (!code || !ownerType || !ownerId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (ownerId !== gate.user.id) {
    const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', gate.user.id).maybeSingle();
    if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('referral_codes').upsert({
    code, owner_type: ownerType, owner_id: ownerId, plan
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
