/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { classifyListing, rankUnclaimed, provenanceOf, MIN_UNCLAIMED_ITEMS, isCityPortal } from '@/lib/delivered/listing';
import { stripComments } from '@/test/stripComments';

const OP = 'op-1';
const ops = new Set([OP]);
const menu = (n: number, extra: Record<string, unknown> = {}) => ({
  meta: extra,
  pages: [{ blocks: [{ type: 'menu', content: { sections: [{ name: 'Mains', items: Array.from({ length: n }, (_, i) => ({ name: `Dish ${i}`, price: '$9' })) }] } }] }],
});
const placeholder = { pages: [{ blocks: [{ type: 'menu', content: { sections: [{ name: 'Dinner', items: [{ name: 'Signature Entrée', description: 'Describe your best seller here.', price: '$19' }] }] } }] }] };
const base = { slug: 's', business_name: 'B', industry: 'restaurant', industry_label: null, hero_url: null, logo_url: null };

describe('classifyListing', () => {
  it('a published, owned site with a real menu is claimed', () => {
    expect(classifyListing({ ...base, data: menu(3), is_site: true, published: true, owner_id: 'someone' }, ops)).toBe('claimed');
  });
  it('an operator-owned listing draft with enough dishes is unclaimed', () => {
    expect(classifyListing({ ...base, data: menu(MIN_UNCLAIMED_ITEMS), claim_source: 'listing_import', owner_id: OP, published: false }, ops)).toBe('unclaimed');
    expect(classifyListing({ ...base, data: menu(9), claim_source: 'operator_draft', owner_id: null, published: false }, ops)).toBe('unclaimed');
  });
  it('a thin draft, a guest build, a stranger-owned draft, a demo and a placeholder menu are not listed', () => {
    expect(classifyListing({ ...base, data: menu(MIN_UNCLAIMED_ITEMS - 1), claim_source: 'listing_import', owner_id: OP }, ops)).toBeNull();
    expect(classifyListing({ ...base, data: menu(9), claim_source: 'guest_build', owner_id: OP }, ops)).toBeNull();
    expect(classifyListing({ ...base, data: menu(9), claim_source: 'listing_import', owner_id: 'a-real-person' }, ops)).toBeNull();
    expect(classifyListing({ ...base, data: menu(9, { is_demo: true }), is_site: true, published: true }, ops)).toBeNull();
    expect(classifyListing({ ...base, data: placeholder, claim_source: 'listing_import', owner_id: OP }, ops)).toBeNull();
    expect(classifyListing({ ...base, slug: null, data: menu(9), is_site: true, published: true }, ops)).toBeNull();
  });
  it('a post-built sale or price list is not a kitchen; a post-built dinner is', () => {
    const draft = (industry: string, post_kind: string) => ({ ...base, industry, data: menu(9, { built_from_post: true, post_kind }), claim_source: 'listing_import', owner_id: OP });
    expect(classifyListing(draft('custom_apparel', 'services'), ops)).toBeNull();
    expect(classifyListing(draft('pop_up_shop', 'goods'), ops)).toBeNull();
    expect(classifyListing(draft('other', 'event'), ops)).toBe('unclaimed');
    expect(classifyListing(draft('restaurant', 'food'), ops)).toBe('unclaimed');
    expect(classifyListing({ ...base, industry: 'lemonade_stand', data: menu(9), claim_source: 'listing_import', owner_id: OP }, ops)).toBe('unclaimed');
    expect(classifyListing({ ...base, industry: 'towing', data: menu(9), claim_source: 'listing_import', owner_id: OP }, ops)).toBeNull();
  });
  it('a city portal is never a restaurant', () => {
    const portal = { ...base, data: { pages: [{ blocks: [{ type: 'restaurants_directory', content: {} }, { type: 'menu', content: { sections: [] } }] }] }, is_site: true, published: true };
    expect(isCityPortal(portal)).toBe(true);
    expect(classifyListing(portal, ops)).toBeNull();
  });
});

describe('rankUnclaimed', () => {
  it('their own post, then their own site, then a photo-read listing; fuller menus first within a kind', () => {
    const rows = [
      { ...base, slug: 'listing-big', data: menu(40) },
      { ...base, slug: 'site', data: menu(10, { rebuilt_from: 'https://x' }) },
      { ...base, slug: 'listing-small', data: menu(8) },
      { ...base, slug: 'post', data: menu(6, { built_from_post: true }) },
    ];
    expect(rankUnclaimed(rows).map((r) => r.slug)).toEqual(['post', 'site', 'listing-big', 'listing-small']);
    expect(provenanceOf({ meta: { post_kind: 'goods' } })).toBe('post');
    expect(provenanceOf({ meta: { ordering_companion: true } })).toBe('site');
    expect(provenanceOf({ meta: {} })).toBe('listing');
  });
});

describe('the apex page', () => {
  const src = stripComments(fs.readFileSync(path.join(process.cwd(), 'app/delivered/page.tsx'), 'utf8'));
  it('does not count kitchens taking orders, and uses the lib predicate for both kinds', () => {
    expect(src).not.toMatch(/taking orders/);
    expect(src).toMatch(/classifyListing\(/);
    expect(src).toMatch(/rankUnclaimed\(/);
  });
  it('carries the spread-the-word lunch sentence by import, linked absolutely (the menu host rewrites relative paths)', () => {
    expect(src).toMatch(/FOR_SALES_PITCHES\.lunch/);
    expect(src).not.toMatch(/Know of a great lunch spot/); // imported, never retyped
    expect(src).toMatch(/https:\/\/www\.quicksites\.ai\/spread-the-word/);
    expect(src).not.toMatch(/href=["']\/spread-the-word/);
  });
  it('passes the client ShowMore only serializable props — a function prop took the apex down', () => {
    const showMore = src.slice(src.indexOf('<ShowMore'), src.indexOf('>', src.indexOf('<ShowMore')));
    expect(showMore).not.toMatch(/=>/);
    expect(showMore).toMatch(/moreLabel="/);
  });
  it('an unclaimed card never says Order online', () => {
    const unclaimedCard = src.slice(src.indexOf("kind === 'unclaimed'"), src.indexOf("kind === 'unclaimed'") + 400);
    expect(unclaimedCard).not.toMatch(/Order online/);
  });
});
