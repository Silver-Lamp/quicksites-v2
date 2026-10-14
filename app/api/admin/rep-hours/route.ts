// /api/admin/rep-hours — the owner's side of the hours log.
//   GET                                   → every code with an hourly arrangement: rows + summary
//   POST { ids: [...], paid_via, note? }  → marks those rows paid now (the money moves outside: Stripe or Venmo)
//   POST { ids: [...], unpay: true }      → clears a mistaken mark
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { REP_HOURLY_RATES, summarizeHours, type HoursRow } from '@/lib/rep/hours';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT = 'id, code, worked_on, hours, note, created_at, paid_at, paid_via, paid_note';

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const codes = Object.keys(REP_HOURLY_RATES);
  const { data } = await supabaseAdmin.from('rep_hours').select(SELECT).in('code', codes).order('worked_on', { ascending: false }).limit(1000);
  const rows = ((data ?? []) as Array<HoursRow & { code: string }>).map((r) => ({ ...r, hours: Number(r.hours) }));
  const byCode = codes.map((code) => {
    const mine = rows.filter((r) => r.code === code);
    return { code, rate_cents: REP_HOURLY_RATES[code], rows: mine, summary: summarizeHours(mine, REP_HOURLY_RATES[code]) };
  });
  return NextResponse.json({ ok: true, codes: byCode });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) : [];
  if (!ids.length) return NextResponse.json({ error: 'ids_required' }, { status: 400 });
  if (body.unpay === true) {
    const { data, error } = await supabaseAdmin.from('rep_hours').update({ paid_at: null, paid_via: null, paid_note: null }).in('id', ids).select('id');
    if (error) return NextResponse.json({ error: 'failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
  }
  const via = String(body.paid_via ?? '');
  if (!['stripe', 'venmo', 'other'].includes(via)) return NextResponse.json({ error: 'paid_via_invalid' }, { status: 400 });
  const note = String(body.note ?? '').trim().slice(0, 200) || null;
  const { data, error } = await supabaseAdmin.from('rep_hours').update({ paid_at: new Date().toISOString(), paid_via: via, paid_note: note }).in('id', ids).is('paid_at', null).select('id');
  if (error) return NextResponse.json({ error: 'failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}
