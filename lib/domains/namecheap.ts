// lib/domains/namecheap.ts
import { splitSLD_TLD } from './util';

const API_URL = process.env.NAMECHEAP_API_URL || 'https://api.namecheap.com/xml.response';
const API_USER = process.env.NAMECHEAP_API_USER;
const API_KEY = process.env.NAMECHEAP_API_KEY;
const USERNAME = process.env.NAMECHEAP_USERNAME;
const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP; // must be whitelisted at Namecheap

function hasNCEnv() { return !!(API_USER && API_KEY && USERNAME && CLIENT_IP); }

function toQuery(params: Record<string, string>) {
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
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
    throw new Error('Namecheap API error: ' + (text.slice(0, 300) || res.status));
  }
  return text;
}

export function namecheapConfigured() { return hasNCEnv(); }

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

export async function tryApplyNamecheapApexAndWWW(apex: string, aIps: string[], cnameTarget: string) {
  if (!hasNCEnv()) return { applied: false, reason: 'Not configured' as const };

  // We replace only @ and www hosts, preserving other records
  const { sld, tld } = splitSLD_TLD(apex);

  // 1) Get existing hosts
  const getHosts = await ncCall({
    Command: 'namecheap.domains.dns.getHosts',
    SLD: sld, TLD: tld,
  });

  // Quick-n-dirty parse: keep non-@/www lines intact (XML parsing optional later)
  const existing: Array<{ HostName: string; RecordType: string; Address: string; TTL?: string }> = [];
  const hostRegex = /<host.*?HostName="([^"]+)".*?Type="([^"]+)".*?Address="([^"]+)".*?(?:TTL="([^"]+)")?/g;
  let m: RegExpExecArray | null;
  while ((m = hostRegex.exec(getHosts))) {
    const [_, HostName, RecordType, Address, TTL] = m;
    if (HostName === '@' || HostName === 'www') continue; // we'll replace
    existing.push({ HostName, RecordType, Address, TTL });
  }

  // 2) Compose new hosts (existing + our @ + www)
  const ttl = '300';
  const newHosts = [
    ...existing,
    ...aIps.map(ip => ({ HostName: '@', RecordType: 'A', Address: ip, TTL: ttl })),
    { HostName: 'www', RecordType: 'CNAME', Address: cnameTarget, TTL: ttl },
  ];

  // 3) SetHosts requires numbered params
  const numbered: Record<string, string> = {
    Command: 'namecheap.domains.dns.setHosts',
    SLD: sld, TLD: tld,
  };
  newHosts.forEach((h, i) => {
    const n = (i + 1).toString();
    numbered[`HostName${n}`] = h.HostName;
    numbered[`RecordType${n}`] = h.RecordType;
    numbered[`Address${n}`] = h.Address;
    if (h.TTL) numbered[`TTL${n}`] = h.TTL;
  });

  await ncCall(numbered);
  return { applied: true as const, reason: 'ok' as const };
}
