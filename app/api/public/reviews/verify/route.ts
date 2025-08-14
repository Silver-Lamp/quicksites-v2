import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

const svc2 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const { data: t } = await svc2
    .from('review_tokens')
    .select('token, meal_id, chef_id, site_id, expires_at, consumed_at')
    .eq('token', token)
    .maybeSingle();

  if (!t) return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
  if (t.consumed_at) return NextResponse.json({ error: 'token_consumed' }, { status: 410 });
  if (new Date(t.expires_at) < new Date()) return NextResponse.json({ error: 'token_expired' }, { status: 410 });

  // Load meal details for the page header
  const { data: m } = await svc2
    .from('meals')
    .select('id, slug, title, image_url, chef_id')
    .eq('id', t.meal_id)
    .maybeSingle();

  return NextResponse.json({ ok: true, meal: m, token });
}