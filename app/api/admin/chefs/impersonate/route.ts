import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = SupabaseClient<any, any, any>;

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
  const { data: auth } = await (supa as AnyClient).auth.getUser();
  if (!auth.user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await (supa as AnyClient)
    .from('admin_users').select('user_id').eq('user_id', auth.user.id).limit(1);
  if (!admin?.[0]) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const };
}

function deriveOrigin(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { email, next } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) as AnyClient;

  const origin = deriveOrigin(req);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next || '/chef/dashboard')}`;

  // Generate a one-time magic link that redirects back to our site
  const { data, error } = await (admin as any).auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url =
    (data?.properties?.action_link as string) ||
    (data as any)?.action_link ||
    (data?.properties as any)?.email_otp_action_link;

  if (!url) return NextResponse.json({ error: 'Could not create link' }, { status: 500 });

  return NextResponse.json({ ok: true, url });
}
