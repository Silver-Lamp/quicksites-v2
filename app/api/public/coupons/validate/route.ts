import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeDiscount } from '@/lib/coupons';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime='nodejs'; export const dynamic='force-dynamic';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
    const { code, merchantId, subtotalCents } = await req.json();
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
  
    const { data: c } = await db
      .from('coupons')
      .select('*')
      .eq('code', String(code).trim().toUpperCase())
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (!c) return NextResponse.json({ valid:false, reason:'not_found' }, { status:404 });
  
    // 🔐 if coupon is bound to a user, require same user to be signed in
    if (c.user_id && (!user || user.id !== c.user_id)) {
      return NextResponse.json({ valid:false, reason:'not_owner' }, { status:200 });
    }
  
    const discount = computeDiscount(Number(subtotalCents||0), c as any);
    if (discount <= 0) return NextResponse.json({ valid:false, reason:'ineligible' }, { status:200 });
  
    return NextResponse.json({ valid:true, discountCents: discount, currency: c.currency });
  }
