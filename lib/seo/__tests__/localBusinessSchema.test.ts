/**
 * @jest-environment node
 */
// lib/seo/__tests__/localBusinessSchema.test.ts

import { buildLocalBusinessSchema, localBusinessSchemaEnabled } from '@/lib/seo/localBusinessSchema';

const withNap = {
  meta: {
    industry: 'hvac',
    contact: {
      phone: '617-555-0100',
      address: '165 Cambridgepark Dr',
      city: 'Cambridge',
      state: 'MA',
      postal: '02140',
      latitude: 42.39,
      longitude: -71.14,
    },
  },
  identity: { business_name: 'Cambridge HVAC' },
};

describe('buildLocalBusinessSchema', () => {
  it('builds a typed LocalBusiness from identity + contact', () => {
    const s = buildLocalBusinessSchema(withNap, { url: 'https://x/sites/cambridge-hvac' })!;
    expect(s['@type']).toBe('HVACBusiness'); // hvac → subtype
    expect(s.name).toBe('Cambridge HVAC');
    expect(s.url).toBe('https://x/sites/cambridge-hvac');
    expect(s.telephone).toBe('617-555-0100');
    expect(s.address).toMatchObject({
      '@type': 'PostalAddress',
      streetAddress: '165 Cambridgepark Dr',
      addressLocality: 'Cambridge',
      addressRegion: 'MA',
      postalCode: '02140',
      addressCountry: 'US',
    });
    expect(s.geo).toMatchObject({ '@type': 'GeoCoordinates', latitude: 42.39, longitude: -71.14 });
    expect(s.areaServed).toBe('Cambridge, MA');
  });

  it('falls back to generic LocalBusiness for an unmapped industry', () => {
    const s = buildLocalBusinessSchema({ ...withNap, meta: { ...withNap.meta, industry: 'junk_removal' } })!;
    expect(s['@type']).toBe('LocalBusiness');
  });

  it('works with just a name + city (no street address)', () => {
    const s = buildLocalBusinessSchema({ meta: { geo_city: 'Cambridge' }, identity: { business_name: 'Cambridge HVAC' } });
    expect(s?.name).toBe('Cambridge HVAC');
    expect(s?.address.addressLocality).toBe('Cambridge');
  });

  it('returns null without a name, or without any locality/address', () => {
    expect(buildLocalBusinessSchema({ meta: { contact: { city: 'Cambridge' } } })).toBeNull(); // no name
    expect(buildLocalBusinessSchema({ identity: { business_name: 'X' } })).toBeNull(); // no city/address
  });
});

describe('localBusinessSchemaEnabled', () => {
  it('detects each accepted flag location', () => {
    expect(localBusinessSchemaEnabled({ meta: { local_business_schema: true } })).toBe(true);
    expect(localBusinessSchemaEnabled({ meta: { schema: { localBusiness: {} } } })).toBe(true);
    expect(localBusinessSchemaEnabled({ meta: { jsonld: {} } })).toBe(true);
    expect(localBusinessSchemaEnabled({ meta: {} })).toBe(false);
    expect(localBusinessSchemaEnabled(null)).toBe(false);
  });
});
