// lib/ppl/__tests__/pitchPlan.test.ts
//
// The pitch script is an honesty surface. Every sentence it can say is grepped for the IVR's
// forbidden words AND the ranking promises a salesperson reaches for; every dollar figure in it
// is the one the account table would charge; the tree is whole (every branch lands somewhere,
// every node is reachable, every path ends); and the advice is derived from the row — the
// missed-call line appears only when a dial actually rang out.
import { buildPitchPlan, pitchScript, pitchFacts, rankPitchOrder, layoutScript, everySayable, whenLabel, SCRIPT_FORBIDDEN, STARTER_DEPOSIT_CENTS, usd } from '@/lib/ppl/pitchPlan';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import type { LineRow } from '@/lib/ppl/corpus';

const line = (p: Partial<LineRow> = {}): LineRow => ({
  campaignId: 'c1', domain: 'vashon-plumbing.com', city: 'Vashon', industry: 'plumbing', rankStatus: 'ranking', rankPosition: 54.9, ageDays: 9,
  forwardToName: 'Midsound Plumbing', impressions28d: 11, clicks28d: 3, calls: 8, dials: 7, answered: 4, leads90: 2, customers: 2, customerLeads90: 2, junk: 0, ownOrTest: 0, answerRate: 4 / 7, lastCallAt: '2026-10-17T21:53:00Z',
  unanswered: 3, leadCalls: [{ at: '2026-10-13T18:00:00Z', seconds: 116 }, { at: '2026-10-17T21:53:00Z', seconds: 259 }], templateId: 't1', trackingNumber: '+12535550100', outcome: { asked: 0, jobs: 0, noJobs: 0, notYet: 0 }, ...p,
});
const kens = line({ campaignId: 'c2', domain: 'richland-towing.com', city: 'Richland', industry: 'towing', forwardToName: "Ken's Auto Rescue", rankPosition: 14, impressions28d: 55, clicks28d: 2, calls: 1, dials: 1, answered: 1, leads90: 1, customers: 1, customerLeads90: 1, unanswered: 0, leadCalls: [{ at: '2026-10-17T19:10:00Z', seconds: 159 }], ageDays: 20 });

describe('honesty of everything the script can say', () => {
  const plan = buildPitchPlan(line(), [line(), kens], '+1 (253) 555-0100');
  // What is SAID to the business: the script and its answer labels.
  const spoken = [...plan.script.map((n) => n.say), ...plan.script.flatMap((n) => (n.options ?? []).map((o) => o.label))].join('\n').toLowerCase();
  // What the owner reads (advice, on-yes steps) may name rank honestly; it still never carries an IVR-forbidden claim.
  const all = everySayable(plan).join('\n').toLowerCase();
  it.each([...FORBIDDEN_IVR_PHRASES, ...SCRIPT_FORBIDDEN])('the spoken script never says "%s"', (w) => {
    expect(spoken).not.toContain(w.toLowerCase());
  });
  it.each(FORBIDDEN_IVR_PHRASES)('the advice never says "%s" either', (w) => {
    expect(all).not.toContain(w.toLowerCase());
  });
  it('names only the money the account would charge', () => {
    const dollars = Array.from(all.matchAll(/\$\d[\d,]*\d|\$\d/g)).map((m) => m[0]);
    const allowed = new Set([usd(PPL_DEFAULTS.cplCents), usd(STARTER_DEPOSIT_CENTS), usd(plan.deal.reloadAmountCents), usd(plan.deal.reloadThresholdCents), usd(PPL_DEFAULTS.reloadAmountCents)].map((s) => s.toLowerCase()));
    expect(dollars.filter((d) => !allowed.has(d))).toEqual([]);
    expect(dollars.length).toBeGreaterThan(0);
  });
  it('states the billable floor as the default, not a typed number', () => {
    expect(all).toContain(`${PPL_DEFAULTS.minBillableSeconds} seconds`);
  });
});

describe('the tree', () => {
  const script = pitchScript(pitchFacts(line()), null);
  const ids = new Set(script.map((n) => n.id));
  it('every branch lands on a node and every node is reachable from the opening', () => {
    for (const n of script) {
      for (const o of n.options ?? []) expect(ids.has(o.next)).toBe(true);
      if (n.next) expect(ids.has(n.next)).toBe(true);
    }
    const seen = new Set<string>();
    const walk = (id: string) => { if (seen.has(id)) return; seen.add(id); const n = script.find((x) => x.id === id)!; for (const o of n.options ?? []) walk(o.next); if (n.next) walk(n.next); };
    walk(script[0].id);
    expect([...ids].filter((i) => !seen.has(i))).toEqual([]);
  });
  it('every non-terminal node leads somewhere and the three endings exist', () => {
    for (const n of script) if (n.kind !== 'end') expect((n.options?.length ?? 0) > 0 || !!n.next).toBe(true);
    expect(script.filter((n) => n.kind === 'end').map((n) => n.outcome).sort()).toEqual(['later', 'no', 'yes']);
  });
  it('lays out with every node placed once and ends on the last row', () => {
    const f = layoutScript(script);
    expect(f.nodes.map((n) => n.id).sort()).toEqual([...ids].sort());
    const maxY = Math.max(...f.nodes.map((n) => n.y));
    for (const n of f.nodes.filter((n) => n.kind === 'end')) expect(n.y).toBe(maxY);
    expect(f.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
  });
});

describe('advice is derived from the row', () => {
  it('says the missed-call line only when a dial rang out, and opens with the latest lead', () => {
    const withMisses = buildPitchPlan(line(), [line()]);
    expect(withMisses.advice.join(' ')).toMatch(/3 of 7 forwarded dials rang out/);
    expect(withMisses.advice[0]).toMatch(/4 minutes/);
    const clean = buildPitchPlan(kens, [kens]);
    expect(clean.advice.join(' ')).not.toMatch(/rang out/);
    expect(clean.advice[0]).toMatch(/October 17/);
  });
  it('orders the two real lines: more paid-grade calls first', () => {
    expect(rankPitchOrder([kens, line()]).map((l) => l.domain)).toEqual(['vashon-plumbing.com', 'richland-towing.com']);
    const p = buildPitchPlan(kens, [kens, line()]);
    expect(p.order).toEqual({ rank: 2, of: 2, reason: expect.stringContaining('vashon-plumbing.com has 2') });
  });
  it('on a tie says so and names the tie-break, instead of "1 call to this line\'s 1"', () => {
    const one = line({ customerLeads90: 1, leadCalls: [{ at: '2026-10-17T21:53:00Z', seconds: 259 }] });
    const p = buildPitchPlan(one, [kens, one]);
    expect(p.order.rank).toBe(2);
    expect(p.order.reason).toMatch(/tied with richland-towing.com at 1 paid-grade call; it has more impressions \(55 vs 11\)/);
    expect(buildPitchPlan(kens, [kens, one]).order.reason).toMatch(/tied .* the most impressions \(55\) breaks the tie/);
  });
  it('labels call times on the owner\'s clock, not the server\'s UTC', () => {
    expect(whenLabel('2026-10-17T21:53:00Z')).toBe('Saturday, October 17 at 2:53 PM');
  });
  it('the starter ask is derived from the constants, with the lead count it buys', () => {
    const p = buildPitchPlan(kens, [kens]);
    expect(p.deal.leadsInDeposit).toBe(Math.floor(STARTER_DEPOSIT_CENTS / PPL_DEFAULTS.cplCents));
    expect(p.advice.join(' ')).toContain(`${usd(STARTER_DEPOSIT_CENTS)} to start`);
  });
});
