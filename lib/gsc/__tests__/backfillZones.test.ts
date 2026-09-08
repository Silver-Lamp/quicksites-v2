/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { partitionByZone } from '@/lib/gsc/backfillGscProperties';

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
