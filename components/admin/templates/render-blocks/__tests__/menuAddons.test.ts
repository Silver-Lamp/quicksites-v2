/** @jest-environment node */
//
// "I added add-ons but they don't display." Reported from real use on a lemonade stand.
//
// They were gated twice: `orderableAddons` requires an `id` (a catalog concept that only exists
// after publishing), and the render block additionally required `catalog_item_id`. On a site
// without online ordering an owner could type two add-ons, save, and see nothing — with no hint
// the field was inert. The stored row proved it: { label, price } and no id anywhere.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const menu = readFileSync(join(process.cwd(), 'components/admin/templates/render-blocks/menu.tsx'), 'utf8');
const editor = readFileSync(join(process.cwd(), 'components/admin/templates/block-editors/menu-editor.tsx'), 'utf8');

describe('add-ons a seller listed are visible', () => {
  it('renders them as text when the item is not orderable', () => {
    expect(menu).toContain('!item.catalog_item_id && staticAddons.length > 0');
  });

  it('the display list does NOT filter on id', () => {
    // An id is a catalog concept. Requiring one for something nobody can click is exactly what
    // made these invisible — the editor never assigns ids, it writes { label, price }.
    // ⚠️ Scope to the DECLARATION, not a fixed character window. A 700-char slice ran past the
    // end of this statement into `chosenAddons`, which legitimately filters on `a.id` — so the
    // test failed on neighbouring code that was never under test.
    const start = menu.indexOf('const staticAddons');
    const block = menu.slice(start, menu.indexOf('}));', start) + 4);
    expect(block).toContain('a?.label');
    expect(block).not.toMatch(/a\?\.id|a\.id/);
  });

  it('keeps the interactive selector gated on orderability', () => {
    // Static text for reading, checkboxes for ordering — the checkbox path must still require
    // a catalog item, or it would offer to add an unpriced thing to a cart.
    expect(menu).toContain('addons.length > 0 && item.catalog_item_id');
  });

  it('the editor says what an add-on will do', () => {
    // The field promised something the renderer refused to show. Copy now states both halves.
    expect(editor).toMatch(/Listed on your menu/);
    expect(editor).toMatch(/online ordering is on/);
  });
});
