// lib/rep/repActionToken.ts
//
// A signed, expiring grant that lets the holder of a rep's unlisted page act AS that code —
// today: build a draft site for a swept business with one click (/api/rep/build-draft).
//
// ⚠️ WHY A TOKEN AND NOT A LOGIN. The rep's code is usually unclaimed when they start (Abdou
// has no account yet), the page they work from is already a bearer URL, and the action costs
// us cents, not money. So the grant is minted into the page at render, lives 30 days, names
// the code, and is checked with a constant-time compare — the same shape as the site-claim
// token, with the same secret. What the grant may do is bounded on the server by the per-code
// daily cap, never by the page.
import crypto from 'node:crypto';

export const REP_ACTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.CLAIM_TOKEN_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  );
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(`qs-rep-action:${body}`).digest('base64url');
}

export function mintRepActionToken(code: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ c: code.trim().toLowerCase(), exp: now + REP_ACTION_TTL_MS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyRepActionToken(token: string | null | undefined, now = Date.now()): { code: string } | null {
  if (!token || typeof token !== 'string' || !secret()) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p?.c || typeof p.exp !== 'number' || now > p.exp) return null;
    return { code: String(p.c) };
  } catch {
    return null;
  }
}
