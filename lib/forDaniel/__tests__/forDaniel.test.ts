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
  });
});
