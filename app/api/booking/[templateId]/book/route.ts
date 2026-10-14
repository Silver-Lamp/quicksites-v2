// POST /api/booking/<templateId>/book — a guest books a table. Public, per-IP rate-limited.
//
// ⚠️ THE SERVER RE-DERIVES THE SLOT. The client sends a date, a party, a start and a table id,
// but the booking is written only if that exact slot is in TODAY'S availability for that party
// (lib/booking/slots.ts) — so a tampered start, a table too small for the party, a time outside
// the windows or inside the lead time all come back `invalid`, and the database's exclusion
// constraint answers the race with `taken`. Emails are a courtesy after the row exists.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { availability, createBooking, loadBookingSite } from '@/lib/booking/db';
import { hasBookableWindows } from '@/lib/booking/settings';
import { notifyBooking } from '@/lib/booking/notify';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { after } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function POST(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const limited = await rateLimitOr429(req, 'booking-book', 12, 3600);
  if (limited) return limited;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const date = clean(body.date, 10);
  const party = Number(body.party);
  const startsAt = clean(body.starts_at, 40);
  const tableId = clean(body.table_id, 36);
  const name = clean(body.name, 80);
  const phone = clean(body.phone, 32) || null;
  const email = clean(body.email, 120).toLowerCase() || null;
  const notes = clean(body.notes, 200) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(party) || party < 1 || !startsAt || !tableId || name.length < 2) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'invalid', field: 'email' }, { status: 400 });

  const site = await loadBookingSite(templateId);
  if (!site || !hasBookableWindows(site.settings)) return NextResponse.json({ error: 'not_bookable' }, { status: 404 });

  const slots = await availability(site, date, party);
  const slot = slots.find((s) => s.starts_at === new Date(startsAt).toISOString() && s.table_id === tableId) ?? slots.find((s) => s.starts_at === new Date(startsAt).toISOString());
  if (!slot) return NextResponse.json({ error: 'invalid', reason: 'not_available' }, { status: 409 });

  const r = await createBooking({ templateId, tableId: slot.table_id, party, startsAt: slot.starts_at, endsAt: slot.ends_at, guestName: name, guestPhone: phone, guestEmail: email, notes, source: 'web', locale: site.settings.locale });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === 'taken' ? 409 : r.error === 'invalid' ? 400 : 500 });

  after(async () => {
    const { data } = await supabaseAdmin.from('templates').select('data').eq('id', templateId).maybeSingle();
    const restaurantEmail = String((data as any)?.data?.meta?.contact?.email ?? (data as any)?.data?.meta?.contact_email ?? '').trim() || null;
    await notifyBooking({ booking: r.booking, tableLabel: slot.label, restaurant: site.name, restaurantEmail, restaurantPhone: site.settings.phone, tz: site.settings.tz, locale: site.settings.locale }).catch(() => undefined);
  });

  return NextResponse.json({ ok: true, booking: { id: r.booking.id, starts_at: r.booking.starts_at, ends_at: r.booking.ends_at, table: slot.label, party } }, { status: 201 });
}
