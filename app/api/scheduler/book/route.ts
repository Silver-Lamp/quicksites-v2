import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function POST(req: Request) {
  const body = await req.json();
  const {
    org_id,
    service_id,
    resource_id,
    customer_name,
    customer_email,
    customer_phone,
    starts_at,
    ends_at,
  } = body || {};

  if (!service_id || !customer_name || !starts_at || !ends_at) {
    return new NextResponse('Missing required fields', { status: 400 });
  }

  // If resource_id not provided, pick the first available among qualified resources (defensive)
  let chosenResource = resource_id;
  if (!chosenResource) {
    const { data: resources } = await supabaseAdmin
      .from('app.resource_services')
      .select('resource_id')
      .eq('service_id', service_id);
    chosenResource = resources?.[0]?.resource_id;
  }
  if (!chosenResource) return new NextResponse('No resource available', { status: 409 });

  // Try insert; the EXCLUDE constraint will prevent double-booking
  const { error } = await supabaseAdmin
    .from('app.bookings')
    .insert([{
      org_id,
      service_id,
      resource_id: chosenResource,
      customer_name,
      customer_email,
      customer_phone,
      starts_at,
      ends_at,
      status: 'confirmed',
    }]);

  if (error) {
    // Postgres EXCLUDE error => overlap
    return new NextResponse('That time was just taken. Please pick another slot.', { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
