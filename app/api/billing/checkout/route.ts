import { NextRequest, NextResponse } from 'next/server';
// import Stripe from 'stripe';
import { getServerSupabase } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';

export async function POST(req: NextRequest) {
  const supa = await getServerSupabase();
  const { data: u } = await supa.auth.getUser();
  if (!u?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const priceId = body?.priceId || process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!priceId) return NextResponse.json({ error: 'missing price id' }, { status: 400 });

  // Ensure the user has a Merchant (used for commissions + mapping)
  const merchantId = await ensureMerchantForUser(supa, u.user);

  // Success/cancel URLs
  const origin = process.env.QS_PUBLIC_URL || req.headers.get('origin') || 'http://localhost:3000';
  const success_url = `${origin}/profile?upgraded=1`;
  const cancel_url = `${origin}/profile?canceled=1`;

  // Create subscription checkout; let webhook persist mapping afterward
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url,
    cancel_url,
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: u.user.email ?? undefined,
    allow_promotion_codes: true,
    // make sure merchant_id flows through to invoices -> our billing webhook can attribute
    metadata: { merchant_id: merchantId, user_id: u.user.id },
    subscription_data: {
      metadata: { merchant_id: merchantId, user_id: u.user.id },
    },
  });

  return NextResponse.json({ url: session.url });
}

/** Finds or creates a Merchant for this user. */
async function ensureMerchantForUser(supa: ReturnType<typeof getServerSupabase> extends Promise<infer T> ? T : any, user: any) {
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
  const { data: created, error } = await supa.from('merchants').insert({
    owner_id: user.id,
    display_name: display,
    site_slug: slug,
    default_currency: 'USD',
  }).select('id').single();
  if (error) throw error;
  return created.id;
}
