// lib/crm/unsubToken.ts
//
// Signed, non-expiring token embedded in every marketing email's unsubscribe link.
// Binds a customer id; the /api/crm/unsubscribe route verifies it and flips
// marketing_consent=false. Mirrors lib/auth/siteClaimToken's HMAC scheme.
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

/** Mint `base64url(payload).base64url(hmac)` binding an unsubscribe link to a customer. */
export function mintUnsubToken(customerId: string): string {
  // No expiry: an unsubscribe link must work indefinitely (CAN-SPAM). The `u` marker
  // scopes it to this purpose so it can't be confused with other signed tokens.
  const body = Buffer.from(JSON.stringify({ u: customerId })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Verify signature; returns { customerId } or null. Constant-time compare. */
export function verifyUnsubToken(token: string | undefined | null): { customerId: string } | null {
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
    if (!p?.u) return null;
    return { customerId: String(p.u) };
  } catch {
    return null;
  }
}
