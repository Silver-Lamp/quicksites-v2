import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/server';
import { resolveMerchantFeeDefault } from '@/lib/commerce/pricingPolicy';
import { requireMerchantOwner } from '@/lib/auth/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!);

/**
 * Start Stripe Connect (Express) onboarding for a merchant and write the canonical
 * `payment_accounts` row. Status stays 'pending' until charges_enabled (finalized
 * by GET /api/connect/status). Replaces the deprecated merchant_payment_accounts path.
 */
export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e: any) {
    /**
     * ⚠️ A MONEY-PATH ROUTE MUST NEVER RETURN A BODILESS 500.
     *
     * This one did, twice in a day, and the owner saw "Could not start Stripe setup. Please try
     * again." both times — advice that could not work, with nothing to act on. I diagnosed it
     * once from the code and was WRONG (blamed an empty base URL; the fix deployed and the 500
     * persisted, and it was a 500 rather than the 502 that fix would have produced — which is
     * the detail that disproved it).
     *
     * The failure is somewhere before the account link is built, and no log I can reach says
     * where. So the route now reports its own cause: Stripe's `code`/`type` and message reach
     * the client instead of being swallowed by the framework's default handler. Guessing from
     * source was cheaper than instrumenting right up until it was twice as expensive.
     */
    const raw = e?.raw ?? e;
    const detail = [raw?.type, raw?.code, raw?.message].filter(Boolean).join(' · ');
    console.error('[connect/onboard] unhandled', detail || e);
    return NextResponse.json(
      { error: detail || 'Stripe onboarding failed for an unknown reason.', where: 'connect/onboard' },
      { status: 502 },
    );
  }
}

async function handle(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 400 });
  }
  const { merchantId } = await req.json();
  if (!merchantId) return NextResponse.json({ error: 'merchantId required' }, { status: 400 });

  const gate = await requireMerchantOwner(merchantId);
  if (gate instanceof NextResponse) return gate;

  // Reuse an existing connected account if we already started one
  const { data: existing } = await supabase
    .from('payment_accounts')
    .select('account_ref')
    .eq('merchant_id', merchantId)
    .eq('provider', 'stripe')
    .maybeSingle();

  let accountId = existing?.account_ref as string | undefined;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: 'express' });
    accountId = account.id;
  }

  // Canonical row (pending until onboarding completes). Fee config seeded from the
  // market default for this merchant's vertical (menu-ordering → restaurant terms,
  // else general); adjustable later via /api/merchant/payment-accounts or the UI.
  const fee = await resolveMerchantFeeDefault(merchantId);
  const { error } = await supabase.from('payment_accounts').upsert(
    {
      merchant_id: merchantId,
      provider: 'stripe',
      account_ref: accountId,
      status: 'pending',
      collect_platform_fee: fee.collect,
      platform_fee_percent: fee.percent,
      platform_fee_min_cents: fee.minCents,
    },
    { onConflict: 'merchant_id,provider' }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  /**
   * ⚠️ THIS MUST BE ABSOLUTE, AND IT WAS SILENTLY EMPTY IN PRODUCTION.
   *
   * The base was `APP_BASE_URL || QS_PUBLIC_URL || ''` and NEITHER is set on this project, so
   * the account link went to Stripe with `refresh_url: "/merchant/connect?..."`. Stripe requires
   * an absolute URL, threw, and — with no try/catch on this route — the owner got a bare 500 and
   * "Could not start Stripe setup. Please try again." Trying again could never have worked.
   *
   * The literal default is the fix that cannot regress: a deploy with no env at all still
   * produces a valid URL. The env vars stay first so a preview deploy can point at itself.
   */
  const base = (
    process.env.APP_BASE_URL ||
    process.env.QS_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.quicksites.ai'
  ).replace(/\/+$/, '');

  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/merchant/connect?merchant=${merchantId}&state=refresh`,
      return_url: `${base}/merchant/connect?merchant=${merchantId}&state=return`,
      type: 'account_onboarding',
    });
    return NextResponse.json({ url: link.url, accountId });
  } catch (e: any) {
    // Surface Stripe's own message. "Please try again" is the wrong advice for a
    // misconfiguration, and a 500 with no body gave the operator nothing to act on.
    const message = e?.raw?.message || e?.message || 'Stripe rejected the onboarding link.';
    return NextResponse.json({ error: `Stripe onboarding failed: ${message}` }, { status: 502 });
  }
}
