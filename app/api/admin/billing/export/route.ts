import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

async function requireAdmin() {
  if (!(await getAdminUser())) throw new Error('forbidden');
}

export async function GET(_req: NextRequest) {
  try {
    await requireAdmin();
    const svc = await getServerSupabase({ serviceRole: true });

    const { data: rows } = await svc
      .from('merchant_billing')
      .select('merchant_id, plan, price_cents, stripe_customer_id, stripe_subscription_id, updated_at')
      .order('updated_at', { ascending: false });

    const merchantIds = Array.from(new Set((rows || []).map(r => r.merchant_id))).filter((x): x is string => !!x);
    const [{ data: merchants }, { data: owners }] = await Promise.all([
      svc.from('merchants').select('id, display_name, site_slug, owner_id').in('id', merchantIds),
      svc.from('user_profiles').select('user_id, email, name'),
    ]);
    const mById = new Map((merchants || []).map(m => [m.id, m]));
    const oById = new Map((owners || []).map(o => [o.user_id, o]));

    const header = [
      'merchant_id','merchant_name','site_slug','owner_email','owner_display_name',
      'plan','price_cents','stripe_customer_id','stripe_subscription_id','updated_at'
    ];
    const lines = [header.join(',')];

    for (const r of (rows || [])) {
      const m = mById.get(r.merchant_id);
      const o = m ? oById.get(m.owner_id) : undefined;
      const row = [
        r.merchant_id,
        (m?.display_name || ''),
        (m?.site_slug || ''),
        (o?.email || ''),
        (o?.name || ''),
        (r.plan || ''),
        String(r.price_cents ?? 0),
        (r.stripe_customer_id || ''),
        (r.stripe_subscription_id || ''),
        (r.updated_at || ''),
      ].map(v => String(v).replace(/,/g,' '));
      lines.push(row.join(','));
    }

    const csv = lines.join('\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="billing_map_${Date.now()}.csv"`
      }
    });
  } catch (e: any) {
    const msg = e?.message || 'error';
    const code = msg === 'unauthorized' ? 401 : msg === 'forbidden' ? 403 : 400;
    return new Response(msg, { status: code });
  }
}
