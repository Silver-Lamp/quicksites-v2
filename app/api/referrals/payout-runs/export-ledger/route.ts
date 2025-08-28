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
    const runId = url.searchParams.get('run_id');
    if (!runId) return new Response('missing run_id', { status: 400 });

    const svc = await getServerSupabase({ serviceRole: true });
    const { data: run } = await svc.from('payout_runs').select('range_start, range_end, codes').eq('id', runId).single();
    if (!run) return new Response('not found', { status: 404 });

    // Export all ledger rows for this run's codes within the run's date window.
    const { data: rows } = await svc
      .from('commission_ledger')
      .select('id, referral_code, subject, subject_id, amount_cents, currency, status, created_at')
      .in('referral_code', run.codes || [])
      .gte('created_at', run.range_start)
      .lte('created_at', run.range_end)
      .order('created_at');

    const header = ['id','referral_code','subject','subject_id','amount_cents','currency','status','created_at'];
    const csv = [header.join(',')]
      .concat((rows || []).map(r => header.map(h => String((r as any)[h] ?? '')).join(',')))
      .join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="payout_run_${runId}_ledger.csv"`
      }
    });
  } catch (e: any) {
    const msg = e?.message || 'error';
    const code = msg === 'unauthorized' ? 401 : msg === 'forbidden' ? 403 : 400;
    return new Response(msg, { status: code });
  }
}
