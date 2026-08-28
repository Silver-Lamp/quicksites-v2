// app/api/admin/splits/assign/route.ts
//
// Credit a geo-domain rental to a closer's referral code and, optionally, a manager's.
// Admin-only: this decides who gets paid.
//
// The override RATE is not accepted from the client — it is derived from the closer's
// referral_codes.parent_code when commissions are written. A caller cannot talk a rep into
// 25% by posting a flag.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeCode } from '@/lib/referrals/codes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanCode(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const c = normalizeCode(v);
  return c || null;
}

/** Codes must already exist — the FK would reject anyway, with a worse error. */
async function assertCodesExist(codes: string[]): Promise<string | null> {
  if (!codes.length) return null;
  const { data } = await supabaseAdmin.from('referral_codes').select('code').in('code', codes);
  const found = new Set(((data ?? []) as any[]).map((r) => r.code));
  const missing = codes.filter((c) => !found.has(c));
  if (!missing.length) return null;
  return `No referral code named ${missing.map((m) => `"${m}"`).join(' or ')}. Mint it in Referral Codes first — a code can exist before the person has an account.`;
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const campaignId = String(body.campaignId ?? '');
  if (!campaignId)
    return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });

  const soldByCode = cleanCode(body.soldByCode);
  // A manager with nobody to manage cannot earn an override.
  const managerCode = soldByCode ? cleanCode(body.managerCode) : null;

  if (soldByCode && managerCode && soldByCode === managerCode) {
    return NextResponse.json(
      {
        error:
          'The closer and the manager cannot be the same code — a rep does not pay themselves an override on their own sale.',
      },
      { status: 400 }
    );
  }

  const missing = await assertCodesExist([soldByCode, managerCode].filter(Boolean) as string[]);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({
      sold_by_code: soldByCode,
      manager_code: managerCode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    assignment: { sold_by_code: soldByCode, manager_code: managerCode },
  });
}
