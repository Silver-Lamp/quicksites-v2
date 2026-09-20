/**
 * @jest-environment node
 */
// The statement link is the only credential a business holds. Pinned: it round-trips, it
// cannot be forged or altered, it expires, and the routes that accept it check both the
// signature and that the call/charge belongs to that account.
import { readFileSync } from 'node:fs';
import {
  mintStatementToken,
  verifyStatementToken,
  statementUrl,
  STATEMENT_TTL_MS,
} from '@/lib/ppl/statementToken';

beforeAll(() => {
  process.env.PPL_STATEMENT_SECRET = 'test-secret-for-statement-tokens';
});

describe('statement token', () => {
  it('round-trips the account id', () => {
    const t = mintStatementToken('acc-123');
    expect(verifyStatementToken(t)).toEqual({ accountId: 'acc-123' });
  });
  it('rejects a tampered payload or signature', () => {
    const t = mintStatementToken('acc-123');
    const [body, sig] = t.split('.');
    const other = Buffer.from(JSON.stringify({ a: 'acc-999', exp: Date.now() + 1e9 })).toString(
      'base64url'
    );
    expect(verifyStatementToken(`${other}.${sig}`)).toBeNull();
    expect(verifyStatementToken(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(verifyStatementToken('nonsense')).toBeNull();
    expect(verifyStatementToken(null)).toBeNull();
  });
  it('expires after a year', () => {
    const t = mintStatementToken('acc-123', 0);
    expect(verifyStatementToken(t, STATEMENT_TTL_MS - 1)).not.toBeNull();
    expect(verifyStatementToken(t, STATEMENT_TTL_MS + 1)).toBeNull();
  });
  it('statementUrl lands on /leads/<token>', () => {
    expect(statementUrl('acc-1', 'https://x.test/')).toMatch(
      /^https:\/\/x\.test\/leads\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
    );
  });
});

describe('the routes that accept the token', () => {
  it('dispute: rate-limited, token-verified, and the window/ownership checks live in lib', () => {
    const src = readFileSync('app/api/leads/dispute/route.ts', 'utf8');
    expect(src.indexOf('rateLimitOr429')).toBeLessThan(src.indexOf('verifyStatementToken('));
    expect(src).toContain('openDispute(');
    const lib = readFileSync('lib/ppl/disputes.ts', 'utf8');
    expect(lib).toContain('row.account_id !== input.account.id');
    expect(lib).toContain('disputeWindowOpen(');
  });
  it('recording: only a call charged to THIS account, and Twilio creds never leave the server', () => {
    const src = readFileSync('app/api/leads/recording/[callSid]/route.ts', 'utf8');
    expect(src).toContain(".eq('account_id', v.accountId)");
    expect(src).toContain(".eq('call_sid', callSid)");
    expect(src).not.toMatch(/redirect\(/);
  });
  it('the statement page 404s a closed account (revocation)', () => {
    const src = readFileSync('app/leads/[token]/page.tsx', 'utf8');
    expect(src).toContain("account.status === 'closed') notFound()");
  });
});
