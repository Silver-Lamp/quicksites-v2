import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string): string | undefined {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { href, type = 'nav_click', meta = {} } = await req.json();
  const { data: user } = await supabase.auth.getUser();

  const ip = headerStore.get('x-forwarded-for') || headerStore.get('x-real-ip') || 'unknown';
  const userAgent = headerStore.get('user-agent') || 'unknown';

  const { data: inserted, error } = await supabase
    .from('nav_events')
    .insert({
      user_id: user.user?.id ?? null,
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
