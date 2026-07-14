/**
 * @jest-environment node
 */
// lib/parks/__tests__/parks.test.ts

import { schemeForPark, pickSuite, inferParkUses, isIndustrialPark, type SuiteScheme } from '@/lib/parks/suiteScheme';
import { areaKey, splitFormatted } from '@/lib/parks/keys';

describe('schemeForPark', () => {
  it('is deterministic per place_id', () => {
    expect(schemeForPark('ChIJabc123')).toEqual(schemeForPark('ChIJabc123'));
  });
  it('produces a valid range or building scheme', () => {
    const s = schemeForPark('ChIJsomeplace');
    if (s.type === 'range') {
      expect(s.to).toBeGreaterThan(s.from);
    } else {
      expect(s.buildings.length).toBeGreaterThan(0);
      expect(s.per).toBeGreaterThan(0);
    }
  });
});

describe('pickSuite', () => {
  it('is stable per seed and matches the scheme shape', () => {
    const range: SuiteScheme = { type: 'range', from: 100, to: 250 };
    const a = pickSuite(range, 'renton-plumbing.com');
    expect(pickSuite(range, 'renton-plumbing.com')).toBe(a); // stable
    expect(Number(a)).toBeGreaterThanOrEqual(100);
    expect(Number(a)).toBeLessThanOrEqual(250);

    const bld: SuiteScheme = { type: 'building_letter', buildings: ['A', 'B', 'C'], per: 12 };
    expect(pickSuite(bld, 'grafton-towing.com')).toMatch(/^[ABC]-\d{1,2}$/);
  });
});

describe('inferParkUses', () => {
  it('always returns at least flex', () => {
    expect(inferParkUses('Some Generic Park')).toEqual(['flex']);
  });
  it('detects warehouse / light_mfg', () => {
    expect(inferParkUses('Eastside Distribution & Warehouse Center')).toContain('warehouse');
    expect(inferParkUses('Riverside Industrial Park')).toContain('light_mfg');
  });
});

describe('isIndustrialPark', () => {
  it('keeps genuine industrial / warehouse parks', () => {
    expect(isIndustrialPark('East Valley Business Park')).toBe(true);
    expect(isIndustrialPark('United Warehouse Main')).toBe(true);
    expect(isIndustrialPark('WareSpace Renton')).toBe(true);
  });
  it('drops coworking / executive-office operators', () => {
    expect(isIndustrialPark('Regus - Renton - Triton Towers Three')).toBe(false);
    expect(isIndustrialPark('Creative Workspace')).toBe(false);
    expect(isIndustrialPark('WeWork Downtown')).toBe(false);
    expect(isIndustrialPark('Downtown Executive Suites')).toBe(false);
  });
  it('drops self-storage facilities', () => {
    expect(isIndustrialPark('The Stor-House Self Storage - Renton')).toBe(false);
    expect(isIndustrialPark('Public Storage')).toBe(false);
    expect(isIndustrialPark('CubeSmart Self Storage')).toBe(false);
  });
});

describe('areaKey', () => {
  it('normalizes case + whitespace', () => {
    expect(areaKey('  Renton ', 'WA')).toBe('renton|wa');
    expect(areaKey('Renton', null)).toBe('renton|');
  });
});

describe('splitFormatted', () => {
  it('parses a US formatted address and drops the country', () => {
    expect(splitFormatted('1420 Commerce Way, Renton, WA 98057, USA')).toEqual({
      street: '1420 Commerce Way',
      city: 'Renton',
      region: 'WA',
      postalCode: '98057',
    });
  });
  it('is null-safe', () => {
    expect(splitFormatted(null)).toEqual({ street: null, city: null, region: null, postalCode: null });
  });
});
