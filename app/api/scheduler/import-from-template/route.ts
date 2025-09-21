// app/api/scheduler/import-from-template/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

/**
 * Body:
 * {
 *   org_id: string,
 *   services: string[],                  // names to import (from template.meta.services)
 *   default_duration_minutes?: number,   // default 60
 *   link_all_services_to_default_resource?: boolean  // default true
 * }
 *
 * Returns:
 * { imported_count, total_count, service_ids, resource_id }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const org_id: string | undefined = body?.org_id ?? undefined;
    const rawServices: unknown = body?.services;
    const default_duration_minutes: number =
      Number.isFinite(body?.default_duration_minutes) ? body.default_duration_minutes : 60;
    const linkAll: boolean =
      typeof body?.link_all_services_to_default_resource === 'boolean'
        ? body.link_all_services_to_default_resource
        : true;

    if (!org_id) {
      return new NextResponse('Missing org_id', { status: 400 });
    }
    const names = Array.isArray(rawServices)
      ? rawServices
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
      : [];

    if (names.length === 0) {
      return new NextResponse('No services provided', { status: 400 });
    }

    // Dedupe (case-insensitive)
    const canon = (s: string) => s.trim().toLowerCase();
    const uniqNames = Array.from(new Map(names.map((n) => [canon(n), n])).values());

    // Fetch existing services for this org
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('app.services')
      .select('id,name')
      .eq('org_id', org_id)
      .in('name', uniqNames);

    if (existErr) return new NextResponse(existErr.message, { status: 500 });

    const existingByName = new Map((existing ?? []).map((r: any) => [canon(r.name), r]));

    // Prepare new rows
    const toInsert = uniqNames
      .filter((n) => !existingByName.has(canon(n)))
      .map((name) => ({
        org_id,
        name,
        duration_minutes: default_duration_minutes,
        active: true,
      }));

    let inserted: any[] = [];
    if (toInsert.length > 0) {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('app.services')
        .insert(toInsert)
        .select('id,name');
      if (insErr) return new NextResponse(insErr.message, { status: 500 });
      inserted = ins ?? [];
    }

    const allServices = [
      ...inserted,
      ...(existing ?? []),
    ] as Array<{ id: string; name: string }>;

    // Optionally ensure a default resource and link
    let resource_id: string | undefined;
    if (linkAll) {
      // find an existing resource
      const { data: resList, error: resErr } = await supabaseAdmin
        .from('app.resources')
        .select('id')
        .eq('org_id', org_id)
        .eq('active', true)
        .limit(1);
      if (resErr) return new NextResponse(resErr.message, { status: 500 });

      if (resList && resList[0]) {
        resource_id = resList[0].id;
      } else {
        const { data: resCreated, error: resInsErr } = await supabaseAdmin
          .from('app.resources')
          .insert([{ org_id, name: 'Default Resource', capacity: 1, active: true }])
          .select('id')
          .limit(1);
        if (resInsErr) return new NextResponse(resInsErr.message, { status: 500 });
        resource_id = resCreated?.[0]?.id;
      }

      if (resource_id) {
        const links = allServices.map((s) => ({ resource_id, service_id: s.id }));
        const { error: linkErr } = await supabaseAdmin
          .from('app.resource_services')
          .upsert(links, { onConflict: 'resource_id,service_id' });
        if (linkErr) return new NextResponse(linkErr.message, { status: 500 });
      }
    }

    const service_ids = allServices.map((s) => s.id);

    return NextResponse.json({
      imported_count: inserted.length,
      total_count: allServices.length,
      service_ids,
      resource_id,
    });
  } catch (e: any) {
    return new NextResponse(e?.message ?? 'Server error', { status: 500 });
  }
}
