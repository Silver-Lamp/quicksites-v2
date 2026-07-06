import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';
import { PARTNER_FEE_SHARE, RESIDUAL_MONTHS, MAX_PLATFORM_FEE_PERCENT, clampOverrideShare } from '@/lib/commerce/partner-terms';

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

  // Hub recruit: if they arrived via a hub's link (?hub=<code> → qs_hub cookie) and
  // that code is a valid, different code with a default override rate, link this new
  // reseller to it so the hub earns a lifetime override on their orders. Best-effort.
  let hub: string | null = null;
  try {
    const hubCode = (await cookies()).get('qs_hub')?.value?.trim();
    if (hubCode && hubCode !== code) {
      // types/supabase.ts is stale for the new hub columns — use the untyped client.
      const db = admin as any;
      const { data: hubRow } = await db
        .from('referral_codes')
        .select('code, default_override_share')
        .eq('code', hubCode)
        .maybeSingle();
      const rate = clampOverrideShare(Number(hubRow?.default_override_share));
      if (hubRow?.code && rate > 0) {
        await db.from('referral_codes').update({ parent_code: hubRow.code, override_share: rate }).eq('code', code);
        hub = hubRow.code as string;
      }
    }
  } catch { /* recruit linking is a nicety — never fail the join over it */ }

  return NextResponse.json({ code, existing: false, ...(hub ? { hub } : {}) });
}
