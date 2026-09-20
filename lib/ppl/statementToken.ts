// lib/ppl/statementToken.ts
//
// The link a pay-per-call business uses to see its own statement and contest a charge
// (docs/PPL_VERTICAL.md §8 Phase 2). Signed, not logged in: these owners will not create an
// account, and the statement email is the one place the link is delivered. Same HMAC shape
// as lib/auth/siteClaimToken.ts; the payload is `{ a: accountId, exp }` with a one-year TTL,
// and closing the account (status 'closed') is the revocation — the page checks status.

import crypto from 'node:crypto';

export const STATEMENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.PPL_STATEMENT_SECRET ||
    process.env.CLAIM_TOKEN_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  );
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(`ppl-statement:${body}`).digest('base64url');
}

export function mintStatementToken(accountId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ a: accountId, exp: now + STATEMENT_TTL_MS })).toString(
    'base64url'
  );
  return `${body}.${sign(body)}`;
}

export function verifyStatementToken(
  token: string | null | undefined,
  now = Date.now()
): { accountId: string } | null {
  if (!token || typeof token !== 'string' || !secret()) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p?.a || typeof p.exp !== 'number' || now > p.exp) return null;
    return { accountId: String(p.a) };
  } catch {
    return null;
  }
}

export function statementUrl(accountId: string, base: string): string {
  return `${base.replace(/\/+$/, '')}/leads/${encodeURIComponent(mintStatementToken(accountId))}`;
}
