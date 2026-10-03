/**
 * @jest-environment node
 */
// components/admin/templates/__tests__/editorTemplateGlobal.test.ts
//
// Six block editors read the open template from `window.__QS_TEMPLATE__` / `__QS_TPL_REF__`.
// Nothing set those globals until 2026-10-02, so every one of them ran as if no template were
// open — the products editor's one-click "Set up my store" was unreachable for real owners, and
// only a recording of the add-product flow showed the merchant-less fallback instead.
//
// Source guards, because the defect is a missing WRITER: a unit test of any reader passes with
// the global absent, which is exactly the state that was broken.
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('the editor publishes the open template to the legacy window globals', () => {
  it('template-editor-content.tsx sets both globals, keyed to the template', () => {
    const src = read('components/admin/templates/template-editor-content.tsx');
    expect(src).toMatch(/__QS_TEMPLATE__ = template/);
    expect(src).toMatch(/__QS_TPL_REF__ = \{ current: template \}/);
  });

  it('the products grid editor takes the template from its prop before the global', () => {
    const src = read('components/admin/templates/block-editors/products-grid-editor.tsx');
    expect(src).toMatch(/String\(template\?\.id \?\? getTpl\(\)\?\.id \?\? ''\)/);
    expect(src).toMatch(/readMerchantFromData\(template\?\.data \?\? getTpl\(\)\?\.data/);
  });

  it('every reader of the global is listed here, so a new one is a conscious addition', () => {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!/node_modules|__tests__/.test(p)) walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(e.name)) continue;
        if (/__QS_TEMPLATE__|__QS_TPL_REF__/.test(fs.readFileSync(p, 'utf8'))) out.push(path.relative(process.cwd(), p));
      }
    };
    for (const d of ['components', 'app', 'lib']) if (fs.existsSync(d)) walk(d);
    expect(out.sort()).toEqual([
      'components/admin/ecommerce/product-manager-modal.tsx',
      'components/admin/templates/block-editors/comments-editor.tsx',
      'components/admin/templates/block-editors/listing-card-editor.tsx',
      'components/admin/templates/block-editors/products-grid-editor.tsx',
      'components/admin/templates/block-editors/service-offer-editor.tsx',
      'components/admin/templates/block-editors/sticky-cart-editor.tsx',
      'components/admin/templates/panels/ecommerce-panel.tsx',
      'components/admin/templates/render-blocks/comments.tsx',
      'components/admin/templates/render-blocks/deck-estimate.tsx',
      'components/admin/templates/render-blocks/job-listing.tsx',
      'components/admin/templates/render-blocks/menu.tsx',
      'components/admin/templates/render-blocks/products-grid.tsx',
      'components/admin/templates/render-blocks/quote-of-the-day.tsx',
      'components/admin/templates/template-editor-content.tsx',
      'components/cart/cart-button.tsx',
    ].sort());
  });
});
