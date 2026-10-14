/**
 * @jest-environment node
 */
// /for-daniel is the one page that tells Daniel how his reseller setup, his rep and the Italy
// deal work. It must state what is live and what is next, derive his rate from the constant that
// pays it, name no third party, and never carry the stale "unclaimed code" story.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const page = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/for-daniel/page.tsx'), 'utf8'));

describe('/for-daniel', () => {
  it('is unlisted', () => {
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
  });

  it('derives the partner share and fee cap from lib/commerce/partner-terms, never typed', () => {
    expect(page).toMatch(/from '@\/lib\/commerce\/partner-terms'/);
    expect(page).toMatch(/\{partnerPct\}%/);
    expect(page).toMatch(/\{feeCapPct\}%/);
    expect(page).not.toMatch(/\b80%|\b35%|\b10% of an order/);
  });

  it('names his org, his code and his link as they exist in the database', () => {
    expect(page).toMatch(/scaleup-software/);
    expect(page).toMatch(/\?ref=daniel/);
    expect(page).toMatch(/\/partners\/dashboard/);
  });

  // Owner, 2026-10-13: "since we have the ability to auto-pay that rep via stripe, let's make sure
  // that Daniel is aware that we can if he wants." Both ways, his call; and the one thing neither
  // of them sets today (the fee itself) is named as next, not implied.
  it('offers both ways to pay the rep, and says who cannot set the fee yet', () => {
    expect(page).toMatch(/Through you \(the default\)/);
    expect(page).toMatch(/Or we pay the rep directly/);
    expect(page).toMatch(/connects their own Stripe account/);
    expect(page).toMatch(/neither of you sets today: the per-order platform fee/);
    // The direct route's ceilings are derived from partner-terms, and the page does not claim the
    // two of them share the full partner share directly (the override clamp forbids it today).
    expect(page).toMatch(/\{repMaxPct\}%/);
    expect(page).toMatch(/\{overrideCapPct\}%/);
    expect(page).not.toMatch(/\b40%|\b20%/);
    expect(page).not.toMatch(/still share the same/);
  });

  it('says what is live and what is next, and does not call the unbuilt things live', () => {
    expect(page).toMatch(/Add a rep/);
    expect(page).toMatch(/minted by Sandon for now/);
    expect(page).toMatch(/nothing built yet/i);
    expect(page).toMatch(/zero bookings ever/);
  });

  // The shape /for-sales and /spread-the-word use: four sentences, everything else folded.
  it('is four folded pitches with boxes inside, sharing the pitch components', () => {
    expect(page).toMatch(/from '@\/components\/for-rep\/pitch'/);
    expect(page.match(/<Pitch summary=/g)?.length).toBe(4);
    expect((page.match(/<SubBox title=/g)?.length ?? 0)).toBeGreaterThanOrEqual(7);
    expect(page.match(/<\/Pitch>/g)?.length).toBe(4);
  });

  it('separates the order-fee share from the Italy subscription, and repeats no proposal price', () => {
    expect(page).toMatch(/two separate terms/i);
    expect(page).not.toMatch(/€\s?\d/);
    expect(page).not.toMatch(/70\s?\/\s?30|70%|30%/);
  });

  it('names no third party and carries none of the stale story', () => {
    expect(page).not.toMatch(/Ugo|Testa/);
    expect(page).not.toMatch(/unclaimed|before you even had an account|Paterson/);
    // Owner, 2026-10-13: the closing "Where I want your take" ask is gone.
    expect(page).not.toMatch(/Where I want your take/);
  });
});
