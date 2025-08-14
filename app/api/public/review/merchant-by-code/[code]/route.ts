import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(_: Request, { params }:{ params:{ code:string } }) {
  const { data, error } = await db.from('merchants').select('id, display_name, name, review_code')
    .eq('review_code', params.code).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    await db.from('qr_scan_events').insert({ merchant_id: data.id, code: params.code });
  } catch {}
  return NextResponse.json({ merchant: { id: data.id, name: data.display_name || data.name || 'Chef' } });
}
