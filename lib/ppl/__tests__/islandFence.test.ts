// lib/ppl/__tests__/islandFence.test.ts — an island campaign is pointed only at the island.
import fs from 'node:fs';
import path from 'node:path';
import { islandTownsFor, prospectOnIsland, cityListFor, ISLAND_GROUPS } from '@/lib/ppl/islandFence';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('the fence', () => {
  it('maps an island campaign city to the towns its prospects carry, and says nothing for the mainland', () => {
    expect(islandTownsFor('Whidbey Island')).toEqual(['Oak Harbor', 'Coupeville', 'Greenbank', 'Freeland', 'Langley', 'Clinton']);
    expect(islandTownsFor('vashon')).toEqual(['Vashon']);
    expect(islandTownsFor('Bainbridge Island')).toEqual(['Bainbridge Island']);
    expect(islandTownsFor('Renton')).toBeNull();
    expect(islandTownsFor(null)).toBeNull();
  });
  it('keeps Clinton for a Whidbey campaign and drops Mukilteo; is neutral on the mainland', () => {
    expect(prospectOnIsland('Whidbey Island', 'Clinton')).toBe(true);
    expect(prospectOnIsland('Whidbey Island', 'Mukilteo')).toBe(false);
    expect(prospectOnIsland('Vashon', 'Renton')).toBe(false); // the vashon-handyman recommender lesson
    expect(prospectOnIsland('Renton', 'Maple Valley')).toBeNull(); // distance decides on the mainland
  });
  it('a lookup list is the island\'s towns, else the city itself', () => {
    expect(cityListFor('Whidbey Island')).toHaveLength(6);
    expect(cityListFor('Oak Harbor')).toEqual(['Oak Harbor']);
    expect(cityListFor('Richland')).toEqual(['Richland']);
    expect(cityListFor(null)).toEqual([]);
    for (const towns of Object.values(ISLAND_GROUPS)) expect(towns.length).toBeGreaterThan(0);
  });
});

describe('source guards — both consumers keep to the island', () => {
  it('the forward-to recommender filters candidates through the fence before ranking', () => {
    const src = read('lib/ppl/forwardSuggestions.ts');
    expect(src).toMatch(/prospectOnIsland\(c\.city, p\.city\) !== false/);
  });
  it('the pitch\'s next-business lookup uses the island town list, never a bare city equality', () => {
    const src = read('lib/ppl/pitchSend.ts');
    expect(src).toMatch(/\.in\('city', cityListFor\(c\.city\)\)/);
    expect(src).not.toMatch(/\.eq\('city', c\.city\)/);
  });
});
