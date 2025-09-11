// lib/domains/util.ts
export const DOMAIN_RX = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

export const stripProto = (d: string) => d.replace(/^https?:\/\//i, '');
export const stripTrailingDot = (d: string) => d.replace(/\.$/, '');
export const stripWww = (d: string) => d.replace(/^www\./i, '');

export function normalizeApex(input: string) {
  const d = stripTrailingDot(stripWww(stripProto(String(input || '').trim().toLowerCase())));
  if (!DOMAIN_RX.test(d)) throw new Error('Invalid domain');
  return d;
}
export const withWWW = (apex: string) => `www.${apex}`;

export const VERCEL_A_IPS = ['76.76.21.21']; // default Anycast IP
export const VERCEL_CNAME_TARGETS = ['cname.vercel-dns.com']; // www CNAME

export function splitSLD_TLD(apex: string) {
  // Good enough for .co.uk etc (sld = first label, tld = rest)
  const parts = apex.split('.');
  if (parts.length < 2) throw new Error('Invalid apex');
  return { sld: parts[0], tld: parts.slice(1).join('.') };
}
