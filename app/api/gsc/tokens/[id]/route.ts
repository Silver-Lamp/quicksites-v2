// app/api/gsc/tokens/[id]/route.ts
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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  // Was unauthenticated — anyone could delete ANY user's GSC connection by id
  // (and the list route leaked the ids). Require auth + ownership.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const isAdmin = !!(await getAdminUser());
  const { id } = await params;

  const { data: tok } = await admin.from('gsc_tokens').select('user_id').eq('id', id).maybeSingle();
  if (!tok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!isAdmin && (tok as any).user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { error } = await admin.from('gsc_tokens').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
