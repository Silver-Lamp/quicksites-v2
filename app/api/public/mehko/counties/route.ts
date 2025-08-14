import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const state = (new URL(req.url).searchParams.get('state') || 'CA').toUpperCase();
  const { data } = await svc.from('mehko_opt_in_counties')
    .select('county').eq('state', state).eq('active', true).order('county', { ascending: true });
  return NextResponse.json({ counties: (data||[]).map(d=>d.county) });
}
