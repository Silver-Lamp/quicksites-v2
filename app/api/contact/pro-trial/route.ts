// app/api/contact/pro-trial/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

  const { data: auth } = await supa.auth.getUser();
  const user = auth?.user;
  const body = await req.json().catch(() => ({}));
  const message: string = String(body?.message ?? '').slice(0, 2000);
  const plan: string = String(body?.plan ?? 'pro');
  const ctx: Record<string, any> = body?.context ?? {};

  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Try writing into a generic contact_messages table first
  let ok = false;
  try {
    const { error } = await supa.from('contact_messages' as any).insert({
      user_id: user.id,
      email: user.email,
      subject: 'Pro trial request',
      message: message || `User ${user.email} requested a ${plan.toUpperCase()} trial via Profile page`,
      meta: { plan, context: ctx },
      created_at: new Date().toISOString(),
    });
    if (!error) ok = true;
  } catch {}

  // Fallback: use access_requests table if contact_messages doesn't exist
  if (!ok) {
    try {
      const { error } = await supa.from('access_requests' as any).insert({
        user_id: user.id,
        email: user.email,
        reason: `Pro trial request (plan=${plan})`,
        requested_at: new Date().toISOString(),
      });
      if (!error) ok = true;
    } catch {}
  }

  if (!ok) return NextResponse.json({ error: 'Unable to record request' }, { status: 500 });
  return NextResponse.json({ ok: true });
}