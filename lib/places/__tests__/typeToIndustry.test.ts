/**
 * @jest-environment node
 */
// lib/places/__tests__/typeToIndustry.test.ts

import { typeToIndustryKey } from '@/lib/places/typeToIndustry';

describe('typeToIndustryKey', () => {
  it('aliases common Google Places types to canonical industry keys', () => {
    expect(typeToIndustryKey(['hair_care'])).toBe('salon_spa');
    expect(typeToIndustryKey(['plumber'])).toBe('plumbing');
    expect(typeToIndustryKey(['meal_takeaway'])).toBe('restaurant');
    expect(typeToIndustryKey(['dentist'])).toBe('medical_dental');
    expect(typeToIndustryKey(['book_store'])).toBe('author');
  });

  it('ignores generic types and uses the specific one', () => {
    expect(typeToIndustryKey(['point_of_interest', 'establishment', 'car_repair'])).toBe('auto_repair');
  });

  it('falls back to the loose text resolver for titlecased category labels', () => {
    expect(typeToIndustryKey(['Roof Cleaning'])).toBe('roof_cleaning');
  });

  it('defaults to restaurant when nothing resolves (food-first pipeline default)', () => {
    expect(typeToIndustryKey([])).toBe('restaurant');
    expect(typeToIndustryKey(['point_of_interest', 'establishment'])).toBe('restaurant');
  });

  it('honours an explicit fallback', () => {
    expect(typeToIndustryKey(undefined, 'other')).toBe('other');
  });
});
