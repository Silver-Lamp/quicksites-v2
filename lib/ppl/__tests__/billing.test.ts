/**
 * @jest-environment node
 */
// lib/ppl/__tests__/billing.test.ts — the money path's decisions, with the DB, Stripe and the
// notifiers mocked. What this pins is the ORDER and the IDEMPOTENCY, which are the two things
// the draft this replaces got wrong: a retried callback must not bill twice, a reload must be
// keyed on the charge that triggered it, and a reload that lands must un-pause.

import type { PplAccount, PplLedgerRow } from '@/lib/ppl/accounts';

const mockAccounts = {
  getPplAccountByCampaign: jest.fn(),
  getPplAccount: jest.fn(),
  postLedger: jest.fn(),
  updatePplAccount: jest.fn(),
};
const mockNotify = {
  notifyLeadBilled: jest.fn().mockResolvedValue(undefined),
  notifyPaused: jest.fn().mockResolvedValue(undefined),
  notifyReloadFailed: jest.fn().mockResolvedValue(undefined),
  notifyReloaded: jest.fn().mockResolvedValue(undefined),
};
const mockStripe = {
  paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
  billingPortal: { sessions: { create: jest.fn().mockRejectedValue(new Error('no portal')) } },
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
};

jest.mock('@/lib/ppl/accounts', () => mockAccounts);
jest.mock('@/lib/ppl/notify', () => mockNotify);
jest.mock('@/lib/stripe/server', () => ({ stripe: mockStripe }));
jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn(), captureException: jest.fn() }));
jest.mock('@/lib/outreach/competitionPoster', () => ({ publicBaseUrl: () => 'https://x.test' }));

// Required (not imported) so it loads AFTER the mock objects above are initialised — ES imports hoist.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { attemptAutoReload, billCompletedCall } =
  require('@/lib/ppl/billing') as typeof import('@/lib/ppl/billing');

const account: PplAccount = {
  id: 'acc1',
  geo_campaign_id: 'camp1',
  business_name: 'Test Roofing',
  contact_email: 'o@x.test',
  contact_phone: '+15125550100',
  stripe_customer_id: 'cus_1',
  stripe_payment_method_id: 'pm_1',
  cpl_cents: 8500,
  min_billable_seconds: 90,
  reload_threshold_cents: 30000,
  reload_amount_cents: 120000,
  auto_reload: true,
  balance_cents: 40000,
  status: 'active',
  paused_reason: null,
  paused_at: null,
  created_at: '2026-09-18T00:00:00Z',
  updated_at: '2026-09-18T00:00:00Z',
};
const ledgerRow = (over: Partial<PplLedgerRow>): PplLedgerRow => ({
  id: 'led1',
  account_id: 'acc1',
  kind: 'lead_charge',
  amount_cents: -8500,
  balance_after_cents: 31500,
  call_sid: 'CA1',
  caller_number: '+1',
  duration_seconds: 120,
  stripe_payment_intent_id: null,
  memo: null,
  created_by: null,
  created_at: '2026-09-18T00:00:00Z',
  ...over,
});
const call = {
  campaignId: 'camp1',
  callSid: 'CA1',
  callerNumber: '+15550001',
  dialStatus: 'completed',
  dialDurationSeconds: 120,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAccounts.getPplAccountByCampaign.mockResolvedValue(account);
  mockAccounts.getPplAccount.mockResolvedValue(account);
  mockAccounts.updatePplAccount.mockResolvedValue(undefined);
});

describe('billCompletedCall', () => {
  it('bills nothing without an account, for an unanswered call, or a short one', async () => {
    mockAccounts.getPplAccountByCampaign.mockResolvedValueOnce(null);
    expect(await billCompletedCall(call)).toEqual({
      outcome: 'not_billable',
      reason: 'no_account',
    });
    expect(await billCompletedCall({ ...call, dialStatus: 'no-answer' })).toEqual({
      outcome: 'not_billable',
      reason: 'not_answered',
    });
    expect(await billCompletedCall({ ...call, dialDurationSeconds: 45 })).toEqual({
      outcome: 'not_billable',
      reason: 'too_short',
    });
    expect(mockAccounts.postLedger).not.toHaveBeenCalled();
  });

  it('posts one charge at the account price, keyed on the CallSid', async () => {
    mockAccounts.postLedger.mockResolvedValueOnce(ledgerRow({}));
    const r = await billCompletedCall(call);
    expect(r).toMatchObject({
      outcome: 'billed',
      balanceAfterCents: 31500,
      reload: null,
      paused: false,
    });
    expect(mockAccounts.postLedger).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'lead_charge', amount_cents: -8500, call_sid: 'CA1' })
    );
    expect(mockNotify.notifyLeadBilled).toHaveBeenCalledTimes(1);
  });

  it('a retried callback is already_billed — the DB said so, and nothing else runs', async () => {
    mockAccounts.postLedger.mockResolvedValueOnce(null);
    expect(await billCompletedCall(call)).toEqual({ outcome: 'already_billed' });
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(mockNotify.notifyLeadBilled).not.toHaveBeenCalled();
  });

  it('under the threshold it reloads with a key derived from THAT charge, then credits by PI id', async () => {
    mockAccounts.postLedger
      .mockResolvedValueOnce(ledgerRow({ id: 'chg9', balance_after_cents: 21500 }))
      .mockResolvedValueOnce(
        ledgerRow({
          id: 'dep1',
          kind: 'deposit',
          amount_cents: 120000,
          balance_after_cents: 141500,
          stripe_payment_intent_id: 'pi_1',
        })
      );
    mockStripe.paymentIntents.create.mockResolvedValueOnce({ id: 'pi_1', status: 'succeeded' });
    const r = await billCompletedCall(call);
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 120000, off_session: true, confirm: true }),
      { idempotencyKey: 'ppl_reload_acc1_chg9' }
    );
    expect(mockAccounts.postLedger).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'deposit',
        amount_cents: 120000,
        stripe_payment_intent_id: 'pi_1',
      })
    );
    expect(r).toMatchObject({
      outcome: 'billed',
      balanceAfterCents: 141500,
      paused: false,
      reload: { ok: true, paymentIntentId: 'pi_1' },
    });
    expect(mockNotify.notifyReloaded).toHaveBeenCalledTimes(1);
    expect(mockAccounts.updatePplAccount).not.toHaveBeenCalledWith(
      'acc1',
      expect.objectContaining({ status: 'paused' })
    );
  });

  it('a declined reload notifies, and pauses only once the balance cannot cover the next lead', async () => {
    // Balance after this charge is $215 — under the $300 threshold but still ≥ one $85 lead.
    mockAccounts.postLedger.mockResolvedValueOnce(
      ledgerRow({ id: 'chg2', balance_after_cents: 21500 })
    );
    mockStripe.paymentIntents.create.mockRejectedValueOnce(
      Object.assign(new Error('Your card was declined'), { decline_code: 'insufficient_funds' })
    );
    const r1 = await billCompletedCall(call);
    expect(r1).toMatchObject({
      outcome: 'billed',
      paused: false,
      reload: { ok: false, reason: 'insufficient_funds' },
    });
    expect(mockNotify.notifyReloadFailed).toHaveBeenCalledTimes(1);
    expect(mockNotify.notifyPaused).not.toHaveBeenCalled();

    // Now the balance after the charge is $50: cannot afford the next lead → pause + say so.
    mockAccounts.postLedger.mockResolvedValueOnce(
      ledgerRow({ id: 'chg3', balance_after_cents: 5000 })
    );
    mockStripe.paymentIntents.create.mockRejectedValueOnce(
      Object.assign(new Error('declined'), { code: 'card_declined' })
    );
    const r2 = await billCompletedCall(call);
    expect(r2).toMatchObject({ outcome: 'billed', paused: true });
    expect(mockAccounts.updatePplAccount).toHaveBeenCalledWith(
      'acc1',
      expect.objectContaining({ status: 'paused', paused_reason: 'balance' })
    );
    expect(mockNotify.notifyPaused).toHaveBeenCalledTimes(1);
  });

  it('a 3DS requires_action outcome is a failed reload, not a silent nothing', async () => {
    mockAccounts.postLedger.mockResolvedValueOnce(
      ledgerRow({ id: 'chg4', balance_after_cents: 21500 })
    );
    mockStripe.paymentIntents.create.mockResolvedValueOnce({
      id: 'pi_2',
      status: 'requires_action',
    });
    const r = await billCompletedCall(call);
    expect(r).toMatchObject({ reload: { ok: false, reason: 'payment_requires_action' } });
    expect(mockNotify.notifyReloadFailed).toHaveBeenCalledTimes(1);
    expect(mockAccounts.postLedger).toHaveBeenCalledTimes(1); // no deposit credited
  });
});

describe('attemptAutoReload', () => {
  it('refuses without a card on file', async () => {
    const r = await attemptAutoReload(
      { ...account, stripe_payment_method_id: null },
      ledgerRow({})
    );
    expect(r).toEqual({ ok: false, reason: 'no_card_on_file' });
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('a PI already credited (same key, concurrent path) is reported ok + alreadyCredited, never credited twice', async () => {
    mockStripe.paymentIntents.create.mockResolvedValueOnce({ id: 'pi_dup', status: 'succeeded' });
    mockAccounts.postLedger.mockResolvedValueOnce(null); // unique index on stripe_payment_intent_id
    mockAccounts.getPplAccount.mockResolvedValueOnce({ ...account, balance_cents: 141500 });
    const r = await attemptAutoReload(account, ledgerRow({ id: 'chgX' }));
    expect(r).toMatchObject({ ok: true, alreadyCredited: true, balanceAfterCents: 141500 });
    expect(mockNotify.notifyReloaded).not.toHaveBeenCalled();
  });

  it('a reload that lands on a paused account un-pauses it', async () => {
    mockStripe.paymentIntents.create.mockResolvedValueOnce({ id: 'pi_3', status: 'succeeded' });
    mockAccounts.postLedger.mockResolvedValueOnce(
      ledgerRow({
        id: 'dep3',
        kind: 'deposit',
        amount_cents: 120000,
        balance_after_cents: 120000,
        stripe_payment_intent_id: 'pi_3',
      })
    );
    await attemptAutoReload(
      { ...account, status: 'paused', balance_cents: 0 },
      ledgerRow({ id: 'chgP' })
    );
    expect(mockAccounts.updatePplAccount).toHaveBeenCalledWith(
      'acc1',
      expect.objectContaining({ status: 'active' })
    );
  });
});
