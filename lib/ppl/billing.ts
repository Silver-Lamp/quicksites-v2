// lib/ppl/billing.ts
//
// The money path for pay-per-call: bill a completed call, reload the balance from the card on
// file, and accept a deposit from a Checkout session. Every write goes through postLedger, so
// the DB's unique indexes — not this code — decide whether a charge or credit already happened.
//
// Order of operations on a billable call, and why:
//   1. post the lead charge (idempotent on CallSid — a Twilio retry returns null and we stop);
//   2. if the balance is now under the threshold, reload with a key derived from THAT charge's
//      ledger id (so a second charge in the same second gets its own key and its own decision —
//      but its decision is made against the balance the first reload already raised, so it does
//      not fire);
//   3. credit the reload with the PaymentIntent id as the ledger's unique key — Stripe returning
//      the same PI for a retried key credits once;
//   4. if the balance is at/under zero and no reload landed, pause the account and say so.
// Notifications are last and best-effort.

import type Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';
import { stripe } from '@/lib/stripe/server';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import {
  getPplAccount,
  getPplAccountByCampaign,
  postLedger,
  updatePplAccount,
  type PplAccount,
  type PplLedgerRow,
} from '@/lib/ppl/accounts';
import { isBillableCall, needsReload, reloadIdempotencyKey } from '@/lib/ppl/rules';
import {
  notifyLeadBilled,
  notifyPaused,
  notifyReloadFailed,
  notifyReloaded,
} from '@/lib/ppl/notify';

export function pplEnabled(): boolean {
  return process.env.PPL_ENABLED === '1' || process.env.PPL_ENABLED === 'true';
}

export type BillCallResult =
  | { outcome: 'not_billable'; reason: 'not_answered' | 'too_short' | 'no_account' }
  | { outcome: 'already_billed' }
  | {
      outcome: 'billed';
      ledgerId: string;
      balanceAfterCents: number;
      reload: ReloadResult | null;
      paused: boolean;
    };

export type ReloadResult =
  | {
      ok: true;
      paymentIntentId: string;
      amountCents: number;
      balanceAfterCents: number;
      alreadyCredited: boolean;
    }
  | { ok: false; reason: string };

/** Called from the signed Twilio <Dial action> callback with the bridged leg's outcome. */
export async function billCompletedCall(args: {
  campaignId: string;
  callSid: string;
  callerNumber: string | null;
  dialStatus: string | null;
  dialDurationSeconds: number;
}): Promise<BillCallResult> {
  const account = await getPplAccountByCampaign(args.campaignId);
  if (!account) return { outcome: 'not_billable', reason: 'no_account' };

  const b = isBillableCall({
    dialStatus: args.dialStatus,
    connectedSeconds: args.dialDurationSeconds,
    minBillableSeconds: account.min_billable_seconds,
  });
  if (!b.billable) return { outcome: 'not_billable', reason: b.reason };

  const charge = await postLedger({
    account_id: account.id,
    kind: 'lead_charge',
    amount_cents: -account.cpl_cents,
    call_sid: args.callSid,
    caller_number: args.callerNumber,
    duration_seconds: args.dialDurationSeconds,
    memo: `Lead: ${args.dialDurationSeconds}s call`,
  });
  if (!charge) return { outcome: 'already_billed' };

  let balanceAfter = charge.balance_after_cents;
  let reload: ReloadResult | null = null;
  if (needsReload(account, balanceAfter)) {
    reload = await attemptAutoReload(account, charge);
    if (reload.ok) balanceAfter = reload.balanceAfterCents;
  }

  let paused = false;
  if (balanceAfter < account.cpl_cents && account.status === 'active') {
    // Cannot afford the next lead and nothing refilled it: stop bridging calls, and say so.
    await updatePplAccount(account.id, {
      status: 'paused',
      paused_reason: 'balance',
      paused_at: new Date().toISOString(),
    });
    paused = true;
    const fresh = (await getPplAccount(account.id)) ?? account;
    await notifyPaused(fresh, { updateUrl: await billingPortalUrl(account) });
  }

  await notifyLeadBilled(account, {
    callerNumber: args.callerNumber,
    durationSeconds: args.dialDurationSeconds,
    balanceAfterCents: balanceAfter,
  });

  return {
    outcome: 'billed',
    ledgerId: charge.id,
    balanceAfterCents: balanceAfter,
    reload,
    paused,
  };
}

/** Charge the saved card off-session and credit the balance. Idempotent per triggering charge. */
export async function attemptAutoReload(
  account: PplAccount,
  trigger: PplLedgerRow
): Promise<ReloadResult> {
  if (!account.stripe_customer_id || !account.stripe_payment_method_id) {
    return { ok: false, reason: 'no_card_on_file' };
  }
  const amount = account.reload_amount_cents;
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.create(
      {
        amount,
        currency: 'usd',
        customer: account.stripe_customer_id,
        payment_method: account.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Prepaid lead balance top-up — ${account.business_name}`,
        metadata: { ppl_account_id: account.id, trigger_ledger_id: trigger.id },
      },
      { idempotencyKey: reloadIdempotencyKey(account.id, trigger.id) }
    );
  } catch (e: any) {
    const reason = e?.decline_code || e?.code || e?.message || 'declined';
    await notifyReloadFailed(account, {
      amountCents: amount,
      reason,
      updateUrl: await billingPortalUrl(account),
    });
    return { ok: false, reason };
  }

  if (pi.status !== 'succeeded') {
    // requires_action (3DS) cannot be completed off-session; it is a failure the owner must fix.
    const reason = `payment_${pi.status}`;
    await notifyReloadFailed(account, {
      amountCents: amount,
      reason,
      updateUrl: await billingPortalUrl(account),
    });
    return { ok: false, reason };
  }

  const credit = await postLedger({
    account_id: account.id,
    kind: 'deposit',
    amount_cents: amount,
    stripe_payment_intent_id: pi.id,
    memo: 'Auto top-up',
  });
  if (!credit) {
    // Already credited by a concurrent path (same PI, same unique key). Nothing to add.
    const fresh = await getPplAccount(account.id);
    return {
      ok: true,
      paymentIntentId: pi.id,
      amountCents: amount,
      balanceAfterCents: fresh?.balance_cents ?? account.balance_cents,
      alreadyCredited: true,
    };
  }
  if (account.status === 'paused') {
    await updatePplAccount(account.id, { status: 'active', paused_reason: null, paused_at: null });
  }
  await notifyReloaded(account, {
    amountCents: amount,
    balanceAfterCents: credit.balance_after_cents,
    paymentIntentId: pi.id,
  });
  return {
    ok: true,
    paymentIntentId: pi.id,
    amountCents: amount,
    balanceAfterCents: credit.balance_after_cents,
    alreadyCredited: false,
  };
}

/**
 * A Checkout session (mode=payment, card saved for off-session) completed for an account:
 * save the customer + payment method, credit the deposit, activate. Idempotent on the PI.
 */
export async function applyPplCheckoutCompleted(s: Stripe.Checkout.Session): Promise<boolean> {
  const accountId = s.metadata?.ppl_account_id;
  if (!accountId) return false;
  const account = await getPplAccount(accountId);
  if (!account) {
    Sentry.captureMessage('ppl checkout for unknown account', {
      level: 'warning',
      extra: { session: s.id, accountId },
    } as any);
    return true;
  }
  const piId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
  const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
  let paymentMethodId: string | null = null;
  if (piId) {
    const pi = await stripe.paymentIntents.retrieve(piId);
    paymentMethodId =
      typeof pi.payment_method === 'string' ? pi.payment_method : (pi.payment_method?.id ?? null);
  }
  const amount = s.amount_total ?? 0;
  const patch: Parameters<typeof updatePplAccount>[1] = {};
  if (customerId) patch.stripe_customer_id = customerId;
  if (paymentMethodId) patch.stripe_payment_method_id = paymentMethodId;
  if (!account.contact_email && s.customer_details?.email)
    patch.contact_email = s.customer_details.email;
  if (Object.keys(patch).length) await updatePplAccount(account.id, patch);

  if (amount > 0 && piId) {
    const credit = await postLedger({
      account_id: account.id,
      kind: 'deposit',
      amount_cents: amount,
      stripe_payment_intent_id: piId,
      memo: 'Deposit via Checkout',
    });
    if (credit && account.status !== 'active') {
      await updatePplAccount(account.id, {
        status: 'active',
        paused_reason: null,
        paused_at: null,
      });
    }
  }
  return true;
}

/** A Checkout link the operator sends the business: deposit now, card saved for top-ups. */
export async function createDepositCheckout(
  account: PplAccount,
  depositCents: number,
  opts?: { successUrl?: string; cancelUrl?: string }
): Promise<{ url: string; sessionId: string }> {
  if (!Number.isInteger(depositCents) || depositCents < 100)
    throw new Error('deposit must be at least $1.00 in cents');
  let customerId = account.stripe_customer_id;
  if (!customerId) {
    const c = await stripe.customers.create({
      name: account.business_name,
      email: account.contact_email ?? undefined,
      phone: account.contact_phone ?? undefined,
      metadata: { ppl_account_id: account.id, geo_campaign_id: account.geo_campaign_id },
    });
    customerId = c.id;
    await updatePplAccount(account.id, { stripe_customer_id: customerId });
  }
  const base = publicBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: depositCents,
          product_data: {
            name: `Prepaid lead balance — ${account.business_name}`,
            description:
              'Calls that reach you and last long enough to be a conversation are deducted from this balance.',
          },
        },
      },
    ],
    payment_intent_data: {
      setup_future_usage: 'off_session',
      metadata: { ppl_account_id: account.id },
    },
    metadata: { ppl_account_id: account.id },
    success_url: opts?.successUrl ?? `${base}/ppl/funded?account=${account.id}`,
    cancel_url: opts?.cancelUrl ?? `${base}/ppl/funded?account=${account.id}&canceled=1`,
  });
  if (!session.url) throw new Error('stripe returned no checkout url');
  return { url: session.url, sessionId: session.id };
}

/** Stripe's hosted portal for updating the card. Null when the portal is not configured. */
export async function billingPortalUrl(account: PplAccount): Promise<string | null> {
  if (!account.stripe_customer_id) return null;
  try {
    const s = await stripe.billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: `${publicBaseUrl()}/ppl/funded?account=${account.id}`,
    });
    return s.url;
  } catch {
    return null;
  }
}
