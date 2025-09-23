import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { resolveCompanyId } from '@/lib/server/resolveCompanyId';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const company_id = resolveCompanyId(new URL(req.url).searchParams, body);
    const namesIn = Array.isArray(body?.services) ? body.services : [];
    const duration = Number.isFinite(body?.default_duration_minutes) ? body.default_duration_minutes : 60;
    const linkAll = typeof body?.link_all_services_to_default_resource === 'boolean'
      ? body.link_all_services_to_default_resource
      : true;

    if (!company_id) return new NextResponse('Missing company_id', { status: 400 });

    const names = Array.from(
      new Map(
        namesIn
          .map((s: any) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
          .map((n: string) => [n.toLowerCase(), n])
      ).values()
    );

    const app = supabaseAdmin.schema('app');

    const { data: existing, error: existErr } = await app
      .from('services')
      .select('id,name')
      .eq('company_id', company_id)
      .in('name', names);
    if (existErr) return new NextResponse(existErr.message, { status: 500 });

    const existingByName = new Map((existing ?? []).map((r: any) => [r.name.toLowerCase(), r]));
    const toInsert = names
      .filter((n: any) => !existingByName.has(n.toLowerCase()))
      .map((name) => ({ company_id, name, duration_minutes: duration, active: true }));

    let inserted: any[] = [];
    if (toInsert.length > 0) {
      const { data: ins, error: insErr } = await app
        .from('services')
        .insert(toInsert)
        .select('id,name');
      if (insErr) return new NextResponse(insErr.message, { status: 500 });
      inserted = ins ?? [];
    }

    const allServices = [...inserted, ...(existing ?? [])] as Array<{ id: string; name: string }>;

    // Ensure a default resource and link
    let resource_id: string | undefined;
    if (linkAll) {
      const { data: resList, error: resErr } = await app
        .from('resources')
        .select('id')
        .eq('company_id', company_id)
        .eq('active', true)
        .limit(1);
      if (resErr) return new NextResponse(resErr.message, { status: 500 });

      if (resList?.[0]) {
        resource_id = resList[0].id;
      } else {
        const { data: resCreated, error: createErr } = await app
          .from('resources')
          .insert([{ company_id, name: 'Default Resource', capacity: 1, active: true }])
          .select('id')
          .limit(1);
        if (createErr) return new NextResponse(createErr.message, { status: 500 });
        resource_id = resCreated?.[0]?.id;
      }

      if (resource_id) {
        const links = allServices.map((s) => ({ resource_id, service_id: s.id }));
        const { error: linkErr } = await app
          .from('resource_services')
          .upsert(links, { onConflict: 'resource_id,service_id' });
        if (linkErr) return new NextResponse(linkErr.message, { status: 500 });
      }
    }

    return NextResponse.json({
      imported_count: inserted.length,
      total_count: allServices.length,
      service_ids: allServices.map((s) => s.id),
      resource_id,
    });
  } catch (e: any) {
    return new NextResponse(e?.message ?? 'Server error', { status: 500 });
  }
}
