import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const cookieStore = cookies();
  const headerStore = await headers();

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
  const { data: { user } } = await supabase.auth.getUser();

  const ip =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip') ||
    'unknown';

  const userAgent = headerStore.get('user-agent') || 'unknown';

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, inserted }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
