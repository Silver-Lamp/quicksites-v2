// lib/ppl/__tests__/pitchAuto.test.ts — the pitch cron's two pure decisions, and what it must never do.
import fs from 'node:fs';
import path from 'node:path';
import { isGoodTimeToText, tzForRegion, windowsFor, nextWindowLabel } from '@/lib/ppl/sendWindow';
import { pitchAutoDecision } from '@/lib/ppl/pitchSend';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('the texting window is the business\'s own clock', () => {
  it('maps a campaign region to its zone, defaulting to Pacific', () => {
    expect(tzForRegion('WA')).toBe('America/Los_Angeles');
    expect(tzForRegion('al')).toBe('America/Chicago');
    expect(tzForRegion('NJ')).toBe('America/New_York');
    expect(tzForRegion(null)).toBe('America/Los_Angeles');
  });
  it('weekdays mid-morning and mid-afternoon; Monday afternoons only; never a weekend', () => {
    // 2026-10-20 is a Tuesday. 17:30Z = 10:30 PDT.
    expect(isGoodTimeToText(Date.parse('2026-10-20T17:30:00Z'), { region: 'WA' })).toMatchObject({ ok: true });
    expect(isGoodTimeToText(Date.parse('2026-10-20T14:30:00Z'), { region: 'WA' })).toMatchObject({ ok: false, reason: 'outside_hours' }); // 7:30 PDT
    expect(isGoodTimeToText(Date.parse('2026-10-20T19:30:00Z'), { region: 'WA' })).toMatchObject({ ok: false, reason: 'outside_hours' }); // 12:30 PDT, lunch
    expect(isGoodTimeToText(Date.parse('2026-10-20T21:30:00Z'), { region: 'WA' })).toMatchObject({ ok: true }); // 14:30 PDT
    // Same instant is 12:30 Central → outside for an Alabama line, 13:30 Eastern → outside for New Jersey.
    expect(isGoodTimeToText(Date.parse('2026-10-20T17:30:00Z'), { region: 'AL' })).toMatchObject({ ok: false });
    expect(isGoodTimeToText(Date.parse('2026-10-20T21:30:00Z'), { region: 'AL' })).toMatchObject({ ok: false }); // 16:30 CDT
    // Monday 2026-10-19 10:30 PDT → no; 14:30 PDT → yes.
    expect(isGoodTimeToText(Date.parse('2026-10-19T17:30:00Z'), { region: 'WA' })).toMatchObject({ ok: false });
    expect(isGoodTimeToText(Date.parse('2026-10-19T21:30:00Z'), { region: 'WA' })).toMatchObject({ ok: true });
    // Saturday 2026-10-17.
    expect(isGoodTimeToText(Date.parse('2026-10-17T17:30:00Z'), { region: 'WA' })).toMatchObject({ ok: false, reason: 'weekend' });
    expect(windowsFor(0, 'towing')).toEqual([]);
  });
  it('says when the next window opens, on their clock', () => {
    expect(nextWindowLabel(Date.parse('2026-10-17T17:30:00Z'), { region: 'WA' })).toMatch(/^Monday 14:00–16:00 \(Los Angeles\)$/);
  });
});

describe('what the cron does with one line', () => {
  const T = Date.parse('2026-10-22T17:30:00Z');
  const f = (p: Partial<Parameters<typeof pitchAutoDecision>[0]['funnel']> = {}) => ({ deal: null, textedAt: null, followupAt: null, followupKind: null, repointBy: null, calledAt: null, result: null, ...p });
  const d = (funnel: ReturnType<typeof f>, extra: Partial<Parameters<typeof pitchAutoDecision>[0]> = {}) => pitchAutoDecision({ funnel, hasPaidGradeLead: true, accountActive: false, nowMs: T, followupAfterDays: 3, ...extra });
  it('paid beats everything; a recorded result stops it; no lead → no text', () => {
    expect(d(f({ textedAt: 'x' }), { accountActive: true })).toEqual({ action: 'mark_paid' });
    expect(d(f({ result: 'no' }))).toEqual({ action: 'wait', reason: 'result_recorded' });
    expect(d(f(), { hasPaidGradeLead: false })).toEqual({ action: 'wait', reason: 'no_lead' });
    expect(d(f())).toEqual({ action: 'text1' });
  });
  it('the follow-up waits its days, then goes; after both texts it waits for the owner, and a passed re-point date asks the owner to intervene', () => {
    expect(d(f({ textedAt: new Date(T - 2 * 86_400_000).toISOString() }))).toEqual({ action: 'wait', reason: 'followup_not_due' });
    expect(d(f({ textedAt: new Date(T - 3 * 86_400_000).toISOString() }))).toEqual({ action: 'text2' });
    // The follow-up would promise the line to the next business: held until a person has vetted them.
    const due = f({ textedAt: new Date(T - 3 * 86_400_000).toISOString() });
    expect(d(due, { alternative: { id: 'bradleys', vetted: false } })).toEqual({ action: 'vet_needed', alternativeId: 'bradleys' });
    expect(d(due, { alternative: { id: 'bradleys', vetted: true } })).toEqual({ action: 'text2' });
    expect(d(due, { alternative: null })).toEqual({ action: 'text2' });
    expect(d(f({ textedAt: 'x', followupAt: 'y', followupKind: 'last_free' }))).toEqual({ action: 'wait', reason: 'awaiting_call' });
    expect(d(f({ textedAt: 'x', followupAt: 'y', followupKind: 'repoint', repointBy: '2026-10-21' }))).toEqual({ action: 'intervene_repoint', by: '2026-10-21' });
    expect(d(f({ textedAt: 'x', followupAt: 'y', followupKind: 'repoint', repointBy: '2026-10-25' }))).toEqual({ action: 'wait', reason: 'awaiting_call' });
  });
});

describe('source guards', () => {
  it('the cron never re-points or changes a forward-to, checks the window before every send, and emails on every step', () => {
    const src = read('app/api/cron/ppl-pitch/route.ts');
    expect(src).not.toMatch(/setCampaignForwardTo|set-forward|forward_to:/);
    expect(src.indexOf('isGoodTimeToText(')).toBeLessThan(src.indexOf('sendPitchText1(c.id'));
    for (const subject of ['Paid:', 'Intervene:', 'Pitch text 1 sent', 'Pitch follow-up sent', 'FAILED', 'Vet ']) expect(src).toContain(subject);
    expect(src).toMatch(/PPL_PITCH_AUTO_ENABLED/);
    // The cron never sends the follow-up past an unvetted business: it does not use the override, and the decision holds.
    expect(src).not.toMatch(/allowUnvetted/);
    expect(src).toMatch(/action === 'vet_needed'/);
    // Text 1's email names the next business and asks for the vet; the intervene email carries their number.
    expect(src).toMatch(/Next business in line/);
    expect(src).toMatch(/NOT yet vetted/);
  });
  it('the button and the cron send through the same functions', () => {
    const route = read('app/api/admin/ppl/pitch/route.ts');
    expect(route).toMatch(/sendPitchText1\(/);
    expect(route).toMatch(/sendPitchText2\(/);
    expect(route).not.toMatch(/sendSms\(/);
    expect(read('.env.example')).toMatch(/PPL_PITCH_AUTO_ENABLED/);
    expect(read('vercel.json')).toMatch(/ppl-pitch"/);
    expect(read('lib/config/health.ts')).toMatch(/enabledBy: 'PPL_PITCH_AUTO_ENABLED'/);
  });
});
