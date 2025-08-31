import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function serverAnon() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: async () => (await store).getAll().map(({ name, value }) => ({ name, value })),
        setAll: async (cks) => cks.forEach((c) => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );
}
async function requireAdmin() {
  const supa = await serverAnon();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: row } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).limit(1);
  return row?.[0] ? user : null;
}

export async function GET() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = 'https://platform.openai.com/docs/pricing';
  const res = await fetch(url, {
    headers: {
      'user-agent': 'QuickSites/ai-pricing-sync-debug',
      'accept': 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
    }
  });
  const html = await res.text();
  return NextResponse.json({ status: res.status, bytes: html.length, sample: html.slice(0, 4000) });
}
