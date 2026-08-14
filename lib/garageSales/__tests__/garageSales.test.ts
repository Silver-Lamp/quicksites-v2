/** @jest-environment node */
import { mintCode, mintCodes, normalizeCode, isPlausibleCode, formatCode } from '@/lib/garageSales/codes';
import { buildPayLinks, normalizeHandle, hasAnyHandle } from '@/lib/garageSales/payLinks';
import { publicAddress, blockLabelFor } from '@/lib/garageSales/address';

describe('sticker codes', () => {
  it('never mints a confusable character', () => {
    // The whole point of the alphabet: these get read off a curling sticker in the sun.
    const codes = mintCodes(400);
    for (const c of codes) expect(c).not.toMatch(/[O0I1LU]/);
  });

  it('mints unique, fixed-length codes', () => {
    const codes = mintCodes(500);
    expect(new Set(codes).size).toBe(500);
    for (const c of codes) expect(c).toHaveLength(6);
  });

  it('accepts what a person actually types', () => {
    const c = mintCode();
    expect(normalizeCode(` ${formatCode(c).toLowerCase()} `)).toBe(c);
    expect(isPlausibleCode(formatCode(c))).toBe(true);
  });

  it('REJECTS a confusable character rather than guessing which letter was meant', () => {
    // ⚠️ The first version substituted O→0 and I→1, which mapped input onto characters the
    // alphabet excludes — turning correctable input into permanently invalid input. Worse, a
    // successful guess would claim the WRONG sticker. There is no safe substitution: a typed
    // "O" could be a misread Q, D or C.
    expect(isPlausibleCode('QDCO24')).toBe(false);
    expect(isPlausibleCode('ABC1EF')).toBe(false);
  });
});

describe('pay links', () => {
  it('strips the decoration people paste', () => {
    expect(normalizeHandle('venmo', '@jane-doe')).toBe('jane-doe');
    expect(normalizeHandle('cashapp', '$janedoe')).toBe('janedoe');
    expect(normalizeHandle('venmo', 'https://venmo.com/jane-doe')).toBe('jane-doe');
    expect(normalizeHandle('paypal', 'https://paypal.me/jane/')).toBe('jane');
  });

  it('returns null for a display name rather than building a dead link', () => {
    // A link that 404s is discovered by a buyer at the moment of payment, standing in a driveway.
    expect(normalizeHandle('venmo', 'Jane Doe')).toBeNull();
    expect(normalizeHandle('venmo', '')).toBeNull();
    expect(normalizeHandle('venmo', null)).toBeNull();
  });

  it('carries the amount in the link for each provider', () => {
    const links = buildPayLinks({ venmo: '@jane', cashapp: '$jane', paypal: 'jane' }, 4000, 'Garage sale');
    expect(links).toHaveLength(3);
    expect(links.every((l) => l.carriesAmount)).toBe(true);
    expect(links.find((l) => l.provider === 'cashapp')!.url).toBe('https://cash.app/$jane/40.00');
    expect(links.find((l) => l.provider === 'paypal')!.url).toBe('https://paypal.me/jane/40.00');
    expect(links.find((l) => l.provider === 'venmo')!.url).toContain('amount=40.00');
  });

  it('still builds a handoff with no amount, and says the amount is not carried', () => {
    const [l] = buildPayLinks({ cashapp: 'jane' }, null);
    expect(l.url).toBe('https://cash.app/$jane');
    // The UI depends on this to know it must show the total in text beside the button.
    expect(l.carriesAmount).toBe(false);
  });

  it('knows when the seller has given us no way to be paid', () => {
    expect(hasAnyHandle({})).toBe(false);
    expect(hasAnyHandle({ venmo: 'Jane Doe' })).toBe(false);
    expect(hasAnyHandle({ venmo: '@jane' })).toBe(true);
  });
});

describe('address privacy', () => {
  const base = {
    address_line: '412 Elm St',
    city: 'Renton',
    state: 'WA',
    starts_at: '2026-08-22T15:00:00Z',
  };

  it('rounds a street address to its block', () => {
    expect(blockLabelFor('412 Elm St')).toBe('400 block of Elm St');
    expect(blockLabelFor('7 Mill Ln')).toBe('0 block of Mill Ln');
  });

  it('returns null when there is no house number to round, rather than inventing a block', () => {
    expect(blockLabelFor('The Old Mill')).toBeNull();
    expect(blockLabelFor('')).toBeNull();
  });

  it('WITHHOLDS the house number before the sale starts', () => {
    const before = new Date('2026-08-20T12:00:00Z');
    const a = publicAddress(base, before);
    expect(a.exact).toBe(false);
    expect(a.line).toBe('400 block of Elm St');
    expect(a.line).not.toContain('412');
    expect(a.revealsAt).toBe(base.starts_at);
  });

  it('reveals it once the sale has begun', () => {
    const during = new Date('2026-08-22T16:00:00Z');
    const a = publicAddress(base, during);
    expect(a.exact).toBe(true);
    expect(a.line).toBe('412 Elm St');
  });

  it('honours an explicit reveal time over the sale start', () => {
    const f = { ...base, address_public_from: '2026-08-22T13:00:00Z' };
    expect(publicAddress(f, new Date('2026-08-22T12:00:00Z')).exact).toBe(false);
    expect(publicAddress(f, new Date('2026-08-22T14:00:00Z')).exact).toBe(true);
  });

  it("shows the exact address immediately when the seller chose 'exact'", () => {
    const f = { ...base, address_precision: 'exact' };
    expect(publicAddress(f, new Date('2026-08-01T00:00:00Z')).exact).toBe(true);
  });

  it('defaults to withholding when precision is missing or unrecognised', () => {
    // Fail closed: a row written by some future code path that forgets the column must not
    // publish a house number by omission.
    expect(publicAddress({ ...base, address_precision: undefined }, new Date('2026-08-01')).exact).toBe(false);
    expect(publicAddress({ ...base, address_precision: 'whatever' as any }, new Date('2026-08-01')).exact).toBe(false);
  });

  it('never emits the precise address in the withheld case even with no block label', () => {
    const f = { address_line: 'The Old Mill', city: 'Renton', starts_at: '2026-08-22T15:00:00Z' };
    const a = publicAddress(f, new Date('2026-08-20T12:00:00Z'));
    expect(a.line).toBeNull();
    expect(a.exact).toBe(false);
  });
});
