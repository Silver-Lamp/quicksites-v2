// app/api/org/billing/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { resolveOrg } from '@/lib/org/resolveOrg';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Narrow/augment the org shape locally for billing fields
type OrgWithBilling = Awaited<ReturnType<typeof resolveOrg>> & {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_connect_account_id?: string | null;
  billing_mode?: 'central' | 'reseller' | 'none';
};

function json(data: any, init?: number | ResponseInit) {
  return NextResponse.json(data, init as ResponseInit);
}

export async function POST() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const org = (await resolveOrg()) as OrgWithBilling;

    // Decide whether this org is billed centrally or via a Connect account
    const mode = org.billing_mode ?? 'central';
    const customerId = org.stripe_customer_id ?? undefined;
    const connectAccount = org.stripe_connect_account_id ?? undefined;

    if (!customerId) {
      return json(
        { error: 'This organization does not have a Stripe customer configured.' },
        { status: 400 }
      );
    }

    const returnUrl =
      `${process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'}/admin/org`;

    // Create a Customer Portal session
    const session =
      mode === 'reseller' && connectAccount
        ? await stripe.billingPortal.sessions.create(
            { customer: customerId, return_url: returnUrl },
            { stripeAccount: connectAccount }
          )
        : await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
          });

    return json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('org/billing error:', err);
    return json(
      { error: err?.message ?? 'Unexpected error creating billing portal session' },
      { status: 500 }
    );
  }
}

// Optional: block GET to make intent explicit
export async function GET() {
  return json({ error: 'Method not allowed' }, { status: 405 });
}
