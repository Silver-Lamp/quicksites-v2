import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { PARTNER_FEE_SHARE, RESIDUAL_MONTHS, MAX_PLATFORM_FEE_PERCENT } from '@/lib/commerce/partner-terms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/partners/join — self-serve: the logged-in user becomes a partner.
 * Creates a referral_code they own (idempotent — returns the existing one). The
 * code's `plan` snapshots the current offer terms. Share `?ref=<code>` to attribute
 * merchants; residuals accrue to this code in commission_ledger.
 */
export async function POST() {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const admin = await getServerSupabase({ serviceRole: true });

  // Already a partner?
  const { data: existing } = await admin
    .from('referral_codes')
    .select('code')
    .eq('owner_type', 'provider_rep')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle();
  if (existing?.code) return NextResponse.json({ code: existing.code, existing: true });

  // Generate a unique, friendly code from the email handle.
  const base = (user.email?.split('@')[0] || 'partner').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'partner';
  let code = base;
  for (let i = 0; i < 8; i++) {
    const cand = i === 0 ? base : `${base}${Math.random().toString(36).slice(2, 5)}`;
    const { data: clash } = await admin.from('referral_codes').select('code').eq('code', cand).maybeSingle();
    if (!clash) {
      code = cand;
      break;
    }
  }

  const plan = {
    type: 'order_fee_share',
    partner_share: PARTNER_FEE_SHARE,
    max_platform_fee_percent: MAX_PLATFORM_FEE_PERCENT,
    residual_months: RESIDUAL_MONTHS, // 0 = lifetime
  };

  const { error } = await admin
    .from('referral_codes')
    .insert({ code, owner_type: 'provider_rep', owner_id: user.id, plan });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ code, existing: false });
}
