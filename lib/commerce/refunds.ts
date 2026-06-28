// lib/commerce/refunds.ts
//
// Take-rate refund handling (Path A, 2B): when a charge is refunded we must also
// reverse the platform's application fee proportionally, otherwise QuickSites
// keeps a fee on money the merchant gave back. The ledger void/clawback lives in
// lib/commerce/orders.ts#markOrderRefunded; this reverses the actual money on
// Stripe.

import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/server';

/**
 * Reverse the platform application fee on a refunded Connect charge,
 * proportional to how much of the charge has been refunded. Idempotent and
 * partial-refund-safe: it computes the *target* refunded fee from the charge's
 * current refunded ratio and only refunds the delta not already reversed — so a
 * retried webhook, or a refund created with `refund_application_fee: true`,
 * never double-refunds.
 *
 * Best-effort: returns a result object instead of throwing, so a fee-reversal
 * hiccup can't block the ledger update or NACK the webhook.
 */
export async function reverseApplicationFeeForCharge(
  event: Stripe.Event
): Promise<{ reversed: boolean; amountCents?: number; reason?: string }> {
  try {
    const charge = event.data.object as Stripe.Charge;
    if (!charge || typeof charge.amount !== 'number') {
      return { reversed: false, reason: 'not_a_charge' };
    }

    const feeRef = charge.application_fee;
    const feeId = typeof feeRef === 'string' ? feeRef : feeRef?.id;
    if (!feeId) return { reversed: false, reason: 'no_application_fee' };

    const chargeAmount = charge.amount;
    const refunded = charge.amount_refunded ?? 0;
    if (chargeAmount <= 0 || refunded <= 0) {
      return { reversed: false, reason: 'nothing_refunded' };
    }

    const fee = await stripe.applicationFees.retrieve(feeId);
    if (!fee?.amount) return { reversed: false, reason: 'fee_zero' };

    // Target reversed amount = fee × (refunded / charge), capped at the fee.
    const target = Math.min(fee.amount, Math.floor((fee.amount * refunded) / chargeAmount));
    const already = fee.amount_refunded ?? 0;
    const delta = target - already;
    if (delta <= 0) return { reversed: false, reason: 'already_reversed' };

    await stripe.applicationFees.createRefund(feeId, { amount: delta });
    return { reversed: true, amountCents: delta };
  } catch (e: any) {
    console.warn('application fee reversal failed:', e?.message || e);
    return { reversed: false, reason: 'error' };
  }
}
