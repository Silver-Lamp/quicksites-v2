import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

async function requireAdmin() {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) throw new Error('unauthorized');
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) throw new Error('forbidden');
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const start = url.searchParams.get('start') || undefined;
    const end = url.searchParams.get('end') || undefined;
    const actor_email = url.searchParams.get('actor_email') || undefined;
    const code = url.searchParams.get('code') || undefined;

    const svc = await getServerSupabase({ serviceRole: true });
    let q = svc
      .from('payout_runs')
      .select('id, created_at, actor_email, range_start, range_end, codes, total_approved_cents_before, total_marked_paid_cents, count_codes, count_rows_marked')
      .order('created_at', { ascending: false });
    if (start) q = q.gte('range_start', start);
    if (end) q = q.lte('range_end', end);
    if (actor_email) q = q.ilike('actor_email', `%${actor_email}%`);
    if (code) q = q.contains('codes', [code]);
    const { data: rows } = await q;

    const header = ['id','created_at','actor_email','range_start','range_end','codes','total_approved_cents_before','total_marked_paid_cents','count_codes','count_rows_marked'];
    const csv = [header.join(',')]
      .concat((rows || []).map(r => [
        r.id, r.created_at, r.actor_email || '', r.range_start, r.range_end,
        (r.codes || []).join('|'),
        r.total_approved_cents_before, r.total_marked_paid_cents,
        r.count_codes, r.count_rows_marked
      ].join(',')))
      .join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="payout_runs_${Date.now()}.csv"`
      }
    });
  } catch (e: any) {
    const msg = e?.message || 'error';
    const code = msg === 'unauthorized' ? 401 : msg === 'forbidden' ? 403 : 400;
    return new Response(msg, { status: code });
  }
}
