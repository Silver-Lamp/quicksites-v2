import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
import { resolveCompanyId } from '@/lib/server/resolveCompanyId';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const company_id = resolveCompanyId(sp);
  const service_ids = (sp.get('service_ids') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const app = supabaseAdmin.schema('app');

  let q = app.from('services')
    .select('id,name,duration_minutes,active,company_id')
    .eq('active', true);

  if (company_id) q = q.eq('company_id', company_id);
  if (service_ids.length) q = q.in('id', service_ids);

  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
