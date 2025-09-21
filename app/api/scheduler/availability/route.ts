import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { toZonedTime } from 'date-fns-tz';
import { addMinutes, startOfDay, endOfDay } from 'date-fns';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const org_id = searchParams.get('org_id')!;
  const service_id = searchParams.get('service_id')!;
  const resource_id = searchParams.get('resource_id') || undefined;
  const date = searchParams.get('date')!;               // yyyy-MM-dd
  const tz = searchParams.get('tz') || 'America/Los_Angeles';
  const gran = Number(searchParams.get('gran') || 30);
  const lead = Number(searchParams.get('lead') || 120);

  if (!service_id || !date) return new NextResponse('Missing service_id or date', { status: 400 });

  // Fetch service duration
  const { data: services, error: svcErr } = await supabaseAdmin
    .from('app.services')
    .select('id,duration_minutes')
    .eq('id', service_id)
    .limit(1);
  if (svcErr) return new NextResponse(svcErr.message, { status: 500 });
  const dur = services?.[0]?.duration_minutes ?? 60;

  // Candidate resources that can perform the service
  let resQuery = supabaseAdmin
    .from('app.resources')
    .select('id,name,active,resource_services(service_id)')
    .eq('active', true);
  if (org_id) resQuery = resQuery.eq('org_id', org_id);
  if (resource_id) resQuery = resQuery.eq('id', resource_id);

  const { data: resources, error: resErr } = await resQuery;
  if (resErr) return new NextResponse(resErr.message, { status: 500 });

  const allowed = (resources ?? []).filter(r => (r.resource_services ?? []).some((rs: any) => rs.service_id === service_id));
  if (!allowed.length) return NextResponse.json({ slots: [] });

  // Day bounds in UTC based on tz
  const localStart = new Date(`${date}T00:00:00`);
  const dayStart = toZonedTime(localStart, tz);
  const dayEnd = toZonedTime(new Date(`${date}T23:59:59`), tz);

  // Pull bookings and blackouts for that day
  const { data: bookings } = await supabaseAdmin
    .from('app.bookings')
    .select('resource_id,starts_at,ends_at,status')
    .gte('starts_at', dayStart.toISOString())
    .lt('starts_at', dayEnd.toISOString());

  const { data: blackouts } = await supabaseAdmin
    .from('app.resource_blackouts')
    .select('resource_id,starts_at:starts_at,ends_at:ends_at')
    .gte('starts_at', dayStart.toISOString())
    .lt('starts_at', dayEnd.toISOString());

  // TODO: optionally incorporate app.resource_hours; for now assume 9–5 local
  const openLocal = new Date(`${date}T09:00:00`);
  const closeLocal = new Date(`${date}T17:00:00`);
  const open = toZonedTime(openLocal, tz);
  const close = toZonedTime(closeLocal, tz);

  const nowPlusLead = new Date(Date.now() + lead * 60_000);

  const slots: any[] = [];

  for (const r of allowed) {
    // iterate granularity and test overlap
    for (let t = open; t < close; t = addMinutes(t, gran)) {
      const s = t;
      const e = addMinutes(t, dur);
      if (e > close) break;
      if (s < nowPlusLead) continue;

      const overlapsBooking = (bookings ?? []).some(b =>
        b.resource_id === r.id &&
        !(new Date(e) <= new Date(b.starts_at) || new Date(s) >= new Date(b.ends_at)) &&
        b.status !== 'cancelled'
      );
      if (overlapsBooking) continue;

      const overlapsBlackout = (blackouts ?? []).some(bl =>
        bl.resource_id === r.id &&
        !(new Date(e) <= new Date(bl.starts_at) || new Date(s) >= new Date(bl.ends_at))
      );
      if (overlapsBlackout) continue;

      slots.push({
        starts_at: s.toISOString(),
        ends_at: e.toISOString(),
        resource_id: r.id,
      });
    }
  }

  return NextResponse.json({ slots });
}
