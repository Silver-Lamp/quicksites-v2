import fetch from 'node-fetch';
import qs from 'querystring';

const NAMECHEAP_API_USER = process.env.NAMECHEAP_API_USER!;
const NAMECHEAP_API_KEY = process.env.NAMECHEAP_API_KEY!;
const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP!;
const SANDBOX = process.env.NAMECHEAP_SANDBOX === 'true';

const API_BASE = SANDBOX
  ? 'https://api.sandbox.namecheap.com/xml.response'
  : 'https://api.namecheap.com/xml.response';

export async function verifyAndConfigureDomain(domain: string) {
  const params = {
    ApiUser: NAMECHEAP_API_USER,
    ApiKey: NAMECHEAP_API_KEY,
    UserName: NAMECHEAP_API_USER,
    ClientIp: CLIENT_IP,
    Command: 'namecheap.domains.dns.setHosts',
    SLD: domain.split('.')[0],
    TLD: domain.split('.').slice(1).join('.'),
    'HostName1': '_verify',
    'RecordType1': 'TXT',
    'Address1': 'quicksites',
    'TTL1': '300',
  };

  const url = `${API_BASE}?${qs.stringify(params)}`;
  const res = await fetch(url);
  const text = await res.text();

  if (!text.includes('<Errors>') && text.includes('OK')) {
    return { success: true };
  }

  throw new Error(`Namecheap API error: ${text}`);
}
