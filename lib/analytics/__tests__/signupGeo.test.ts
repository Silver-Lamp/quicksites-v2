import { geoFromHeaders, hasGeo } from '@/lib/analytics/signupGeo';

const h = (o: Record<string, string>) => new Headers(o);

describe('geoFromHeaders', () => {
  // ⚠️ Vercel URL-ENCODES the city. Stored raw you get a city list full of percent signs that
  // looks like corruption and sorts wrongly.
  it('decodes the city', () => {
    expect(geoFromHeaders(h({ 'x-vercel-ip-city': 'San%20Francisco' })).city).toBe('San Francisco');
    expect(geoFromHeaders(h({ 'x-vercel-ip-city': 'Z%C3%BCrich' })).city).toBe('Zürich');
  });

  it('reads country and region', () => {
    const g = geoFromHeaders(h({
      'x-vercel-ip-country': 'US',
      'x-vercel-ip-country-region': 'WA',
      'x-vercel-ip-city': 'Seattle',
    }));
    expect(g).toEqual({ country: 'US', region: 'WA', city: 'Seattle' });
  });

  // ⚠️ Absent locally and on any non-Vercel host. Nulls, never a fabricated "Unknown" — the
  // difference between "we never looked" and "we looked and found nothing" is the whole point.
  it('returns nulls when the headers are absent', () => {
    expect(geoFromHeaders(h({}))).toEqual({ country: null, region: null, city: null });
    expect(hasGeo(geoFromHeaders(h({})))).toBe(false);
  });

  it('survives a malformed escape rather than throwing', () => {
    expect(geoFromHeaders(h({ 'x-vercel-ip-city': '100%' })).city).toBe('100%');
  });

  it('ignores empty and absurdly long values', () => {
    expect(geoFromHeaders(h({ 'x-vercel-ip-city': '   ' })).city).toBeNull();
    expect(geoFromHeaders(h({ 'x-vercel-ip-city': 'x'.repeat(200) })).city).toBeNull();
  });
});

describe('the IP is never read', () => {
  const src = require('node:fs').readFileSync(
    require('node:path').resolve(__dirname, '../signupGeo.ts'), 'utf8');
  // ⚠️ Storing the IP would answer questions nobody asked and create a PII store needing
  // retention and deletion paths. Coarse geo answers the actual question.
  it('reads no address header and stores no ip column', () => {
    expect(src).not.toMatch(/x-forwarded-for|x-real-ip|['"]ip['"]\s*:/);
  });
});
