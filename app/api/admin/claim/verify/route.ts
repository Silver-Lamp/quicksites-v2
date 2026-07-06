// app/api/admin/claim/verify/route.ts
//
// Operator manual override for claim verification: after confirming a business by phone
// (no listing number, wrong number, franchise, etc.), an admin marks the draft verified
// so the next claim transfers without an OTP. Writes a channel='manual' verified row —
// the same grant claimPendingSiteDraft accepts. Admin-gated. See docs/CLAIM_VERIFICATION_PLAN.md.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }); }
  const templateId = String(body?.templateId || '').trim();
  if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );

  // Only an unclaimed listing_import draft can be manually verified.
  const { data: tpl } = await db
    .from('templates')
    .select('id, claim_source')
    .eq('id', templateId)
    .maybeSingle();
  if (!tpl || (tpl as any).claim_source !== 'listing_import') {
    return NextResponse.json({ error: 'not_claimable' }, { status: 409 });
  }

  const { error } = await db.from('claim_verifications').insert({
    template_id: templateId,
    channel: 'manual',
    destination: 'manual',
    verified_at: new Date().toISOString(),
    verified_by: admin.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
