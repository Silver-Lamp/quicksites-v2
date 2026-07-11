// lib/gsc/normalizeDomain.ts
//
// Normalize a Google Search Console property or a site domain to a single
// comparable key, so a card (e.g. `foo.quicksites.ai` or `https://foo.com/`)
// can be matched to a connected GSC property (`sc-domain:foo.com`,
// `https://www.foo.com/`, …). Pure — no I/O.

export function normalizeGscDomain(input?: string | null): string {
  let s = (input || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^sc-domain:/, ''); // GSC "Domain" property
  s = s.replace(/^https?:\/\//, ''); // GSC "URL prefix" property / full URL
  s = s.split('/')[0]; // drop any path
  s = s.replace(/^www\./, '');
  s = s.replace(/[.:]+$/, ''); // trailing dot/colon
  return s;
}
