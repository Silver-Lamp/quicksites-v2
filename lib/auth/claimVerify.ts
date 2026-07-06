// lib/auth/claimVerify.ts
//
// Pure crypto for the claim-verification flow (docs/CLAIM_VERIFICATION_PLAN.md):
//  - a 6-digit OTP that's HMAC-hashed at rest (never store plaintext) and compared
//    in constant time;
//  - a signed, short-lived "verify grant" cookie proving THIS browser passed the OTP,
//    bound to the templateId (so a leaked site-claim token alone can't transfer, and
//    one user can't ride another's verification).
// Shares the HMAC secret with siteClaimToken. No DB / IO here — testable.
import crypto from 'crypto';

/** httpOnly cookie carrying the "this browser verified" grant across the login hop. */
export const CLAIM_VERIFY_GRANT_COOKIE = 'qs_claim_verify_grant';

export const CODE_TTL_MS = 10 * 60 * 1000; // OTP lifetime
export const GRANT_TTL_MS = 30 * 60 * 1000; // time to finish sign-up after verifying
export const MAX_CONFIRM_ATTEMPTS = 5; // per active code before it's burned

function secret(): string {
  return (
    process.env.CLAIM_TOKEN_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  );
}

function hmac(s: string): string {
  return crypto.createHmac('sha256', secret()).update(s).digest('base64url');
}

/** Cryptographically-random 6-digit code, zero-padded. */
export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** HMAC of the code, salted by templateId so a hash can't be replayed across drafts. */
export function hashCode(code: string, templateId: string): string {
  return hmac(`code:${templateId}:${code}`);
}

/** Constant-time compare of a submitted code against the stored hash. */
export function codeMatches(code: string, templateId: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashCode(code, templateId));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** "(•••) •••-4567" — never log or render a full listing number. */
export function maskPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length < 4) return '•••';
  return `(•••) •••-${d.slice(-4)}`;
}

/** Best-effort US E.164 normalization for Twilio. Returns null if it can't. */
export function toE164(raw: string | null | undefined): string | null {
  const s = (raw || '').trim();
  if (s.startsWith('+') && /^\+\d{8,15}$/.test(s)) return s;
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

/** Mint `base64url(payload).hmac` proving verification for a templateId, short TTL. */
export function mintVerifyGrant(templateId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ t: templateId, exp: now + GRANT_TTL_MS })).toString('base64url');
  return `${body}.${hmac(body)}`;
}

/** True iff `token` is a valid, unexpired grant for exactly `templateId`. */
export function verifyVerifyGrant(
  token: string | undefined | null,
  templateId: string,
  now = Date.now(),
): boolean {
  if (!token || typeof token !== 'string' || !secret()) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p?.t === templateId && typeof p.exp === 'number' && now <= p.exp;
  } catch {
    return false;
  }
}
