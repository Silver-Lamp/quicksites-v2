// /api/booking/<templateId>/tables
//
//   GET  → the restaurant's active tables `[{id, label, seats, sort}]`.
//   POST → create tables: `{ tables: [{ ref, label, seats }] }` → `{ tables: [{ ref, id, label,
//          seats, existing }] }`. The one write that turns HiveJournal's plan-from-image
//          PROPOSAL into rows, after the owner confirmed it on HJ's plan (contract:
//          crosstalk/contracts/restaurant-floor-plan.md). `ref` is the caller's temporary key
//          and is echoed beside the new id so HJ can save positions on it.
//
// Who: the site's owner/admin session, or HiveJournal server-to-server (partner HMAC over the
// raw body, verified before parse — lib/booking/partnerAuth.ts).
//
// ⚠️ A LABEL THAT ALREADY EXISTS IS THE SAME TABLE, NOT A SECOND ONE. "Table 3" proposed for a
// restaurant that already has an active "Table 3" returns the existing row's id with
// `existing: true` and leaves its seat count alone — the owner set that, and an extraction's
// guess must not overwrite it. ⚠️ Seats are required per row (lib/booking/tablesInput.ts):
// a table the photo could not count is filled in by the owner before this call, never
// defaulted here.
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { checkBookingPartner } from '@/lib/booking/partnerAuth';
import { parseTablesInput } from '@/lib/booking/tablesInput';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function gate(req: NextRequest, templateId: string, signedInput: string): Promise<NextResponse | null> {
  const partnerCheck = checkBookingPartner(req, signedInput);
  if (partnerCheck === 'bad_signature') return NextResponse.json({ error: 'bad_signature' }, { status: 403 });
  if (partnerCheck === 'ok') return null;
  const g = await requireTemplateOwner(templateId);
  return g.ok ? null : g.response;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const denied = await gate(req, templateId, `${req.nextUrl.pathname}${req.nextUrl.search}`);
  if (denied) return denied;
  const { data } = await supabaseAdmin.from('restaurant_tables').select('id, label, seats, sort').eq('template_id', templateId).eq('active', true).order('sort').order('seats');
  return NextResponse.json({ ok: true, tables: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const raw = await req.text();
  const denied = await gate(req, templateId, raw);
  if (denied) return denied;
  let body: unknown = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = parseTablesInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, index: parsed.index }, { status: 400 });

  const { data: tpl } = await supabaseAdmin.from('templates').select('id').eq('id', templateId).maybeSingle();
  if (!tpl) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: existingRows } = await supabaseAdmin.from('restaurant_tables').select('id, label, seats, sort').eq('template_id', templateId).eq('active', true);
  const existing = new Map((existingRows ?? []).map((r: any) => [String(r.label).toLowerCase(), r]));
  let sort = (existingRows ?? []).reduce((m: number, r: any) => Math.max(m, Number(r.sort) || 0), 0);

  const out: Array<{ ref: string; id: string; label: string; seats: number; existing: boolean }> = [];
  const toInsert: Array<{ ref: string; row: { template_id: string; label: string; seats: number; sort: number } }> = [];
  for (const t of parsed.tables) {
    const hit = existing.get(t.label.toLowerCase());
    if (hit) {
      out.push({ ref: t.ref, id: hit.id, label: hit.label, seats: Number(hit.seats), existing: true });
      continue;
    }
    sort += 1;
    toInsert.push({ ref: t.ref, row: { template_id: templateId, label: t.label, seats: t.seats, sort } });
  }
  if (toInsert.length) {
    const { data: made, error } = await supabaseAdmin
      .from('restaurant_tables')
      .insert(toInsert.map((x) => x.row))
      .select('id, label, seats');
    if (error) return NextResponse.json({ error: 'failed', detail: error.message }, { status: 500 });
    const byLabel = new Map((made ?? []).map((r: any) => [String(r.label).toLowerCase(), r]));
    for (const x of toInsert) {
      const r = byLabel.get(x.row.label.toLowerCase());
      if (r) out.push({ ref: x.ref, id: r.id, label: r.label, seats: Number(r.seats), existing: false });
    }
  }
  // Answer in the caller's order so ref → id reads straight down.
  const order = new Map(parsed.tables.map((t, i) => [t.ref, i]));
  out.sort((a, b) => (order.get(a.ref) ?? 0) - (order.get(b.ref) ?? 0));
  return NextResponse.json({ ok: true, tables: out, created: toInsert.length }, { status: toInsert.length ? 201 : 200 });
}
