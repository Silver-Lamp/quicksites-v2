import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime='nodejs'; export const dynamic='force-dynamic';

export async function GET() {
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
  const { data: m } = await supa.from('merchants').select(
    'id, review_incentive_enabled, review_incentive_percent, review_incentive_min_subtotal_cents, review_incentive_expires_days, review_incentive_prefix, review_incentive_disclosure'
  ).eq('user_id', user?.id || '').maybeSingle();
  return NextResponse.json({ settings: m });
}

export async function PATCH(req: NextRequest) {
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
  const body = await req.json();

  const patch:any = {};
  if ('review_incentive_enabled' in body) patch.review_incentive_enabled = !!body.review_incentive_enabled;
  if ('review_incentive_percent' in body) patch.review_incentive_percent = Math.max(1, Math.min(50, Number(body.review_incentive_percent)));
  if ('review_incentive_min_subtotal_cents' in body) patch.review_incentive_min_subtotal_cents = Number(body.review_incentive_min_subtotal_cents||0);
  if ('review_incentive_expires_days' in body) patch.review_incentive_expires_days = Math.max(7, Math.min(180, Number(body.review_incentive_expires_days||30)));
  if ('review_incentive_prefix' in body) patch.review_incentive_prefix = String(body.review_incentive_prefix||'DM').slice(0,6).toUpperCase();
  if ('review_incentive_disclosure' in body) patch.review_incentive_disclosure = String(body.review_incentive_disclosure||'');
  await supa.from('merchants').update(patch).eq('user_id', user?.id || '');

  return NextResponse.json({ ok:true });
}
