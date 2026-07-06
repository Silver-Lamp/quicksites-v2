/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/importListing.test.ts
//
// The "no website" ingestion mappers: Google Places hours → our HoursDaySpec, types
// → categories, and listing (+ photo-extracted menu) → RebuildSpec. Pure, so they
// pin the shape assembleDraft downstream depends on.

import { mapPlacesHours, mapTypes, buildSpecFromListing, type Listing } from '@/lib/rebuild/importListing';

describe('mapPlacesHours', () => {
  it('maps Google periods (0=Sunday) to validated day/HH:MM entries', () => {
    const out = mapPlacesHours([
      { open: { day: 1, time: '0800' }, close: { day: 1, time: '2100' } },
      { open: { day: 0, time: '0900' }, close: { day: 0, time: '1500' } },
    ]);
    expect(out).toEqual([
      { day: 'mon', open: '08:00', close: '21:00' },
      { day: 'sun', open: '09:00', close: '15:00' },
    ]);
  });

  it('drops malformed times and non-array input', () => {
    expect(mapPlacesHours([{ open: { day: 2, time: 'x' }, close: { day: 2, time: '2100' } }])).toEqual([]);
    expect(mapPlacesHours(undefined)).toEqual([]);
  });
});

describe('mapTypes', () => {
  it('titlecases and drops generic Google types', () => {
    expect(mapTypes(['mexican_restaurant', 'bar', 'point_of_interest', 'establishment', 'food'])).toEqual([
      'Mexican Restaurant',
      'Bar',
    ]);
  });
});

describe('buildSpecFromListing', () => {
  const listing: Listing = {
    name: "Hawkers Bar & Grill",
    phone: '253-555-0100',
    address: '123 Main St, Auburn, WA',
    categories: ['Bar', 'American'],
    hours: [{ day: 'mon', open: '11:00', close: '22:00' }],
    photos: ['https://x/1.jpg'],
  };

  it('maps a restaurant listing into a full RebuildSpec', () => {
    const spec = buildSpecFromListing(listing, {
      sections: [{ name: 'Mains', items: [{ name: 'Burger', price: '$14' }] }],
    });
    expect(spec.businessName).toBe("Hawkers Bar & Grill");
    expect(spec.industryKey).toBe('restaurant');
    expect(spec.contact).toEqual({ phone: '253-555-0100', address: '123 Main St, Auburn, WA' });
    expect(spec.hours).toEqual([{ day: 'mon', open: '11:00', close: '22:00' }]);
    expect(spec.services).toEqual(['Bar', 'American']);
    expect(spec.menu?.sections[0].items[0].name).toBe('Burger');
  });

  it('omits menu/contact/hours when absent, and defaults the name', () => {
    const spec = buildSpecFromListing({ name: '' });
    expect(spec.businessName).toBe('Restaurant');
    expect(spec.menu).toBeUndefined();
    expect(spec.contact).toBeUndefined();
    expect(spec.hours).toBeUndefined();
  });
});
