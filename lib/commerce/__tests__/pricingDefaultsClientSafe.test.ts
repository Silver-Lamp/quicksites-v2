/**
 * @jest-environment node
 */
// /pricing hydrated into "Application error: supabaseKey is required" because a client component
// imported constants from a module that also imports the service-role Supabase client. The server
// HTML was fine, so every curl-based check passed; only a browser saw it. Source guards, because a
// unit test cannot see a bundle graph but reading the files can.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(p, 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.') || name === '__tests__') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('the pricing numbers are importable from a client component', () => {
  it('pricingDefaults imports nothing that touches Supabase', () => {
    const src = read('lib/commerce/pricingDefaults.ts');
    expect(src).not.toMatch(/@\/lib\/supabase/);
    expect(src).not.toMatch(/supabase-js/);
    // Its one dependency is pure too.
    expect(read('lib/commerce/partner-terms.ts')).not.toMatch(/^import/m);
  });
  it('/pricing imports the defaults, never the policy module', () => {
    const src = read('app/pricing/page.tsx');
    expect(src).toMatch(/from '@\/lib\/commerce\/pricingDefaults'/);
    expect(src).not.toMatch(/from '@\/lib\/commerce\/pricingPolicy'/);
  });
  it('pricingPolicy re-exports the same names, so server callers are unchanged', () => {
    const src = read('lib/commerce/pricingPolicy.ts');
    for (const n of ['RESTAURANT_FEE_PERCENT', 'RESTAURANT_FEE_MIN_CENTS', 'GENERAL_FEE_PERCENT', 'GENERAL_FEE_MIN_CENTS', 'restaurantFeeDefault', 'generalFeeDefault']) {
      expect(src).toContain(n);
    }
  });
});

describe('no client component imports the admin client, directly or via pricingPolicy', () => {
  const files = [...walk('app'), ...walk('components')].filter((f) => /^\s*['"]use client['"]/m.test(read(f)));
  it('scans a non-empty set (a sweep matching nothing reports success)', () => {
    expect(files.length).toBeGreaterThan(50);
  });
  it('finds none', () => {
    const offenders = files.filter((f) => /@\/lib\/supabase\/admin|@\/lib\/commerce\/pricingPolicy/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
