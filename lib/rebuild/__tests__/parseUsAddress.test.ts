/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/parseUsAddress.test.ts
//
// The formatted-address splitter that fixes "addresses not parsing into location fields" on
// auto-gen sites — the whole string used to land in one field. Also pins that buildSpecFromListing
// surfaces the structured parts on ContactSpec so assembleDraft can fill city/state/postal.

import { parseUsAddress, formatContactAddress } from '@/lib/rebuild/parseAddress';
import { buildSpecFromListing, type Listing } from '@/lib/rebuild/importListing';

describe('parseUsAddress', () => {
  it('splits a standard Google/Places US address', () => {
    expect(parseUsAddress('907 S 3rd St, Renton, WA 98057, USA')).toEqual({
      address: '907 S 3rd St',
      city: 'Renton',
      state: 'WA',
      postal: '98057',
    });
  });

  it('handles a suite in the street line and no trailing country', () => {
    expect(parseUsAddress('123 Main St Suite 200, Boston, MA 02101')).toEqual({
      address: '123 Main St Suite 200',
      city: 'Boston',
      state: 'MA',
      postal: '02101',
    });
  });

  it('keeps ZIP+4', () => {
    expect(parseUsAddress('1 Loop, Cupertino, CA 95014-2083')).toMatchObject({
      postal: '95014-2083',
      state: 'CA',
    });
  });

  it('degrades to the whole string when it cannot confidently split', () => {
    expect(parseUsAddress('London, UK')).toEqual({ address: 'London, UK' });
    expect(parseUsAddress('Just a street with no commas')).toEqual({
      address: 'Just a street with no commas',
    });
  });

  it('round-trips through formatContactAddress for map queries', () => {
    const parsed = parseUsAddress('907 S 3rd St, Renton, WA 98057, USA');
    expect(formatContactAddress(parsed)).toBe('907 S 3rd St, Renton, WA 98057');
  });
});

describe('buildSpecFromListing — structured contact', () => {
  it('surfaces city/state/postal on the contact (not a single blob)', () => {
    const listing: Listing = {
      name: 'The Local 907',
      phone: '(425) 255-2511',
      address: '907 S 3rd St, Renton, WA 98057, USA',
      categories: ['restaurant'],
    };
    const spec = buildSpecFromListing(listing);
    expect(spec.contact).toMatchObject({
      phone: '(425) 255-2511',
      address: '907 S 3rd St',
      city: 'Renton',
      state: 'WA',
      postal: '98057',
    });
  });
});
