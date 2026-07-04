// lib/auth/claimToken.ts
//
// Short-lived, HMAC-signed token that lets a guest's in-progress draft follow them
// into an existing account. Minted (server-side) only after proving the caller is
// the anonymous owner of the draft; verified after they log in, then used to
// transfer ownership. The token binds { templateId, anonUid, exp } so it can only
// move that one draft, and the transfer RPC additionally requires the row to still
// be an unclaimed guest draft owned by anonUid — so a stale/replayed token no-ops.
import crypto from 'crypto';

/** Cookie that carries the pending claim token across the login round-trip. */
export const CLAIM_COOKIE = 'qs_pending_claim';

/** 30 minutes — long enough to click a magic link, short enough to limit replay. */
export const CLAIM_TTL_MS = 30 * 60 * 1000;

function secret(): string {
  // No dedicated env required: fall back through existing high-entropy secrets so
  // the token works in every environment. Server-only (never shipped to clients).
  return (
    process.env.CLAIM_TOKEN_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  );
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

export type ClaimPayload = { templateId: string; anonUid: string };

/** Mint `base64url(payload).base64url(hmac)` binding the draft to its anon owner. */
export function mintClaimToken(templateId: string, anonUid: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ t: templateId, a: anonUid, exp: now + CLAIM_TTL_MS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Verify signature + expiry; returns the bound ids or null. Constant-time compare. */
export function verifyClaimToken(token: string | undefined | null, now = Date.now()): ClaimPayload | null {
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
    if (!p?.t || !p?.a || typeof p.exp !== 'number' || now > p.exp) return null;
    return { templateId: String(p.t), anonUid: String(p.a) };
  } catch {
    return null;
  }
}
