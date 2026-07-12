// lib/domains/namecheap.ts
//
// The single Namecheap client for the app. Availability + registration are used by
// the operator geo-domain flow (lib/outreach/geoCampaigns.ts); configureVercelDns
// writes the apex A / www CNAME / _verify TXT records when a domain lives at
// Namecheap (called from app/api/domains/connect). Namecheap's API requires a
// whitelisted static ClientIp, so this is an operator/server path — the self-serve
// buy flow uses the Vercel registrar instead (lib/domains/registrar.ts).
import { splitSLD_TLD, normalizeApex } from './util';

const API_USER = process.env.NAMECHEAP_API_USER;
const API_KEY = process.env.NAMECHEAP_API_KEY;
// UserName is usually the same as ApiUser; accept either env so the two historical
// conventions (NAMECHEAP_USERNAME vs reusing NAMECHEAP_API_USER) both work.
const USERNAME = process.env.NAMECHEAP_USERNAME || process.env.NAMECHEAP_API_USER;
const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP; // must be whitelisted at Namecheap
const SANDBOX = process.env.NAMECHEAP_SANDBOX === 'true';
const API_URL =
  process.env.NAMECHEAP_API_URL ||
  (SANDBOX ? 'https://api.sandbox.namecheap.com/xml.response' : 'https://api.namecheap.com/xml.response');

function hasNCEnv() {
  return !!(API_USER && API_KEY && USERNAME && CLIENT_IP);
}

function toQuery(params: Record<string, string>) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function ncCall(params: Record<string, string>) {
  const base = {
    ApiUser: API_USER!,
    ApiKey: API_KEY!,
    UserName: USERNAME!,
    ClientIp: CLIENT_IP!,
    ...params,
  };
  const url = `${API_URL}?${toQuery(base)}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const text = await res.text();
  if (!res.ok || !/Status="OK"/.test(text)) {
    const err = text.match(/<Errors>[\s\S]*?<\/Errors>/)?.[0] || text.slice(0, 300);
    throw new Error(`Namecheap API error: ${res.status} ${err || res.statusText}`);
  }
  return text;
}

export function namecheapConfigured() {
  return hasNCEnv();
}

/**
 * Check whether a domain is available to register (namecheap.domains.check).
 * Returns null when Namecheap isn't configured (caller decides how to surface it).
 */
export async function checkDomainAvailability(domain: string): Promise<boolean | null> {
  if (!hasNCEnv()) return null;
  const text = await ncCall({ Command: 'namecheap.domains.check', DomainList: domain });
  // <DomainCheckResult Domain="boston-towing.com" Available="true" .../>
  const m = new RegExp(`Domain="${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*Available="([^"]+)"`, 'i').exec(text);
  return m ? /true/i.test(m[1]) : false;
}

/**
 * Register a domain (namecheap.domains.create). GATED behind GEO_DOMAIN_REGISTER_ENABLED
 * because this SPENDS MONEY — off by default so a campaign never buys a domain by
 * accident. Registrant contact fields come from NAMECHEAP_REGISTRANT_* env. Returns a
 * result object; throws only on a Namecheap API error when registration was attempted.
 */
export async function registerDomain(
  domain: string,
  years = 1,
): Promise<{ registered: boolean; reason?: string }> {
  if (!hasNCEnv()) return { registered: false, reason: 'not_configured' };
  if (process.env.GEO_DOMAIN_REGISTER_ENABLED !== '1' && process.env.GEO_DOMAIN_REGISTER_ENABLED !== 'true') {
    return { registered: false, reason: 'registration_disabled' };
  }
  const { sld, tld } = splitSLD_TLD(domain);
  // Registrant contact — a single shared set of contact fields for all four roles.
  const c = {
    FirstName: process.env.NAMECHEAP_REGISTRANT_FIRST || '',
    LastName: process.env.NAMECHEAP_REGISTRANT_LAST || '',
    Address1: process.env.NAMECHEAP_REGISTRANT_ADDRESS || '',
    City: process.env.NAMECHEAP_REGISTRANT_CITY || '',
    StateProvince: process.env.NAMECHEAP_REGISTRANT_STATE || '',
    PostalCode: process.env.NAMECHEAP_REGISTRANT_ZIP || '',
    Country: process.env.NAMECHEAP_REGISTRANT_COUNTRY || 'US',
    Phone: process.env.NAMECHEAP_REGISTRANT_PHONE || '',
    EmailAddress: process.env.NAMECHEAP_REGISTRANT_EMAIL || '',
  };
  if (!c.FirstName || !c.EmailAddress || !c.Phone || !c.Address1) {
    return { registered: false, reason: 'missing_registrant_contact' };
  }
  const roles = ['Registrant', 'Tech', 'Admin', 'AuxBilling'];
  const contactParams: Record<string, string> = {};
  for (const role of roles) {
    for (const [k, v] of Object.entries(c)) contactParams[`${role}${k}`] = v;
  }
  await ncCall({
    Command: 'namecheap.domains.create',
    DomainName: `${sld}.${tld}`,
    Years: String(years),
    ...contactParams,
  });
  return { registered: true };
}

type Host = { HostName: string; RecordType: string; Address: string; TTL?: string };

/** Parse a namecheap.domains.dns.getHosts response into structured host records. */
function parseHosts(xml: string): Host[] {
  const out: Host[] = [];
  const re = /<host\b([^>]+?)\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const get = (k: string) => attrs.match(new RegExp(`${k}="([^"]*)"`, 'i'))?.[1] ?? '';
    out.push({
      HostName: get('HostName'),
      RecordType: get('Type'),
      Address: get('Address'),
      TTL: get('TTL') || undefined,
    });
  }
  return out;
}

/**
 * Point a Namecheap-hosted domain at the site: writes apex A record(s), a www CNAME,
 * and a _verify TXT ownership token, preserving every other existing record. Idempotent
 * (setHosts replaces the full host set, so we re-send the preserved records too).
 * Throws if Namecheap isn't configured or the API rejects the write.
 */
export async function configureVercelDns(
  domain: string,
  options?: {
    aIps?: string[]; // default Vercel anycast
    cnameTarget?: string; // default Vercel CNAME target
    txtToken?: string; // token set at _verify
    ttl?: string; // seconds
  },
): Promise<{ success: true; applied: { apexA: number; wwwCname: string; verifyTxt: string } }> {
  if (!hasNCEnv()) throw new Error('Namecheap not configured');

  const apex = normalizeApex(domain);
  const { sld, tld } = splitSLD_TLD(apex);
  const aIps = options?.aIps?.length ? options.aIps : ['76.76.21.21'];
  const cnameTarget = options?.cnameTarget || 'cname.vercel-dns.com';
  const txtToken = options?.txtToken || process.env.QS_DOMAIN_TXT_TOKEN || 'quicksites';
  const ttl = options?.ttl || '300';

  // 1) Fetch existing hosts and keep everything except the records we own.
  const getRes = await ncCall({ Command: 'namecheap.domains.dns.getHosts', SLD: sld, TLD: tld });
  const preserved = parseHosts(getRes).filter(
    (h) => !['@', 'www', '_verify'].includes(h.HostName.toLowerCase()),
  );

  // 2) Compose the desired host set.
  const desired: Host[] = [
    ...preserved,
    ...aIps.map((ip) => ({ HostName: '@', RecordType: 'A', Address: ip, TTL: ttl })),
    { HostName: 'www', RecordType: 'CNAME', Address: cnameTarget, TTL: ttl },
    { HostName: '_verify', RecordType: 'TXT', Address: txtToken, TTL: ttl },
  ];

  // 3) setHosts requires numbered params HostName1..N etc.
  const params: Record<string, string> = {
    Command: 'namecheap.domains.dns.setHosts',
    SLD: sld,
    TLD: tld,
  };
  desired.forEach((h, i) => {
    const n = String(i + 1);
    params[`HostName${n}`] = h.HostName;
    params[`RecordType${n}`] = h.RecordType;
    params[`Address${n}`] = h.Address;
    if (h.TTL) params[`TTL${n}`] = h.TTL;
  });

  await ncCall(params);

  return { success: true, applied: { apexA: aIps.length, wwwCname: cnameTarget, verifyTxt: txtToken } };
}
