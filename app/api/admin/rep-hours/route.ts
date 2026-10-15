// /api/admin/rep-hours — the payer's side of the hours log, and the per-rep hourly config.
//   GET                                    → { reps: every code + its hourly config, codes: hourly-enabled codes with rows + summary }
//   POST  { ids, paid_via, note? }         → marks those rows paid now (the money moves outside: Stripe or Venmo)
//   POST  { ids, unpay: true }             → clears a mistaken mark
//   PATCH { code, hourly_enabled, hourly_rate_cents, hourly_paid_by } → the option per rep (lib/rep/hours.ts#parseHourlyConfig)
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { listRepHourlyConfigs, parseHourlyConfig, summarizeHours, type HoursRow } from '@/lib/rep/hours';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT = 'id, code, worked_on, hours, note, created_at, paid_at, paid_via, paid_note';

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const reps = await listRepHourlyConfigs();
  const hourly = reps.filter((r) => r.enabled && r.rateCents != null);
  const codes = hourly.map((r) => r.code);
  const { data } = codes.length ? await supabaseAdmin.from('rep_hours').select(SELECT).in('code', codes).order('worked_on', { ascending: false }).limit(1000) : { data: [] as any[] };
  const rows = ((data ?? []) as Array<HoursRow & { code: string }>).map((r) => ({ ...r, hours: Number(r.hours) }));
  const byCode = hourly.map((r) => {
    const mine = rows.filter((x) => x.code === r.code);
    return { code: r.code, label: r.label, rate_cents: r.rateCents as number, paid_by: r.paidBy, rows: mine, summary: summarizeHours(mine, r.rateCents as number) };
  });
  return NextResponse.json({ ok: true, reps, codes: byCode });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = parseHourlyConfig(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { code, enabled, rateCents, paidBy } = parsed.value;
  const { data, error } = await supabaseAdmin
    .from('referral_codes')
    .update({ hourly_enabled: enabled, hourly_rate_cents: rateCents, hourly_paid_by: paidBy })
    .eq('code', code)
    .select('code, hourly_enabled, hourly_rate_cents, hourly_paid_by')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'failed', detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, rep: data });
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
