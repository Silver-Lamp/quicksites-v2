// app/api/billing/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getServerSupabase } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.QS_BILLING_STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('QS_BILLING_STRIPE_WEBHOOK_SECRET not set');
    return new NextResponse('server misconfigured', { status: 500 });
  }

  // Verify signature
  const raw = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    console.error('QS billing webhook signature error', err?.message);
    return new NextResponse('bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      // ----- Checkout finished (subscription mode) -----
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === 'subscription') {
          const merchantId = (s.metadata as any)?.merchant_id as string | undefined;
          const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
          const subscriptionId =
            typeof s.subscription === 'string' ? s.subscription : s.subscription?.id;
          await upsertMerchantBillingFromStripe({ merchantId, customerId, subscriptionId });
        }
        break;
      }

      // ----- Subscription lifecycle events -----
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const merchantId = (sub.metadata as any)?.merchant_id as string | undefined;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        await upsertMerchantBillingFromStripe({
          merchantId,
          customerId,
          subscriptionId: sub.id,
          subscription: sub,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const merchantId = (sub.metadata as any)?.merchant_id as string | undefined;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        await clearSubscriptionFromMapping({ merchantId, customerId, subscriptionId: sub.id });
        break;
      }

      // ----- Invoice paid (commission ledger + lock attribution) -----
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await recordCommissionForSubscriptionInvoice(invoice);
        break;
      }

      default:
        // ignore other event types silently
        break;
    }

    return new NextResponse('ok', { status: 200 });
  } catch (e: any) {
    console.error('billing webhook error', event.type, e?.message || e);
    return new NextResponse('error', { status: 500 });
  }
}

/* ===================== helpers ===================== */

async function upsertMerchantBillingFromStripe(opts: {
  merchantId?: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  subscription?: Stripe.Subscription | null;
}) {
  const { merchantId, customerId, subscriptionId } = opts;
  const supa = await getServerSupabase({ serviceRole: true });

  // If we weren't given the subscription, fetch it (we need price/plan)
  const sub =
    opts.subscription ||
    (subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null);

  // Build label + price
  let planLabel: string | null = null;
  let priceCents: number | null = null;

  const price = sub?.items.data?.[0]?.price;
  if (price) {
    priceCents = typeof price.unit_amount === 'number' ? price.unit_amount : null;
    planLabel = price.nickname || (price.lookup_key as string | null) || null;
    if (!planLabel && typeof price.product === 'string') {
      try {
        const prod = await stripe.products.retrieve(price.product);
        planLabel = prod.name || null;
      } catch {
        /* ignore */
      }
    }
  }

  // If we know the merchant, upsert directly on key merchant_id.
  if (merchantId) {
    const patch: any = {
      merchant_id: merchantId,
      plan: planLabel || 'Pro',
      price_cents: priceCents ?? 0,
      stripe_customer_id: customerId || null,
      stripe_subscription_id: sub?.id || subscriptionId || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supa
      .from('merchant_billing')
      .upsert(patch, { onConflict: 'merchant_id' });
    if (error) throw error;
    return;
  }

  // No merchant_id in metadata: try to locate an existing row by customer/subscription and update it.
  if (customerId) {
    const { data: mb } = await supa
      .from('merchant_billing')
      .select('merchant_id')
      .eq('stripe_customer_id', customerId)
      .limit(1)
      .maybeSingle();
    if (mb?.merchant_id) {
      const patch: any = {
        plan: planLabel || 'Pro',
        price_cents: priceCents ?? 0,
        stripe_subscription_id: sub?.id || subscriptionId || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supa
        .from('merchant_billing')
        .update(patch)
        .eq('merchant_id', mb.merchant_id);
      if (error) throw error;
    }
  }
}

async function clearSubscriptionFromMapping(opts: {
  merchantId?: string;
  customerId?: string | null;
  subscriptionId?: string | null;
}) {
  const { merchantId, customerId } = opts;
  const supa = await getServerSupabase({ serviceRole: true });

  if (merchantId) {
    await supa
      .from('merchant_billing')
      .update({ stripe_subscription_id: null, updated_at: new Date().toISOString() })
      .eq('merchant_id', merchantId);
    return;
  }
  if (customerId) {
    const { data: mb } = await supa
      .from('merchant_billing')
      .select('merchant_id')
      .eq('stripe_customer_id', customerId)
      .limit(1)
      .maybeSingle();
    if (mb?.merchant_id) {
      await supa
        .from('merchant_billing')
        .update({ stripe_subscription_id: null, updated_at: new Date().toISOString() })
        .eq('merchant_id', mb.merchant_id);
    }
  }
}

async function recordCommissionForSubscriptionInvoice(invoice: Stripe.Invoice) {
  const supa = await getServerSupabase({ serviceRole: true });

  const stripeCustomerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!stripeCustomerId || !invoice.total) return;

  // Find merchant via billing mapping (or metadata fallback)
  const { data: mb } = await supa
    .from('merchant_billing')
    .select('merchant_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()
    .throwOnError();

  const merchantId: string =
    mb?.merchant_id || ((invoice.metadata?.merchant_id as string) || '');

  if (!merchantId) return;

  // Attribution (lock if first revenue)
  const { data: attr } = await supa
    .from('attributions')
    .select('merchant_id, referral_code, first_touch_at, locked_at')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (!attr?.referral_code) return;

  // Load referral plan for code
  const { data: code } = await supa
    .from('referral_codes')
    .select('code, plan')
    .eq('code', attr.referral_code)
    .single()
    .throwOnError();

  const plan = (code.plan || {}) as any; // { type:'percent', rate:0.x, duration_months:n }
  const duration = Number(plan.duration_months || 0);

  // Respect duration window
  if (duration > 0 && attr.first_touch_at) {
    const start = new Date(attr.first_touch_at);
    const now = new Date(invoice.created * 1000);
    const monthsElapsed =
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (monthsElapsed >= duration) return;
  }

  // Compute commission
  const totalCents = invoice.total || 0;
  let amountCents = 0;
  if (plan.type === 'percent') {
    amountCents = Math.floor(totalCents * Number(plan.rate || 0));
  } else if (plan.type === 'flat_cents') {
    amountCents = Number(plan.flat_cents || 0);
  }
  if (amountCents <= 0) return;

  // Upsert to ledger (idempotent by unique index referral_code+subject+subject_id)
  const payload = {
    referral_code: code.code,
    subject: 'qs_subscription',
    subject_id: invoice.id,
    amount_cents: amountCents,
    currency: (invoice.currency || 'usd').toUpperCase(),
    status: 'pending',
    adjustments: { invoice_total_cents: totalCents, merchant_id: merchantId },
  };

  const { error } = await supa
    .from('commission_ledger')
    .upsert(payload, { onConflict: 'referral_code,subject,subject_id' });
  if (error) throw error;

  // Lock attribution on first revenue
  await supa
    .from('attributions')
    .update({ locked_at: new Date().toISOString() })
    .eq('merchant_id', merchantId)
    .is('locked_at', null);
}
