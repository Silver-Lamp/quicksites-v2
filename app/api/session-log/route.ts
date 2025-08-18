// app/api/session-log/route.ts
import { getServerSupabase } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/supabase';

export async function POST(req: Request) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const userAgent = req.headers.get('user-agent') ?? 'unknown';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  await supabase
    .from('user_profiles')
    .update({ last_seen_at: now })
    .eq('user_id', user.id);

  await supabase.from('session_logs').insert({
    type: 'login_callback',
    email: user.email,
    user_id: user.id,
    user_agent: userAgent,
    ip,
    timestamp: now,
  });

  return NextResponse.json({ success: true });
}
