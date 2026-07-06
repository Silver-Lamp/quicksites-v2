/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/parseMenu.test.ts
//
// parseMenu turns the model's freeform `menu` JSON into a clean, safe structure for
// the menu block — dropping empty sections/items so a half-hallucinated menu can't
// reach the site. Importing inferSiteSpec pulls in the meter chain (Supabase client
// at import), so stub it; we only exercise the pure parseMenu.

jest.mock('@/lib/ai/meter', () => ({ meterLLMCall: jest.fn() }));

import { parseMenu, parseContact, parseHours } from '@/lib/rebuild/inferSiteSpec';

describe('parseMenu', () => {
  it('parses sections + items with optional description/price', () => {
    const out = parseMenu({
      sections: [
        { name: 'Breakfast', items: [{ name: 'Pancakes', description: 'Fluffy stack', price: '$10' }] },
        { name: 'Drinks', items: [{ name: 'Coffee', price: '$3' }] },
      ],
    });
    expect(out).toEqual({
      sections: [
        { name: 'Breakfast', items: [{ name: 'Pancakes', description: 'Fluffy stack', price: '$10' }] },
        { name: 'Drinks', items: [{ name: 'Coffee', price: '$3' }] },
      ],
    });
  });

  it('drops items with no name and sections that end up empty', () => {
    const out = parseMenu({
      sections: [
        { name: 'Lunch', items: [{ name: '' }, { description: 'no name' }, { name: 'Burger' }] },
        { name: 'Empty', items: [{ name: '' }] },
        { name: '', items: [{ name: 'Orphan' }] },
      ],
    });
    expect(out).toEqual({ sections: [{ name: 'Lunch', items: [{ name: 'Burger' }] }] });
  });

  it('accepts a bare array of sections', () => {
    const out = parseMenu([{ name: 'Mains', items: [{ name: 'Steak', price: '$25' }] }]);
    expect(out?.sections[0].name).toBe('Mains');
  });

  it('returns undefined when there is no usable menu', () => {
    expect(parseMenu(undefined)).toBeUndefined();
    expect(parseMenu({})).toBeUndefined();
    expect(parseMenu({ sections: [] })).toBeUndefined();
    expect(parseMenu({ sections: [{ name: 'X', items: [] }] })).toBeUndefined();
  });
});

describe('parseContact', () => {
  it('keeps found fields and validates email', () => {
    expect(parseContact({ phone: '425-271-1817', address: '16341 Renton Rd', email: 'a@b.com' })).toEqual({
      phone: '425-271-1817',
      address: '16341 Renton Rd',
      email: 'a@b.com',
    });
  });

  it('drops an invalid email but keeps phone/address', () => {
    expect(parseContact({ phone: '555', email: 'not-an-email' })).toEqual({ phone: '555' });
  });

  it('returns undefined when nothing usable is present', () => {
    expect(parseContact(undefined)).toBeUndefined();
    expect(parseContact({})).toBeUndefined();
    expect(parseContact({ phone: '   ' })).toBeUndefined();
  });
});

describe('parseHours', () => {
  it('validates day keys + HH:MM and preserves closed days', () => {
    expect(
      parseHours([
        { day: 'mon', open: '08:00', close: '21:00' },
        { day: 'sun', closed: true },
      ]),
    ).toEqual([
      { day: 'mon', open: '08:00', close: '21:00' },
      { day: 'sun', closed: true },
    ]);
  });

  it('drops bad days, bad times, and duplicate days', () => {
    expect(
      parseHours([
        { day: 'funday', open: '08:00', close: '21:00' }, // bad day
        { day: 'tue', open: '25:00', close: '21:00' }, // bad time
        { day: 'wed', open: '08:00', close: '17:00' },
        { day: 'wed', open: '09:00', close: '18:00' }, // duplicate → dropped
      ]),
    ).toEqual([{ day: 'wed', open: '08:00', close: '17:00' }]);
  });

  it('returns undefined when not an array or nothing usable', () => {
    expect(parseHours(undefined)).toBeUndefined();
    expect(parseHours('mon 9-5' as any)).toBeUndefined();
    expect(parseHours([{ day: 'xx' }])).toBeUndefined();
  });
});
