/**
 * @jest-environment node
 */
// lib/outreach/__tests__/outreachChannels.test.ts
//
// Pure helpers for the postcard + SMS outreach channels (no network / no supabase).

import { parseUsAddress } from '@/lib/outreach/mail/lob';
import { normalizePhone } from '@/lib/outreach/sms/outreachSms';

describe('parseUsAddress', () => {
  it('parses a standard Places formatted address', () => {
    expect(parseUsAddress('123 Main St, Boston, MA 02101, USA')).toEqual({
      line1: '123 Main St',
      city: 'Boston',
      state: 'MA',
      zip: '02101',
    });
  });

  it('prefers city/region hints and still extracts state+zip', () => {
    expect(parseUsAddress('45 Oak Ave, Cambridge, MA 02139', 'Cambridge', 'MA')).toMatchObject({
      city: 'Cambridge',
      state: 'MA',
      zip: '02139',
    });
  });

  it('returns null when the address is unparseable (no zip/state)', () => {
    expect(parseUsAddress('Somewhere downtown')).toBeNull();
    expect(parseUsAddress(null)).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('normalizes 10- and 11-digit US numbers to E.164', () => {
    expect(normalizePhone('(253) 555-0100')).toBe('+12535550100');
    expect(normalizePhone('1-253-555-0100')).toBe('+12535550100');
  });
  it('passes through an existing +E.164 and rejects junk', () => {
    expect(normalizePhone('+442071234567')).toBe('+442071234567');
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
