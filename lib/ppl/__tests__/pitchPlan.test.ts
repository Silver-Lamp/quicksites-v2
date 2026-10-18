// lib/ppl/__tests__/pitchPlan.test.ts
//
// The pitch script is an honesty surface. Every sentence it can say is grepped for the IVR's
// forbidden words AND the ranking promises a salesperson reaches for; every dollar figure in it
// is the one the account table would charge; the tree is whole (every branch lands somewhere,
// every node is reachable, every path ends); and the advice is derived from the row — the
// missed-call line appears only when a dial actually rang out.
import { buildPitchPlan, pitchScript, pitchFacts, rankPitchOrder, layoutScript, everySayable, whenLabel, SCRIPT_FORBIDDEN, STARTER_DEPOSIT_CENTS, DEALS, usd } from '@/lib/ppl/pitchPlan';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import type { LineRow } from '@/lib/ppl/corpus';

const line = (p: Partial<LineRow> = {}): LineRow => ({
  campaignId: 'c1', domain: 'vashon-plumbing.com', city: 'Vashon', industry: 'plumbing', rankStatus: 'ranking', rankPosition: 54.9, ageDays: 9,
  forwardToName: 'Midsound Plumbing', impressions28d: 11, clicks28d: 3, calls: 8, dials: 7, answered: 4, leads90: 2, customers: 2, customerLeads90: 2, junk: 0, ownOrTest: 0, answerRate: 4 / 7, lastCallAt: '2026-10-17T21:53:00Z',
  unanswered: 3, leadCalls: [{ at: '2026-10-13T18:00:00Z', seconds: 116 }, { at: '2026-10-17T21:53:00Z', seconds: 259 }], templateId: 't1', trackingNumber: '+12535550100', outcome: { asked: 0, jobs: 0, noJobs: 0, notYet: 0 },
  pitch: { deal: null, textedAt: null, followupAt: null, followupKind: null, repointBy: null, repointName: null, calledAt: null, result: null }, ...p,
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
    // Every figure must be one the account table would charge: a deal's price, deposit, reload or threshold, or the default reload the advice warns off.
    const allowed = new Set(
      [
        ...Object.values(plan.deals).flatMap((d) => [d.cplCents, d.depositCents, d.reloadAmountCents, d.reloadThresholdCents]),
        PPL_DEFAULTS.reloadAmountCents,
      ].map((c) => usd(c).toLowerCase()),
    );
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
  it('every non-terminal node leads somewhere; the endings are later, no, and one yes per deal', () => {
    for (const n of script) if (n.kind !== 'end') expect((n.options?.length ?? 0) > 0 || !!n.next).toBe(true);
    const ends = script.filter((n) => n.kind === 'end');
    expect(new Set(ends.map((n) => n.outcome))).toEqual(new Set(['later', 'no', 'yes']));
    expect(ends.filter((n) => n.outcome === 'yes').map((n) => n.deal).sort()).toEqual(['next', 'package']);
  });
  it('the deals are what the account table charges: the next one is one lead ahead, the package is a round count, never a percentage in the script', () => {
    expect(DEALS.next.depositCents).toBe(DEALS.next.cplCents);
    expect(DEALS.next.reloadAmountCents).toBe(DEALS.next.cplCents);
    expect(DEALS.next.reloadThresholdCents).toBe(DEALS.next.cplCents); // below one lead → charge one lead: always exactly one ahead
    expect(DEALS.package.cplCents * DEALS.package.leads).toBe(DEALS.package.depositCents);
    expect(DEALS.package.cplCents).toBeLessThan(DEALS.next.cplCents);
    const spoken = script.map((n) => n.say).join(' ');
    expect(spoken).not.toMatch(/\d+\s?%/); // the lever is spoken by a person, never printed in the script
    expect(spoken).toMatch(/refundable/);
    expect(spoken).toMatch(/one (call )?ahead/);
  });
  it('lays out with every node placed once and ends on the last row', () => {
    const f = layoutScript(script);
    expect(f.nodes.map((n) => n.id).sort()).toEqual([...ids].sort());
    const maxY = Math.max(...f.nodes.map((n) => n.y));
    for (const n of f.nodes.filter((n) => n.kind === 'end')) expect(n.y).toBe(maxY);
    expect(f.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
  });
});

describe('the client console never bundles the server module', () => {
  it('imports from pitchPlan as TYPE only, and pulls values from the pure money module', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, '../../../components/admin/ppl-pitch-call-tool.tsx'), 'utf8');
    const valueImports = src.match(/^import (?!type )[^;]*from '@\/lib\/ppl\/pitchPlan'/gm) ?? [];
    expect(valueImports).toEqual([]);
    expect(src).toMatch(/import \{ usd \} from '@\/lib\/ppl\/money'/);
    const money = fs.readFileSync(path.resolve(__dirname, '../money.ts'), 'utf8');
    expect(money).not.toMatch(/^import /m); // pure: nothing for the browser to drag in
  });
});

describe('after the text went out, the call is the third touch', () => {
  const texted = line({ pitch: { deal: 'next', textedAt: '2026-10-19T17:00:00Z', followupAt: '2026-10-22T17:00:00Z', followupKind: 'repoint', repointBy: '2026-10-26', repointName: "Bob's Northwest Plumbing", calledAt: null, result: null } });
  const plan = buildPitchPlan(texted, [texted], '+1 (253) 555-0100');
  const byId = new Map(plan.script.map((n) => [n.id, n]));
  it('opens with the text, offers "did not see it" and "already paid", and the offer says resend rather than describe', () => {
    expect(byId.get('open')!.say).toMatch(/I texted you Monday about the Saturday call from vashon-plumbing.com/);
    expect(byId.get('open')!.options!.map((o) => o.next)).toEqual(['job_q', 'missed_text', 'paid_now', 'who', 'no']);
    expect(byId.get('offer')!.say).toMatch(/^I said I would offer the line to Bob's Northwest Plumbing by Monday, Oct 26; I would rather it stayed with you\./);
    expect(byId.get('offer')!.say).toMatch(/I can resend it right now/);
    expect(byId.get('yes_next')!.say).toMatch(/resending the link now/);
    expect(byId.get('paid_now')).toEqual(expect.objectContaining({ kind: 'end', outcome: 'yes', deal: 'next' }));
  });
  it('still a whole tree, still honest', () => {
    const ids = new Set(plan.script.map((n) => n.id));
    for (const n of plan.script) { for (const o of n.options ?? []) expect(ids.has(o.next)).toBe(true); if (n.next) expect(ids.has(n.next)).toBe(true); }
    const spoken = plan.script.map((n) => n.say).join(' ').toLowerCase();
    for (const w of [...FORBIDDEN_IVR_PHRASES, ...SCRIPT_FORBIDDEN]) expect(spoken).not.toContain(w.toLowerCase());
    expect(plan.advice[0]).toMatch(/THIRD touch/);
    expect(plan.advice.join(' ')).toMatch(/re-point as promised/);
  });
  it('without a follow-up shop the offer carries no re-point sentence', () => {
    const t2 = line({ pitch: { deal: 'package', textedAt: '2026-10-19T17:00:00Z', followupAt: '2026-10-22T17:00:00Z', followupKind: 'last_free', repointBy: null, repointName: null, calledAt: null, result: null } });
    const p2 = buildPitchPlan(t2, [t2]);
    const offer = p2.script.find((n) => n.id === 'offer')!.say;
    expect(offer).not.toMatch(/offer the line/);
    expect(offer).toMatch(new RegExp(`${DEALS.package.leads} calls for \\${usd(DEALS.package.depositCents)}`));
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
  it('the deals in the advice are the constants: pay-the-next-one at the default price, the package as a count for a round number', () => {
    const p = buildPitchPlan(kens, [kens]);
    expect(p.deals.next.cplCents).toBe(PPL_DEFAULTS.cplCents);
    expect(p.deal.leadsInDeposit).toBe(DEALS.package.leads);
    expect(STARTER_DEPOSIT_CENTS).toBe(DEALS.package.depositCents);
    const advice = p.advice.join(' ');
    expect(advice).toContain(`the next is ${usd(DEALS.next.cplCents)} paid now`);
    expect(advice).toContain(`"${DEALS.package.label}"`);
  });
});
