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
  SALE_PRESETS,
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

describe('what depth actually costs (the claim a first draft got backwards)', () => {
  const base = { monthlyVolumeCents: 1_000_000, feePercent: 0.05 } as const;
  const topOf = (shares: number[], tier: 'operator' | 'origination') => {
    const r = applyLadderScenario({ ...base, tier, uplineShares: shares });
    return r.rungs[r.rungs.length - 1];
  };

  // ⚠️ An override is a share of the FEE, not of what is left after the level below. So adding
  // a level between you and the sale does NOT reduce your cut. A first draft of the Daryle page
  // asserted the opposite in prose; running it disproved it.
  it('a level in between does not reduce the rate above it', () => {
    const direct = topOf([0.05], 'origination');
    for (const middle of [0.05, 0.1, 0.15, 0.18]) {
      expect(topOf([middle, 0.05], 'origination').cents).toBe(direct.cents);
    }
  });

  // ⚠️ It is a CLIFF, not a slope: past the pool you are paid nothing, not less. A slope would
  // be survivable and visible in a number; this is neither.
  it('but past the pool the top of the chain gets nothing, not less', () => {
    const ok = topOf([0.15, 0.05], 'operator');
    expect(ok.shorted).toBeFalsy();
    const over = topOf([0.18, 0.05], 'operator');
    expect(over.shorted).toBe(true);
    expect(over.cents).toBe(0);
  });

  // The tier decides whether there is a cliff at all — same rates, same depth.
  it('the same rates that zero you on one tier fit on the other', () => {
    expect(topOf([0.18, 0.05], 'operator').shorted).toBe(true);
    expect(topOf([0.18, 0.05], 'origination').shorted).toBeFalsy();
  });
});

describe('the partner-facing view hides jargon, never the caveat', () => {
  const src = (() => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { stripComments } = require('@/test/stripComments') as typeof import('@/test/stripComments');
    return stripComments(readFileSync('components/admin/role-ladder-tool.tsx', 'utf8'));
  })();

  // ⚠️ A partner reading `referral_codes.owner_type` learns nothing and may read it as
  // unfinished, so the source column is internal-only.
  it('shows the source column only internally', () => {
    expect(src).toMatch(/audience === 'internal' \? \(\s*<span[^>]*>\{r\.established\}/);
  });

  // ⚠️ But the unnamed-rung caveat SURVIVES for partners, reworded. Dropping it would let a
  // name that exists only in a diagram be quoted back to us as a commitment — the precise risk
  // the marking exists for.
  it('still warns a partner when a rung has no settled name', () => {
    expect(src).toMatch(/levels this deep are supported, but we have not settled/);
  });

  // ⚠️ The house row is deliberately visible to partners — /for-amy's own voice settled that a
  // constraint you can see is easier to trust than one we assert. Asserted as BEHAVIOUR, not by
  // matching the comment that explains it: the first version of this test did the latter and
  // failed, because stripComments had already removed the thing it was looking for.
  it('never hides what QuickSites keeps, and gates nothing else on audience', () => {
    expect(src).toContain('QuickSites');
    // `audience` may only ever decide the rung-name note. Two uses, both in that branch.
    const uses = src.match(/audience ===/g) ?? [];
    expect(uses).toHaveLength(2);
  });
});

describe('the candle examples Amy actually gave', () => {
  const chain = (cents: number) =>
    applyLadderScenario({
      monthlyVolumeCents: cents, feePercent: 0.05, tier: 'origination',
      uplineShares: [0.1, 0.1, 0.1], personas: ISO_PERSONAS,
    });

  // ⚠️ THE NUMBER THE MONTHLY-VOLUME FRAMING HID. She asked about a $25 candle. The whole
  // platform fee on it is $1.25 and each upline earns twelve cents. That is not a defect —
  // it is the model saying which merchants a four-deep chain can carry, and it only becomes
  // visible if the page can show ONE SALE rather than a month of them.
  it('pays cents on a $25 candle, and the tool must be able to show that', () => {
    const r = chain(2500);
    expect(r.feeCents).toBe(125);
    const top = r.rungs[r.rungs.length - 1];
    expect(top.cents).toBeLessThan(25); // under a quarter
    expect(top.cents).toBeGreaterThan(0); // but not shorted — the pool is fine, the order is small
  });

  it('becomes real money on a busy month, which is the point', () => {
    const top = chain(2_000_000).rungs.slice(-1)[0];
    expect(top.cents).toBeGreaterThan(5000); // > $50/mo per merchant
  });

  // Presets are the examples from the call, verbatim. If someone rounds them to $20/$50 the
  // page stops answering the question she asked.
  it('keeps her figures', () => {
    expect(SALE_PRESETS.map((p) => p.cents)).toContain(2500);
    expect(SALE_PRESETS.map((p) => p.cents)).toContain(4500);
  });
});
