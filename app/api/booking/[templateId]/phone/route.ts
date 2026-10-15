// POST /api/booking/<templateId>/phone — a booking taken over the phone, added by the owner
// (session) or dropped onto a table on HiveJournal's floor plan (partner HMAC over the raw
// body — lib/booking/partnerAuth.ts). Same slot re-derivation as the guest route, with two
// differences: the caller may name a table (`table_id`) to seat the party where they like —
// if that table is not free at that time, `taken` — and lead time does not apply (they are
// booking what was just agreed on the phone).
//
// Body, either shape (the contract's or the owner page's):
//   { table_id?, party_size | party, starts_at (ISO) | date + time ('19:30'), guest_name | name,
//     guest_phone? | phone?, notes? }
import { NextRequest, NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { checkBookingPartner } from '@/lib/booking/partnerAuth';
import { createBooking, loadBookingSite, loadBookingsAround, loadTables } from '@/lib/booking/db';
import { isPartnerLinked } from '@/lib/booking/partnerLink';
import { computeSlots } from '@/lib/booking/slots';
import { hasBookableWindows } from '@/lib/booking/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function POST(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const raw = await req.text();
  const partnerCheck = checkBookingPartner(req, raw);
  if (partnerCheck === 'bad_signature') return NextResponse.json({ error: 'bad_signature' }, { status: 403 });
  if (partnerCheck === 'ok') {
    // A partner writes only to a template its OWNER linked (or the exempt demo) — lib/booking/partnerLink.ts.
    if (!(await isPartnerLinked(templateId))) return NextResponse.json({ error: 'not_linked' }, { status: 403 });
  } else {
    const gate = await requireTemplateOwner(templateId);
    if (!gate.ok) return gate.response;
  }
  let body: any = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const site = await loadBookingSite(templateId);
  if (!site || !hasBookableWindows(site.settings)) return NextResponse.json({ error: 'not_bookable' }, { status: 404 });

  const party = Number(body.party_size ?? body.party);
  const tableId = clean(body.table_id, 36) || null;
  const name = clean(body.guest_name ?? body.name, 80);
  const phone = clean(body.guest_phone ?? body.phone, 32) || null;
  const notes = clean(body.notes, 200) || null;
  let date = clean(body.date, 10);
  let time = clean(body.time, 5); // "19:30"
  const startsAt = clean(body.starts_at, 40);
  if (startsAt && !Number.isNaN(new Date(startsAt).getTime())) {
    date = formatInTimeZone(new Date(startsAt), site.settings.tz, 'yyyy-MM-dd');
    time = formatInTimeZone(new Date(startsAt), site.settings.tz, 'HH:mm');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !Number.isInteger(party) || party < 1 || name.length < 2) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const [tables, bookings] = await Promise.all([loadTables(templateId), loadBookingsAround(templateId, date, site.settings.tz)]);
  // The owner's view of the day: no lead time, the party cap lifted to the biggest table.
  const settings = { ...site.settings, leadMinutes: 0, maxParty: Math.max(site.settings.maxParty, ...tables.map((t) => t.seats)) };
  const slots = computeSlots({ date, party, settings, tables, bookings });
  const atTime = slots.filter((s) => s.time === time);
  const slot = tableId ? atTime.find((s) => s.table_id === tableId) : atTime[0];
  if (!slot) return NextResponse.json({ error: tableId ? 'taken' : 'not_available' }, { status: 409 });
  const r = await createBooking({ templateId, tableId: slot.table_id, party, startsAt: slot.starts_at, endsAt: slot.ends_at, guestName: name, guestPhone: phone, guestEmail: null, notes, source: 'phone', locale: site.settings.locale });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'taken' ? 409 : r.error === 'invalid' ? 400 : 500 });
  const { guest_phone: _p, guest_email: _e, ...publicRow } = r.booking;
  return NextResponse.json({ ok: true, booking: { ...(partnerCheck === 'ok' ? publicRow : r.booking), table: slot.label } }, { status: 201 });
}
