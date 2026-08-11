/**
 * @jest-environment node
 */
// The copyright line must not appear on a site the business has not claimed.
//
// ⚠️ "© 2026 Enjoy Teriyaki" on a page we generated from a photo of their signboard asserts that
// Enjoy Teriyaki claims ownership of something they have never seen and did not write. We wrote
// it. Putting their name on the assertion is not a courtesy — it is signing a document as them.
// Once a real owner claims the site the line is true again, because by then they took it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(process.cwd(), 'components/admin/templates/render-blocks/footer.tsx'),
  'utf8',
);

describe('footer copyright is gated on claim status', () => {
  it('computes an unclaimed-draft flag from claim_source', () => {
    expect(SRC).toMatch(/isUnclaimedDraft/);
    expect(SRC).toMatch(/listing_import/);
    expect(SRC).toMatch(/operator_draft/);
  });

  it('renders the © line only when the site is not an unclaimed draft', () => {
    // The guard must wrap the ©, not sit near it.
    const guarded = /\{!isUnclaimedDraft && \([\s\S]{0,400}©/.test(SRC);
    expect(guarded).toBe(true);
  });

  // The sibling rule this one extends: a tagline nobody supplied is a promise nobody made.
  it('still never defaults the tagline', () => {
    expect(SRC).toMatch(/tagline \? `\. \$\{tagline\}` : ''/);
  });
});
