/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { partitionByZone, isRegisteredDomain } from '@/lib/gsc/backfillGscProperties';

describe('a domain in the Vercel list is not necessarily registered', () => {
  it('registered through Vercel, or delegated to nameservers, counts; attached with neither does not', () => {
    expect(isRegisteredDomain({ registeredWithVercel: true, nameservers: [] })).toBe(true);
    expect(isRegisteredDomain({ registeredWithVercel: false, nameservers: ['ns1.vercel-dns.com'] })).toBe(true);
    // milton-electrical.com on 2026-09-08: serviceType "na", nameservers [], RDAP 404.
    expect(isRegisteredDomain({ registeredWithVercel: false, nameservers: [] })).toBe(false);
  });
  it('the cron writes the registry truth back to the campaign rows every night', () => {
    const src = read('app/api/cron/gsc-backfill/route.ts');
    expect(src).toMatch(/domain_status: 'unregistered'/);
    expect(src).toMatch(/domain_status: 'attached'/);
  });
});

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('the backfill spends its nightly budget only where it can write DNS', () => {
  const cands = [
    { id: '1', domain: 'seatac-towing.com' },
    { id: '2', domain: 'www.franklin-towing.com' },
    { id: '3', domain: 'milton-electrical.com' },
  ];

  it('splits candidates by Vercel zone, comparing bare apexes', () => {
    const { onVercel, offVercel } = partitionByZone(cands, new Set(['seatac-towing.com', 'franklin-towing.com']));
    expect(onVercel.map((c) => c.id)).toEqual(['1', '2']);
    expect(offVercel.map((c) => c.domain)).toEqual(['milton-electrical.com']);
  });

  it('tries everything when the zone list could not be fetched — unknown is not "off"', () => {
    const { onVercel, offVercel } = partitionByZone(cands, null);
    expect(onVercel).toHaveLength(3);
    expect(offVercel).toHaveLength(0);
  });

  it('the cron probes the zone while picking — listed is not writable — and names the rest', () => {
    // Second run under a working grant: the 6 "not a DNS zone" domains were IN Vercel's domain
    // list (registered there, zone never created) and still burned 6 of 10 slots.
    const src = read('app/api/cron/gsc-backfill/route.ts');
    expect(src).toMatch(/const zone = await isVercelDnsZone\(bareDomain\(c\.domain\)\)/);
    expect(src).toMatch(/if \(zone === false\) noZone\.push/);
    expect(src).toMatch(/notOnVercelDns: offVercel\.map/);
  });

  it('a domain whose TXT is already published is re-verified, not re-tokened', () => {
    // 4 of the first 10 landed "pending"; the next run must finish them rather than write a second record.
    const src = read('lib/gsc/backfillGscProperties.ts');
    expect(src).toMatch(/hasGoogleVerificationTxt\(bareDomain\(domain\)\)/);
    expect(src).toMatch(/verifyPendingGscDomain\(domain, userId\)/);
  });
});
