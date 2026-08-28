/**
 * Accrual rules for rental commissions. The DB is stubbed — what is under test is the
 * decision-making: who gets a row, for how much, and when NO row is the right answer.
 */

const state: any = {
  campaign: null as any,
  codeParent: null as string | null,
  upserted: null as any,
  upsertOpts: null as any,
};

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from(table: string) {
      if (table === 'geo_industry_campaigns') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.campaign }) }) }),
        };
      }
      if (table === 'referral_codes') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { parent_code: state.codeParent } }) }),
          }),
        };
      }
      if (table === 'commission_ledger') {
        return {
          upsert: async (rows: any, opts: any) => {
            state.upserted = rows;
            state.upsertOpts = opts;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

import {
  recordRentalCommissions,
  SUBJECT_CLOSER,
  SUBJECT_MANAGER,
} from '@/lib/commerce/rentalCommissions';

const base = { campaignId: 'camp-1', invoiceId: 'in_123', currency: 'usd' };

beforeEach(() => {
  state.campaign = { id: 'camp-1', domain: 'boston-plumbing.com', sold_by_code: 'shelly', manager_code: 'amy' };
  state.codeParent = null;
  state.upserted = null;
  state.upsertOpts = null;
});

describe('recordRentalCommissions', () => {
  it('writes a closer row and a manager row at the standard 15% override', async () => {
    const r = await recordRentalCommissions({ ...base, amountPaidCents: 9900 });

    expect(r.wrote).toBe(2);
    expect(r.variant).toBe('standard');
    expect(state.upserted).toHaveLength(2);

    const closer = state.upserted.find((x: any) => x.subject === SUBJECT_CLOSER);
    const mgr = state.upserted.find((x: any) => x.subject === SUBJECT_MANAGER);
    expect(closer.referral_code).toBe('shelly');
    expect(closer.amount_cents).toBe(4791); // 50% of $95.83 net
    expect(mgr.referral_code).toBe('amy');
    expect(mgr.amount_cents).toBe(1437); // 15% of net
    expect(mgr.adjustments.recruited).toBe(false);
  });

  it('pays the 25% override only when the manager recruited the closer', async () => {
    state.codeParent = 'amy';
    const r = await recordRentalCommissions({ ...base, amountPaidCents: 9900 });

    expect(r.variant).toBe('recruit');
    const mgr = state.upserted.find((x: any) => x.subject === SUBJECT_MANAGER);
    expect(mgr.amount_cents).toBe(2395); // 25% of net
    expect(mgr.adjustments.recruited).toBe(true);

    // The closer is untouched by the manager's raise — the invariant the whole design rests on.
    const closer = state.upserted.find((x: any) => x.subject === SUBJECT_CLOSER);
    expect(closer.amount_cents).toBe(4791);
  });

  it('does not treat an unrelated manager as the recruiter', async () => {
    // parent_code points at somebody else: this manager supervises but did not recruit.
    state.codeParent = 'someone-else';
    const r = await recordRentalCommissions({ ...base, amountPaidCents: 9900 });
    expect(r.variant).toBe('standard');
  });

  it('writes NOTHING when no closer is credited', async () => {
    // An unattributed accrual would invent a debt with no creditor.
    state.campaign = { id: 'camp-1', domain: 'x.com', sold_by_code: null, manager_code: 'amy' };
    const r = await recordRentalCommissions({ ...base, amountPaidCents: 9900 });

    expect(r.skipped).toBe('no_closer');
    expect(r.wrote).toBe(0);
    expect(state.upserted).toBeNull();
  });

  it('writes only the closer row when no manager is credited', async () => {
    state.campaign = { id: 'camp-1', domain: 'x.com', sold_by_code: 'shelly', manager_code: null };
    const r = await recordRentalCommissions({ ...base, amountPaidCents: 9900 });

    expect(r.wrote).toBe(1);
    expect(r.managerCents).toBe(0);
    expect(state.upserted.every((x: any) => x.subject === SUBJECT_CLOSER)).toBe(true);
  });

  it('skips a zero or refunded-to-nothing invoice', async () => {
    const r = await recordRentalCommissions({ ...base, amountPaidCents: 0 });
    expect(r.skipped).toBe('zero_amount');
    expect(state.upserted).toBeNull();
  });

  it('keys on the invoice so a webhook redelivery cannot pay twice', async () => {
    await recordRentalCommissions({ ...base, amountPaidCents: 9900 });

    // Stripe retries deliveries. Without this conflict target a redelivery inserts a
    // SECOND set of rows and the rep is paid for one payment twice.
    expect(state.upsertOpts).toEqual({ onConflict: 'referral_code,subject,subject_id' });
    expect(state.upserted.every((x: any) => x.subject_id === 'in_123')).toBe(true);
  });

  it('records the arithmetic it used, so a disputed payout can be reconstructed', async () => {
    await recordRentalCommissions({ ...base, amountPaidCents: 9900 });
    const closer = state.upserted.find((x: any) => x.subject === SUBJECT_CLOSER);
    expect(closer.adjustments.gross_cents).toBe(9900);
    expect(closer.adjustments.processor_fee_cents).toBe(317);
    expect(closer.adjustments.net_cents).toBe(9583);
    expect(closer.adjustments.domain).toBe('boston-plumbing.com');
  });

  it('accrues as pending, never as paid', async () => {
    await recordRentalCommissions({ ...base, amountPaidCents: 9900 });
    expect(state.upserted.every((x: any) => x.status === 'pending')).toBe(true);
  });

  it('never accrues more than the money that arrived', async () => {
    await recordRentalCommissions({ ...base, amountPaidCents: 39900 });
    const total = state.upserted.reduce((s: number, x: any) => s + x.amount_cents, 0);
    expect(total).toBeLessThan(39900);
  });
});
