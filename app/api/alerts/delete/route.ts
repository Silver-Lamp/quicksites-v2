import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { subscriptionId, all } = await req.json();
  if (all) {
    const { error } = await supa
      .from('waitlist_subscriptions')
      .update({ status: 'unsubscribed' })
      .eq('user_id', user.id)
      .in('status', ['active','queued']);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 });
  const { error } = await supa
    .from('waitlist_subscriptions')
    .update({ status: 'unsubscribed' })
    .eq('id', subscriptionId)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
