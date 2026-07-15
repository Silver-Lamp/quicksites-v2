/**
 * @jest-environment node
 */
// lib/seo/__tests__/readinessActions.test.ts

import {
  READINESS_ACTIONS,
  readinessActionForItem,
  readinessActionByKey,
} from '@/lib/seo/readinessActions';

describe('readiness-actions registry', () => {
  it('has a unique key + itemId per action', () => {
    const keys = READINESS_ACTIONS.map((a) => a.key);
    const items = READINESS_ACTIONS.map((a) => a.itemId);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(items).size).toBe(items.length);
  });

  it('maps the nap item to the park-address action for non-food, null for food', () => {
    expect(readinessActionForItem('nap', 'plumbing')?.key).toBe('fill_office_address');
    expect(readinessActionForItem('nap', 'restaurant')).toBeNull();
  });

  it('offers schema for every industry (incl. food)', () => {
    expect(readinessActionForItem('schema', 'plumbing')?.key).toBe('fill_local_business_schema');
    expect(readinessActionForItem('schema', 'restaurant')?.key).toBe('fill_local_business_schema');
  });

  it('maps the subpage item to generate_city_page', () => {
    expect(readinessActionForItem('pages', 'plumbing')?.key).toBe('generate_city_page');
  });

  it('returns null for an item with no registered action', () => {
    expect(readinessActionForItem('hero', 'plumbing')).toBeNull();
  });

  it('resolves an action by key (and every action has an endpoint + result)', () => {
    for (const a of READINESS_ACTIONS) {
      expect(readinessActionByKey(a.key)).toBe(a);
      expect(a.endpoint.startsWith('/api/')).toBe(true);
      expect(typeof a.result).toBe('function');
    }
    expect(readinessActionByKey('nope')).toBeNull();
    expect(readinessActionByKey(null)).toBeNull();
  });

  it('result() renders the changed + no-change toasts', () => {
    const schema = readinessActionByKey('fill_local_business_schema')!;
    expect(schema.result({ changed: true, type: 'HVACBusiness' })).toEqual({ ok: true, text: expect.stringContaining('HVACBusiness') });
    expect(schema.result({ changed: false, reason: 'already' }).ok).toBe(true);
    expect(schema.result({ changed: false, reason: 'insufficient' }).ok).toBe(false);

    const park = readinessActionByKey('fill_office_address')!;
    expect(park.result({ changed: true, parkName: 'Cambridgepark' }).text).toContain('Cambridgepark');
    expect(park.result({ changed: false, reason: 'no_parks', city: 'Cambridge' }).ok).toBe(false);
  });
});
