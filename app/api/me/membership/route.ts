// app/api/me/membership/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let planRec: any = null;

  // Try simple user_plans first (preferred for inline edits)
  try {
    const { data } = await supa
      .from('user_plans')
      .select('plan, status, price_id, trial_end, current_period_end, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) planRec = { source: 'user_plans', ...data };
  } catch {}

  // Fallback to Stripe-like subscription tables if visible via RLS
  if (!planRec) {
    const subTables = [
      { name: 'subscriptions', fields: 'status, price_id, current_period_end, trial_end, created' },
      { name: 'billing_subscriptions', fields: 'status, price_id, current_period_end, trial_end, created' },
      { name: 'stripe_subscriptions', fields: 'status, price_id, current_period_end, trial_end, created' },
    ];
    for (const t of subTables) {
      try {
        const { data: sub }: { data: any } = await supa
          .from(t.name)
          .select(t.fields)
          .eq('user_id', user.id)
          .order('created', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sub) {
          let label: string | null = null;
          if (sub?.price_id) {
            try {
              const { data: price } = await supa
                .from('prices')
                .select('nickname, lookup_key, product_id')
                .eq('id', sub?.price_id)
                .maybeSingle();
              if (price) {
                label = price.nickname ?? price.lookup_key ?? null;
                if (!label && price.product_id) {
                  const { data: product } = await supa
                    .from('products')
                    .select('name')
                    .eq('id', price.product_id)
                    .maybeSingle();
                  label = product?.name ?? null;
                }
              }
            } catch {}
          }
          planRec = { source: t.name, plan: label, ...sub } as any;
          break;
        }
      } catch {}
    }
  }

  const membership = {
    plan: planRec?.plan ?? 'free',
    label: planRec?.plan ?? (planRec ? '—' : 'Free'),
    status: planRec?.status ?? (planRec ? 'active' : 'none'),
    price_id: planRec?.price_id ?? null,
    trial_end: planRec?.trial_end ?? null,
    current_period_end: planRec?.current_period_end ?? null,
    updated_at: planRec?.updated_at ?? null,
    source: planRec?.source ?? 'unknown',
  };

  return NextResponse.json({ ok: true, membership });
}