// Consent v2 (contract §"Consent v2 — voice bases"): the two pure pieces that decide what we
// may CLAIM about a clip's voice, and how HJ's 403s are told apart. Getting either wrong means
// telling a site visitor a customer endorsed a business in their own voice when they didn't.

import { codeForStatus, readUsage } from '../provisionClient';

describe('codeForStatus — HJ 403s are not interchangeable', () => {
  // The exact strings HJ's checkGrant returns.
  it('maps the third-party-voice refusal to its own code', () => {
    expect(codeForStatus(403, { error: 'grant does not permit third-party voice' })).toBe('voice_third_party');
  });

  it('still distinguishes the embed-narrowing 403', () => {
    expect(codeForStatus(403, { error: 'grant is not valid for this embed' })).toBe('grant_embed_mismatch');
  });

  it('still distinguishes the scope 403', () => {
    expect(codeForStatus(403, { error: 'grant scope does not permit this action' })).toBe('grant_scope');
  });

  it('separates a bad partner key from a bad grant on 401', () => {
    expect(codeForStatus(401, { error: 'invalid partner key' })).toBe('invalid_partner_key');
    expect(codeForStatus(401, { error: 'invalid or revoked grant' })).toBe('invalid_or_revoked_grant');
  });

  it('maps the quota + config statuses', () => {
    expect(codeForStatus(429, {})).toBe('quota_exceeded');
    expect(codeForStatus(402, {})).toBe('partner_quota_exceeded');
    expect(codeForStatus(503, { error: 'audio rendering is not configured' })).toBe('audio_not_configured');
    expect(codeForStatus(500, {})).toBe('unknown');
  });
});

describe('readUsage — never invent a voice basis', () => {
  it('passes through a reported basis', () => {
    expect(readUsage({ owner_id: 'u1', embed_id: 'e1', render_chars: 120, billed: true, voice_basis: 'self' })).toMatchObject({
      owner_id: 'u1',
      render_chars: 120,
      billed: true,
      voice_basis: 'self',
    });
  });

  it('leaves the basis UNKNOWN for a welcome when HJ omits it (never assumes "self")', () => {
    expect(readUsage({ render_chars: 10 })?.voice_basis).toBeUndefined();
    expect(readUsage(undefined)).toBeUndefined();
  });

  it('may assume narrator for a testimonial — the contract renders those narrator-always', () => {
    expect(readUsage(undefined, 'narrator')).toEqual({ voice_basis: 'narrator' });
    expect(readUsage({ render_chars: 10 }, 'narrator')?.voice_basis).toBe('narrator');
  });

  it('rejects a basis it does not recognize rather than passing it on', () => {
    // 'third_party' can never legitimately come back through a partner grant.
    expect(readUsage({ voice_basis: 'third_party' })?.voice_basis).toBeUndefined();
    expect(readUsage({ voice_basis: 'nonsense' }, 'narrator')?.voice_basis).toBe('narrator');
  });

  it('normalizes a cache hit (0 chars, unbilled)', () => {
    expect(readUsage({ render_chars: 0, billed: false, voice_basis: 'narrator' })).toMatchObject({
      render_chars: 0,
      billed: false,
    });
  });
});
