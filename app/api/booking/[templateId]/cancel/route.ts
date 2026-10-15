// POST /api/booking/<templateId>/cancel { booking_id } — cancels; the table frees itself
// because the exclusion constraint ignores cancelled rows. Also { booking_id, status:
// 'seated' | 'no_show' | 'booked' } to mark a booking. Owner/admin session, or HiveJournal's
// floor plan (partner HMAC over the raw body — lib/booking/partnerAuth.ts).
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { checkBookingPartner } from '@/lib/booking/partnerAuth';
import { cancelBooking, setBookingStatus } from '@/lib/booking/db';
import { isPartnerLinked } from '@/lib/booking/partnerLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const bookingId = String(body.booking_id ?? '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const status = String(body.status ?? 'cancelled');
  if (status === 'cancelled') {
    const ok = await cancelBooking(templateId, bookingId);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  }
  if (status === 'seated' || status === 'no_show' || status === 'booked') {
    const ok = await setBookingStatus(templateId, bookingId, status);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  }
  return NextResponse.json({ error: 'invalid' }, { status: 400 });
}
