/**
 * @jest-environment node
 */
// lib/domains/__tests__/purchaseOrder.test.ts — a 2xx from POST …/buy is a receipt for the ORDER,
// not the domain. On 2026-10-19 qspages.com got a 200, purchaseDomain said "bought", the order
// failed ten seconds later (payment-failed), and the domain was never registered. The order must
// be waited for, and each of its three outcomes must read differently to the caller.
jest.mock('@/lib/domains/vercel', () => ({ addProjectDomain: jest.fn(async () => ({ verified: true })) }));

import { purchaseDomain } from '@/lib/domains/registrar';
import { addProjectDomain } from '@/lib/domains/vercel';

const ENV: Record<string, string> = {
  VERCEL_TOKEN: 'tok',
  VERCEL_TEAM_ID: 'team_x',
  DOMAIN_REGISTRANT_FIRST: 'Sandon',
  DOMAIN_REGISTRANT_LAST: 'Jurowski',
  DOMAIN_REGISTRANT_EMAIL: 'owner@example.com',
  DOMAIN_REGISTRANT_PHONE: '+12623028118',
  DOMAIN_REGISTRANT_ADDRESS: '1 Main St',
  DOMAIN_REGISTRANT_CITY: 'Renton',
  DOMAIN_REGISTRANT_STATE: 'WA',
  DOMAIN_REGISTRANT_ZIP: '98055',
  DOMAIN_REGISTRANT_COUNTRY: 'US',
};

type Step = { match: RegExp; status?: number; body: unknown };
function mockFetch(steps: Step[]) {
  const calls: string[] = [];
  // Order polls are consumed in sequence (draft → failed), the last one repeating.
  const orderQueue = steps.filter((s) => s.match.test('https://api.vercel.com/v1/registrar/orders/o1'));
  const f = jest.fn(async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    let step: Step | undefined;
    if (/\/orders\//.test(url)) step = orderQueue.length > 1 ? orderQueue.shift() : orderQueue[0];
    else step = steps.find((s) => s.match.test(url));
    if (!step) throw new Error(`unmocked fetch ${url}`);
    return { ok: (step.status ?? 200) < 400, status: step.status ?? 200, text: async () => JSON.stringify(step!.body) } as Response;
  });
  (global as any).fetch = f;
  return { calls };
}

const base: Step[] = [
  { match: /\/availability/, body: { available: true } },
  { match: /\/price\?years=1/, body: { years: 1, purchasePrice: 11.25 } },
  { match: /\/buy/, body: { orderId: 'o1' } },
];

beforeEach(() => {
  Object.assign(process.env, ENV);
  (addProjectDomain as jest.Mock).mockClear();
});

describe('purchaseDomain waits for the registrar ORDER', () => {
  it('a failed order is NOT a purchase: reason names the registrar code, nothing is attached', async () => {
    const { calls } = mockFetch([
      ...base,
      { match: /\/orders\/o1/, body: { orderId: 'o1', status: 'draft', domains: [{ domainName: 'qspages.com', status: 'pending' }] } },
      { match: /\/orders\/o1/, body: { orderId: 'o1', status: 'failed', error: { code: 'payment-failed' } } },
    ]);
    const r = await purchaseDomain('qspages.com', { expectedPriceUsd: 15, orderPollMs: 1 });
    expect(r).toMatchObject({ ok: false, purchased: false, attached: false, reason: 'order_failed:payment-failed', orderId: 'o1', priceUsd: 11.25 });
    expect(addProjectDomain).not.toHaveBeenCalled();
    expect(calls.filter((c) => /\/orders\/o1/.test(c)).length).toBe(2);
  });

  it('a completed order is a purchase, and only then is the domain attached', async () => {
    mockFetch([...base, { match: /\/orders\/o1/, body: { orderId: 'o1', status: 'completed' } }]);
    const r = await purchaseDomain('qspages.com', { expectedPriceUsd: 15, orderPollMs: 1 });
    expect(r).toMatchObject({ ok: true, purchased: true, attached: true, orderId: 'o1' });
    expect((addProjectDomain as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['qspages.com', 'www.qspages.com']);
  });

  it('an order still pending when the budget runs out is PENDING — not bought, not failed, and the id is handed back', async () => {
    mockFetch([...base, { match: /\/orders\/o1/, body: { orderId: 'o1', status: 'draft' } }]);
    const r = await purchaseDomain('qspages.com', { expectedPriceUsd: 15, orderWaitMs: 5, orderPollMs: 1 });
    expect(r).toMatchObject({ ok: false, purchased: false, reason: 'order_pending', orderId: 'o1' });
    expect(addProjectDomain).not.toHaveBeenCalled();
  });

  it('a buy that answers 2xx with no order id is not trusted', async () => {
    mockFetch([base[0], base[1], { match: /\/buy/, body: {} }]);
    const r = await purchaseDomain('qspages.com', { expectedPriceUsd: 15, orderPollMs: 1 });
    expect(r).toMatchObject({ ok: false, purchased: false, reason: 'buy_returned_no_order_id' });
  });
});
