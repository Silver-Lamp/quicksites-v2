/**
 * @jest-environment node
 */
// The client's only credential. It must grant exactly one thread and nothing else.
process.env.COLLAB_TOKEN_SECRET = 'test-secret-for-collab-tokens';

import {
  mintCollabToken,
  verifyCollabToken,
  COLLAB_TOKEN_TTL_MS,
} from '../collabToken';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

describe('round trip', () => {
  it('mints and verifies', () => {
    expect(verifyCollabToken(mintCollabToken(A))?.collabId).toBe(A);
  });

  // ⚠️ The whole point: a token for thread A must never open thread B. Every route that takes
  // one must scope its query by the id INSIDE the token, never by an id from the request body.
  it('binds to one collab', () => {
    expect(verifyCollabToken(mintCollabToken(A))?.collabId).not.toBe(B);
  });
});

describe('rejects everything it should', () => {
  it('a tampered payload', () => {
    const t = mintCollabToken(A);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ c: B, exp: Date.now() + 1000 })).toString('base64url');
    expect(verifyCollabToken(`${forged}.${sig}`)).toBeNull();
  });

  it('a tampered signature', () => {
    const t = mintCollabToken(A);
    expect(verifyCollabToken(t.slice(0, -1) + 'x')).toBeNull();
  });

  it('an expired token', () => {
    const past = Date.now() - COLLAB_TOKEN_TTL_MS - 1000;
    expect(verifyCollabToken(mintCollabToken(A, past))).toBeNull();
  });

  it.each([undefined, null, '', 'not-a-token', 'a.b.c', '.', 'x.'])('junk: %s', (t) => {
    expect(verifyCollabToken(t as any)).toBeNull();
  });

  it('does not distinguish expired from forged', () => {
    // Both return null. Telling a caller WHICH failed turns the endpoint into an oracle.
    const expired = mintCollabToken(A, Date.now() - COLLAB_TOKEN_TTL_MS - 1);
    expect(verifyCollabToken(expired)).toBeNull();
    expect(verifyCollabToken('garbage.garbage')).toBeNull();
  });
});

describe('lifetime', () => {
  it('lasts long enough to be a working thread, not a magic link', () => {
    // A collaboration runs over weeks. A 15-minute link would be hostile to the client
    // re-opening an old email, and expiry is a backstop here rather than the access control.
    expect(COLLAB_TOKEN_TTL_MS).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000);
  });

  it('is still valid just inside the window', () => {
    const nearly = Date.now() - COLLAB_TOKEN_TTL_MS + 60_000;
    expect(verifyCollabToken(mintCollabToken(A, nearly))?.collabId).toBe(A);
  });
});
