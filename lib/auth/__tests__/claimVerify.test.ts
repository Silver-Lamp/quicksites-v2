/**
 * @jest-environment node
 */
// Pure-crypto tests for the claim-verification primitives (docs/CLAIM_VERIFICATION_PLAN.md):
// OTP hashing (salted by templateId, constant-time), the short-lived verify grant, and
// the phone helpers. No DB / network.
process.env.CLAIM_TOKEN_SECRET = 'test-secret-claim-verify';

import {
  generateCode,
  hashCode,
  codeMatches,
  maskPhone,
  toE164,
  mintVerifyGrant,
  verifyVerifyGrant,
  GRANT_TTL_MS,
} from '../claimVerify';

describe('OTP hashing', () => {
  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('matches the right code for the right template, in constant time', () => {
    const h = hashCode('123456', 'tpl-A');
    expect(codeMatches('123456', 'tpl-A', h)).toBe(true);
    expect(codeMatches('654321', 'tpl-A', h)).toBe(false); // wrong code
    expect(codeMatches('123456', 'tpl-B', h)).toBe(false); // salt (templateId) mismatch
    expect(codeMatches('123456', 'tpl-A', null)).toBe(false); // no stored hash
  });
});

describe('maskPhone', () => {
  it('shows only the last four', () => {
    expect(maskPhone('+15551234567')).toBe('(•••) •••-4567');
    expect(maskPhone('(555) 123-4567')).toBe('(•••) •••-4567');
    expect(maskPhone('12')).toBe('•••');
  });
});

describe('toE164', () => {
  it('normalizes US numbers, rejects junk', () => {
    expect(toE164('(555) 123-4567')).toBe('+15551234567');
    expect(toE164('555-123-4567')).toBe('+15551234567');
    expect(toE164('15551234567')).toBe('+15551234567');
    expect(toE164('+15551234567')).toBe('+15551234567');
    expect(toE164('123')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});

describe('verify grant', () => {
  it('round-trips for the exact templateId', () => {
    const g = mintVerifyGrant('tpl-A');
    expect(verifyVerifyGrant(g, 'tpl-A')).toBe(true);
    expect(verifyVerifyGrant(g, 'tpl-B')).toBe(false); // bound to a different template
  });

  it('rejects empty, tampered, and expired grants', () => {
    expect(verifyVerifyGrant('', 'tpl-A')).toBe(false);
    expect(verifyVerifyGrant('garbage', 'tpl-A')).toBe(false);
    const g = mintVerifyGrant('tpl-A');
    expect(verifyVerifyGrant(g + 'x', 'tpl-A')).toBe(false); // signature tamper
    const expired = mintVerifyGrant('tpl-A', Date.now() - GRANT_TTL_MS - 1000);
    expect(verifyVerifyGrant(expired, 'tpl-A')).toBe(false);
  });
});
