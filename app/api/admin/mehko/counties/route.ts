import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime='nodejs'; export const dynamic='force-dynamic';

async function requireAdmin(supa: ReturnType<typeof createRouteHandlerClient<any>>) {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) throw new Error('401');
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) throw new Error('403');
  return user;
}

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  try { await requireAdmin(supa); } catch(e:any){ return NextResponse.json({ error:'Forbidden' }, { status: e.message==='401'?401:403 }); }
  const { data, error } = await supa
    .from('mehko_opt_in_counties')
    .select('id, state, county, active')
    .order('state', { ascending: true })
    .order('county', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ counties: data || [] });
}

export async function POST(req: NextRequest) {
  const supa = createRouteHandlerClient({ cookies });
  try { await requireAdmin(supa); } catch(e:any){ return NextResponse.json({ error:'Forbidden' }, { status: e.message==='401'?401:403 }); }
  const body = await req.json();
  const state = String(body.state || '').toUpperCase();
  const county = String(body.county || '').trim();
  if (!state || !county) return NextResponse.json({ error:'state & county required' }, { status:400 });

  const { error } = await supa.from('mehko_opt_in_counties').upsert({ state, county, active: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
