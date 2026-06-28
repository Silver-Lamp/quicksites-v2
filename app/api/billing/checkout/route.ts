import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getServerSupabase } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';
import { buildAgencyLineItems, agencyDiscountConfig } from '@/lib/billing/agency';
import { countBillableSites, planForTier, type AgencyTier } from '@/lib/billing/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Creates a Stripe subscription Checkout session.
 *
 * Two shapes:
 *  - Agency (Path B): body `{ tier: 'founder'|'public', sites?: number }` →
 *    per-user platform line + per-site line (quantity = sites). Founder applies
 *    the configured grandfather coupon(s).
 *  - Legacy: body `{ priceId }` (or STRIPE_PRICE_PRO_MONTHLY) → single price.
 */
export async function POST(req: NextRequest) {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const tierRaw = typeof body?.tier === 'string' ? body.tier.toLowerCase() : null;
  const isAgency = tierRaw === 'founder' || tierRaw === 'public';

  // Ensure the user has a Merchant (used for commissions + billing mapping)
  const merchantId = await ensureMerchantForUser(supa, u.user);

  const origin = process.env.QS_PUBLIC_URL || req.headers.get('origin') || 'http://localhost:3000';
  const success_url = `${origin}/profile?upgraded=1`;
  const cancel_url = `${origin}/profile?canceled=1`;

  const baseParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    success_url,
    cancel_url,
    customer_email: u.user.email ?? undefined,
    metadata: { merchant_id: merchantId, user_id: u.user.id },
  };

  let params: Stripe.Checkout.SessionCreateParams;

  if (isAgency) {
    const tier = tierRaw as AgencyTier;
    // Default the per-site quantity to the user's current published-site count;
    // accept an explicit `sites` override; never below 1. Nightly sync corrects it.
    let sites = Number.isFinite(body?.sites) ? Math.floor(Number(body.sites)) : 0;
    if (sites <= 0) {
      try {
        sites = await countBillableSites(supa as any, u.user.id);
      } catch {
        sites = 0;
      }
    }

    let line_items: Stripe.Checkout.SessionCreateParams.LineItem[];
    try {
      line_items = buildAgencyLineItems(sites);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'agency prices not configured' }, { status: 400 });
    }

    params = {
      ...baseParams,
      line_items,
      ...agencyDiscountConfig(tier),
      metadata: { ...baseParams.metadata!, tier, plan: planForTier(tier) },
      subscription_data: {
        metadata: { merchant_id: merchantId, user_id: u.user.id, tier, plan: planForTier(tier) },
      },
    };
  } else {
    const priceId = body?.priceId || process.env.STRIPE_PRICE_PRO_MONTHLY;
    if (!priceId) return NextResponse.json({ error: 'missing price id' }, { status: 400 });
    params = {
      ...baseParams,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { merchant_id: merchantId, user_id: u.user.id },
      },
    };
  }

  const session = await stripe.checkout.sessions.create(params);
  return NextResponse.json({ url: session.url });
}

/** Finds or creates a Merchant for this user. */
async function ensureMerchantForUser(
  supa: ReturnType<typeof getServerSupabase> extends Promise<infer T> ? T : any,
  user: any
) {
  const { data: existing } = await supa
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at')
    .limit(1);

  if (existing?.[0]?.id) return existing[0].id;

  // Insert via session (RLS allows owner to insert)
  const display = user.user_metadata?.name || user.email?.split('@')[0] || 'My Account';
  const slug = `acct-${user.id.slice(0, 8)}`;
  // merchants requires user_id (non-nullable); include it alongside owner_id — pattern D
  const { data: created, error } = await supa.from('merchants').insert({
    owner_id: user.id,
    user_id: user.id,
    display_name: display,
    site_slug: slug,
    default_currency: 'USD',
  }).select('id').single();
  if (error) throw error;
  return created.id;
}
