// app/api/admin/outreach/delete/route.ts
//
// Delete an unclaimed listing-import draft from the outreach pipeline (a dud lead, a
// duplicate, a no-menu spot you won't send). Admin-gated, and scoped to
// claim_source='listing_import' so it can never delete a claimed site or a real
// template — even if the wrong id is passed.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }); }
  const id = String(body?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );

  // Only unclaimed listing-import drafts are deletable here.
  const { data, error } = await db
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('claim_source', 'listing_import')
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length) return NextResponse.json({ error: 'Not found or already claimed.' }, { status: 404 });

  return NextResponse.json({ ok: true, id });
}
