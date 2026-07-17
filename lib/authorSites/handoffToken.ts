// lib/authorSites/handoffToken.ts
//
// The signed HANDOFF TOKEN for HJ Author Sites (crosstalk ideas.md §1 prereq #3 /
// crosstalk/contracts/author-handoff-token.md). HiveJournal links an author to a QS
// join URL carrying this token; QS provisions a reseller-branded author site on
// signup. Same shape as lib/auth/siteClaimToken.ts (base64url(payload).hmac), but:
//
//  - It is minted by HJ, not QS, so the secret MUST be shared between both projects
//    (env `AUTHOR_HANDOFF_SECRET`, set identically in each Vercel project). Unlike
//    the site-claim secret, we do NOT fall back to per-project secrets (service-role
//    key etc.) — those differ across projects and a cross-product token signed with
//    one could never be verified by the other. No shared secret ⇒ the flow is inert
//    (verify returns null), which is the safe default until the owner sets it.
//  - The payload carries what provisioning needs without a callback: the HJ work id
//    (the artifact-import key), the QS reseller org slug, and display fields. The
//    artifact snapshot is fetched separately at provision time (the sellable-
//    artifacts export) so a big payload never rides in a URL.
//
// The token is a bearer grant, exactly like the site-claim token: whoever opens the
// link provisions once. Provisioning is idempotent per (org, work_id) so a leaked or
// replayed token can't double-provision.
import crypto from 'crypto';

/** Cookie carrying the pending author handoff across the login round-trip. */
export const AUTHOR_HANDOFF_COOKIE = 'qs_pending_author_handoff';

/** 30 days — an author may not sign up the instant they click the link. */
export const AUTHOR_HANDOFF_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthorHandoffPayload = {
  /** HJ work id — the stable key for the artifact import + provisioning idempotency. */
  workId: string;
  /** QS reseller org slug the site is provisioned under (e.g. 'hivejournal'). */
  org: string;
  /** Display-only, so provisioning can seed the shell with no HJ callback. */
  authorName?: string;
  workTitle?: string;
};

/**
 * The SHARED secret. Required and explicit — no per-project fallback (see file
 * header). Empty ⇒ mint/verify both no-op, so the feature is off until configured.
 */
function secret(): string {
  return process.env.AUTHOR_HANDOFF_SECRET || '';
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

/** Mint `base64url(payload).base64url(hmac)`. Returns '' if no shared secret is set. */
export function mintAuthorHandoffToken(payload: AuthorHandoffPayload, now = Date.now()): string {
  if (!secret() || !payload?.workId || !payload?.org) return '';
  const body = Buffer.from(
    JSON.stringify({
      w: payload.workId,
      o: payload.org,
      ...(payload.authorName ? { an: payload.authorName } : {}),
      ...(payload.workTitle ? { wt: payload.workTitle } : {}),
      exp: now + AUTHOR_HANDOFF_TTL_MS,
    }),
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Verify signature + expiry; returns the payload or null. Constant-time compare. */
export function verifyAuthorHandoffToken(
  token: string | undefined | null,
  now = Date.now(),
): AuthorHandoffPayload | null {
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
    if (!p?.w || !p?.o || typeof p.exp !== 'number' || now > p.exp) return null;
    return {
      workId: String(p.w),
      org: String(p.o),
      ...(p.an ? { authorName: String(p.an) } : {}),
      ...(p.wt ? { workTitle: String(p.wt) } : {}),
    };
  } catch {
    return null;
  }
}
