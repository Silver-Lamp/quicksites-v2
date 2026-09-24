// lib/auth/pagePin.ts
//
// A shared PIN gate for UNLISTED pages — the `/for-<name>` pattern. These pages carry things a
// named person would not want casually forwarded (a compensation schedule, in the first case), and
// until now their only protection was "the URL is hard to guess", which is not protection: a URL
// travels in link previews, browser sync, screenshots and forwarded texts.
//
// ⚠️ A SIX-DIGIT PIN IS A SPEED BUMP, NOT A SECRET, AND THE HONEST THING IS TO SAY SO. A million
// combinations falls in minutes to a script, so the rate limit below is doing as much work as the
// comparison. What this buys is real but narrow: someone who receives the link cannot read the page
// without also being told the code. It does not make the contents safe to leak.
//
// Three things it deliberately gets right, because each has bitten someone:
//
//   1. THE PIN LIVES IN ENV, NEVER IN SOURCE. A PIN hardcoded in a page is in the repo, in every
//      clone, in the client bundle if the check runs client-side, and — worst — a six-digit literal
//      is short enough that no secret scanner flags it. It would look protected and be published.
//   2. THE CHECK IS SERVER-SIDE AND THE GRANT IS SIGNED. A client-side compare ships the PIN to the
//      browser. An unsigned `pin_ok=1` cookie is a gate anyone can open with devtools.
//   3. IT FAILS CLOSED. No PIN configured → the page does not render. The opposite default (open
//      when unconfigured) is how a gate ends up protecting nothing on the one deploy that mattered.

import crypto from 'crypto';

/**
 * Pages that require a PIN, and the env var holding each one.
 *
 * ⚠️ Written as literal `process.env.X` reads rather than `process.env[\`PAGE_PIN_${key}\`]` ON
 * PURPOSE: the config-declarations test (rule 7a) finds env keys by grepping the source, and a
 * computed name is invisible to it — the key would go undeclared and `/status` could not report the
 * gate. Adding a gated page is one line here plus one in `.env.example`.
 */
const PIN_BY_PAGE: Record<string, string | undefined> = {
  amy: process.env.PAGE_PIN_AMY,
};

/** 7 days: long enough not to nag a repeat reader, short enough to expire off a borrowed laptop. */
export const PAGE_PIN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Attempts per IP per hour. 1e6 combinations ÷ 10/hr ≈ 11 years, which is the real defence. */
export const PAGE_PIN_MAX_ATTEMPTS_PER_HOUR = 10;

export const pagePinCookie = (pageKey: string) => `qs_page_pin_${pageKey}`;

/** True when this page is gated at all — i.e. a PIN is configured for it. */
export function pageRequiresPin(pageKey: string): boolean {
  return Boolean(PIN_BY_PAGE[pageKey]);
}

/** Every gated page key, for `/status` to report readiness without revealing values. */
export function gatedPageKeys(): string[] {
  return Object.keys(PIN_BY_PAGE);
}

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

/** Length-independent equality. `timingSafeEqual` throws on unequal lengths, so hash first. */
function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Is `submitted` the PIN for this page?
 *
 * ⚠️ Returns false when no PIN is configured — a page with no PIN cannot be unlocked BY ANY INPUT,
 * including an empty one. The caller decides whether an ungated page is public; this function never
 * says yes on absence.
 */
export function checkPagePin(pageKey: string, submitted: string | null | undefined): boolean {
  const expected = PIN_BY_PAGE[pageKey];
  if (!expected) return false;
  const given = String(submitted ?? '').trim();
  if (!given) return false;
  return sameSecret(given, expected);
}

/**
 * Mint the grant cookie value. Bound to the page key, so a grant for one unlisted page does not
 * open another — the pages have different audiences and one leaked code must not be a master key.
 */
export function mintPagePinGrant(pageKey: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ p: pageKey, exp: now + PAGE_PIN_TTL_MS })).toString(
    'base64url'
  );
  return `${body}.${sign(body)}`;
}

/** Verify a grant cookie for this page: signature, expiry, and that it names THIS page. */
export function verifyPagePinGrant(
  token: string | undefined | null,
  pageKey: string,
  now = Date.now()
): boolean {
  if (!token || typeof token !== 'string' || !secret()) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!sameSecret(mac, sign(body))) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload?.p !== pageKey) return false;
    return typeof payload?.exp === 'number' && payload.exp > now;
  } catch {
    return false;
  }
}
