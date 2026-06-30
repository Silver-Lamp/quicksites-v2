// lib/templates/__tests__/identity.test.ts
import {
  stripEmpty,
  obj,
  dget,
  ddel,
  toSlug,
  humanizeSlug,
  normalizeIndustryTriplet,
  enrichPatchWithIdentity,
} from '../identity';

describe('stripEmpty', () => {
  it('drops empty strings (→ undefined) but keeps other values', () => {
    expect(stripEmpty('')).toBeUndefined();
    expect(stripEmpty('x')).toBe('x');
    expect(stripEmpty(0)).toBe(0);
    expect(stripEmpty(null)).toBeNull();
  });

  it('recurses into objects and arrays, removing empty-string members', () => {
    expect(stripEmpty({ a: '', b: 'keep', c: { d: '' } })).toEqual({ b: 'keep', c: {} });
    expect(stripEmpty(['', 'x'])).toEqual([undefined, 'x']);
  });
});

describe('obj', () => {
  it('passes objects through, parses JSON strings, and falls back to {}', () => {
    const o = { a: 1 };
    expect(obj(o)).toBe(o);
    expect(obj('{"a":1}')).toEqual({ a: 1 });
    expect(obj('not json')).toEqual({});
    expect(obj(null)).toEqual({});
  });
});

describe('dget / ddel', () => {
  it('dget reads a deep path, undefined when missing', () => {
    expect(dget({ a: { b: { c: 5 } } }, ['a', 'b', 'c'])).toBe(5);
    expect(dget({ a: {} }, ['a', 'b', 'c'])).toBeUndefined();
  });

  it('ddel removes a deep key in place', () => {
    const o = { a: { b: { c: 5, d: 6 } } };
    ddel(o, ['a', 'b', 'c']);
    expect(o).toEqual({ a: { b: { d: 6 } } });
  });
});

describe('toSlug', () => {
  it('lowercases, replaces whitespace/punctuation with underscores, trims', () => {
    expect(toSlug('Window Cleaning')).toBe('window_cleaning');
    expect(toSlug('  A/B  Test! ')).toBe('a_b_test');
    expect(toSlug('already-slug')).toBe('already-slug');
  });

  it('returns null for empty / nullish', () => {
    expect(toSlug('')).toBeNull();
    expect(toSlug(null)).toBeNull();
    expect(toSlug(undefined)).toBeNull();
  });
});

describe('humanizeSlug', () => {
  it('title-cases slug words', () => {
    expect(humanizeSlug('window_cleaning')).toBe('Window Cleaning');
    expect(humanizeSlug('roof-repair')).toBe('Roof Repair');
  });
});

describe('normalizeIndustryTriplet', () => {
  it('uses an incoming key and humanizes a missing label', () => {
    expect(normalizeIndustryTriplet({ industry: 'Window Cleaning' }, {})).toEqual({
      industry: 'window_cleaning',
      industry_label: 'Window Cleaning',
      industry_other: null,
    });
  });

  it('keeps a provided label over the humanized one', () => {
    expect(normalizeIndustryTriplet({ industry: 'window_cleaning', industry_label: 'Glass Co' }, {})).toEqual({
      industry: 'window_cleaning',
      industry_label: 'Glass Co',
      industry_other: null,
    });
  });

  it('handles the "other" key, carrying industry_other through', () => {
    expect(normalizeIndustryTriplet({ industry: 'other', industry_other: 'Llama grooming' }, {})).toEqual({
      industry: 'other',
      industry_label: 'Other',
      industry_other: 'Llama grooming',
    });
  });

  it('infers "other" from a free-text industry_other when no key is given', () => {
    expect(normalizeIndustryTriplet({ industry_other: 'Llama grooming' }, {})).toEqual({
      industry: 'other',
      industry_label: 'Other',
      industry_other: 'Llama grooming',
    });
  });

  it('falls back to the previous meta when nothing is incoming', () => {
    expect(normalizeIndustryTriplet({}, { industry: 'roofing' })).toEqual({
      industry: 'roofing',
      industry_label: 'Roofing',
      industry_other: null,
    });
  });

  it('returns {} when neither incoming nor previous has an industry', () => {
    expect(normalizeIndustryTriplet({}, {})).toEqual({});
  });
});

describe('enrichPatchWithIdentity', () => {
  it('mirrors identity into meta + columns and normalizes industry', () => {
    const patch = {
      data: {
        identity: {
          template_name: 'Acme Site',
          business_name: 'Acme LLC',
          site_type: 'small_business',
          contact: { email: 'a@acme.com', phone: '555-1212', city: 'Reno' },
        },
        meta: { industry: 'Window Cleaning' },
      },
    };

    const out = enrichPatchWithIdentity(patch, {});

    // column mirrors
    expect(out.template_name).toBe('Acme Site');
    expect(out.business_name).toBe('Acme LLC');
    expect(out.contact_email).toBe('a@acme.com');
    expect(out.phone).toBe('555-1212');
    expect(out.city).toBe('Reno');
    expect(out.industry).toBe('window_cleaning');
    expect(out.industry_label).toBe('Window Cleaning');

    // meta mirrors
    expect(out.data.meta.siteTitle).toBe('Acme Site');
    expect(out.data.meta.business).toBe('Acme LLC');
    expect(out.data.meta.industry).toBe('window_cleaning');
    expect(out.data.meta.contact.email).toBe('a@acme.com');
  });

  it('does not overwrite an explicit column already set on the patch', () => {
    const patch = {
      template_name: 'Explicit Name',
      data: { identity: { template_name: 'From Identity' }, meta: {} },
    };
    const out = enrichPatchWithIdentity(patch, {});
    expect(out.template_name).toBe('Explicit Name');
  });
});
