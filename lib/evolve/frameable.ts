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

export async function isFrameable(url: string, ourOrigin: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    assertPublicHttpUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);
    try {
      const res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; QuickSitesEvolve/1.0)' } });
      return frameableFromHeaders(res.headers, ourOrigin);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return true;
  }
}
