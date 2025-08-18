import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const store = await cookies();
  const supa = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ coupon: null });

  const u = new URL(req.url);
  const merchantId = u.searchParams.get('merchantId');
  if (!merchantId) return NextResponse.json({ error: 'merchantId required' }, { status: 400 });

  const nowIso = new Date().toISOString();
  const { data: c } = await supa
    .from('coupons')
    .select('id, code, type, percent, amount_cents, min_subtotal_cents, currency, expires_at, uses_allowed, uses_count, status')
    .eq('merchant_id', merchantId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(1);

  return NextResponse.json({ coupon: c?.[0] || null });
}
