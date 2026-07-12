// lib/seo/coach/unsubToken.ts
//
// Signed, non-expiring token embedded in every coaching email's unsubscribe link.
// Binds a user id; the /api/seo-coach/unsubscribe route verifies it and flips the
// email_preferences opt-out. Mirrors lib/crm/unsubToken.ts but scopes the payload
// with a `c` marker (coaching) so it can't be confused with the customer `u` token.
import crypto from 'crypto';

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
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

/** Mint `base64url(payload).base64url(hmac)` binding an unsubscribe link to a user. */
export function mintCoachUnsubToken(userId: string): string {
  const body = Buffer.from(JSON.stringify({ c: userId })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Verify signature; returns { userId } or null. Constant-time compare. */
export function verifyCoachUnsubToken(token: string | undefined | null): { userId: string } | null {
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
    if (!p?.c) return null;
    return { userId: String(p.c) };
  } catch {
    return null;
  }
}
