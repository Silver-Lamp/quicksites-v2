// lib/namecheap/verifyAndConfigureDomain.ts
const NAMECHEAP_API_USER = process.env.NAMECHEAP_API_USER!;
const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY!;
const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP!;
const SANDBOX = process.env.NAMECHEAP_SANDBOX === 'true';

const API_BASE = SANDBOX
  ? 'https://api.sandbox.namecheap.com/xml.response'
  : 'https://api.namecheap.com/xml.response';

function toQuery(params: Record<string, string>) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

function splitSLD_TLD(apex: string) {
  const parts = apex.split('.');
  if (parts.length < 2) throw new Error(`Invalid apex: ${apex}`);
  return { SLD: parts[0], TLD: parts.slice(1).join('.') };
}

async function ncCall(params: Record<string, string>) {
  const creds = {
    ApiUser: NAMECHEAP_API_USER,
    ApiKey: NAMECHEAP_API_KEY,
    UserName: NAMECHEAP_API_USER, // often same; adjust if different
    ClientIp: CLIENT_IP,
  };
  const url = `${API_BASE}?${toQuery({ ...creds, ...params })}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const text = await res.text();
  const ok = /Status="OK"/.test(text);
  if (!res.ok || !ok) {
    const err = text.match(/<Errors>[\s\S]*?<\/Errors>/)?.[0] || text.slice(0, 500);
    throw new Error(`Namecheap API error: ${res.status} ${res.statusText} ${err}`);
  }
  return text;
}

type Host = { HostName: string; RecordType: string; Address: string; TTL?: string };

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

export async function verifyAndConfigureDomain(
  domain: string,
  options?: {
    aIps?: string[];               // default Vercel anycast
    cnameTarget?: string;          // default Vercel CNAME target
    txtToken?: string;             // token we’ll set at _verify
    ttl?: string;                  // seconds
  }
) {
  const apex = String(domain || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').replace(/\.$/, '');
  if (!apex) throw new Error('Domain required');

  const { SLD, TLD } = splitSLD_TLD(apex);
  const aIps = options?.aIps?.length ? options.aIps : ['76.76.21.21'];
  const cnameTarget = options?.cnameTarget || 'cname.vercel-dns.com';
  const txtToken = options?.txtToken || (process.env.QS_DOMAIN_TXT_TOKEN || 'quicksites');
  const ttl = options?.ttl || '300';

  // 1) Fetch existing hosts
  const getRes = await ncCall({
    Command: 'namecheap.domains.dns.getHosts',
    SLD, TLD,
  });
  const existing = parseHosts(getRes);

  // Keep everything EXCEPT we’ll replace @, www, and _verify
  const preserved = existing.filter(
    (h) => !['@', 'www', '_verify'].includes(h.HostName.toLowerCase())
  );

  // 2) Compose desired hosts
  const desired: Host[] = [
    ...preserved,
    ...aIps.map((ip) => ({ HostName: '@', RecordType: 'A', Address: ip, TTL: ttl })),
    { HostName: 'www', RecordType: 'CNAME', Address: cnameTarget, TTL: ttl },
    { HostName: '_verify', RecordType: 'TXT', Address: txtToken, TTL: ttl },
  ];

  // 3) Namecheap requires numbered params HostName1..N etc.
  const params: Record<string, string> = {
    Command: 'namecheap.domains.dns.setHosts',
    SLD, TLD,
  };
  desired.forEach((h, i) => {
    const n = String(i + 1);
    params[`HostName${n}`] = h.HostName;
    params[`RecordType${n}`] = h.RecordType;
    params[`Address${n}`] = h.Address;
    if (h.TTL) params[`TTL${n}`] = h.TTL;
  });

  const setRes = await ncCall(params);

  return {
    success: true as const,
    applied: {
      apexA: aIps.length,
      wwwCname: cnameTarget,
      verifyTxt: txtToken,
    },
    raw: SANDBOX ? undefined : undefined, // keep minimal; attach `getRes`/`setRes` if you need.
  };
}
