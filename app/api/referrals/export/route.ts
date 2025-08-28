import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supa = await getServerSupabase();
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner'); // 'me' or null
  const code = url.searchParams.get('code') || undefined;
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  // Who is calling?
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return new Response('unauthorized', { status: 401 });
  const userId = u.user.id;

  // Build code list
  let codes: string[] = [];
  if (code) {
    codes = [code];
  } else if (owner === 'me') {
    const { data: myCodes } = await supa.from('referral_codes')
      .select('code').eq('owner_type', 'provider_rep').eq('owner_id', userId);
    codes = (myCodes || []).map((c: any) => c.code);
  } else {
    // admin-only full export
    const { data: profile } = await supa.from('profiles').select('role').eq('id', userId).maybeSingle();
    const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
    if (!isAdmin) return new Response('forbidden', { status: 403 });
    const svc = await getServerSupabase({ serviceRole: true });
    const { data: all } = await svc.from('referral_codes').select('code');
    codes = (all || []).map((c: any) => c.code);
  }

  if (codes.length === 0) return new Response('no data', { status: 200 });

  const svc = await getServerSupabase({ serviceRole: true });
  let q = svc.from('commission_ledger')
    .select('id, referral_code, subject, subject_id, amount_cents, currency, status, created_at')
    .in('referral_code', codes)
    .order('created_at');

  if (start) q = q.gte('created_at', start);
  if (end) q = q.lte('created_at', end);
  const { data: rows } = await q;

  const header = ['id','referral_code','subject','subject_id','amount_cents','currency','status','created_at'];
  const csv = [header.join(',')]
    .concat((rows || []).map((r: any) => header.map((h: any) => String((r as any)[h] ?? '')).join(',')))
    .join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="referrals_${Date.now()}.csv"`
    }
  });
}
