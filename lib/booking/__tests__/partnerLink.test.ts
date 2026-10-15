/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateLinkCode, isLinkExemptDemo, hjConnectUrl, LINK_CODE_TTL_MS } from '@/lib/booking/partnerLink';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('link codes', () => {
  it('are ten unambiguous characters in two groups, fresh each time, fifteen minutes long', () => {
    const a = generateLinkCode();
    const b = generateLinkCode();
    expect(a).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(a).not.toBe(b);
    expect(LINK_CODE_TTL_MS).toBe(15 * 60 * 1000);
  });
  it('the connect link goes to HiveJournal\'s dashboard connect page with template + code', () => {
    expect(hjConnectUrl('t-1', 'ABCDE-FGHJK')).toBe('https://www.hivejournal.com/dashboard/restaurants/connect?template=t-1&code=ABCDE-FGHJK');
  });
});

describe('the demo exemption is by FLAGS, never by id', () => {
  it('only an Italy booking demo is exempt', () => {
    expect(isLinkExemptDemo({ meta: { is_demo: true, demo_kind: 'italy_table_booking' } })).toBe(true);
    expect(isLinkExemptDemo({ meta: { is_demo: true } })).toBe(false);
    expect(isLinkExemptDemo({ meta: { demo_kind: 'italy_table_booking' } })).toBe(false);
    expect(isLinkExemptDemo({ meta: { is_demo: 'true', demo_kind: 'italy_table_booking' } })).toBe(false);
    expect(isLinkExemptDemo(null)).toBe(false);
  });
  it('no route or lib exempts the demo by its template id', () => {
    for (const p of ['lib/booking/partnerLink.ts', 'app/api/booking/[templateId]/day/route.ts', 'app/api/booking/[templateId]/phone/route.ts', 'app/api/booking/[templateId]/cancel/route.ts', 'app/api/booking/[templateId]/tables/route.ts']) {
      expect(read(p)).not.toMatch(/1d424c69/);
    }
  });
});

describe('the four partner routes answer only for a linked template', () => {
  it.each(['day', 'phone', 'cancel', 'tables'])('%s checks isPartnerLinked on the partner path and 403s not_linked', (r) => {
    const src = read(`app/api/booking/[templateId]/${r}/route.ts`);
    expect(src).toMatch(/isPartnerLinked\(templateId\)/);
    expect(src).toMatch(/'not_linked'/);
    // The check is on the PARTNER branch, not the owner's: the owner always sees their own site.
    const i = src.indexOf('isPartnerLinked(templateId)');
    const before = src.slice(Math.max(0, i - 400), i);
    expect(before).toMatch(/partnerCheck === 'ok'|partner\) \{/);
  });
  it('the public guest routes do not need a link — book consults it only to lift the IP limit for a signed simulation call', () => {
    expect(read('app/api/booking/[templateId]/availability/route.ts')).not.toMatch(/isPartnerLinked/);
    const book = read('app/api/booking/[templateId]/book/route.ts');
    expect((book.match(/isPartnerLinked\(/g) ?? []).length).toBe(1);
    expect(book).toMatch(/const unthrottled = partnerCheck === 'ok' && simulation && \(await isPartnerLinked\(templateId\)\)/);
    expect(book).not.toMatch(/'not_linked'/); // a guest is never refused for lack of a link
  });
});

describe('the link routes', () => {
  it('mint is owner-session only and refuses an anonymous (guest-build) session', () => {
    const src = read('app/api/booking/[templateId]/link/route.ts');
    expect(src).toMatch(/requireTemplateOwner\(templateId\)/);
    expect(src).toMatch(/gate\.isAnonymous\) return NextResponse\.json\(\{ error: 'needs_signup' \}/);
    expect(src).not.toMatch(/checkBookingPartner/);
  });
  it('verify is partner-signed only — an owner cannot complete their own link', () => {
    const src = read('app/api/booking/[templateId]/link/verify/route.ts');
    expect(src).toMatch(/checkBookingPartner\(req, raw\)/);
    expect(src).toMatch(/partnerCheck !== 'ok'\) return/);
    expect(src).not.toMatch(/requireTemplateOwner/);
    expect(src).toMatch(/r\.error === 'expired' \? 410/);
  });
  it('unlink takes either side and records which', () => {
    const src = read('app/api/booking/[templateId]/unlink/route.ts');
    expect(src).toMatch(/by = 'owner'/);
    expect(src).toMatch(/unlinkTemplate\(\{ templateId, by/);
  });
  it('a link is unlinked, never deleted; a code is single use', () => {
    const lib = read('lib/booking/partnerLink.ts');
    expect(lib).not.toMatch(/\.delete\(/);
    expect(lib).toMatch(/\.is\('code_used_at', null\)/);
    expect(lib).toMatch(/status: 'unlinked'/);
  });
});
