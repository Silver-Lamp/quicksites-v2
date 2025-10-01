// app/api/scheduler/services/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { resolveCompanyId } from '@/lib/server/resolveCompanyId';

/**
 * Rules:
 * - You MUST provide a company owner (company_id or org->company via resolveCompanyId)
 *   OR explicitly pass an allow-list via ?service_ids=... .
 * - If both are provided, results are intersected (only that company's listed IDs).
 * - Active-only.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;

  // Prefer company; resolveCompanyId should also handle org_id → company when possible.
  const company_id = resolveCompanyId(sp);

  // Explicit allow-list (IDs may be used without an owner – e.g., editor previews)
  const service_ids = (sp.get('service_ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Guard: never return “all services”
  if (!company_id && service_ids.length === 0) {
    return new NextResponse(
      'Required: company_id (preferred) or service_ids.',
      { status: 400 }
    );
  }

  const app = supabaseAdmin.schema('app');

  let q = app
    .from('services')
    .select('id,name,duration_minutes,active,company_id')
    .eq('active', true);

  // Apply owner scope when available
  if (company_id) q = q.eq('company_id', company_id);

  // Intersect with explicit allow-list when present
  if (service_ids.length) q = q.in('id', service_ids);

  const { data, error } = await q;

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  // Extra belt-and-suspenders client safety not needed here now, but keep response shape stable
  return NextResponse.json({ rows: data ?? [] });
}
