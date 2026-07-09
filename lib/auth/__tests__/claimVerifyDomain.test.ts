// lib/auth/__tests__/claimVerifyDomain.test.ts
//
// The domain-claim email flow reuses claimVerify.ts with the DOMAIN id as the
// subject (instead of a template id). These tests pin that reuse: a grant/hash
// minted for one domain id must not validate against another.
import {
  hashCode,
  codeMatches,
  mintVerifyGrant,
  verifyVerifyGrant,
  GRANT_TTL_MS,
} from '../claimVerify';

const DOMAIN_A = 'aaaaaaaa-0000-0000-0000-000000000000';
const DOMAIN_B = 'bbbbbbbb-0000-0000-0000-000000000000';

beforeAll(() => {
  process.env.CLAIM_TOKEN_SECRET = 'test-secret-for-domain-claim';
});

describe('code hashing salted by domain id', () => {
  it('matches the same code under the same domain id', () => {
    const hash = hashCode('123456', DOMAIN_A);
    expect(codeMatches('123456', DOMAIN_A, hash)).toBe(true);
  });

  it('does not match a different code or a different domain', () => {
    const hash = hashCode('123456', DOMAIN_A);
    expect(codeMatches('000000', DOMAIN_A, hash)).toBe(false);
    expect(codeMatches('123456', DOMAIN_B, hash)).toBe(false); // cross-domain replay blocked
    expect(codeMatches('123456', DOMAIN_A, null)).toBe(false);
  });
});

describe('verify grant bound to domain id', () => {
  const now = 1_000_000_000_000;

  it('validates for the same domain within TTL', () => {
    const g = mintVerifyGrant(DOMAIN_A, now);
    expect(verifyVerifyGrant(g, DOMAIN_A, now + 1000)).toBe(true);
  });

  it('rejects another domain, an expired grant, and junk', () => {
    const g = mintVerifyGrant(DOMAIN_A, now);
    expect(verifyVerifyGrant(g, DOMAIN_B, now + 1000)).toBe(false);
    expect(verifyVerifyGrant(g, DOMAIN_A, now + GRANT_TTL_MS + 1)).toBe(false);
    expect(verifyVerifyGrant('not-a-token', DOMAIN_A, now)).toBe(false);
    expect(verifyVerifyGrant(undefined, DOMAIN_A, now)).toBe(false);
  });
});
