// lib/agreements/signToken.ts
//
// The signer's key to one agreement.
//
// ⚠️ THE LINK IS THE IDENTITY EVIDENCE, AND WE SHOULD BE HONEST ABOUT WHAT THAT IS WORTH. The
// token is emailed to one address, so signing proves possession of that inbox at that moment —
// no more. That is the same standard every low-cost e-signature product actually meets, and it is
// proportionate for an agreement between two people who know each other. It is NOT identity
// verification, and no copy anywhere may imply otherwise. If a case ever needs more, the SMS OTP
// machinery already in this repo (lib/auth/claimVerify.ts) is the next rung, not a bigger claim.
//
// ⚠️ ONE AGREEMENT, NOTHING ELSE. Same rule as the collab token: the id comes from INSIDE the
// token, never from the request body. A token that authorises "an agreement" plus a body naming
// "which agreement" is the shape of every IDOR bug ever written.
//
// Shorter-lived than a collab token (30 days): a signature request is a specific ask with a
// natural end, unlike a conversation that runs for weeks. Expiry is a backstop — revocation is
// voiding the agreement.

import crypto from 'crypto';

export const SIGN_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * ⚠️ TWO LINKS ONLY, AND IT THROWS RATHER THAN SIGNING WITH ''. A longer fallback chain resolves
 * to whatever a given process happens to have — which already cost this repo a live bug when a
 * seeding script signed a collab token with a different secret than the dev server verified with,
 * and the only symptom was "this link isn't working" with nothing logged. Agreements are minted
 * from scripts too, so the same discipline applies.
 */
function secret(): string {
  return process.env.AGREEMENT_TOKEN_SECRET || process.env.SUPABASE_JWT_SECRET || '';
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

export function mintSignToken(agreementId: string, now = Date.now()): string {
  if (!secret()) {
    throw new Error('mintSignToken: no AGREEMENT_TOKEN_SECRET or SUPABASE_JWT_SECRET set');
  }
  const body = Buffer.from(
    JSON.stringify({ a: agreementId, exp: now + SIGN_TOKEN_TTL_MS }),
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** The agreement id, or null. Never throws — a malformed token is an ordinary "bad link". */
export function verifySignToken(token: string, now = Date.now()): { agreementId: string } | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac || !secret()) return null;

  const expected = sign(body);
  // Constant-time: the comparison is the whole security boundary.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.a || typeof payload.exp !== 'number' || payload.exp < now) return null;
    return { agreementId: String(payload.a) };
  } catch {
    return null;
  }
}
