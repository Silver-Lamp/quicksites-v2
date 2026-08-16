import { mergeTemplateMeta } from '../mergeMeta';

describe('mergeTemplateMeta', () => {
  it('keeps a stored key the incoming save never heard of', () => {
    // The exact loss: a server-side write stamped meta.ecom, then the editor saved a `meta`
    // captured before that, and the merchant link vanished from a site that still showed
    // "Add to order" buttons.
    const stored = { siteTitle: 'Renton Lemonade', ecom: { merchant_id: 'm-1' } };
    const incoming = { siteTitle: 'Renton Lemonade' };

    expect(mergeTemplateMeta(stored, incoming)).toEqual({
      siteTitle: 'Renton Lemonade',
      ecom: { merchant_id: 'm-1' },
    });
  });

  it('lets the incoming save change what it actually carries', () => {
    const out = mergeTemplateMeta({ siteTitle: 'Old', ecom: { merchant_id: 'm-1' } }, { siteTitle: 'New' });
    expect(out.siteTitle).toBe('New');
    expect(out.ecom).toEqual({ merchant_id: 'm-1' });
  });

  it('replaces a nested object wholesale rather than deep-merging it', () => {
    // A panel that owns meta.ecom writes it as a unit; deep-merging would resurrect keys the
    // owner just removed from inside it.
    const out = mergeTemplateMeta({ ecom: { merchant_id: 'm-1', stale: true } }, { ecom: { merchant_id: 'm-2' } });
    expect(out.ecom).toEqual({ merchant_id: 'm-2' });
  });

  it('deletes only on an explicit null', () => {
    const out = mergeTemplateMeta({ siteTitle: 'x', payments: { venmo: 'lemonade-stand' } }, { payments: null });
    expect('payments' in out).toBe(false);
    expect(out.siteTitle).toBe('x');
  });

  it('does not blank meta when a save carries none', () => {
    const stored = { siteTitle: 'Renton Lemonade' };
    expect(mergeTemplateMeta(stored, undefined)).toEqual(stored);
    expect(mergeTemplateMeta(stored, null)).toEqual(stored);
  });

  it('accepts the incoming object when nothing is stored yet', () => {
    expect(mergeTemplateMeta(undefined, { payments: { venmo: 'lemonade-stand' } }))
      .toEqual({ payments: { venmo: 'lemonade-stand' } });
    expect(mergeTemplateMeta(null, { a: 1 })).toEqual({ a: 1 });
  });

  it('keeps real meta when the incoming one is malformed', () => {
    // An array is not a meta object. Letting it through would destroy the stored keys, which is
    // the exact failure this function exists to prevent — so a malformed write is ignored
    // rather than honoured. (Nothing legitimate sends this; a broken client would.)
    expect(mergeTemplateMeta({ a: 1 }, ['x'])).toEqual({ a: 1 });
    expect(mergeTemplateMeta({ a: 1 }, 'nonsense')).toEqual({ a: 1 });

    // With nothing stored there is nothing to protect, so the value passes through untouched
    // and the schema layer above can reject it.
    expect(mergeTemplateMeta(['x'], { a: 1 })).toEqual({ a: 1 });
  });

  it('does not mutate the stored object', () => {
    const stored = { siteTitle: 'x', ecom: { merchant_id: 'm-1' } };
    mergeTemplateMeta(stored, { siteTitle: 'y', ecom: null });
    expect(stored).toEqual({ siteTitle: 'x', ecom: { merchant_id: 'm-1' } });
  });
});
