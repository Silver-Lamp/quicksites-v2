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
