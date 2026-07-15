/**
 * @jest-environment node
 */
// lib/geo/__tests__/cleanCityName.test.ts

import { cleanCityName } from '@/lib/geo/cleanCityName';

describe('cleanCityName', () => {
  it('leaves a plain city untouched', () => {
    expect(cleanCityName('Cambridge')).toBe('Cambridge');
    expect(cleanCityName('San Francisco')).toBe('San Francisco');
  });

  it('strips a "Serving …" service-area lead-in', () => {
    expect(cleanCityName('Serving Cambridge, MA')).toBe('Cambridge');
    expect(cleanCityName('Proudly serving the Renton area')).toBe('Renton');
    expect(cleanCityName('Now serving Grafton')).toBe('Grafton');
  });

  it('drops a trailing state/region after a comma', () => {
    expect(cleanCityName('Cambridge, MA')).toBe('Cambridge');
    expect(cleanCityName('Renton, WA 98055')).toBe('Renton');
  });

  it('drops "surrounding/metro area" tails', () => {
    expect(cleanCityName('Boston metro area')).toBe('Boston');
    expect(cleanCityName('Cambridge and surrounding areas')).toBe('Cambridge');
    expect(cleanCityName('Renton and the nearby areas')).toBe('Renton');
  });

  it('handles empty / nullish input', () => {
    expect(cleanCityName('')).toBe('');
    expect(cleanCityName(null)).toBe('');
    expect(cleanCityName(undefined)).toBe('');
  });

  it('does not mangle a city that merely contains "area"-like letters', () => {
    expect(cleanCityName('Areata')).toBe('Areata'); // not a trailing " area"
  });
});
