/**
 * @jest-environment node
 */
// lib/menu/__tests__/previewOrder.test.ts — preview ordering moves no money and says so.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';
import { parsePriceCents, previewTotals, addLine, changeQty, PREVIEW_COPY } from '@/lib/menu/previewOrder';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('prices and totals', () => {
  it('reads cents, then a price string, else null — never a guess', () => {
    expect(parsePriceCents({ price_cents: 1965 })).toBe(1965);
    expect(parsePriceCents({ price: '$19.65' })).toBe(1965);
    expect(parsePriceCents({ price: '12' })).toBe(1200);
    expect(parsePriceCents({ price: 'N/A' })).toBeNull();
    expect(parsePriceCents({})).toBeNull();
  });
  it('totals priced lines and counts unpriced ones separately', () => {
    let lines = addLine([], { key: 'a', name: 'Greek', priceCents: 1965 });
    lines = addLine(lines, { key: 'a', name: 'Greek', priceCents: 1965 });
    lines = addLine(lines, { key: 'b', name: 'Cookie', priceCents: null });
    expect(previewTotals(lines)).toEqual({ count: 3, subtotalCents: 3930, unpriced: 1 });
    lines = changeQty(lines, 'a', -2);
    expect(lines.map((l) => l.key)).toEqual(['b']);
  });
});

describe('the copy never claims an order or a charge', () => {
  const text = [
    PREVIEW_COPY.fab(2, 'SUBTOTAL'),
    ...Object.values(PREVIEW_COPY).flatMap((v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : [])),
  ].join('\n');
  it('says nothing was charged and no order was sent, in words', () => {
    expect(text).toMatch(/Nothing was charged/);
    expect(text).toMatch(/no order was sent/);
  });
  it('never says "order placed" / "confirmed" / asks for a card', () => {
    expect(text).not.toMatch(/order (placed|confirmed|received)/i);
    expect(text).not.toMatch(/card number|enter your card/i);
    expect(text).not.toMatch(/\$\s?\d/);
  });
});

describe('source guards — preview ordering only where it is an exhibit, never over real ordering', () => {
  it('the menu block offers the preview button only when the item has no catalog id and the page is an exhibit', () => {
    const menu = read('components/admin/templates/render-blocks/menu.tsx');
    expect(menu).toMatch(/previewOrdering && !item\.catalog_item_id/);
    expect(menu).toMatch(/qs:preview-order:add/);
  });
  it('the public page mounts the preview drawer only in exhibit mode, and keeps demand capture OFF there', () => {
    const page = read('app/sites/[slug]/[[...rest]]/page.tsx');
    expect(page).toMatch(/exhibit && <PreviewOrderDrawer/);
    expect(page).toMatch(/demandEnabled && !exhibit/);
    expect(page).toMatch(/menu: \{ previewOrdering: true \}/);
  });
  it('the drawer never posts anywhere', () => {
    const drawer = read('components/sites/preview-order-drawer.tsx');
    expect(drawer).not.toMatch(/fetch\(/);
    expect(drawer).not.toMatch(/sendBeacon/);
    expect(drawer).toMatch(/PREVIEW_COPY\.doneBody/);
  });
});
