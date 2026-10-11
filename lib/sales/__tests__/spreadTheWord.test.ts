// /spread-the-word is the PUBLIC referral page: it must read as "tell people about it", never as
// a sales job, and its pay line must be derived from the member plan the code actually mints.
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import { SPREAD_COPY, FOR_SALES_PITCHES } from '@/lib/sales/forSalesPitches';
import { MEMBER_REFERRAL_PLAN } from '@/lib/rep/memberCode';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));
const page = read('app/spread-the-word/page.tsx');

describe('/spread-the-word', () => {
  it('is public and indexed, with its own share card and canonical', () => {
    expect(page).not.toMatch(/index: false/);
    expect(page).toMatch(/alternates: \{ canonical: 'https:\/\/www\.quicksites\.ai\/spread-the-word' \}/);
    expect(page).toMatch(/metadataBase: new URL\('https:\/\/www\.quicksites\.ai'\)/);
    expect(readFileSync(join(process.cwd(), 'app/spread-the-word/opengraph-image.tsx'), 'utf8')).toMatch(/spread-the-word/);
  });
  it('carries nothing from the sales brief: no commission-sales badge, no call sheet, no domain rental, no typed money', () => {
    const all = page + '\n' + Object.values(SPREAD_COPY).map((v) => (typeof v === 'function' ? v(20, true) : v)).join('\n');
    for (const re of [/commission sales/i, /unlisted/i, /call sheet/i, /for-sales\/call/, /domain rental/i, /<SubPitch k="rental">/, /\$\s?\d/, /\brank(s|ing|ed)?\b/i, /guarantee/i]) expect(all).not.toMatch(re);
  });
  it('mounts the two pitches (lunch first), the restaurants section, and the store + free-site boxes', () => {
    const lunch = page.indexOf('<Pitch summary={FOR_SALES_PITCHES.lunch}');
    const business = page.indexOf('<Pitch summary={FOR_SALES_PITCHES.business}');
    expect(lunch).toBeGreaterThan(0);
    expect(lunch).toBeLessThan(page.indexOf('<RestaurantsSection'));
    expect(page.indexOf('<RestaurantsSection')).toBeLessThan(business);
    expect(page.indexOf('<SubPitch k="store">')).toBeLessThan(page.indexOf('<SubPitch k="website">'));
    expect(FOR_SALES_PITCHES.lunch).toMatch(/^Know of a great lunch spot\?/);
  });
  it('the pay line is derived from the member plan, which is lifetime (owner chose "earn for life", 2026-10-11)', () => {
    expect(MEMBER_REFERRAL_PLAN.durationMonths).toBe(0);
    expect(page).toMatch(/SPREAD_COPY\.howPaid\(MEMBER_REFERRAL_PLAN\.ratePct, MEMBER_REFERRAL_PLAN\.durationMonths === 0\)/);
    const line = SPREAD_COPY.howPaid(MEMBER_REFERRAL_PLAN.ratePct, true);
    expect(line).toContain(`${MEMBER_REFERRAL_PLAN.ratePct}% of our per-order fee`);
    expect(line).toMatch(/for as long as they sell/);
    expect(SPREAD_COPY.howPaid(MEMBER_REFERRAL_PLAN.ratePct, false)).not.toMatch(/for as long as they sell/);
    // The code the route mints carries that plan, not createVanityCode's 12-month default.
    expect(read('lib/rep/memberCode.ts')).toMatch(/ratePct: MEMBER_REFERRAL_PLAN\.ratePct, durationMonths: MEMBER_REFERRAL_PLAN\.durationMonths/);
  });
  it('is reachable from the footer, and the rep brief points at it', () => {
    expect(read('components/site/site-footer.tsx')).toMatch(/href: '\/spread-the-word'/);
    expect(read('app/for-sales/page.tsx')).toMatch(/href="\/spread-the-word"/);
  });
});
