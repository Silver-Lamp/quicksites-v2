import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';

async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error('forbidden');
  return admin.id;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json() as { ids?: string[]; code?: string; start?: string; end?: string };
    const svc = await getServerSupabase({ serviceRole: true });

    if (body.ids?.length) {
      const { data, error } = await svc.from('commission_ledger')
        .update({ status: 'approved' })
        .in('id', body.ids)
        .eq('status', 'paid')
        .select('id');
      if (error) throw error;
      return NextResponse.json({ ok: true, count: data?.length || 0 });
    }

    if (body.code) {
      let q = svc.from('commission_ledger')
        .update({ status: 'approved' })
        .eq('referral_code', body.code)
        .eq('status', 'paid');
      if (body.start) q = q.gte('created_at', body.start);
      if (body.end) q = q.lte('created_at', body.end);
      const { data, error } = await q.select('id');
      if (error) throw error;
      return NextResponse.json({ ok: true, count: data?.length || 0 });
    }

    return NextResponse.json({ error: 'nothing to revert' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'error' }, { status: 400 });
  }
}
