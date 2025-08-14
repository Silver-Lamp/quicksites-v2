import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime='nodejs'; export const dynamic='force-dynamic';

export async function PATCH(req: NextRequest, { params }:{ params:{ id:string } }) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error:'Forbidden' }, { status:403 });

  const body = await req.json();
  const patch:any = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (body.county) patch.county = String(body.county);
  if (body.state) patch.state = String(body.state).toUpperCase();

  const { error } = await supa.from('mehko_opt_in_counties').update(patch).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true });
}

export async function DELETE(_: NextRequest, { params }:{ params:{ id:string } }) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error:'Forbidden' }, { status:403 });

  const { error } = await supa.from('mehko_opt_in_counties').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true });
}
