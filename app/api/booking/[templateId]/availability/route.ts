// GET /api/booking/<templateId>/availability?date=YYYY-MM-DD&party=N — the free times for a
// party on a day, each with the table it would get (lib/booking/slots.ts). Public (a guest on
// the site), per-IP rate-limited, read-only. Table ids are exposed because the booking POST
// names one; nothing about other guests is.
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { availability, loadBookingSite } from '@/lib/booking/db';
import { hasBookableWindows } from '@/lib/booking/settings';
import { dayTimes } from '@/lib/booking/slots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const limited = await rateLimitOr429(req, 'booking-availability', 120, 3600);
  if (limited) return limited;
  const sp = req.nextUrl.searchParams;
  const date = String(sp.get('date') ?? '');
  const party = Number(sp.get('party') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(party) || party < 1) return NextResponse.json({ error: 'bad_query' }, { status: 400 });
  const site = await loadBookingSite(templateId);
  if (!site || !hasBookableWindows(site.settings)) return NextResponse.json({ error: 'not_bookable' }, { status: 404 });
  const now = new Date();
  const slots = await availability(site, date, party, now);
  // `times` is every bookable start that day, free or not, so the widget can mark a full time
  // as full rather than hide it; `slots` is the free subset with the table each would get.
  const times = party <= site.settings.maxParty ? dayTimes(site.settings, date, now) : [];
  return NextResponse.json({ ok: true, date, party, times, slots: slots.map((s) => ({ starts_at: s.starts_at, ends_at: s.ends_at, table_id: s.table_id, label: s.label, time: s.time })) });
}
