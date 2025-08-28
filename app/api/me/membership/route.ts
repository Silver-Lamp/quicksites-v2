// app/api/me/membership/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lazy Stripe init (only if key is present) */
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return stripe;
}

/** Safely read a Unix-second field and return ISO string (or null). */
function unixToIso(obj: any, key: string): string | null {
  const v = obj && typeof obj[key] === 'number' ? obj[key] : null;
  return typeof v === 'number' ? new Date(v * 1000).toISOString() : null;
}

export async function GET(_req: NextRequest) {
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

  let planRec: any = null; // normalize to { source, plan, status, price_id?, trial_end?, current_period_end?, updated_at? }

  // ---------- 1) Lightweight table: user_plans ----------
  try {
    const { data } = await supa
      .from('user_plans')
      .select('plan, status, price_id, trial_end, current_period_end, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) planRec = { source: 'user_plans', ...data };
  } catch {}

  // ---------- 2) merchant_billing + (optional) live Stripe check ----------
  if (!planRec) {
    try {
      const { data: merchants } = await supa
        .from('merchants')
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at');

      const mIds = (merchants || []).map((m: any) => m.id);
      if (mIds.length) {
        const { data: mb } = await supa
          .from('merchant_billing')
          .select('merchant_id, stripe_customer_id, stripe_subscription_id, plan, updated_at')
          .in('merchant_id', mIds);

        const best: any = (mb || [])[0] || null;

        if (best) {
          const stripe = getStripe();
          if (stripe && (best.stripe_subscription_id || best.stripe_customer_id)) {
            try {
              let sub: import('stripe').Stripe.Subscription | null = null;

              if (best.stripe_subscription_id) {
                sub = await stripe.subscriptions.retrieve(best.stripe_subscription_id);
              } else if (best.stripe_customer_id) {
                const list = await stripe.subscriptions.list({
                  customer: best.stripe_customer_id,
                  status: 'all',
                  limit: 1,
                });
                sub = list.data[0] || null;
              }

              if (sub) {
                // derive a friendly label from the Stripe price/product
                let label: string | null = null;
                const price = sub.items.data[0]?.price;
                label = price?.nickname || (price?.lookup_key as string | null) || null;

                if (!label && price?.id) {
                  try {
                    const pr = await stripe.prices.retrieve(price.id);
                    label = pr.nickname || (pr.lookup_key as string | null) || null;
                    if (!label && typeof pr.product === 'string') {
                      const prod = await stripe.products.retrieve(pr.product);
                      label = prod.name || null;
                    }
                  } catch {}
                }

                planRec = {
                  source: 'merchant_billing+stripe',
                  plan: label || best.plan || 'Pro',
                  status: sub.status,
                  price_id: price?.id ?? null,
                  // read timestamp fields defensively; some local type decls omit them
                  trial_end: unixToIso(sub as any, 'trial_end'),
                  current_period_end: unixToIso(sub as any, 'current_period_end'),
                  updated_at: best.updated_at ?? null,
                };
              }
            } catch {
              // Stripe lookup failed — fall back to local mapping
              planRec = {
                source: 'merchant_billing',
                plan: best.plan || 'Pro',
                status: 'active',
                price_id: null,
                trial_end: null,
                current_period_end: null,
                updated_at: best.updated_at ?? null,
              };
            }
          } else {
            // No Stripe configured; expose a minimal mapping-based membership
            planRec = {
              source: 'merchant_billing',
              plan: best.plan || 'Pro',
              status: 'active',
              price_id: null,
              trial_end: null,
              current_period_end: null,
              updated_at: best.updated_at ?? null,
            };
          }
        }
      }
    } catch {}
  }

  // ---------- 3) Legacy fallbacks ----------
  if (!planRec) {
    const subTables = [
      { name: 'subscriptions', fields: 'status, price_id, current_period_end, trial_end, created' },
      { name: 'billing_subscriptions', fields: 'status, price_id, current_period_end, trial_end, created' },
      { name: 'stripe_subscriptions', fields: 'status, price_id, current_period_end, trial_end, created' },
    ] as const;

    for (const t of subTables) {
      try {
        const { data: sub }: { data: any } = await supa
          .from(t.name)
          .select(t.fields)
          .eq('user_id', user.id)
          .order('created', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!sub) continue;

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
        planRec = { source: t.name, plan: label, ...sub };
        break;
      } catch {}
    }
  }

  // ---------- Normalize response ----------
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

/**
 * Optional: if you keep a custom Stripe declaration elsewhere that lacks `current_period_end`,
 * this tiny augmentation fixes the TS error without copying Stripe’s whole spec.
 */
declare module 'stripe' {
  namespace Stripe {
    interface Subscription {
      /** Unix timestamp (seconds) for end of current billing period */
      current_period_end?: number;
    }
  }
}
