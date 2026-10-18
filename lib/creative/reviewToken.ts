// lib/creative/reviewToken.ts
//
// A signed, expiring link that lets a named reviewer (Amy, Daryle) read a project's takes and
// leave votes/comments without an account — the rep-action token shape (lib/rep/repActionToken.ts),
// same secret, a different prefix so one token can never be read as the other.
//
// ⚠️ The link IS the identity. Whoever holds Daryle's link speaks as Daryle on the page. That is
// the same trust as the claim link and the rep grant, and the page says so beside the name. The
// token names the PROJECT, so a reviewer on bhard cannot read another client's takes.
import crypto from 'node:crypto';

export const REVIEW_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type Reviewer = { key: string; name: string };

/** The owner, identified by an admin session rather than a link; replies are stamped with this. */
export const OWNER_REVIEWER: Reviewer = { key: 'owner', name: 'Sandon' };

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
  return crypto.createHmac('sha256', secret()).update(`qs-creative-review:${body}`).digest('base64url');
}

export function normalizeKey(key: string): string {
  return String(key ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32);
}

export function mintReviewToken(project: string, reviewer: Reviewer, now = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({ p: normalizeKey(project), k: normalizeKey(reviewer.key), n: String(reviewer.name).slice(0, 60), exp: now + REVIEW_TOKEN_TTL_MS }),
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** The reviewer a token names for THIS project, or null for a bad/expired/other-project token. */
export function verifyReviewToken(token: string | null | undefined, project: string, now = Date.now()): Reviewer | null {
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
    if (!p?.k || !p?.n || typeof p.exp !== 'number' || now > p.exp) return null;
    if (p.p !== normalizeKey(project)) return null;
    return { key: String(p.k), name: String(p.n) };
  } catch {
    return null;
  }
}
