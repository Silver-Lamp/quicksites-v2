import { NextResponse } from 'next/server';
import { getSupabaseForAction } from '@/lib/supabase/serverClient';

export async function GET() {
  const supa = await getSupabaseForAction();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // companies the user is a member of
  const { data: mem, error: memErr } = await supa
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id);
  if (memErr) return new NextResponse(memErr.message, { status: 500 });

  const companyIds = (mem ?? []).map((m) => m.company_id);
  if (!companyIds.length) return NextResponse.json({ companies: [] });

  const { data, error } = await supa
    .from('companies')
    .select('id,name,tenant_id')
    .in('id', companyIds)
    .order('name', { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ companies: data ?? [] });
}
