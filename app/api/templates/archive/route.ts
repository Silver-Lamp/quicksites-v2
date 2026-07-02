// app/api/templates/archive/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Body = { ids: string[]; archived?: boolean; reason?: string };

export async function POST(req: Request) {
  const supabase = await getServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let payload: Body;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const ids = (payload.ids ?? []).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });

  // AuthZ: a platform admin may archive any template; otherwise EVERY id must be
  // owned by the caller. (The RPC took p_actor_id on trust — anyone could archive
  // anyone's templates.)
  const { data: adminRow } = await supabaseAdmin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) {
    const { data: owned } = await supabaseAdmin.from('templates').select('id, owner_id').in('id', ids);
    const ownedIds = new Set((owned ?? []).filter((t: any) => t.owner_id === user.id).map((t: any) => t.id));
    if (!ids.every((id) => ownedIds.has(id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const archived = payload.archived !== false; // default → archive
  const reason = payload.reason ?? (archived ? 'archive via list' : 'restore via list');

  const failures: Array<{ id: string; message: string }> = [];
  for (const id of ids) {
    const { error } = await supabase.rpc('set_template_archived', {
      p_template_id: id,
      p_archived: archived,
      p_actor_id: user.id,
      p_reason: reason,
    });
    if (error) failures.push({ id, message: error.message });
  }

  if (failures.length) return NextResponse.json({ error: 'Some commits failed', failures }, { status: 500 });

  // keep list in sync immediately (best effort)
  try {
    await supabase.rpc('refresh_template_bases');
  } catch {
    // ignore 
  }
  return NextResponse.json({ ok: true, count: ids.length });
}
