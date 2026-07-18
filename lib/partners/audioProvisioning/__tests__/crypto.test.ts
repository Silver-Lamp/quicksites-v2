// lib/partners/audioProvisioning/__tests__/crypto.test.ts
//
// Grant tokens are per-owner bearer secrets stored at rest — this locks in that the
// AES-256-GCM round-trip recovers the exact plaintext, that ciphertext is randomized
// per call (fresh IV), and that tampering is rejected by the auth tag.

import { encryptGrant, decryptGrant } from '../crypto';

// 32-byte key as 64 hex chars.
const KEY = 'a'.repeat(64);

describe('grant token encryption', () => {
  const OLD = process.env.PARTNER_GRANT_ENC_KEY;
  beforeEach(() => { process.env.PARTNER_GRANT_ENC_KEY = KEY; });
  afterEach(() => {
    if (OLD === undefined) delete process.env.PARTNER_GRANT_ENC_KEY;
    else process.env.PARTNER_GRANT_ENC_KEY = OLD;
  });

  it('round-trips an arbitrary token', () => {
    const token = 'grt_live_9f3c-Ωunicode-πtoken/with+symbols==';
    expect(decryptGrant(encryptGrant(token))).toBe(token);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const a = encryptGrant('same');
    const b = encryptGrant('same');
    expect(a).not.toBe(b);
    expect(decryptGrant(a)).toBe('same');
    expect(decryptGrant(b)).toBe('same');
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptGrant('secret');
    const parts = enc.split(':');
    // Flip a byte in the ciphertext segment.
    const ct = Buffer.from(parts[3], 'base64');
    ct[0] ^= 0xff;
    parts[3] = ct.toString('base64');
    expect(() => decryptGrant(parts.join(':'))).toThrow();
  });

  it('throws when the key is missing', () => {
    delete process.env.PARTNER_GRANT_ENC_KEY;
    expect(() => encryptGrant('x')).toThrow(/PARTNER_GRANT_ENC_KEY/);
  });

  it('accepts a base64 key too', () => {
    process.env.PARTNER_GRANT_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
    expect(decryptGrant(encryptGrant('hello'))).toBe('hello');
  });
});
