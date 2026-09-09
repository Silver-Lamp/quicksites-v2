/**
 * @jest-environment node
 */
// `grandstead-towing-service.quicksites.ai` resolves; the card prints it only when it is safe to.
import { readFileSync } from 'node:fs';
import { pickTemplateForBase, printableSlug, type BaseSlugRow } from '../baseSlug';

const row = (over: Partial<BaseSlugRow> & { id: string; slug: string }): BaseSlugRow => ({
  base_slug: over.slug.replace(/-[a-z0-9]{4,5}$/, ''),
  business_name: 'Grandstead Towing Service',
  published: false,
  created_at: '2026-09-08T06:00:00Z',
  ...over,
});

describe('pickTemplateForBase — newest published, else newest draft', () => {
  const older = row({ id: 'a', slug: 'grandstead-towing-service-11111', created_at: '2026-07-12T00:00:00Z' });
  const newer = row({ id: 'b', slug: 'grandstead-towing-service-5v2qe', created_at: '2026-09-08T06:00:00Z' });
  it('one template → that one', () => {
    expect(pickTemplateForBase([newer])?.id).toBe('b');
  });
  it('two drafts → the newest', () => {
    expect(pickTemplateForBase([older, newer])?.id).toBe('b');
  });
  it('an older PUBLISHED one beats a newer draft — "latest published"', () => {
    expect(pickTemplateForBase([{ ...older, published: true }, newer])?.id).toBe('a');
  });
  it('two published → the newest published', () => {
    expect(pickTemplateForBase([{ ...older, published: true }, { ...newer, published: true }])?.id).toBe('b');
  });
  it('none → null', () => {
    expect(pickTemplateForBase([])).toBeNull();
  });
});

describe('printableSlug — the bare host goes on the card only when it cannot mislead', () => {
  const only = row({ id: 'g', slug: 'grandstead-towing-service-5v2qe' });
  it('a lone template prints its base', () => {
    expect(printableSlug(only, [only])).toBe('grandstead-towing-service');
  });
  it('the legacy twin of the same business: the resolver\'s pick prints the base, the other keeps its tail', () => {
    const legacy = row({ id: 'l', slug: 'dirty-south-towing-recovery-8su1i', business_name: 'Dirty South Towing & Recovery', created_at: '2026-09-08T06:00:00Z' });
    const twin = row({ id: 't', slug: 'dirty-south-towing-recovery-eklsq', business_name: 'Dirty South Towing & Recovery', created_at: '2026-09-08T12:39:00Z' });
    expect(printableSlug(twin, [legacy, twin])).toBe('dirty-south-towing-recovery');
    expect(printableSlug(legacy, [legacy, twin])).toBe('dirty-south-towing-recovery-8su1i');
  });
  it('⚠️ two DIFFERENT shops with one name: neither gets the bare host', () => {
    const decatur = row({ id: 'd', slug: 'aa-wrecker-service-8l9ti', business_name: 'AA Wrecker Service (Decatur)' });
    const arab = row({ id: 'r', slug: 'aa-wrecker-service-gjv4a', business_name: 'AA Wrecker Service', created_at: '2026-09-09T06:00:00Z' });
    expect(printableSlug(arab, [decatur, arab])).toBe('aa-wrecker-service-gjv4a');
    expect(printableSlug(decatur, [decatur, arab])).toBe('aa-wrecker-service-8l9ti');
  });
  it('a slug with no tail, or no base, prints as-is', () => {
    expect(printableSlug(row({ id: 'x', slug: 'boston-contractor', base_slug: 'boston-contractor' }), [])).toBe('boston-contractor');
    expect(printableSlug(row({ id: 'y', slug: 'y-abcde', base_slug: null }), [])).toBe('y-abcde');
  });
  it('a family that does not contain the template prints the full slug (caller error, fail safe)', () => {
    expect(printableSlug(only, [])).toBe('grandstead-towing-service-5v2qe');
  });
});

describe('wired in', () => {
  it('the public route falls back to base_slug after an exact-slug miss, using the shared pick', () => {
    const src = readFileSync('app/sites/[slug]/[[...rest]]/page.tsx', 'utf8');
    const exact = src.indexOf(".eq('slug', slug)");
    const base = src.indexOf(".eq('base_slug', slug)");
    expect(exact).toBeGreaterThan(0);
    expect(base).toBeGreaterThan(exact);
    expect(src).toMatch(/pickTemplateForBase\(/);
  });
  it('the card printer uses printableSlug and preflights whatever it printed', () => {
    const src = readFileSync('lib/outreach/claimPostcardSend.ts', 'utf8');
    expect(src).toMatch(/slug: printableSlug\(t as BaseSlugRow, siblings\)/);
    expect(src.indexOf('printableSlug(')).toBeLessThan(src.indexOf('preflightSiteUrl(d.siteUrl)'));
  });
});
