import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

async function requireAdmin() {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) throw new Error('unauthorized');
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) throw new Error('forbidden');
  return u.user.id;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json() as { ids?: string[]; code?: string; start?: string; end?: string };
    const svc = await getServerSupabase({ serviceRole: true });

    if (body.ids?.length) {
      const { error } = await svc.from('commission_ledger')
        .update({ status: 'paid' })
        .in('id', body.ids);
      if (error) throw error;
      return NextResponse.json({ ok: true, count: body.ids.length });
    }

    if (body.code) {
      let q = svc.from('commission_ledger').update({ status: 'paid' })
        .eq('referral_code', body.code).eq('status', 'approved');
      if (body.start) q = q.gte('created_at', body.start);
      if (body.end) q = q.lte('created_at', body.end);
      const { data, error } = await q.select('id');
      if (error) throw error;
      return NextResponse.json({ ok: true, count: data?.length || 0 });
    }

    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'error' }, { status: 400 });
  }
}
