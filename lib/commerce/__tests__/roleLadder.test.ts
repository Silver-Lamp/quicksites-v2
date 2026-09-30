/**
 * @jest-environment node
 */
// lib/commerce/__tests__/roleLadder.test.ts
//
// The ladder is a vocabulary as much as a calculator, and both halves can be wrong. These pin
// the half that would mislead a partner rather than merely miscount.
import {
  buildRoleLadder,
  applyLadderScenario,
  ladderMermaid,
  CAST,
  ISO_PERSONAS,
  MAX_UPLINE_DEPTH,
} from '@/lib/commerce/roleLadder';
import { PARTNER_FEE_SHARE, AFFILIATE_FEE_SHARE } from '@/lib/commerce/partner-terms';

describe('the ladder names what it can and admits what it cannot', () => {
  // ⚠️ THE FINDING THE TOOL EXISTS TO SHOW. Three rungs have names the code branches on; above
  // that the system has only a parent_code. A name that lives in a diagram becomes a promise
  // the moment it is quoted to an ISO, so "no established name" must survive as data.
  it('marks deep rungs as having no established name', () => {
    const l = buildRoleLadder({ tier: 'origination', uplineLevels: 3 });
    expect(l[1].established).toContain('owner_type');
    expect(l[3].established).toContain('set-hub');
    expect(l[4].established).toBeNull();
  });

  it('never draws deeper than the walk will go', () => {
    const l = buildRoleLadder({ tier: 'operator', uplineLevels: 99 });
    expect(l).toHaveLength(2 + MAX_UPLINE_DEPTH);
  });

  it('names the seller by who supports the merchant, not by who sold', () => {
    expect(buildRoleLadder({ tier: 'operator', uplineLevels: 0 })[1].name).toBe('Operator');
    expect(buildRoleLadder({ tier: 'origination', uplineLevels: 0 })[1].name).toBe('Originator');
  });
});

describe('the money matches the payment path', () => {
  const base = { monthlyVolumeCents: 1_000_000, feePercent: 0.05 } as const;

  it('pays the seller their tier share and nobody more than the pool', () => {
    const r = applyLadderScenario({ ...base, tier: 'origination', uplineShares: [0.1, 0.1, 0.1] });
    expect(r.rungs[1].cents).toBe(Math.floor(r.feeCents * AFFILIATE_FEE_SHARE));
    const uplines = r.rungs.slice(2).reduce((a, x) => a + (x.cents ?? 0), 0);
    expect(uplines).toBeLessThanOrEqual(r.poolCents);
    expect(r.houseCents).toBeGreaterThan(0);
  });

  it('an operator keeps more and leaves less above them', () => {
    const op = applyLadderScenario({ ...base, tier: 'operator', uplineShares: [0.05] });
    expect(op.rungs[1].cents).toBe(Math.floor(op.feeCents * PARTNER_FEE_SHARE));
    expect(op.poolCents).toBeLessThan(
      applyLadderScenario({ ...base, tier: 'origination', uplineShares: [0.05] }).poolCents,
    );
  });

  // ⚠️ Nearest-first means the shortfall lands FURTHEST from the sale — on whoever recruited the
  // chain. Measured: operator tier, four levels at 10%, and the top two get nothing.
  it('shorts the top of the chain, never the bottom, and says who', () => {
    const r = applyLadderScenario({
      ...base, tier: 'operator', uplineShares: [0.1, 0.1, 0.1, 0.1],
    });
    expect(r.shortedNames.length).toBeGreaterThan(0);
    expect(r.rungs[2].shorted).toBeFalsy(); // nearest the sale is paid
    expect(r.rungs[r.rungs.length - 1].shorted).toBe(true); // furthest up is not
  });
});

describe('the exported diagram', () => {
  const r = applyLadderScenario({
    monthlyVolumeCents: 1_000_000, feePercent: 0.05, tier: 'origination',
    uplineShares: [0.1, 0.1, 0.1], personas: ISO_PERSONAS,
  });

  it('is generated from the same result the table shows', () => {
    const m = ladderMermaid(r);
    expect(m).toContain(CAST.hub);
    expect(m).toContain(CAST.head);
    expect(m).toContain(`$${((r.houseCents) / 100).toFixed(2)}`);
  });

  // ⚠️ These pages get forwarded. A stand-in name is the whole point, so a real one appearing
  // would defeat it.
  it('uses stand-in names, never the real people', () => {
    const m = ladderMermaid(r).toLowerCase();
    for (const real of ['amy', 'daryle', 'harrison', 'ware']) expect(m).not.toContain(real);
  });

  // A quote or bracket inside a label ends it early and the diagram silently mangles.
  it('escapes characters that would break a mermaid label', () => {
    const q = applyLadderScenario({
      monthlyVolumeCents: 500_000, feePercent: 0.05, tier: 'operator',
      uplineShares: [0.05], personas: ['A "quoted" merchant', 'Rep [one]', 'Boss'],
    });
    const m = ladderMermaid(q);
    expect(m).not.toContain('"quoted"');
    expect(m).not.toContain('[one]');
  });
});
