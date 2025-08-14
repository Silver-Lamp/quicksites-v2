import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await db.from('meals').select('slug').eq('id', params.id).maybeSingle();
  const handle = data?.slug || params.id;
  return NextResponse.redirect(new URL(`/meals/${handle}`, process.env.APP_BASE_URL), 301);
}
