/**
 * @jest-environment node
 */
// lib/authorSites/__tests__/buildAuthorStorefront.test.ts
//
// The shared author-storefront scaffold used by both the Arlo demo seeder and the
// reseller handoff-provisioning flow. Assert the wiring both callers depend on:
// hero titled to the author/work, the grid pointed at the imported items, the
// labeling line rendered verbatim, and meta stamps (incl. merchant_id) merged.

import { buildAuthorStorefront } from '@/lib/authorSites/buildAuthorStorefront';

const flattenBlocks = (data: any): any[] =>
  (data?.pages ?? []).flatMap((p: any) => (Array.isArray(p?.blocks) ? p.blocks : []));

describe('buildAuthorStorefront', () => {
  it('titles the hero and points the products grid at the imported items', () => {
    const s = buildAuthorStorefront({
      authorName: 'Arlo V',
      workTitle: 'Broadcast',
      slug: 'arlo-v-books',
      merchantId: 'merch_1',
      itemIds: ['item_a', 'item_b'],
    });
    const blocks = flattenBlocks(s.data);
    const hero = blocks.find((b) => b?.type === 'hero');
    expect(hero?.content?.headline).toContain('Arlo V');
    expect(hero?.content?.headline).toContain('Broadcast');

    const grid = blocks.find((b) => b?.type === 'products_grid');
    expect(grid?.content?.product_ids).toEqual(['item_a', 'item_b']);
    expect(grid?.content?.productIds).toEqual(['item_a', 'item_b']);

    expect(s.data.meta.ecom.merchant_id).toBe('merch_1');
  });

  it('renders the labeling line verbatim in a story block when provided', () => {
    const LINE = 'Arlo V is a fictional author; this book is machine-assisted fiction.';
    const s = buildAuthorStorefront({
      authorName: 'Arlo V',
      workTitle: 'Broadcast',
      slug: 'arlo-v-books',
      merchantId: 'merch_1',
      itemIds: ['item_a'],
      bio: 'Arlo writes dystopias.',
      labelingLine: LINE,
    });
    const story = flattenBlocks(s.data).find((b) => b?.type === 'story');
    expect(story).toBeTruthy();
    const body = story.content.sections[0].body as string;
    expect(body).toContain('Arlo writes dystopias.');
    expect(body).toContain(LINE);
  });

  it('omits the story block and supports a pending-import shell (empty grid + stamps)', () => {
    const s = buildAuthorStorefront({
      authorName: 'Nadia K',
      workTitle: 'The Long Field',
      slug: 'nadia-k-books-abc123',
      merchantId: 'merch_2',
      itemIds: [],
      extraMeta: { hj_work_id: 'work_9', import_pending: true, author_site: true },
    });
    const blocks = flattenBlocks(s.data);
    expect(blocks.find((b) => b?.type === 'story')).toBeUndefined();
    expect(blocks.find((b) => b?.type === 'products_grid')?.content?.product_ids).toEqual([]);
    expect(s.data.meta.hj_work_id).toBe('work_9');
    expect(s.data.meta.import_pending).toBe(true);
    expect(s.data.meta.ecom.merchant_id).toBe('merch_2');
  });
});
