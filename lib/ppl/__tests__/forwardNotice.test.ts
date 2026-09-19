/**
 * @jest-environment node
 */
// lib/ppl/__tests__/forwardNotice.test.ts — the one-time notice and STOP (§9). The notice may
// state what is happening and how to stop it; it may not pitch, promise, or claim. STOP must
// match Twilio's OptOutType as well as the words, because Twilio's own opt-out handling passes
// the keyword through with that parameter set.
import { readFileSync } from 'node:fs';
import {
  forwardNoticeText,
  isStartMessage,
  isStopMessage,
  stopConfirmationText,
} from '@/lib/ppl/forwardNotice';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';

describe('the notice', () => {
  const t = forwardNoticeText('graftontowing.com', {
    senderName: 'Sandon Jurowski',
    industryLabel: 'Towing',
  });
  it('is the operator’s wording, first name only, calls not leads', () => {
    expect(t).toBe(
      'Hey, Sandon here from QuickSites. Towing calls that come in to graftontowing.com are being forwarded to you at no charge. ' +
        'Callers hear a short "this call may be recorded" notice first. Reply STOP any time to stop receiving them.'
    );
  });
  it('degrades honestly without a sender name or industry', () => {
    const plain = forwardNoticeText('example.com');
    expect(plain).toMatch(/^Hey, this is QuickSites\. Calls that come in to example\.com/);
  });
  it('names the domain, says it is free, says who, and says how to stop', () => {
    expect(t).toContain('graftontowing.com');
    expect(t).toMatch(/no charge/i);
    expect(t).toContain('QuickSites');
    expect(t).toMatch(/Reply STOP/);
  });
  it('mentions the recording notice callers hear', () => {
    expect(t).toMatch(/may be recorded/i);
  });
  it('makes no pitch and no claim', () => {
    for (const p of ['$', 'lead', 'pay', 'price', 'customer', ...FORBIDDEN_IVR_PHRASES]) {
      expect(t.toLowerCase()).not.toContain(p.toLowerCase());
    }
  });
  it('fits one SMS segment for a typical domain (≤ 320 chars, two segments at most)', () => {
    expect(t.length).toBeLessThanOrEqual(320);
  });
});

describe('STOP / START', () => {
  it.each(['STOP', 'stop', ' Stop ', 'UNSUBSCRIBE', 'cancel', 'END', 'quit', 'STOPALL'])(
    '%s is a stop',
    (b) => {
      expect(isStopMessage(b)).toBe(true);
    }
  );
  it('Twilio OptOutType=STOP is a stop regardless of body', () => {
    expect(isStopMessage('please stop calling', 'STOP')).toBe(true);
  });
  it('an ordinary message is not a stop', () => {
    expect(isStopMessage('what is this?')).toBe(false);
    expect(isStopMessage('')).toBe(false);
    expect(isStopMessage(null)).toBe(false);
  });
  it('START / UNSTOP resume', () => {
    expect(isStartMessage('START')).toBe(true);
    expect(isStartMessage('hello', 'START')).toBe(true);
    expect(isStartMessage('hello')).toBe(false);
  });
  it('the confirmation tells them how to resume', () => {
    expect(stopConfirmationText()).toMatch(/START/);
  });
});

describe('the inbound SMS route', () => {
  const src = readFileSync('app/api/twilio/sms/inbound/route.ts', 'utf8');
  it('verifies the Twilio signature before acting', () => {
    expect(src.indexOf('validateRequest')).toBeLessThan(src.indexOf('applyStop(from'));
  });
  it('applies STOP to every campaign using the phone (applyStop), not one', () => {
    const lib = readFileSync('lib/ppl/forwardNotice.ts', 'utf8');
    const fn = lib.slice(lib.indexOf('export async function applyStop'));
    expect(fn).toContain(".eq('forward_to', phone)");
    expect(fn).not.toContain('.limit(1)');
  });
});
