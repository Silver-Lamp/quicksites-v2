import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { resolveCompanyId } from '@/lib/server/resolveCompanyId';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const company_id = resolveCompanyId(new URL(req.url).searchParams, body);

  const {
    service_id,
    resource_id,
    customer_name,
    customer_email,
    customer_phone,
    starts_at,
    ends_at,
    site_id,
  } = body || {};

  if (!service_id || !customer_name || !starts_at || !ends_at) {
    return new NextResponse('Missing required fields', { status: 400 });
  }

  const app = supabaseAdmin.schema('app');

  async function pickResourceForService(svcId: string, companyId?: string): Promise<string | null> {
    const { data: mapRows, error: mapErr } = await app
      .from('resource_services')
      .select('resource_id')
      .eq('service_id', svcId);
    if (mapErr) throw mapErr;

    const ids = (mapRows ?? []).map((r: any) => r.resource_id).filter(Boolean);
    if (!ids.length) return null;

    if (companyId) {
      const { data: resRows, error: resErr } = await app
        .from('resources')
        .select('id')
        .in('id', ids)
        .eq('company_id', companyId)
        .limit(1);
      if (resErr) throw resErr;
      return resRows?.[0]?.id ?? ids[0];
    }
    return ids[0];
  }

  let chosenResource: string | undefined = resource_id as string | undefined;
  if (!chosenResource) {
    const picked = await pickResourceForService(service_id, company_id);
    if (!picked) return new NextResponse('No resource available', { status: 409 });
    chosenResource = picked;
  }

  const insert = {
    company_id: company_id ?? null,
    service_id,
    resource_id: chosenResource,
    customer_name,
    customer_email: customer_email || null,
    customer_phone: customer_phone || null,
    starts_at,
    ends_at,
    status: 'confirmed',
    site_id: site_id ?? null,
  };

  const { error } = await app.from('bookings').insert([insert]);
  if (error) {
    return new NextResponse('That time was just taken. Please pick another slot.', { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
