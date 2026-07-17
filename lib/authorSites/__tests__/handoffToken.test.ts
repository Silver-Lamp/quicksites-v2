/**
 * @jest-environment node
 */
// lib/authorSites/__tests__/handoffToken.test.ts
//
// The author handoff token is the cross-product provisioning grant (HJ mints, QS
// verifies). Pin the security-relevant properties: it round-trips the work/org,
// expires, tamper/foreign tokens verify to null, and — the cross-product invariant —
// it is INERT without the shared AUTHOR_HANDOFF_SECRET (no per-project fallback).

import {
  mintAuthorHandoffToken,
  verifyAuthorHandoffToken,
  AUTHOR_HANDOFF_TTL_MS,
} from '@/lib/authorSites/handoffToken';

describe('authorHandoffToken', () => {
  const SECRET = 'shared-author-handoff-secret';
  const orig = process.env.AUTHOR_HANDOFF_SECRET;
  beforeEach(() => {
    process.env.AUTHOR_HANDOFF_SECRET = SECRET;
  });
  afterAll(() => {
    if (orig === undefined) delete process.env.AUTHOR_HANDOFF_SECRET;
    else process.env.AUTHOR_HANDOFF_SECRET = orig;
  });

  it('round-trips work id + org (+ optional display fields)', () => {
    const tok = mintAuthorHandoffToken({ workId: 'work_1', org: 'hivejournal', authorName: 'Arlo V', workTitle: 'Broadcast' });
    expect(verifyAuthorHandoffToken(tok)).toEqual({
      workId: 'work_1',
      org: 'hivejournal',
      authorName: 'Arlo V',
      workTitle: 'Broadcast',
    });
  });

  it('omits absent display fields', () => {
    const tok = mintAuthorHandoffToken({ workId: 'work_1', org: 'hivejournal' });
    expect(verifyAuthorHandoffToken(tok)).toEqual({ workId: 'work_1', org: 'hivejournal' });
  });

  it('rejects an expired token', () => {
    const now = 1_000_000;
    const tok = mintAuthorHandoffToken({ workId: 'work_1', org: 'hivejournal' }, now);
    expect(verifyAuthorHandoffToken(tok, now + AUTHOR_HANDOFF_TTL_MS + 1)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const tok = mintAuthorHandoffToken({ workId: 'work_1', org: 'hivejournal' });
    expect(verifyAuthorHandoffToken(tok.slice(0, -3) + 'xxx')).toBeNull();
  });

  it('rejects a tampered payload (different org → sig mismatch)', () => {
    const [, sig] = mintAuthorHandoffToken({ workId: 'work_1', org: 'hivejournal' }).split('.');
    const forged = Buffer.from(JSON.stringify({ w: 'work_1', o: 'evilcorp', exp: Date.now() + 1000 })).toString('base64url');
    expect(verifyAuthorHandoffToken(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects empty / malformed input', () => {
    expect(verifyAuthorHandoffToken('')).toBeNull();
    expect(verifyAuthorHandoffToken('nodot')).toBeNull();
    expect(verifyAuthorHandoffToken(undefined)).toBeNull();
  });

  it('is INERT without the shared secret — mint returns "" and verify returns null', () => {
    delete process.env.AUTHOR_HANDOFF_SECRET;
    expect(mintAuthorHandoffToken({ workId: 'work_1', org: 'hivejournal' })).toBe('');
    // A token minted WITH a secret cannot be verified once the secret is gone.
    process.env.AUTHOR_HANDOFF_SECRET = SECRET;
    const tok = mintAuthorHandoffToken({ workId: 'work_1', org: 'hivejournal' });
    delete process.env.AUTHOR_HANDOFF_SECRET;
    expect(verifyAuthorHandoffToken(tok)).toBeNull();
  });

  it('a token signed with a DIFFERENT secret does not verify (shared-secret binding)', () => {
    const tok = mintAuthorHandoffToken({ workId: 'work_1', org: 'hivejournal' });
    process.env.AUTHOR_HANDOFF_SECRET = 'a-different-projects-secret';
    expect(verifyAuthorHandoffToken(tok)).toBeNull();
  });
});
