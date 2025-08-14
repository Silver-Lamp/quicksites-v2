// /app/l/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const { data } = await db.from('short_links').select('long_url').eq('code', params.code).maybeSingle();
  const to = data?.long_url || process.env.APP_BASE_URL!;
  await db.from('short_link_clicks').insert({
    code: params.code, ip: req.headers.get('x-forwarded-for')?.split(',')[0], ua: req.headers.get('user-agent'), referer: req.headers.get('referer')
  });
  return NextResponse.redirect(to, 302);
}
