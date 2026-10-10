/**
 * @jest-environment node
 */
// lib/outreach/__tests__/otherRestaurants.test.ts
//
// The apex directory's "more places to eat" list is decided from Google's types, never from
// our industry guess: the Vashon sweep filed three CPAs, a vet and a garden centre under
// `restaurant`, and a tax office on a restaurant directory is a wrong claim about a business.
import fs from 'node:fs';
import path from 'node:path';
import { isFoodListing, usableWebsite } from '@/lib/outreach/otherRestaurants';

import { stripComments as strip } from '@/test/stripComments';
const read = (p: string) => strip(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('isFoodListing — from the Vashon sweep rows', () => {
  it('keeps places that serve food', () => {
    expect(isFoodListing(['brunch_restaurant', 'american_restaurant', 'restaurant', 'food'])).toBe(true); // Hardware Store
    expect(isFoodListing(['coffee_shop', 'cafe', 'food_store', 'store', 'food'])).toBe(true); // Coffee Roasterie
    expect(isFoodListing(['cafe', 'food', 'point_of_interest'])).toBe(true); // Anu Rana's
    expect(isFoodListing(['pizza_restaurant', 'restaurant', 'food'])).toBe(true);
  });

  it('keeps a bar, brewery or winery only when Google also tags it food', () => {
    expect(isFoodListing(['brewery', 'bar', 'manufacturer', 'food'])).toBe(true); // Camp Colvos
    expect(isFoodListing(['bar', 'restaurant', 'food'])).toBe(true); // Dragon's Head Cider
    expect(isFoodListing(['bar', 'point_of_interest', 'establishment'])).toBe(false); // Home Sweet Home
    expect(isFoodListing(['garden_center', 'community_center', 'event_venue', 'bar', 'store'])).toBe(false); // Dig Deep Gardens
  });

  it('drops what the sweep mis-filed under restaurant', () => {
    expect(isFoodListing(['accounting', 'consultant', 'finance', 'point_of_interest'])).toBe(false); // three CPAs
    expect(isFoodListing(['veterinary_care', 'pet_care', 'point_of_interest'])).toBe(false); // Fair Isle Animal Clinic
    expect(isFoodListing([])).toBe(false);
    expect(isFoodListing(null)).toBe(false);
  });
});

describe('usableWebsite', () => {
  it('normalises to an absolute http(s) URL and rejects the sweep’s "no site" marker', () => {
    expect(usableWebsite('vashonsnapdragon.com')).toBe('https://vashonsnapdragon.com/');
    expect(usableWebsite('http://www.thsrestaurant.com/')).toBe('http://www.thsrestaurant.com/');
    expect(usableWebsite('no site')).toBeNull();
    expect(usableWebsite('')).toBeNull();
    expect(usableWebsite(null)).toBeNull();
    expect(usableWebsite('javascript:alert(1)')).toBeNull();
  });
});

describe('the directory carries the list end to end', () => {
  it('loader → public API → block, as outbound links that leave the site', () => {
    expect(read('lib/outreach/restaurantCompetitionDirectory.ts')).toMatch(/others: OtherRestaurant\[\]/);
    expect(read('app/api/public/restaurant-directory/route.ts')).toMatch(/others: dir\.others\.map/);
    const block = read('components/admin/templates/render-blocks/restaurants-directory.tsx');
    expect(block).toMatch(/More places to eat and drink/);
    expect(block).toMatch(/href=\{o\.website\} target="_blank" rel="noopener noreferrer"/);
    // Live only — never written into the block's snapshot.
    expect(block).not.toMatch(/others:\s*\[/);
    // The featured entry says WHY it is featured (honest-scaffold standard, "Rankings and listings").
    expect(block).toMatch(/Featured · first to claim, unpaid/);
  });
});
