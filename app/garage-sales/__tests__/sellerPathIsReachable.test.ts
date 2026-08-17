// app/garage-sales/__tests__/sellerPathIsReachable.test.ts
//
// The directory must offer a route a visitor can actually take.
//
// ⚠️ THE ORIGINAL COPY WAS TRUE WHEN WRITTEN AND BECAME A DEAD END. It read "if someone handed you
// a sticker, scan it to get listed" — correct while stickers were the only path, and after
// `/yard-sale/new` shipped it meant the apex of the domain we want to rank was advertising the one
// route most visitors cannot take. Nobody arriving from a search has a sticker.
//
// It was also in the wrong PLACE: only in the empty state, so the seller path vanished as soon as a
// third sale was listed. Fixing the sentence without moving it would have fixed the instance and
// left the class.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'app/garage-sales/page.tsx'), 'utf8');

/** Source with JSX/line comments stripped — so a rule can't pass on its own explanation. */
const shipped = src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^\s*\/\/.*$/gm, '');

describe('/garage-sales offers the self-serve path', () => {
  it('links to /yard-sale/new', () => {
    expect(shipped).toContain('/yard-sale/new');
  });

  // The load-bearing part: it must be OUTSIDE the empty-state branch, so it survives having sales.
  it('offers it whether or not any sales are listed', () => {
    const emptyBranch = shipped.indexOf('sales.length === 0');
    const firstLink = shipped.indexOf('/yard-sale/new');
    expect(firstLink).toBeGreaterThan(-1);
    expect(emptyBranch).toBeGreaterThan(-1);
    expect(firstLink).toBeLessThan(emptyBranch);
  });

  it('no longer presents a sticker as the way to get listed', () => {
    // The sticker still works and is still mentioned — as an alternative, not as the requirement.
    expect(shipped).not.toMatch(/handed you a sticker, scan it to get listed/);
  });

  it('states the terms that make the offer worth taking', () => {
    expect(shipped).toMatch(/no sticker, no account, no fee/);
  });
});
