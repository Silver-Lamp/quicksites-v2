/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/importListingYelp.test.ts
//
// Yelp uses day 0 = Monday (Google uses 0 = Sunday) — pin that mapping, and the
// business → Listing shape the photo-augmentation depends on.

import { mapYelpHours, yelpBusinessToListing } from '@/lib/rebuild/importListingYelp';

describe('mapYelpHours (0 = Monday)', () => {
  it('maps Yelp open periods to validated day/HH:MM entries', () => {
    expect(
      mapYelpHours([
        { day: 0, start: '1100', end: '2200' }, // Monday
        { day: 6, start: '1100', end: '0000' }, // Sunday
      ]),
    ).toEqual([
      { day: 'mon', open: '11:00', close: '22:00' },
      { day: 'sun', open: '11:00', close: '00:00' },
    ]);
  });

  it('drops malformed times / non-array', () => {
    expect(mapYelpHours([{ day: 1, start: 'x', end: '2200' }])).toEqual([]);
    expect(mapYelpHours(undefined)).toEqual([]);
  });
});

describe('yelpBusinessToListing', () => {
  it('maps a Yelp business payload into our Listing shape', () => {
    const listing = yelpBusinessToListing({
      name: 'Hawkers Bar & Grill',
      display_phone: '(253) 285-4838',
      location: { display_address: ['18 Auburn Way S', 'Auburn, WA 98002'] },
      categories: [{ title: 'Bars' }, { title: 'American' }],
      hours: [{ open: [{ day: 4, start: '1100', end: '0000' }] }],
      photos: ['https://yelp/1.jpg', 'https://yelp/2.jpg'],
    });
    expect(listing).toEqual({
      name: 'Hawkers Bar & Grill',
      phone: '(253) 285-4838',
      address: '18 Auburn Way S, Auburn, WA 98002',
      website: null,
      categories: ['Bars', 'American'],
      hours: [{ day: 'fri', open: '11:00', close: '00:00' }],
      photos: ['https://yelp/1.jpg', 'https://yelp/2.jpg'],
    });
  });
});
