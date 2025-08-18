import { NextRequest, NextResponse } from 'next/server';
        import { cookies } from 'next/headers';
        import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime='nodejs'; export const dynamic='force-dynamic';

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
  if (!user) return NextResponse.json({ meals: [] });

  const merchantId = new URL(req.url).searchParams.get('merchantId')!;
  const { data } = await supa
    .from('orders')
    .select('id, created_at, order_items ( meal_id, meals ( id, title ) )')
    .eq('user_id', user.id)
    .eq('merchant_id', merchantId)
    .gte('created_at', new Date(Date.now() - 30*24*3600e3).toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  const mealsMap = new Map<string, string>();
  (data||[]).forEach(o => o.order_items?.forEach((it:any) => mealsMap.set(it.meals.id, it.meals.title)));
  const meals = Array.from(mealsMap, ([id,title]) => ({ id, title }));
  return NextResponse.json({ meals });
}
