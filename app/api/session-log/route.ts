// app/api/session-log/route.ts
import { getServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  await supabase
    .from('user_profiles')
    .update({ last_seen_at: now })
    .eq('user_id', user.id);

  // user_agent and ip are not in session_logs Insert type (not live DB cols) — omit them
  await supabase.from('session_logs').insert({
    type: 'login_callback',
    email: user.email,
    user_id: user.id,
    timestamp: now,
  });

  return NextResponse.json({ success: true });
}
