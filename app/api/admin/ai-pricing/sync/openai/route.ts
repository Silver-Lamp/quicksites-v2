import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { syncOpenAIPrices } from '@/lib/ai/pricing-sync/openaiSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function serverAnon() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
    //   cookieEncoding: 'base64url',
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
  const { data: adminRow } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .limit(1);
  return adminRow?.[0] ? user : null;
}

export async function POST() {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const result = await syncOpenAIPrices(); // { applied, queued, status }
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'sync failed' }, { status: 500 });
  }
}
