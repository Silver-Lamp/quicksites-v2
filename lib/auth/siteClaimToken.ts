// lib/auth/siteClaimToken.ts
//
// Signed, expiring token that lets a prospect claim an OPERATOR-assembled outreach
// draft (claim_source='listing_import') when they sign up via the link we send them.
// Unlike the guest claim token (lib/auth/claimToken.ts), this binds ONLY the
// templateId + expiry — the "to" owner is whoever signs up through the link. The
// claim_operator_draft RPC additionally requires the row to still be an unclaimed
// listing_import draft, so a leaked/replayed token no-ops after the first claim.
import crypto from 'crypto';

/** Cookie carrying the pending site-claim across the login round-trip. */
export const SITE_CLAIM_COOKIE = 'qs_pending_site_claim';

/** 30 days — outreach links live longer than a magic-link (guest) claim. */
export const SITE_CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

/** Mint `base64url(payload).base64url(hmac)` binding a claimable draft to its id. */
export function mintSiteClaimToken(templateId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ t: templateId, exp: now + SITE_CLAIM_TTL_MS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Verify signature + expiry; returns { templateId } or null. Constant-time compare. */
export function verifySiteClaimToken(token: string | undefined | null, now = Date.now()): { templateId: string } | null {
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
    if (!p?.t || typeof p.exp !== 'number' || now > p.exp) return null;
    return { templateId: String(p.t) };
  } catch {
    return null;
  }
}
