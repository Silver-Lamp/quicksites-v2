// lib/partners/perfectLoopsUrls.ts
//
// Which HiveJournal URLs a Perfect Loops block may frame or link to. A plain module with no
// directive, imported by BOTH the client renderer and the server route.
//
// ⚠️ THESE USED TO LIVE IN THE RENDERER, WHICH IS `'use client'` — and importing a function from
// a client module into an API route does not give the server that function: Next hands it a
// client reference, and calling it throws "Attempted to call isAllowedFanLink() from the server".
// The first real signed POST from HiveJournal (2026-10-13 19:19 UTC) died inside zod's refine
// with exactly that, and nothing before it could catch it: jest ignores the directive, the
// unsigned smoke test stops at the signature, and the local secret is a placeholder. A
// server-side helper must not live in a client file, however small.

/** Hosts whose pages may be framed. Exact hosts, no suffix match. */
export const PERFECT_LOOPS_EMBED_HOSTS = new Set(['www.hivejournal.com', 'hivejournal.com']);
export const PERFECT_LOOPS_FAN_LINK_HOSTS = new Set(['perfectloops.fm', 'www.perfectloops.fm', 'www.hivejournal.com', 'hivejournal.com']);

export function isAllowedEmbedUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && PERFECT_LOOPS_EMBED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isAllowedFanLink(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && PERFECT_LOOPS_FAN_LINK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** `?via=site` is accepted and recommended by HJ; nothing else is appended. */
export function fanLinkWithVia(u: string): string {
  try {
    const url = new URL(u);
    if (!url.searchParams.has('via')) url.searchParams.set('via', 'site');
    return url.toString();
  } catch {
    return u;
  }
}
