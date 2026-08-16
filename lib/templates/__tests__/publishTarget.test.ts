// Pins the rule that unstuck 1,376 sites. See lib/templates/publishTarget.ts for the mechanism.

import { resolvePublishTarget } from '../publishTarget';

const canonical = { id: 'canon', owner_id: 'u1', slug: 'renton-lemonade' };
const self = { id: 'self', owner_id: 'u1', slug: 'renton-lemonade-fxny' };

describe('resolvePublishTarget', () => {
  it('prefers the family canonical when one exists', () => {
    // Version semantics are untouched where the family is real: publishing a version still
    // flips the pointer on the canonical, not on the version.
    expect(resolvePublishTarget(canonical, self)?.id).toBe('canon');
  });

  it('falls back to the row itself when the family has no canonical', () => {
    // The case that broke: base_slug_of() stripped `-fxny` and stamped a standalone site as a
    // version of a canonical that never existed, so the lookup matched zero rows and 404'd.
    expect(resolvePublishTarget(null, self)?.id).toBe('self');
  });

  it('refuses a slug-less row — it has no URL to be canonical at', () => {
    expect(resolvePublishTarget(null, { id: 'x', owner_id: 'u1', slug: null })).toBeNull();
    expect(resolvePublishTarget(null, { id: 'x', owner_id: 'u1', slug: '   ' })).toBeNull();
  });

  it('refuses when there is neither a canonical nor a self row', () => {
    expect(resolvePublishTarget(null, null)).toBeNull();
    expect(resolvePublishTarget(undefined, undefined)).toBeNull();
  });

  it('returns the row itself, so ownership is checked against the row being published', () => {
    // The caller gates on target.owner_id. Returning a different row's owner would authorize
    // a publish against the wrong record.
    const other = { id: 'self', owner_id: 'u2', slug: 'a-site-abcd' };
    expect(resolvePublishTarget(null, other)?.owner_id).toBe('u2');
  });
});
