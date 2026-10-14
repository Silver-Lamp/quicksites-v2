// GET /api/booking/<templateId>/day?date=YYYY-MM-DD — the day's tables and bookings, for the
// owner page and for HiveJournal's floor plan (crosstalk/contracts/restaurant-floor-plan.md).
//
// Who may read: the site's owner or a platform admin (session), or HiveJournal server-to-server
// (lib/booking/partnerAuth.ts: the signature is over `pathname + search`). ⚠️ The partner payload
// carries who is at which table and when — never the guest's phone, email or notes; the plan
// needs seats, not contact details.
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { checkBookingPartner } from '@/lib/booking/partnerAuth';
import { listBookingsForDay, loadBookingSite, loadTables } from '@/lib/booking/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const date = String(req.nextUrl.searchParams.get('date') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'bad_query' }, { status: 400 });

  const partnerCheck = checkBookingPartner(req, `${req.nextUrl.pathname}${req.nextUrl.search}`);
  if (partnerCheck === 'bad_signature') return NextResponse.json({ error: 'bad_signature' }, { status: 403 });
  const partner = partnerCheck === 'ok';
  if (!partner) {
    const gate = await requireTemplateOwner(templateId);
    if (!gate.ok) return gate.response;
  }

  const site = await loadBookingSite(templateId);
  if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const [tables, bookings] = await Promise.all([loadTables(templateId), listBookingsForDay(templateId, date, site.settings.tz)]);
  return NextResponse.json({
    ok: true,
    date,
    tz: site.settings.tz,
    seating_minutes: site.settings.seatingMinutes,
    tables: tables.map((t) => ({ id: t.id, label: t.label, seats: t.seats })),
    bookings: bookings.map((b) =>
      partner
        ? { id: b.id, table_id: b.table_id, party_size: b.party_size, starts_at: b.starts_at, ends_at: b.ends_at, guest_name: b.guest_name, status: b.status, source: b.source }
        : b,
    ),
  });
}
