// lib/ppl/__tests__/ownNumberCall.test.ts — the business calling its own tracking line
// (renton-towing.com, 2026-10-16): never bridged to itself, never texted its own number.
import fs from 'node:fs';
import path from 'node:path';
import { isOwnBusinessCaller, ownBusinessSmsBody, ownBusinessSpeech, ownBusinessTwiml } from '@/lib/ppl/ownNumberCall';
import { missedCallDecision } from '@/lib/ppl/missedCallNotice';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('isOwnBusinessCaller', () => {
  it('compares the last ten digits (E.164 vs a directory number)', () => {
    expect(isOwnBusinessCaller('+12532170639', '+12532170639')).toBe(true);
    expect(isOwnBusinessCaller('+12532170639', '(253) 217-0639')).toBe(true);
    expect(isOwnBusinessCaller('+12533451344', '+12532170639')).toBe(false);
    expect(isOwnBusinessCaller(null, '+12532170639')).toBe(false);
    expect(isOwnBusinessCaller('+12532170639', '')).toBe(false);
  });
});

describe('what the business hears and reads', () => {
  const args = { domain: 'renton-towing.com', lastCaller: { number: '+12533451344', at: '2026-10-16T21:53:33Z' } };
  it('names the line, says it does not connect their own phone, reads the last caller digit by digit, twice', () => {
    const s = ownBusinessSpeech(args);
    expect(s).toContain('This is the renton-towing.com line, which forwards to your number');
    expect(s).toContain('not connected');
    expect((s.match(/2 5 3, 3 4 5, 1 3 4 4/g) ?? []).length).toBe(2);
    expect(s).toMatch(/2:53/); // Pacific
    expect(s).not.toMatch(/217-0639|2 1 7, 0 6 3 9/); // never their own number
  });
  it('the text carries the number in display form and the time', () => {
    expect(ownBusinessSmsBody(args)).toBe('renton-towing.com: you rang your own forwarding line. The last call to it came from (253) 345-1344 at Oct 16, 2:53 PM. Call them back on that number.');
    expect(ownBusinessSmsBody({ domain: 'x.com', lastCaller: null })).toBeNull();
  });
  it('no prior caller → says so, no text', () => {
    expect(ownBusinessSpeech({ domain: 'x.com', lastCaller: null })).toContain('no other calls to this line on record');
  });
  it('TwiML: a Say and a Hangup, no Dial', () => {
    const t = ownBusinessTwiml(args);
    expect(t).toMatch(/<Say[^>]*>.*<\/Say>\s*<Hangup\/>/s);
    expect(t).not.toContain('<Dial');
  });
});

describe('the missed-call text never tells a business to ring itself', () => {
  const row = { handling: 'forward', call_status: 'dial-no-answer', call_duration: null, forwarded_to: '+12532170639', recording_url: null, voicemail_notified_at: null, missed_call_notified_at: null };
  it('own_business skip', () => {
    expect(missedCallDecision(row, { status: 'completed' }, { callerIsForwardTo: true })).toEqual({ send: false, reason: 'own_business' });
    expect(missedCallDecision(row, { status: 'completed' }, { callerIsForwardTo: false })).toEqual({ send: true, to: '+12532170639' });
  });
});

describe('the wiring (source guards)', () => {
  it('the entry route checks the own number AFTER the screen list and BEFORE the PPL gate, logs it, and never dials', () => {
    const src = read('app/api/twilio/geo/[campaignId]/route.ts');
    const screen = src.indexOf('const screen = await activeScreen(');
    const own = src.indexOf("isOwnBusinessCaller(searchParams.get('From'), campaign.forward_to)");
    const ppl = src.indexOf("campaign?.pricing_model === 'ppl'");
    expect(screen).toBeGreaterThan(-1);
    expect(own).toBeGreaterThan(screen);
    expect(ppl).toBeGreaterThan(own);
    const block = src.slice(own, ppl);
    expect(block).toMatch(/handling: 'own_business'/);
    expect(block).toMatch(/return xml\(ownBusinessTwiml\(args\)\)/);
    expect(block).not.toMatch(/<Dial/);
  });
  it('the status route passes the own-number fact into the missed-call decision', () => {
    const src = read('app/api/twilio/geo/[campaignId]/status/route.ts');
    expect(src).toMatch(/const callerIsForwardTo = isOwnBusinessCaller\(row\?\.from_number, row\?\.forwarded_to\)/);
    expect(src).toMatch(/\{ otherNumbersRungByCaller, callerIsForwardTo \}/);
  });
  it('the admin text route only ever texts the campaign\'s own forward_to', () => {
    const src = read('app/api/admin/ppl/text-business/route.ts');
    expect(src).toMatch(/sendSms\(campaign\.forward_to, parsed\.data\.body(, \{[^)]*\})?\)/);
    expect(src).toMatch(/requireAdmin\(\)/);
    expect(src).not.toMatch(/z\.object\(\{[^}]*to:/);
  });
});
