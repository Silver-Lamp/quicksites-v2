// app/api/admin/referrals/set-hub/route.ts
//
// Configure a "hub" override: link a reseller's referral code to an upline hub code
// and set the hub's cut (out of QuickSites' share). Per-hub configurable — set the
// same overrideShare across a hub's resellers, or vary it per relationship.
//
//   POST { code, parentCode, overrideShare }   // overrideShare e.g. 0.05 = 5%
//   POST { code, parentCode: null }             // unlink (clears the override)
//
// Admin-gated. markOrderPaid then credits parentCode a hubOverrideCents cut on every
// paid order the reseller's merchants process, lifetime; runPayouts pays the hub.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { clampOverrideShare, QS_FEE_SHARE } from '@/lib/commerce/partner-terms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }); }

  const code = String(body?.code || '').trim();
  const parentCode = body?.parentCode == null ? null : String(body.parentCode).trim();
  if (!code) return NextResponse.json({ error: 'code (the reseller code) is required.' }, { status: 400 });
  if (parentCode && parentCode === code) {
    return NextResponse.json({ error: 'A code cannot be its own hub.' }, { status: 400 });
  }

  const db = admin();

  // The reseller code must exist.
  const { data: reseller } = await db.from('referral_codes').select('code').eq('code', code).maybeSingle();
  if (!reseller) return NextResponse.json({ error: `Referral code "${code}" not found.` }, { status: 404 });

  // Unlink: clear the override.
  if (!parentCode) {
    const { error } = await db.from('referral_codes').update({ parent_code: null, override_share: 0 }).eq('code', code);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, code, parentCode: null, overrideShare: 0 });
  }

  // The hub code must exist too.
  const { data: hub } = await db.from('referral_codes').select('code').eq('code', parentCode).maybeSingle();
  if (!hub) return NextResponse.json({ error: `Hub code "${parentCode}" not found.` }, { status: 404 });

  const overrideShare = clampOverrideShare(Number(body?.overrideShare));
  const { error } = await db
    .from('referral_codes')
    .update({ parent_code: parentCode, override_share: overrideShare })
    .eq('code', code);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    code,
    parentCode,
    overrideShare,
    note:
      overrideShare < Number(body?.overrideShare)
        ? `Clamped to the max ${Math.round(QS_FEE_SHARE * 100)}% (the override comes out of QuickSites' share).`
        : `${parentCode} now earns ${(overrideShare * 100).toFixed(1)}% of ${code}'s order fees, lifetime.`,
  });
}
