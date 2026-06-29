// app/api/admin/site-settings/showcase-mode/route.ts
//
// Read (public) / set (admin-only) the homepage showcase display mode.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { SHOWCASE_MODE_KEY, DEFAULT_SHOWCASE_MODE, isShowcaseMode } from '@/lib/home/showcase-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Returns the admin user id, or null if the caller isn't an admin/owner. */
async function adminUserId(): Promise<string | null> {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach((c) => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );
  const { data: auth } = await (supa as any).auth.getUser();
  const user = auth?.user;
  if (!user) return null;

  const { data: au } = await (supa as any)
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .limit(1);
  if (au?.[0]) return user.id;

  const { data: prof } = await (supa as any)
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (prof && (prof.role === 'admin' || prof.role === 'owner')) return user.id;

  return null;
}

export async function GET() {
  const mode = await getSiteSetting<string>(SHOWCASE_MODE_KEY, DEFAULT_SHOWCASE_MODE);
  return NextResponse.json({ mode: isShowcaseMode(mode) ? mode : DEFAULT_SHOWCASE_MODE });
}

export async function PUT(req: NextRequest) {
  const adminId = await adminUserId();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const mode = body?.mode;
  if (!isShowcaseMode(mode)) return NextResponse.json({ error: 'invalid mode' }, { status: 400 });

  try {
    await setSiteSetting(SHOWCASE_MODE_KEY, mode, adminId);
    return NextResponse.json({ ok: true, mode });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed to save' }, { status: 500 });
  }
}
