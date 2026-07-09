import { normalizePhone, normalizeName, findDuplicateGroups, type DedupCustomer } from '@/lib/crm/dedup';

function cust(over: Partial<DedupCustomer> & { id: string }): DedupCustomer {
  return {
    email: `${over.id}@example.com`,
    name: null,
    phone: null,
    orders_count: 1,
    lifetime_cents: 1000,
    last_order_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

describe('normalizePhone', () => {
  it('collapses formatting to the national 10-digit form', () => {
    expect(normalizePhone('(415) 555-1234')).toBe('4155551234');
    expect(normalizePhone('415.555.1234')).toBe('4155551234');
  });
  it('drops a US country code', () => {
    expect(normalizePhone('+1 415 555 1234')).toBe('4155551234');
    expect(normalizePhone('14155551234')).toBe('4155551234');
  });
  it('rejects too-short numbers', () => {
    expect(normalizePhone('555-1234')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('normalizeName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeName('  Jane   Doe ')).toBe('jane doe');
  });
  it('rejects blank / single-char names', () => {
    expect(normalizeName('')).toBeNull();
    expect(normalizeName('x')).toBeNull();
  });
});

describe('findDuplicateGroups', () => {
  it('returns nothing when there are no duplicates', () => {
    const rows = [cust({ id: 'a', phone: '4155551111' }), cust({ id: 'b', phone: '4155552222' })];
    expect(findDuplicateGroups(rows)).toEqual([]);
  });

  it('groups two rows sharing a phone (different emails)', () => {
    const rows = [
      cust({ id: 'a', email: 'jane@work.com', phone: '(415) 555-1234' }),
      cust({ id: 'b', email: 'jane@home.com', phone: '415.555.1234' }),
    ];
    const groups = findDuplicateGroups(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe('phone');
    expect(groups[0].members.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('ranks the higher-order-count record as the default survivor (first member)', () => {
    const rows = [
      cust({ id: 'low', phone: '4155551234', orders_count: 1 }),
      cust({ id: 'high', phone: '4155551234', orders_count: 5 }),
    ];
    const groups = findDuplicateGroups(rows);
    expect(groups[0].members[0].id).toBe('high');
  });

  it('prefers the phone reason over name when both link a component', () => {
    const rows = [
      cust({ id: 'a', name: 'Jane Doe', phone: '4155551234' }),
      cust({ id: 'b', name: 'Jane Doe', phone: '4155551234' }),
    ];
    const groups = findDuplicateGroups(rows);
    expect(groups[0].reason).toBe('phone');
  });

  it('chains transitive matches (phone A-B, name B-C) into one component', () => {
    const rows = [
      cust({ id: 'a', name: 'Al', phone: '4155551234' }),
      cust({ id: 'b', name: 'Jane Doe', phone: '4155551234' }),
      cust({ id: 'c', name: 'Jane Doe', phone: null }),
    ];
    const groups = findDuplicateGroups(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
    expect(groups[0].reason).toBe('phone'); // strongest edge wins the label
  });

  it('does not group on a single-char / blank name collision', () => {
    const rows = [cust({ id: 'a', name: 'x' }), cust({ id: 'b', name: 'x' })];
    expect(findDuplicateGroups(rows)).toEqual([]);
  });
});
