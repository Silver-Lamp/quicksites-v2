import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const org_id = searchParams.get('org_id');

  let q = supabaseAdmin.from('app.resources').select('id,name,active').eq('active', true);
  if (org_id) q = q.eq('org_id', org_id);

  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
