import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const org_id = searchParams.get('org_id');
  const service_ids = (searchParams.get('service_ids') || '').split(',').filter(Boolean);

  let q = supabaseAdmin.from('app.services').select('id,name,duration_minutes,active').eq('active', true);
  if (org_id) q = q.eq('org_id', org_id);
  if (service_ids.length) q = q.in('id', service_ids);

  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
