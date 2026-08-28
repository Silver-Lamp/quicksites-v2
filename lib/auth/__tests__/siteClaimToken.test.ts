/**
 * @jest-environment node
 */
// lib/auth/__tests__/siteClaimToken.test.ts
//
// The site-claim token is the entitlement grant for transferring an operator draft.
// Pin the security-relevant properties: it binds one template id, expires, and a
// tampered/foreign token verifies to null.

import {
  mintSiteClaimToken,
  verifySiteClaimToken,
  SITE_CLAIM_TTL_MS,
} from '@/lib/auth/siteClaimToken';

// The token needs a signing secret; provide one for the suite.
process.env.CLAIM_TOKEN_SECRET = 'test-site-claim-secret';

describe('siteClaimToken', () => {
  it('round-trips a template id', () => {
    const tok = mintSiteClaimToken('tpl-123');
    expect(verifySiteClaimToken(tok)).toEqual({ templateId: 'tpl-123' });
  });

  it('rejects an expired token', () => {
    const now = 1_000_000;
    const tok = mintSiteClaimToken('tpl-123', now);
    expect(verifySiteClaimToken(tok, now + SITE_CLAIM_TTL_MS + 1)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const tok = mintSiteClaimToken('tpl-123');
    expect(verifySiteClaimToken(tok.slice(0, -3) + 'xxx')).toBeNull();
  });

  it('rejects a tampered payload (different id → sig mismatch)', () => {
    const [, sig] = mintSiteClaimToken('tpl-123').split('.');
    const forged = Buffer.from(JSON.stringify({ t: 'tpl-999', exp: Date.now() + 1000 })).toString(
      'base64url'
    );
    expect(verifySiteClaimToken(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects empty / malformed input', () => {
    expect(verifySiteClaimToken('')).toBeNull();
    expect(verifySiteClaimToken('nodot')).toBeNull();
    expect(verifySiteClaimToken(undefined)).toBeNull();
  });
});
