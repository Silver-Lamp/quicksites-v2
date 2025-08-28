import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

async function requireAdmin() {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) throw new Error('unauthorized');
  const { data: profile } = await supa.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const isAdmin = (u.user.user_metadata?.role === 'admin') || profile?.role === 'admin';
  if (!isAdmin) throw new Error('forbidden');
  return { id: u.user.id, email: u.user.email || u.user.user_metadata?.email || null };
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdmin();
    const body = await req.json() as {
      rangeStart: string; rangeEnd: string;
      codes: string[];
      totalApprovedCentsBefore: number;
      totalMarkedPaidCents: number;
      countRowsMarked: number;
      perCode: Array<{ code: string; approvedCentsBefore: number; rowsMarked: number; markedPaidCents: number }>;
      meta?: Record<string, any>;
    };

    if (!body?.codes?.length || !body.rangeStart || !body.rangeEnd) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }

    const svc = await getServerSupabase({ serviceRole: true });

    const { data: run, error } = await svc.from('payout_runs').insert({
      actor_user_id: actor.id,
      actor_email: actor.email,
      range_start: body.rangeStart,
      range_end: body.rangeEnd,
      codes: body.codes,
      total_approved_cents_before: body.totalApprovedCentsBefore || 0,
      total_marked_paid_cents: body.totalMarkedPaidCents || 0,
      count_codes: body.codes.length,
      count_rows_marked: body.countRowsMarked || 0,
      meta: body.meta || {}
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (body.perCode?.length) {
      const items = body.perCode.map(pc => ({
        payout_run_id: run.id,
        referral_code: pc.code,
        approved_cents_before: pc.approvedCentsBefore || 0,
        rows_marked: pc.rowsMarked || 0,
        marked_paid_cents: pc.markedPaidCents || 0
      }));
      const { error: iErr } = await svc.from('payout_run_items').insert(items);
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: run.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'error' }, { status: 400 });
  }
}
