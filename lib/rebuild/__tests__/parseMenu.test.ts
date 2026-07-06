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

import { parseMenu } from '@/lib/rebuild/inferSiteSpec';

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
