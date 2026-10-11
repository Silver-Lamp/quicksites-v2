/**
 * @jest-environment node
 */
// components/for-rep/__tests__/restaurantsSection.test.ts
//
// The restaurants section sits on pages for people who would be counting on the income. Its
// copy is held to the claim-postcard list; every sales page mounts it; the sweep that strangers
// can trigger is bounded in the source; territories name real codes.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';
import { SECTION_COPY } from '@/components/for-rep/restaurants-section';
import { OTHER_VERTICALS_COPY } from '@/components/for-rep/other-verticals';
import { FOR_SALES_PITCHES } from '@/lib/sales/forSalesPitches';
import { REP_TERRITORIES } from '@/lib/rep/territories';
import { sweptRecently } from '@/lib/rep/repRestaurants';
import { cityStateFromNominatim } from '@/lib/utils/geocode';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\brank(s|ing|ed)?\b/i, 'a ranking claim'],
  [/page one|page 1|#1\b/i, 'a page-one claim'],
  [/\bgoogle\b/i, 'a search-engine claim'],
  [/24\s*\/\s*7/i, 'an availability claim'],
  [/licens|insured/i, 'a regulatory claim'],
  [/guarantee/i, 'a guarantee'],
  [/before someone else|goes to one|whoever lets them/i, 'the competition mechanic'],
  [/claim by|deadline|expires|only \d+ (days|left)/i, 'invented urgency'],
  [/\$\s?\d/, 'a typed price'],
  [/more (customers|orders|sales)|grow your|double|boost/i, 'a results promise'],
];

function allCopy(): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'function') { const r = (v as (...a: any[]) => unknown)('Vashon Island', 100); push(r); }
    else if (v && typeof v === 'object') Object.values(v).forEach(push);
  };
  Object.values(SECTION_COPY).forEach(push);
  push(SECTION_COPY.intro(null));
  return parts.join('\n');
}

describe('the section promises nothing the postcard may not', () => {
  const text = allCopy();
  it.each(FORBIDDEN)('never says %s — %s', (re) => {
    expect(text).not.toMatch(re);
  });
  it('earning is conditional, in words', () => {
    expect(text).toMatch(/You earn when they do, and only then/);
  });
  it('the sweep widget\'s own copy says why it is limited', () => {
    const w = read('components/for-rep/sweep-here.tsx');
    expect(w).toMatch(/each sweep costs money/i);
    expect(w).not.toMatch(/\$\s?\d/);
  });
});

describe('every sales-related /for-<name> page mounts it; partner-orientation pages do not', () => {
  it.each(['app/for-abdou/page.tsx', 'app/for-angela/page.tsx', 'app/for-ryan/page.tsx', 'app/for-amber/page.tsx', 'app/for-sales/page.tsx'])('%s', (p) => {
    const src = read(p);
    expect(src).toMatch(/<RestaurantsSection /);
    expect(src).toMatch(/export default async function/);
  });
  it.each(['app/for-daniel/page.tsx', 'app/for-daryle/page.tsx'])('%s is not a sales page', (p) => {
    expect(read(p)).not.toMatch(/<RestaurantsSection /);
  });
  it('/for-sales has no code and no grant: read-only lists, the sweep still works', () => {
    expect(read('app/for-sales/page.tsx')).toMatch(/<RestaurantsSection code=\{null\} repName="a QuickSites rep" token=\{null\} prominent \/>/);
  });
  it('/for-sales is two folded pitches in the owner\'s order (2026-10-11); the lunch pitch holds the restaurants section', () => {
    const src = read('app/for-sales/page.tsx');
    const business = src.indexOf('<Pitch summary={FOR_SALES_PITCHES.business}>');
    const lunch = src.indexOf('<Pitch summary={FOR_SALES_PITCHES.lunch}>');
    const mount = src.indexOf('<RestaurantsSection');
    expect(business).toBeGreaterThan(0);
    expect(lunch).toBeGreaterThan(business);
    expect(mount).toBeGreaterThan(lunch);
    expect(src.slice(mount, mount + 200)).toMatch(/prominent \/>/);
    expect(src).not.toMatch(/<OtherVerticals/);
    expect(FOR_SALES_PITCHES.business).toMatch(/^Know a small business owner\?/);
    expect(FOR_SALES_PITCHES.lunch).toMatch(/^Know of a great lunch spot\?/);
  });
  it.each(['app/for-abdou/page.tsx', 'app/for-angela/page.tsx', 'app/for-ryan/page.tsx'])(
    '%s: restaurants are THE MAIN EVENT — right after the opening section, prominent, then "Our other verticals"',
    (p) => {
      const src = read(p);
      const header = src.indexOf('<SiteHeader');
      const firstClose = src.indexOf('</section>', header);
      const mount = src.indexOf('<RestaurantsSection');
      const secondClose = src.indexOf('</section>', firstClose + 1);
      expect(mount).toBeGreaterThan(firstClose);
      expect(mount).toBeLessThan(secondClose);
      expect(src.slice(mount, mount + 200)).toMatch(/prominent \/>/);
      // Prefix, not the literal `<OtherVerticals />`: /for-sales passes the short `line` variant
      // (its straight-talk section is hidden), and a divider with a prop is still the divider.
      const divider = src.indexOf('<OtherVerticals');
      expect(divider).toBeGreaterThan(mount);
      expect(divider).toBeLessThan(secondClose);
    },
  );
  it('the short divider line names no straight-talk section', () => {
    expect(OTHER_VERTICALS_COPY.lineBrief).not.toMatch(/straight talk|referral code/i);
    expect(OTHER_VERTICALS_COPY.line.startsWith(OTHER_VERTICALS_COPY.lineBrief.replace(/\.$/, ''))).toBe(true);
  });
  it("/for-amber keeps the section inside its QuickSites half (the kitchen half is held free of numbers by its own test)", () => {
    const src = read('app/for-amber/page.tsx');
    expect(src.indexOf('<RestaurantsSection')).toBeGreaterThan(src.indexOf('A separate thing, because you know half the island'));
    expect(src).not.toMatch(/<OtherVerticals/);
  });
});

describe('the public sweep is bounded in the source', () => {
  const src = read('app/api/rep/sweep/route.ts');
  it('per-IP and global daily caps, a recent city is not re-swept, and the shape is fixed server-side', () => {
    expect(src).toMatch(/rateLimitOr429\(req, 'rep-sweep', SWEEPS_PER_IP_PER_DAY, 86_400\)/);
    expect(src).toMatch(/checkRateLimit\('rep-sweep:global', SWEEPS_PER_DAY_GLOBAL, 86_400\)/);
  });
  it('the caps are for strangers: a platform admin is exempt, and a capped visitor still sees a swept city (owner, 2026-10-10)', () => {
    expect(src).toMatch(/getAdminUser\(\)/);
    // Both caps sit inside the not-owner branch, and the per-IP check runs AFTER the city is
    // resolved so the "already swept" answer can be returned instead of a bare 429.
    const notOwner = src.indexOf('if (!asOwner)');
    expect(notOwner).toBeGreaterThan(src.indexOf('loadRestaurantsFor({ city, region, code, menuHost })'));
    expect(src.indexOf("rateLimitOr429(req, 'rep-sweep'")).toBeGreaterThan(notOwner);
    expect(src.indexOf("checkRateLimit('rep-sweep:global'")).toBeGreaterThan(notOwner);
    expect(src).toMatch(/reason: 'ip_cap'/);
    const w = read('components/for-rep/sweep-here.tsx');
    expect(w).toMatch(/j\.reason === 'ip_cap'/);
    expect(src).toMatch(/if \(sweptRecently\(existing\.sweptOn\)\)/);
    expect(src).toMatch(/radiusMeters: RADIUS_METERS/);
    expect(src).toMatch(/includedTypes: TYPES/);
    expect(src).not.toMatch(/body\.(radius|includedTypes|types|operatorId)/);
  });
  it('sweptRecently: seven days', () => {
    const now = Date.parse('2026-10-10T12:00:00Z');
    expect(sweptRecently('2026-10-08T00:00:00Z', now)).toBe(true);
    expect(sweptRecently('2026-09-01T00:00:00Z', now)).toBe(false);
    expect(sweptRecently(null, now)).toBe(false);
  });
});

describe('territories and reverse geocoding', () => {
  it('every territory is a city + two-letter state + label', () => {
    for (const [code, t] of Object.entries(REP_TERRITORIES)) {
      expect(code).toMatch(/^[a-z0-9-]+$/);
      expect(t.city.length).toBeGreaterThan(1);
      expect(t.region).toMatch(/^[A-Z]{2}$/);
      expect(t.label.length).toBeGreaterThan(1);
    }
  });
  it('cityStateFromNominatim reads city/town/village and the US state code', () => {
    expect(cityStateFromNominatim({ address: { town: 'Vashon', 'ISO3166-2-lvl4': 'US-WA' } })).toEqual({ city: 'Vashon', region: 'WA' });
    expect(cityStateFromNominatim({ address: { city: 'Renton', state_code: 'wa' } })).toEqual({ city: 'Renton', region: 'WA' });
    expect(cityStateFromNominatim({ address: { country: 'France' } })).toBeNull();
    expect(cityStateFromNominatim(null)).toBeNull();
  });
});
