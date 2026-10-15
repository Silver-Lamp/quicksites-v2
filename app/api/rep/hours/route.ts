// /api/rep/hours — a rep's hours log, from their unlisted page.
//
//   GET  ?token=   → { code, rate_cents, rows, summary }
//   POST { token, worked_on, hours, note } → 201 { row, summary }
//
// Auth is the page's signed rep grant (lib/rep/repActionToken.ts) — the same bearer the build
// button uses: the rep usually has no account when they start. The code must be active and on
// an hourly arrangement (lib/rep/hours.ts); the IP is throttled; a code may log at most
// MAX_ENTRIES_PER_DAY rows per worked day. Marking paid is the owner's, on /admin/rep-hours.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { verifyRepActionToken } from '@/lib/rep/repActionToken';
import { loadHourly, parseHoursInput, summarizeHours, MAX_ENTRIES_PER_DAY, type HoursRow } from '@/lib/rep/hours';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECT = 'id, worked_on, hours, note, created_at, paid_at, paid_via';

/** The grant names the code; the code's row says whether hours are an option at all (hourly_enabled). */
async function gate(token: string | null): Promise<{ code: string; rate: number; paidBy: string | null } | NextResponse> {
  const grant = verifyRepActionToken(token);
  if (!grant) return NextResponse.json({ error: 'bad_token' }, { status: 403 });
  const arr = await loadHourly(grant.code);
  if (!arr.enabled || arr.rateCents == null) return NextResponse.json({ error: 'no_hourly_arrangement' }, { status: 403 });
  const { data } = await supabaseAdmin.from('referral_codes').select('code, status').eq('code', grant.code).maybeSingle();
  if (!data || (data as any).status === 'disabled') return NextResponse.json({ error: 'code_inactive' }, { status: 403 });
  return { code: grant.code, rate: arr.rateCents, paidBy: arr.paidBy };
}

async function list(code: string): Promise<HoursRow[]> {
  const { data } = await supabaseAdmin.from('rep_hours').select(SELECT).eq('code', code).order('worked_on', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  return ((data ?? []) as HoursRow[]).map((r) => ({ ...r, hours: Number(r.hours) }));
}

export async function GET(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'rep-hours-read', 120, 3600);
  if (limited) return limited;
  const g = await gate(req.nextUrl.searchParams.get('token'));
  if (g instanceof NextResponse) return g;
  const rows = await list(g.code);
  return NextResponse.json({ ok: true, code: g.code, rate_cents: g.rate, paid_by: g.paidBy, rows, summary: summarizeHours(rows, g.rate) });
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'rep-hours-write', 30, 3600);
  if (limited) return limited;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const g = await gate(typeof body.token === 'string' ? body.token : null);
  if (g instanceof NextResponse) return g;
  const parsed = parseHoursInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { count } = await supabaseAdmin.from('rep_hours').select('id', { count: 'exact', head: true }).eq('code', g.code).eq('worked_on', parsed.value.workedOn);
  if ((count ?? 0) >= MAX_ENTRIES_PER_DAY) return NextResponse.json({ error: 'day_full' }, { status: 429 });
  const { data, error } = await supabaseAdmin
    .from('rep_hours')
    .insert({ code: g.code, worked_on: parsed.value.workedOn, hours: parsed.value.hours, note: parsed.value.note })
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: 'failed', detail: error.message }, { status: 500 });
  const rows = await list(g.code);
  return NextResponse.json({ ok: true, row: { ...(data as HoursRow), hours: Number((data as any).hours) }, rows, summary: summarizeHours(rows, g.rate) }, { status: 201 });
}
