// lib/collab/collabToken.ts
//
// The client's key to their own collaboration page.
//
// ⚠️ A CLIENT SHOULD NOT NEED AN ACCOUNT TO LOOK AT THEIR OWN SITE OPTIONS. Making someone sign
// up before they can see what you built for them puts a login wall at the exact moment friction
// is most expensive — while they are deciding whether to proceed at all. So access is a signed,
// expiring token in a link, the same construction as lib/auth/siteClaimToken.ts.
//
// ⚠️ THE TOKEN GRANTS EXACTLY ONE COLLAB, AND NOTHING ELSE. It is not a session. Holding it lets
// you read that thread and post to it as the client; it confers no ability to read another
// thread, touch a template, or act as an operator. Every route that accepts one must scope its
// query by the collab id inside the token and never by an id from the request body — a token
// that authorises "a collab" and a body that names "which collab" is the shape of every IDOR bug
// ever written.
//
// Long-lived by design (90 days): this is a working thread over weeks, not a one-shot magic
// link, and a client re-opening an old email should land in the conversation rather than a wall.
// It is revocable by rotating the secret or archiving the collab — expiry is a backstop, not the
// access control.

import crypto from 'crypto';

/** 90 days. A collaboration is a slow conversation; a 15-minute link would be hostile. */
export const COLLAB_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * ⚠️ A SHORT CHAIN, ON PURPOSE — A LONG ONE MAKES THE SECRET DEPEND ON THE PROCESS.
 *
 * This started as a four-link fallback copied from the site-claim token, and it produced a bug
 * within minutes of first use: a token minted by a script (which had SUPABASE_SERVICE_ROLE_KEY
 * exported but not SUPABASE_JWT_SECRET) was signed with the service-role key, while the dev
 * server (which loads .env.local, where SUPABASE_JWT_SECRET IS present) verified with a
 * different one. Same code, same machine, two secrets — and the only symptom was the client
 * page saying "this link isn't working", with no error logged anywhere.
 *
 * A fallback chain silently resolves to whatever a given process happens to have. That is fine
 * when minting and verifying always happen in the same server process, and quietly broken the
 * moment anything mints out-of-process — which is exactly what a seeding script does.
 *
 * Two links only, both of which exist in every real environment, and `mintCollabToken` throws if
 * neither is set rather than signing with an empty string.
 */
function secret(): string {
  return process.env.COLLAB_TOKEN_SECRET || process.env.SUPABASE_JWT_SECRET || '';
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

/** `base64url(payload).base64url(hmac)` binding the holder to ONE collab. */
export function mintCollabToken(collabId: string, now = Date.now()): string {
  // Fail loudly at mint time. Signing with '' produces a token that verifies only against
  // another '' — i.e. a link that works nowhere and explains itself nowhere.
  if (!secret()) throw new Error('mintCollabToken: no COLLAB_TOKEN_SECRET or SUPABASE_JWT_SECRET set');
  const body = Buffer.from(
    JSON.stringify({ c: collabId, exp: now + COLLAB_TOKEN_TTL_MS }),
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

/**
 * Verify signature + expiry. Returns the collab id, or null.
 *
 * Constant-time compare, and it returns null for every failure mode rather than distinguishing
 * "bad signature" from "expired" — a caller does not need to know which, and telling them turns
 * the endpoint into an oracle.
 */
export function verifyCollabToken(
  token: string | undefined | null,
  now = Date.now(),
): { collabId: string } | null {
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
    if (!p?.c || typeof p.exp !== 'number' || now > p.exp) return null;
    return { collabId: String(p.c) };
  } catch {
    return null;
  }
}
