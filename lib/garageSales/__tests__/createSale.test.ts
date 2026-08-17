/** @jest-environment node */
// Validation for the self-serve sale — the front door that did not exist until 2026-08-17.
//
// These are the mistakes a person makes in a hurry on a Thursday evening, and each one produces
// a page that looks fine and is wrong in a way the seller cannot see from the form.

import { validateSaleInput, SELF_SERVE_BATCH } from '../createSale';

const base = {
  ownerId: 'u-1',
  title: 'Moving sale — everything must go',
  city: 'Renton',
  state: 'WA',
  startsAt: '2026-09-12T09:00:00.000Z',
  endsAt: '2026-09-12T16:00:00.000Z',
};

describe('validateSaleInput', () => {
  it('accepts an ordinary Saturday sale', () => {
    expect(validateSaleInput(base)).toBeNull();
  });

  it('rejects a sale that ends before it starts', () => {
    // ⚠️ The failure mode this exists for: such a page renders as permanently OVER, and nothing
    // on the form tells the seller why. They conclude the product is broken.
    const err = validateSaleInput({ ...base, endsAt: '2026-09-12T08:00:00.000Z' });
    expect(err).toMatch(/ends before it starts/i);
  });

  it('rejects a "sale" long enough to be a permanent listing', () => {
    // A sale page expires from its own data. A three-month window is a standing advert wearing a
    // weekend's clothes, and it would sit in the directory outliving every real sale around it.
    const err = validateSaleInput({ ...base, endsAt: '2026-12-12T16:00:00.000Z' });
    expect(err).toMatch(/two weeks/i);
  });

  it('requires somewhere to go before it can be listed publicly', () => {
    // A directory shopper DRIVES to these. A listing with no city and no cross street wastes a
    // stranger's Saturday, and per the directory's own note, someone who drives to a sale that
    // is not there does not come back.
    const err = validateSaleInput({ ...base, city: '', blockLabel: '' });
    expect(err).toMatch(/cross street|city/i);
  });

  it('allows an unlisted sale with no location — the link still works', () => {
    // The self-contained value is a page you text to your own contacts. That needs no address at
    // all; only the public directory does. Refusing this would break the honest use case in
    // service of the speculative one.
    expect(validateSaleInput({ ...base, city: '', blockLabel: '', listed: false })).toBeNull();
  });

  it('requires a name and a signed-in owner', () => {
    expect(validateSaleInput({ ...base, title: '   ' })).toMatch(/name/i);
    expect(validateSaleInput({ ...base, ownerId: '' })).toMatch(/sign in/i);
  });

  it('rejects unparseable times rather than storing them', () => {
    expect(validateSaleInput({ ...base, startsAt: 'saturday morning' })).toMatch(/start/i);
    expect(validateSaleInput({ ...base, endsAt: '' })).toMatch(/end/i);
  });

  it('labels self-serve codes distinguishably from printed ones', () => {
    // `sticker_code` is a FK to garage_sale_stickers, so a self-serve sale must have a row
    // there. The batch label is what keeps "never printed" separable from "came off a sheet"
    // instead of the two being conflated in one column.
    expect(SELF_SERVE_BATCH).toBe('self-serve');
  });
});
