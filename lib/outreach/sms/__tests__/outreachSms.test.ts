/**
 * @jest-environment node
 */
// lib/outreach/sms/__tests__/outreachSms.test.ts

import { composeOutreachSms, normalizePhone } from '@/lib/outreach/sms/outreachSms';

describe('composeOutreachSms', () => {
  const base = { businessName: 'Thai Kitchen', domain: 'renton-thai-kitchen.com', campaignId: 'camp1' };

  it('always ends with the opt-out', () => {
    expect(composeOutreachSms(base).trimEnd().endsWith('Reply STOP to opt out.')).toBe(true);
  });

  it('greets the business and links the domain', () => {
    const s = composeOutreachSms(base);
    expect(s).toContain('Hi Thai Kitchen');
    expect(s).toContain('renton-thai-kitchen.com');
  });

  it('signs with the sender name + email when provided, before the opt-out', () => {
    const s = composeOutreachSms({ ...base, sender: { name: 'Sandon Jurowski', email: 'sandon@pointsevenstudio.com' } });
    expect(s).toContain('— Sandon Jurowski · sandon@pointsevenstudio.com');
    // Sign-off precedes the compliance opt-out.
    expect(s.indexOf('Sandon Jurowski')).toBeLessThan(s.indexOf('Reply STOP'));
  });

  it('omits the sign-off line entirely when no sender is set', () => {
    const s = composeOutreachSms(base);
    // The greeting uses an em-dash ("Hi X —"); the sign-off is a "\n— " line — assert that's absent.
    expect(s).not.toContain('\n—');
  });

  it('signs with just the name when no email is set', () => {
    const s = composeOutreachSms({ ...base, sender: { name: 'Sandon Jurowski', email: null } });
    expect(s).toContain('— Sandon Jurowski');
    expect(s).not.toContain(' · ');
  });
});

describe('normalizePhone', () => {
  it('normalizes 10-digit US numbers to E.164', () => {
    expect(normalizePhone('(425) 555-0100')).toBe('+14255550100');
  });
  it('keeps an 11-digit leading-1 number', () => {
    expect(normalizePhone('1-425-555-0100')).toBe('+14255550100');
  });
  it('rejects junk', () => {
    expect(normalizePhone('nope')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});
