import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return new Response('unauthorized', { status: 401 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get('year') || new Date().getUTCFullYear());

  const { data: rows } = await supa
    .from('affiliate_payouts')
    .select('paid_at, amount_cents, currency, method, is_tpso, tx_ref')
    .eq('affiliate_user_id', u.user.id)
    .eq('tax_year', year)
    .order('paid_at');

  const header = ['paid_at','amount_cents','currency','method','is_tpso','tx_ref'];
  const csv = [header.join(',')]
    .concat((rows||[]).map(r => [
      r.paid_at, r.amount_cents, (r.currency||'USD'), r.method, r.is_tpso ? 'true' : 'false', (r.tx_ref||'')
    ].map(v => String(v).replace(/,/g,' ')).join(',')))
    .join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="my_payouts_${year}.csv"`
    }
  });
}
