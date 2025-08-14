import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: merchant } = await supa.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  const { data, error } = await supa
    .from('social_webhooks')
    .select('id, name, endpoint_url, kind, created_at')
    .eq('merchant_id', merchant?.id || '')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // do NOT leak full URLs in UI if you prefer; mask later in UI
  return NextResponse.json({ webhooks: data ?? [] });
}
