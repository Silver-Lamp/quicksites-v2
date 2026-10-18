// lib/ppl/__tests__/pitchText.test.ts — the text-first pitch is an honesty surface.
import fs from 'node:fs';
import path from 'node:path';
import { pitchText1, pitchText2, pitchNextStep, pitchFollowupKind, FOLLOWUP_AFTER_DAYS, REPOINT_AFTER_DAYS } from '@/lib/ppl/pitchText';
import { DEALS, usd } from '@/lib/ppl/pitchPlan';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const lead = { at: '2026-10-17T21:53:00Z', seconds: 259, callerPhone: '+12533451344' };
const t1next = pitchText1({ domain: 'oak-harbor-plumbing.com', lead, deal: 'next', checkoutUrl: 'https://pay.example/x', termsUrl: 'https://www.quicksites.ai/leads/terms' });
const t1pkg = pitchText1({ domain: 'oak-harbor-plumbing.com', lead, deal: 'package', checkoutUrl: 'https://pay.example/x', termsUrl: 'https://www.quicksites.ai/leads/terms' });
const sentAt = new Date('2026-10-21T17:00:00Z');
const t2rep = pitchText2({ domain: 'oak-harbor-plumbing.com', deal: 'next', checkoutUrl: 'https://pay.example/x', alternative: { name: "Bob's Northwest Plumbing" }, sentAt });
const t2last = pitchText2({ domain: 'vashon-plumbing.com', deal: 'next', checkoutUrl: 'https://pay.example/x', alternative: null, sentAt });
const all = [t1next, t1pkg, t2rep.text, t2last.text];

describe('text 1', () => {
  it('names the call they got as free, states the deal, carries the pay link and the terms, offers STOP', () => {
    expect(t1next).toMatch(/Saturday call from oak-harbor-plumbing.com \(\(253\) 345-1344\) was on us/);
    expect(t1next).toContain(`pay ${usd(DEALS.next.cplCents)} for the next one`);
    expect(t1next).toContain('always one ahead');
    expect(t1next).toContain('https://pay.example/x');
    expect(t1next).toContain('Terms: https://www.quicksites.ai/leads/terms');
    expect(t1next).toContain('STOP');
    expect(t1pkg).toContain(`${DEALS.package.leads} calls for ${usd(DEALS.package.depositCents)}`);
    expect(t1pkg).toContain('unused refundable');
  });
  it('fits in a few SMS segments', () => {
    for (const t of [t1next, t1pkg]) expect(t.length).toBeLessThan(420);
  });
});

describe('text 2 is chosen by the facts, never a bluff', () => {
  it('names the real alternative and a real date only when one exists', () => {
    expect(pitchFollowupKind({ alternative: { name: 'x' } })).toBe('repoint');
    expect(t2rep.kind).toBe('repoint');
    expect(t2rep.text).toContain("offer the line to Bob's Northwest Plumbing");
    expect(t2rep.by?.getTime()).toBe(sentAt.getTime() + REPOINT_AFTER_DAYS * 86_400_000);
    expect(t2rep.text).toMatch(/by \w+, Oct 25/);
  });
  it('says "last free one" where there is nobody to re-point to — and never mentions switching', () => {
    expect(t2last.kind).toBe('last_free');
    expect(t2last.by).toBeNull();
    expect(t2last.text).toContain('that was the last free call');
    expect(t2last.text).not.toMatch(/offer the line|another|switch/i);
  });
});

describe('honesty', () => {
  it.each(FORBIDDEN_IVR_PHRASES)('never says "%s"', (w) => {
    for (const t of all) expect(t.toLowerCase()).not.toContain(w.toLowerCase());
  });
  it('never promises ranking, never names a percentage, and every dollar is a deal figure', () => {
    const allowed = new Set(Object.values(DEALS).flatMap((d) => [d.cplCents, d.depositCents]).map((c) => usd(c)));
    for (const t of all) {
      expect(t).not.toMatch(/rank|google|first page|page one|\d+\s?%/i);
      for (const m of t.match(/\$\d[\d,]*/g) ?? []) expect(allowed.has(m)).toBe(true);
    }
    // Text 1 states the floor it bills on; text 2 only reminds, so it need not.
    for (const t of [t1next, t1pkg]) expect(t).toContain(`${PPL_DEFAULTS.minBillableSeconds} s`);
  });
});

describe('next step from the funnel', () => {
  const T = Date.parse('2026-10-21T17:00:00Z');
  const base = { deal: null, textedAt: null, followupAt: null, followupKind: null, repointBy: null, calledAt: null, result: null } as const;
  it('walks text1 → text2 after the wait → call → repoint when the promised date passes', () => {
    expect(pitchNextStep({ ...base }, T).step).toBe('text1');
    expect(pitchNextStep({ ...base, textedAt: new Date(T - 1 * 86_400_000).toISOString() }, T).step).toBe('text2');
    expect(pitchNextStep({ ...base, textedAt: new Date(T - (FOLLOWUP_AFTER_DAYS + 1) * 86_400_000).toISOString() }, T).why).toMatch(/no deposit/);
    expect(pitchNextStep({ ...base, textedAt: 'x', followupAt: 'y' }, T).step).toBe('call');
    expect(pitchNextStep({ ...base, textedAt: 'x', followupAt: 'y', followupKind: 'repoint', repointBy: '2026-10-20', calledAt: 'z' }, T)).toEqual({ step: 'repoint', why: expect.stringContaining('Re-point the line as promised') });
    expect(pitchNextStep({ ...base, textedAt: 'x', followupAt: 'y', followupKind: 'last_free', calledAt: 'z' }, T).step).toBe('done');
    expect(pitchNextStep({ ...base, result: 'paid' }, T).step).toBe('done');
  });
});

describe('source guards — the campaign flips to pay-per-call only when money lands', () => {
  it('account creation no longer switches the campaign; the deposit webhook path does', () => {
    expect(read('app/api/admin/ppl/accounts/route.ts')).not.toMatch(/setCampaignPricing\(/);
    const billing = read('lib/ppl/billing.ts');
    const fn = billing.slice(billing.indexOf('export async function applyPplCheckoutCompleted'));
    expect(fn).toMatch(/setCampaignPricing\(account\.geo_campaign_id/);
    expect(fn).toMatch(/pricing_model: 'ppl'/);
  });
  it('the pitch route texts only the forward-to, honours STOP, and the terms page types no number', () => {
    // The sends live in lib/ppl/pitchSend.ts (the button and the cron share them).
    const send = read('lib/ppl/pitchSend.ts');
    expect(send).toMatch(/sendSms\(c\.forward_to!/);
    expect(send).not.toMatch(/sendSms\([^)]*from_number/);
    expect(send).toMatch(/isOptedOut\(c\.forward_to\)/);
    const terms = read('app/leads/terms/page.tsx');
    expect(terms).not.toMatch(/\$\d/);
    expect(terms).toMatch(/usd\(next\.cplCents\)/);
  });
});
