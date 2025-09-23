import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { toZonedTime } from 'date-fns-tz';
import { addMinutes } from 'date-fns';
import { resolveCompanyId } from '@/lib/server/resolveCompanyId';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const company_id = resolveCompanyId(sp);
  const service_id = sp.get('service_id')!;
  const resource_id = sp.get('resource_id') || undefined;
  const date = sp.get('date')!;
  const tz = sp.get('tz') || 'America/Los_Angeles';
  const gran = Number(sp.get('gran') || 30);
  const lead = Number(sp.get('lead') || 120);

  if (!service_id || !date) return new NextResponse('Missing service_id or date', { status: 400 });

  const { data: services, error: svcErr } = await supabaseAdmin
    .from('services')
    .select('id,duration_minutes')
    .eq('id', service_id)
    .limit(1);
  if (svcErr) return new NextResponse(svcErr.message, { status: 500 });
  const dur = services?.[0]?.duration_minutes ?? 60;

  // Candidate resources that can perform the service (scoped to company)
  let resQuery = supabaseAdmin
    .from('resources')
    .select('id,name,active,company_id,resource_services(service_id)')
    .eq('active', true);

  if (company_id) resQuery = resQuery.eq('company_id', company_id);
  if (resource_id) resQuery = resQuery.eq('id', resource_id);

  const { data: resources, error: resErr } = await resQuery;
  if (resErr) return new NextResponse(resErr.message, { status: 500 });

  const allowed = (resources ?? []).filter((r) =>
    (r.resource_services ?? []).some((rs: any) => rs.service_id === service_id)
  );
  if (!allowed.length) return NextResponse.json({ slots: [] });

  // Day bounds (simple 9–5; replace with resource_hours when ready)
  const dayStart = toZonedTime(new Date(`${date}T00:00:00`), tz);
  const dayEnd   = toZonedTime(new Date(`${date}T23:59:59`), tz);
  const open     = toZonedTime(new Date(`${date}T09:00:00`), tz);
  const close    = toZonedTime(new Date(`${date}T17:00:00`), tz);

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('resource_id,starts_at,ends_at,status')
    .gte('starts_at', dayStart.toISOString())
    .lt('starts_at', dayEnd.toISOString());

  const { data: blackouts } = await supabaseAdmin
    .from('resource_blackouts')
    .select('resource_id,starts_at,ends_at')
    .gte('starts_at', dayStart.toISOString())
    .lt('starts_at', dayEnd.toISOString());

  const nowPlusLead = new Date(Date.now() + lead * 60_000);
  const slots: any[] = [];

  for (const r of allowed) {
    for (let t = open; t < close; t = addMinutes(t, gran)) {
      const s = t;
      const e = addMinutes(t, dur);
      if (e > close) break;
      if (s < nowPlusLead) continue;

      const overlapsBooking = (bookings ?? []).some(
        (b) => b.resource_id === r.id && !(e <= new Date(b.starts_at) || s >= new Date(b.ends_at)) && b.status !== 'cancelled'
      );
      if (overlapsBooking) continue;

      const overlapsBlackout = (blackouts ?? []).some(
        (bl) => bl.resource_id === r.id && !(e <= new Date(bl.starts_at) || s >= new Date(bl.ends_at))
      );
      if (overlapsBlackout) continue;

      slots.push({ starts_at: s.toISOString(), ends_at: e.toISOString(), resource_id: r.id });
    }
  }

  return NextResponse.json({ slots });
}
