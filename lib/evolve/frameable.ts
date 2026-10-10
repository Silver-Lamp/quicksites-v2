// lib/evolve/frameable.ts
//
// Can this site sit inside an <iframe> on ours? Decided from the response headers the site
// actually sends (X-Frame-Options, CSP frame-ancestors), because a cross-origin iframe that is
// refused renders a blank box and nothing on our side can tell. Unknown → assume it can; the
// page still offers "open in a new tab" beside the frame either way.

import { assertPublicHttpUrl } from '@/lib/rebuild/scrapeSite';

export function frameableFromHeaders(headers: { get(name: string): string | null }, ourOrigin: string): boolean {
  const xfo = (headers.get('x-frame-options') ?? '').trim().toLowerCase();
  if (xfo === 'deny' || xfo === 'sameorigin') return false;
  const csp = headers.get('content-security-policy') ?? '';
  const m = csp.match(/frame-ancestors\s+([^;]+)/i);
  if (m) {
    const sources = m[1].trim().toLowerCase().split(/\s+/);
    if (sources.includes("'none'")) return false;
    if (sources.includes('*')) return true;
    const our = ourOrigin.toLowerCase().replace(/^https?:\/\//, '');
    return sources.some((s) => s === "'self'" ? false : s.replace(/^https?:\/\//, '').replace(/^\*\./, '') === our || (s.startsWith('*.') && our.endsWith(s.slice(1))) || s === 'https:');
  }
  return true;
}

export type FrameCheck = {
  frameable: boolean;
  /**
   * The URL to put in the iframe: where the site's own redirects ended, upgraded to https.
   * ⚠️ A browser refuses an http:// iframe inside an https:// page (mixed content) and renders
   * a blank box with no error we can read — the first live Evolve page framed the prospect's
   * stored `http://pizzarockisland.com/` and showed nothing (2026-10-10). Always https here.
   */
  frameUrl: string;
};

export function httpsOf(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

export async function isFrameable(url: string, ourOrigin: string, fetchImpl: typeof fetch = fetch): Promise<FrameCheck> {
  const start = httpsOf(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  try {
    assertPublicHttpUrl(start);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);
    try {
      const res = await fetchImpl(start, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; QuickSitesEvolve/1.0)' } });
      const frameable = res.ok ? frameableFromHeaders(res.headers, ourOrigin) : false;
      return { frameable, frameUrl: httpsOf(res.url || start) };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { frameable: false, frameUrl: start };
  }
}
