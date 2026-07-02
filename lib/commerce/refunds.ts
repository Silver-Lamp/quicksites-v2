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
 * Pure math for a proportional application-fee reversal. Given the fee's current
 * state and the charge's current refund state, returns the additional cents to
 * reverse now (never negative) plus a machine reason when nothing is owed.
 *
 * Target reversed fee = fee × (charge refunded ÷ charge amount), capped at the
 * fee and floored to whole cents. We only reverse the delta beyond what Stripe
 * already reversed, which makes this idempotent (retried webhook) and partial-
 * refund-safe (each partial refund reverses only its own slice), and co-operates
 * with refunds created using `refund_application_fee: true` (Stripe already
 * bumped `fee.amount_refunded`, so `delta` collapses to 0).
 */
export function computeFeeReversalDeltaCents(input: {
  feeAmountCents: number;
  feeAlreadyRefundedCents: number;
  chargeAmountCents: number;
  chargeRefundedCents: number;
}): { deltaCents: number; reason?: string } {
  const { feeAmountCents, feeAlreadyRefundedCents, chargeAmountCents, chargeRefundedCents } = input;

  if (!(chargeAmountCents > 0) || !(chargeRefundedCents > 0)) {
    return { deltaCents: 0, reason: 'nothing_refunded' };
  }
  if (!(feeAmountCents > 0)) return { deltaCents: 0, reason: 'fee_zero' };

  const target = Math.min(
    feeAmountCents,
    Math.floor((feeAmountCents * chargeRefundedCents) / chargeAmountCents),
  );
  const already = feeAlreadyRefundedCents > 0 ? feeAlreadyRefundedCents : 0;
  const delta = target - already;
  if (delta <= 0) return { deltaCents: 0, reason: 'already_reversed' };

  return { deltaCents: delta };
}

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

    const { deltaCents, reason } = computeFeeReversalDeltaCents({
      feeAmountCents: fee.amount,
      feeAlreadyRefundedCents: fee.amount_refunded ?? 0,
      chargeAmountCents: chargeAmount,
      chargeRefundedCents: refunded,
    });
    if (deltaCents <= 0) return { reversed: false, reason: reason ?? 'already_reversed' };

    await stripe.applicationFees.createRefund(feeId, { amount: deltaCents });
    return { reversed: true, amountCents: deltaCents };
  } catch (e: any) {
    console.warn('application fee reversal failed:', e?.message || e);
    return { reversed: false, reason: 'error' };
  }
}
