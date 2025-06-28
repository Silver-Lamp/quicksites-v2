// Use logEvent() when you need to log an event
// Use getUserFromRequest() when you need the user context

import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const cookieStore = cookies(); // ✅ no need to await
  const headerStore = headers();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore;
          return cookie.get(name)?.value;
        },
      },
    }
  );

  const { href, type = 'nav_click', meta = {} } = await req.json();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('❌ Failed to get user:', userError.message);
  }

  const ip =
    (await headerStore).get('x-forwarded-for')?.split(',')[0]?.trim() ||
    (await headerStore).get('x-real-ip') ||
    'unknown';

  const userAgent = (await headerStore).get('user-agent') || 'unknown';

  const { data: inserted, error } = await supabase
    .from('nav_events')
    .insert({
      user_id: user?.id ?? null,
      href,
      type,
      meta,
      ip,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error inserting nav_event:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, inserted });
}
