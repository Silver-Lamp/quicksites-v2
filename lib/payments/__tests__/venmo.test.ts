import { normalizeVenmoHandle, venmoProfileUrl, readVenmoHandle, writeVenmoHandle } from '../venmo';

describe('normalizeVenmoHandle', () => {
  it('accepts the forms people actually paste', () => {
    for (const input of [
      'lemonade-stand',
      '@lemonade-stand',
      'venmo.com/u/lemonade-stand',
      'www.venmo.com/u/lemonade-stand',
      'https://venmo.com/u/lemonade-stand',
      'https://venmo.com/lemonade-stand',
      '  @lemonade-stand  ',
      'https://venmo.com/u/lemonade-stand?txn=pay',
    ]) {
      expect(normalizeVenmoHandle(input)).toBe('lemonade-stand');
    }
  });

  it('rejects rather than repairs — this string addresses someone money', () => {
    // A "cleaned up" handle that happens to be valid sends a stranger the payment, so
    // anything that isn't already a handle comes back null and the UI stays silent.
    expect(normalizeVenmoHandle('abc')).toBeNull();               // too short
    expect(normalizeVenmoHandle('a'.repeat(31))).toBeNull();      // too long
    expect(normalizeVenmoHandle('has spaces')).toBeNull();
    expect(normalizeVenmoHandle('bad!chars')).toBeNull();
    expect(normalizeVenmoHandle('user@example.com')).toBeNull();
    expect(normalizeVenmoHandle('')).toBeNull();
    expect(normalizeVenmoHandle(null)).toBeNull();
    expect(normalizeVenmoHandle(undefined)).toBeNull();
  });

  it('does not treat a paypal or cashapp URL as a venmo handle', () => {
    expect(normalizeVenmoHandle('https://paypal.me/someone')).toBeNull();
    expect(normalizeVenmoHandle('https://cash.app/$someone')).toBeNull();
  });
});

describe('venmoProfileUrl', () => {
  it('builds the profile link', () => {
    expect(venmoProfileUrl('@lemonade-stand')).toBe('https://venmo.com/u/lemonade-stand');
  });

  it('is null for anything invalid, so no dead link renders', () => {
    expect(venmoProfileUrl('nope!')).toBeNull();
    expect(venmoProfileUrl(null)).toBeNull();
  });

  it('encodes no amount — see the note in venmo.ts', () => {
    // Venmo's web profile link does not reliably carry an amount, and a link that silently
    // drops one is worse than a link that never promised it.
    expect(venmoProfileUrl('lemonade-stand')).not.toMatch(/amount|txn=/);
  });
});

describe('read/write on template data', () => {
  it('round-trips through meta.payments.venmo', () => {
    const next = writeVenmoHandle({ meta: { siteTitle: 'Renton Lemonade' } }, '@lemonade-stand');
    expect(next.meta.payments.venmo).toBe('lemonade-stand');
    expect(readVenmoHandle(next)).toBe('lemonade-stand');
    expect(next.meta.siteTitle).toBe('Renton Lemonade'); // untouched
  });

  it('reads the legacy venmo_handle key too', () => {
    expect(readVenmoHandle({ meta: { payments: { venmo_handle: '@lemonade-stand' } } })).toBe('lemonade-stand');
  });

  it('clears on empty, so removing the handle removes the section', () => {
    const set = writeVenmoHandle({}, 'lemonade-stand');
    const cleared = writeVenmoHandle(set, '');
    expect(cleared.meta.payments.venmo).toBeUndefined();
    expect(readVenmoHandle(cleared)).toBeNull();
  });

  it('stores nothing for an invalid handle rather than a broken one', () => {
    const next = writeVenmoHandle({}, 'nope!');
    expect(readVenmoHandle(next)).toBeNull();
  });

  it('returns null for data with no payments at all', () => {
    expect(readVenmoHandle({})).toBeNull();
    expect(readVenmoHandle(null)).toBeNull();
  });
});
