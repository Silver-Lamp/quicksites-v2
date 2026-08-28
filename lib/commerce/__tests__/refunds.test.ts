// lib/commerce/__tests__/refunds.test.ts
//
// Verifies the take-rate fee-reversal (punch-list Tier 2, item 8): when a Connect
// charge is refunded we must reverse the platform's application fee in the same
// proportion, and we must never double-refund on a retried webhook or a partial
// refund. The proportional math lives in computeFeeReversalDeltaCents (pure); the
// orchestrator reverseApplicationFeeForCharge wires it to Stripe.

// Mock the Stripe client the orchestrator pulls in, so no network/env is needed.
const mockRetrieve = jest.fn();
const mockCreateRefund = jest.fn();
jest.mock('@/lib/stripe/server', () => ({
  stripe: {
    applicationFees: {
      retrieve: (...a: any[]) => mockRetrieve(...a),
      createRefund: (...a: any[]) => mockCreateRefund(...a),
    },
  },
}));

import { computeFeeReversalDeltaCents, reverseApplicationFeeForCharge } from '../refunds';

describe('computeFeeReversalDeltaCents', () => {
  const base = {
    feeAmountCents: 100,
    feeAlreadyRefundedCents: 0,
    chargeAmountCents: 1000,
    chargeRefundedCents: 1000,
  };

  it('reverses the full fee on a full refund', () => {
    expect(computeFeeReversalDeltaCents(base)).toEqual({ deltaCents: 100 });
  });

  it('reverses proportionally on a partial refund', () => {
    // 40% of the charge refunded -> 40% of the $1.00 fee.
    expect(computeFeeReversalDeltaCents({ ...base, chargeRefundedCents: 400 })).toEqual({
      deltaCents: 40,
    });
  });

  it('floors the reversal to whole cents (never over-reverses)', () => {
    // fee 100, charge 999, refunded 333 -> floor(100*333/999)=floor(33.33)=33
    expect(
      computeFeeReversalDeltaCents({
        feeAmountCents: 100,
        feeAlreadyRefundedCents: 0,
        chargeAmountCents: 999,
        chargeRefundedCents: 333,
      })
    ).toEqual({ deltaCents: 33 });
  });

  it('is idempotent: a full-refund fee already fully reversed owes nothing', () => {
    expect(computeFeeReversalDeltaCents({ ...base, feeAlreadyRefundedCents: 100 })).toEqual({
      deltaCents: 0,
      reason: 'already_reversed',
    });
  });

  it('only reverses the incremental slice across successive partial refunds', () => {
    // First 40% already reversed (40¢); charge now 70% refunded -> target 70¢, delta 30¢.
    expect(
      computeFeeReversalDeltaCents({
        feeAmountCents: 100,
        feeAlreadyRefundedCents: 40,
        chargeAmountCents: 1000,
        chargeRefundedCents: 700,
      })
    ).toEqual({ deltaCents: 30 });
  });

  it('collapses to 0 when a refund_application_fee:true refund already bumped the fee', () => {
    // Stripe reversed the fee alongside the refund; our webhook must not stack another.
    expect(
      computeFeeReversalDeltaCents({
        ...base,
        chargeRefundedCents: 500,
        feeAlreadyRefundedCents: 50,
      })
    ).toEqual({ deltaCents: 0, reason: 'already_reversed' });
  });

  it('caps the reversal at the fee even if refunded somehow exceeds the charge', () => {
    expect(computeFeeReversalDeltaCents({ ...base, chargeRefundedCents: 5000 })).toEqual({
      deltaCents: 100,
    });
  });

  it('owes nothing when nothing has been refunded', () => {
    expect(computeFeeReversalDeltaCents({ ...base, chargeRefundedCents: 0 })).toEqual({
      deltaCents: 0,
      reason: 'nothing_refunded',
    });
  });

  it('owes nothing on a non-positive or invalid charge amount', () => {
    expect(computeFeeReversalDeltaCents({ ...base, chargeAmountCents: 0 })).toEqual({
      deltaCents: 0,
      reason: 'nothing_refunded',
    });
    expect(computeFeeReversalDeltaCents({ ...base, chargeAmountCents: NaN })).toEqual({
      deltaCents: 0,
      reason: 'nothing_refunded',
    });
  });

  it('owes nothing when the fee itself is zero', () => {
    expect(computeFeeReversalDeltaCents({ ...base, feeAmountCents: 0 })).toEqual({
      deltaCents: 0,
      reason: 'fee_zero',
    });
  });
});

describe('reverseApplicationFeeForCharge', () => {
  beforeEach(() => {
    mockRetrieve.mockReset();
    mockCreateRefund.mockReset();
  });

  const chargeEvent = (charge: any): any => ({ data: { object: charge } });

  it('reverses the proportional fee delta on a refunded charge', async () => {
    mockRetrieve.mockResolvedValue({ amount: 100, amount_refunded: 0 });
    mockCreateRefund.mockResolvedValue({ id: 'fr_1' });

    const res = await reverseApplicationFeeForCharge(
      chargeEvent({ amount: 1000, amount_refunded: 400, application_fee: 'fee_1' })
    );

    expect(res).toEqual({ reversed: true, amountCents: 40 });
    expect(mockCreateRefund).toHaveBeenCalledWith('fee_1', { amount: 40 });
  });

  it('accepts an expanded application_fee object, not just an id', async () => {
    mockRetrieve.mockResolvedValue({ amount: 100, amount_refunded: 0 });
    mockCreateRefund.mockResolvedValue({ id: 'fr_1' });

    const res = await reverseApplicationFeeForCharge(
      chargeEvent({ amount: 1000, amount_refunded: 1000, application_fee: { id: 'fee_9' } })
    );

    expect(res).toEqual({ reversed: true, amountCents: 100 });
    expect(mockRetrieve).toHaveBeenCalledWith('fee_9');
  });

  it('does not double-refund when the fee is already fully reversed (retried webhook)', async () => {
    mockRetrieve.mockResolvedValue({ amount: 100, amount_refunded: 100 });

    const res = await reverseApplicationFeeForCharge(
      chargeEvent({ amount: 1000, amount_refunded: 1000, application_fee: 'fee_1' })
    );

    expect(res).toEqual({ reversed: false, reason: 'already_reversed' });
    expect(mockCreateRefund).not.toHaveBeenCalled();
  });

  it('short-circuits before hitting Stripe when the charge has no application fee', async () => {
    const res = await reverseApplicationFeeForCharge(
      chargeEvent({ amount: 1000, amount_refunded: 1000, application_fee: null })
    );

    expect(res).toEqual({ reversed: false, reason: 'no_application_fee' });
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('short-circuits when nothing has been refunded yet', async () => {
    const res = await reverseApplicationFeeForCharge(
      chargeEvent({ amount: 1000, amount_refunded: 0, application_fee: 'fee_1' })
    );

    expect(res).toEqual({ reversed: false, reason: 'nothing_refunded' });
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('reports not_a_charge for a malformed event object', async () => {
    const res = await reverseApplicationFeeForCharge(chargeEvent({ foo: 'bar' }));
    expect(res).toEqual({ reversed: false, reason: 'not_a_charge' });
  });

  it('is best-effort: a Stripe failure is swallowed, never thrown', async () => {
    mockRetrieve.mockRejectedValue(new Error('stripe down'));

    const res = await reverseApplicationFeeForCharge(
      chargeEvent({ amount: 1000, amount_refunded: 1000, application_fee: 'fee_1' })
    );

    expect(res).toEqual({ reversed: false, reason: 'error' });
  });
});
