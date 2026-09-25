/**
 * @jest-environment node
 */
import { expectedFooterCity, googleSearchUrl, uuleFor } from '@/lib/serp/uule';
import { LOC, locationFor } from '@/lib/serp/checkSets';

describe('encoding a canonical location', () => {
  it('produces the documented shape: prefix, length char, base64 name', () => {
    const u = uuleFor('Austin,Texas,United States');
    expect(u.startsWith('w+CAIQICI')).toBe(true);
    const rest = u.slice('w+CAIQICI'.length);
    const lengthChar = rest[0];
    const decoded = Buffer.from(rest.slice(1), 'base64').toString('utf8');
    expect(decoded).toBe('Austin,Texas,United States');
    // The length char encodes the BYTE length of the name.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    expect(alphabet.indexOf(lengthChar)).toBe(Buffer.byteLength('Austin,Texas,United States'));
  });

  it('round-trips every city the checker can be sent to', () => {
    for (const canonical of Object.values(LOC)) {
      const rest = uuleFor(canonical).slice('w+CAIQICI'.length);
      expect(Buffer.from(rest.slice(1), 'base64').toString('utf8')).toBe(canonical);
    }
  });

  // ⚠️ Fail loudly rather than emit a token Google ignores. An ignored uule falls back to the
  // searcher's IP — the exact silent failure this module exists to remove, wearing a URL.
  it('refuses a name it cannot encode', () => {
    expect(() => uuleFor('x'.repeat(64))).toThrow(/too long/);
    expect(() => uuleFor('')).toThrow(/required/);
  });
});

describe('the URL a person opens', () => {
  const url = googleSearchUrl('horse barn builder austin', locationFor('Austin'));

  it('carries the query and the location together', () => {
    expect(url).toContain('q=horse+barn+builder+austin');
    expect(url).toContain(`uule=${encodeURIComponent(uuleFor('Austin,Texas,United States'))}`);
  });

  // Personalisation is what made the first hand check unreproducible: results shaped by prior
  // activity look exactly like results shaped by the market.
  it('turns personalisation off and pins country and language', () => {
    expect(url).toContain('pws=0');
    expect(url).toContain('gl=us');
    expect(url).toContain('hl=en');
  });

  it('uses the SAME location string the API check uses', () => {
    // The hand check and the API check must point at one place by construction, not by retyping.
    expect(url).toContain(encodeURIComponent(uuleFor(locationFor('Austin'))));
  });
});

describe('the receipt', () => {
  it('names what the footer should say', () => {
    expect(expectedFooterCity('Austin,Texas,United States')).toBe('Austin, Texas');
    expect(expectedFooterCity('Bonney Lake,Washington,United States')).toBe('Bonney Lake, Washington');
  });
});
