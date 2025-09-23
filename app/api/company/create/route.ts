import { NextResponse } from 'next/server';
import { getSupabaseForAction } from '@/lib/supabase/serverClient';

export async function POST(req: Request) {
  const supa = await getSupabaseForAction();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name || 'New Company').toString().slice(0, 120);
  const tenant_id = body?.tenant_id ?? null; // optional mapping to your whitelabel org

  const { data: co, error: coErr } = await supa
    .from('companies')
    .insert([{ name, tenant_id, created_by: user.id }])
    .select('id')
    .single();
  if (coErr) return new NextResponse(coErr.message, { status: 500 });

  await supa.from('company_members').insert([{ company_id: co.id, user_id: user.id, role: 'owner' }]);

  return NextResponse.json({ company_id: co.id });
}
