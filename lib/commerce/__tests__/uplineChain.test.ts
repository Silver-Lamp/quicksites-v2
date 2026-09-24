/**
 * @jest-environment node
 */
import {
  MAX_UPLINE_DEPTH,
  allocateUplineOverrides,
  buildUplineChain,
  type CodeNode,
} from '@/lib/commerce/uplineChain';
import { QS_FEE_SHARE } from '@/lib/commerce/partner-terms';

/** A tiny org chart: bob sells, daryle recruited bob, amy recruited daryle. */
const graph = (rates: Record<string, number> = {}): ((c: string) => CodeNode | undefined) => {
  const nodes: Record<string, CodeNode> = {
    bob: { parentCode: 'daryle', overrideShare: rates.bob ?? 0 },
    daryle: { parentCode: 'amy', overrideShare: rates.daryle ?? 0 },
    amy: { parentCode: null, overrideShare: 0 },
  };
  return (c) => nodes[c];
};

describe('walking the chain', () => {
  it('finds every level above the seller, nearest first', () => {
    const chain = buildUplineChain('bob', graph({ bob: 0.1, daryle: 0.05 }));
    expect(chain.map((l) => l.code)).toEqual(['daryle', 'amy']);
    // The share stored on bob's row is what bob's PARENT earns.
    expect(chain[0]).toEqual({ code: 'daryle', overrideShare: 0.1 });
    expect(chain[1]).toEqual({ code: 'amy', overrideShare: 0.05 });
  });

  it('stops at the top', () => {
    expect(buildUplineChain('amy', graph())).toEqual([]);
  });

  it('returns nothing for a code it has never heard of', () => {
    expect(buildUplineChain('ghost', graph())).toEqual([]);
  });

  // ⚠️ parent_code has no foreign key and no acyclicity constraint, and neither writer
  // (/api/admin/referrals/set-hub, /api/partners/join) checks. A→B→A is one mistyped field away,
  // and this walk runs INSIDE the Stripe webhook: an unbounded loop there means money taken and no
  // order ever marked paid. The depth cap alone would not save it — a 2-cycle would still be walked
  // MAX_UPLINE_DEPTH times and pay the same code repeatedly.
  it('breaks a cycle instead of looping forever', () => {
    const cyclic = (c: string): CodeNode | undefined =>
      ({
        a: { parentCode: 'b', overrideShare: 0.1 },
        b: { parentCode: 'a', overrideShare: 0.1 },
      })[c];
    const chain = buildUplineChain('a', cyclic);
    expect(chain.map((l) => l.code)).toEqual(['b']);
  });

  it('never pays the seller itself, even if a row points there', () => {
    const selfRef = (c: string): CodeNode | undefined =>
      ({ a: { parentCode: 'a', overrideShare: 0.5 } })[c];
    expect(buildUplineChain('a', selfRef)).toEqual([]);
  });

  it('is bounded by depth on a long chain', () => {
    const deep = (c: string): CodeNode | undefined => {
      const n = Number(c.replace('n', ''));
      return Number.isFinite(n) ? { parentCode: `n${n + 1}`, overrideShare: 0.01 } : undefined;
    };
    expect(buildUplineChain('n0', deep).length).toBe(MAX_UPLINE_DEPTH);
  });
});

describe('the cap is on the TOTAL, which is the whole point', () => {
  const FEE = 50_000; // $500 platform fee on a $10k month at 5%

  // One level capped at QS_FEE_SHARE is safe by construction. Two levels each at that ceiling would
  // pay twice the slice that exists — out of the house's pocket and then through the floor.
  it('two greedy levels cannot together exceed the available slice', () => {
    const chain = [
      { code: 'daryle', overrideShare: QS_FEE_SHARE },
      { code: 'amy', overrideShare: QS_FEE_SHARE },
    ];
    const a = allocateUplineOverrides(FEE, chain);
    expect(a.totalCents).toBeLessThanOrEqual(Math.floor(FEE * QS_FEE_SHARE));
    expect(a.payments.map((p) => p.code)).toEqual(['daryle']);
    expect(a.shorted.map((s) => s.code)).toEqual(['amy']);
  });

  it('pays both when they fit', () => {
    const a = allocateUplineOverrides(FEE, [
      { code: 'daryle', overrideShare: 0.1 },
      { code: 'amy', overrideShare: 0.05 },
    ]);
    expect(a.payments).toEqual([
      { code: 'daryle', cents: 5_000, share: 0.1 },
      { code: 'amy', cents: 2_500, share: 0.05 },
    ]);
    expect(a.totalCents).toBe(7_500);
    expect(a.shorted).toEqual([]);
  });

  // ⚠️ The alternative (scale everyone to fit) quietly cuts a rate somebody agreed to in writing
  // because a level was added elsewhere in the tree. Nearest-first keeps the promise to the person
  // supporting the account and makes the shortfall VISIBLE instead.
  it('shorts the distant level rather than diluting the near one', () => {
    const a = allocateUplineOverrides(FEE, [
      { code: 'daryle', overrideShare: 0.18 },
      { code: 'amy', overrideShare: 0.1 },
    ]);
    expect(a.payments).toEqual([{ code: 'daryle', cents: 9_000, share: 0.18 }]);
    expect(a.shorted).toEqual([{ code: 'amy', requestedShare: 0.1, paidCents: 0 }]);
  });

  it('a shorted level is paid nothing, never a partial amount at an unagreed rate', () => {
    const a = allocateUplineOverrides(FEE, [
      { code: 'daryle', overrideShare: 0.19 },
      { code: 'amy', overrideShare: 0.05 },
    ]);
    expect(a.payments.map((p) => p.code)).toEqual(['daryle']);
    expect(a.shorted[0].paidCents).toBe(0);
  });

  it('a level configured at zero is not participating, not shorted', () => {
    const a = allocateUplineOverrides(FEE, [
      { code: 'daryle', overrideShare: 0 },
      { code: 'amy', overrideShare: 0.05 },
    ]);
    expect(a.payments).toEqual([{ code: 'amy', cents: 2_500, share: 0.05 }]);
    expect(a.shorted).toEqual([]);
  });
});

describe('today, nothing is configured, so nothing changes', () => {
  // Every referral_codes.override_share is 0 in production. Landing this mechanism must be a no-op
  // until the owner sets rates — that is what makes it safe to ship ahead of the pay decisions.
  it('pays nothing when every rate is zero', () => {
    const chain = buildUplineChain('bob', graph());
    expect(chain.map((l) => l.code)).toEqual(['daryle', 'amy']);
    const a = allocateUplineOverrides(50_000, chain);
    expect(a).toEqual({ payments: [], totalCents: 0, shorted: [] });
  });
});

describe('degenerate inputs cannot pay money', () => {
  it.each([0, -100, Number.NaN])('a fee of %p pays nothing', (fee) => {
    const a = allocateUplineOverrides(fee as number, [{ code: 'amy', overrideShare: 0.2 }]);
    expect(a.totalCents).toBe(0);
    expect(a.payments).toEqual([]);
  });

  it('an available share of zero pays nothing', () => {
    const a = allocateUplineOverrides(50_000, [{ code: 'amy', overrideShare: 0.2 }], 0);
    expect(a.totalCents).toBe(0);
  });

  it('a negative configured share is treated as off, not as a credit', () => {
    const a = allocateUplineOverrides(50_000, [{ code: 'amy', overrideShare: -0.5 }]);
    expect(a.totalCents).toBe(0);
    expect(a.payments).toEqual([]);
  });

  it('an absurd available share is clamped to the whole fee, never more', () => {
    const a = allocateUplineOverrides(50_000, [{ code: 'amy', overrideShare: 5 }], 99);
    expect(a.totalCents).toBeLessThanOrEqual(50_000);
  });
});
