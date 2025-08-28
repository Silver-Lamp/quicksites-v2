import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = ReturnType<typeof createServerClient<any>>;

async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach(c => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );

  const { data: auth } = await supa.auth.getUser();
  if (!auth.user) return { code: 401 as const, error: 'Not signed in' };

  const { data: admin } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', auth.user.id)
    .limit(1);

  if (!admin?.[0]) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const };
}

function getOrigin(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`.replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });

  const { email, next } = await req.json().catch(() => ({} as { email?: string; next?: string }));
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const origin = getOrigin(req);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next || '/merchant/dashboard')}`;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Generate a magiclink without sending an email; returns action_link we can open directly.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: String(email).toLowerCase(),
    options: { redirectTo },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = (data as any)?.properties?.action_link || (data as any)?.action_link;
  if (!url) return NextResponse.json({ error: 'Could not create action link' }, { status: 500 });

  return NextResponse.json({ ok: true, url });
}
