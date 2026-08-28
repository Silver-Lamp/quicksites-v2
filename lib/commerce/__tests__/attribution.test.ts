// lib/commerce/__tests__/attribution.test.ts
//
// Guards the self-serve partner attribution write (gap #4). `attributions` is RLS
// deny-default, so this MUST use the service-role client — a user-scoped client is
// silently rejected, recording nothing and paying the recruiting partner $0. This
// pins that contract plus the lock/insert/update/no-ref behaviors.

let mockRefValue: string | undefined;
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'qs_ref' && mockRefValue ? { value: mockRefValue } : undefined,
  }),
}));

const mockGetServerSupabase = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  getServerSupabase: (opts?: any) => mockGetServerSupabase(opts),
}));

import { ensureAttributionForMerchant } from '../attribution';

// Chainable supabase stub. `maybeSingle` resolves to `existing`; insert/update
// record their calls and resolve to `{ error }`.
function makeDb(existing: any, error: any = null) {
  const calls = { insert: [] as any[], update: [] as any[] };
  const db = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing }) }) }),
      insert: async (row: any) => {
        calls.insert.push(row);
        return { error };
      },
      update: (row: any) => ({
        eq: async () => {
          calls.update.push(row);
          return { error };
        },
      }),
    }),
  };
  return { db, calls };
}

describe('ensureAttributionForMerchant', () => {
  beforeEach(() => {
    mockRefValue = undefined;
    mockGetServerSupabase.mockReset();
  });

  it('uses the SERVICE-ROLE client (attributions is RLS deny-default)', async () => {
    mockRefValue = 'ACME';
    const { db } = makeDb(null);
    mockGetServerSupabase.mockResolvedValue(db);

    await ensureAttributionForMerchant('m1');

    expect(mockGetServerSupabase).toHaveBeenCalledWith({ serviceRole: true });
  });

  it('inserts a new attribution binding merchant → ref when none exists', async () => {
    mockRefValue = 'ACME';
    const { db, calls } = makeDb(null);
    mockGetServerSupabase.mockResolvedValue(db);

    await ensureAttributionForMerchant('m1');

    expect(calls.insert).toEqual([{ merchant_id: 'm1', referral_code: 'ACME' }]);
    expect(calls.update).toEqual([]);
  });

  it('updates an existing UNLOCKED attribution to the current ref', async () => {
    mockRefValue = 'NEWCODE';
    const { db, calls } = makeDb({ merchant_id: 'm1', locked_at: null });
    mockGetServerSupabase.mockResolvedValue(db);

    await ensureAttributionForMerchant('m1');

    expect(calls.update).toEqual([{ referral_code: 'NEWCODE' }]);
    expect(calls.insert).toEqual([]);
  });

  it('never rebinds a LOCKED attribution (attribution is fixed on first revenue)', async () => {
    mockRefValue = 'POACH';
    const { db, calls } = makeDb({ merchant_id: 'm1', locked_at: '2026-01-01T00:00:00Z' });
    mockGetServerSupabase.mockResolvedValue(db);

    await ensureAttributionForMerchant('m1');

    expect(calls.insert).toEqual([]);
    expect(calls.update).toEqual([]);
  });

  it('is a no-op when there is no qs_ref cookie (no client even created)', async () => {
    mockRefValue = undefined;
    await ensureAttributionForMerchant('m1');
    expect(mockGetServerSupabase).not.toHaveBeenCalled();
  });

  it('never throws when the write fails (must not block checkout)', async () => {
    mockRefValue = 'ACME';
    const { db } = makeDb(null, { message: 'rls denied' });
    mockGetServerSupabase.mockResolvedValue(db);

    await expect(ensureAttributionForMerchant('m1')).resolves.toBeUndefined();
  });
});
