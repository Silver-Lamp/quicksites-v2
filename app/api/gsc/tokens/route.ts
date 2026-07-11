// app/api/gsc/tokens/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/requireUser';
import { getAdminUser } from '@/lib/auth/getAdminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

export async function GET() {
  // Was unauthenticated + returned EVERY tenant's connected domains + owner
  // user_ids. Require auth and scope: admins see all, others only their own.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const isAdmin = !!(await getAdminUser());

  let q = admin
    .from('gsc_tokens')
    .select('id, domain, user_id, expiry, created_at')
    .order('created_at', { ascending: false });
  if (!isAdmin) q = q.eq('user_id', user.id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
