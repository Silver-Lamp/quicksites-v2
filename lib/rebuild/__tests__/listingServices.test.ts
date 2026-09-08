/**
 * @jest-environment node
 */
// "Our Services" on a listing-built draft shows the business's own categories or nothing — never
// Google's taxonomy tags, never the scaffold's invented list.
import { readFileSync } from 'node:fs';
import { applyListingServices, cleanListingCategories, countServicesBlocks, isGenericListingCategory, stripServicesBlocks } from '../listingServices';
import { buildSpecFromListing } from '../importListing';
import { GENERIC_PLACE_TYPES } from '../../places/typeToIndustry';

describe('generic Places tags are not services', () => {
  it('recognises every spelling the pipeline has produced', () => {
    for (const s of ['point_of_interest', 'Point of interest', 'Point Of Interest', 'establishment', 'Establishment', 'service', 'Service', 'store', 'food']) {
      expect(isGenericListingCategory(s)).toBe(true);
    }
    for (const s of ['Car repair', 'Towing', 'Roofing contractor', 'Electrician', 'bar', 'mexican_restaurant']) {
      expect(isGenericListingCategory(s)).toBe(false);
    }
  });

  it('shares ONE list with the industry resolver plus `service`', () => {
    for (const t of GENERIC_PLACE_TYPES) expect(isGenericListingCategory(t)).toBe(true);
  });

  it('the Ferry Street case: four tags → the one real category, label untouched', () => {
    expect(cleanListingCategories(['Car repair', 'Point of interest', 'Service', 'Establishment'])).toEqual(['Car repair']);
  });

  it('a towing listing tagged only with plumbing → nothing', () => {
    expect(cleanListingCategories(['Point of interest', 'Service', 'Establishment'])).toEqual([]);
  });

  it('dedupes case-insensitively and keeps order', () => {
    expect(cleanListingCategories(['Roofing contractor', 'roofing_contractor', 'General contractor'])).toEqual(['Roofing contractor', 'General contractor']);
  });
});

function draft(services: string[]) {
  return {
    services,
    meta: { services, business_name: 'X' },
    pages: [
      {
        content_blocks: [{ type: 'hero', content: {} }, { type: 'services', content: { items: [{ name: 'Oil Change' }, { name: 'AC Recharge' }] } }, { type: 'faq', content: {} }],
        blocks: [{ type: 'hero', props: {} }, { type: 'services', props: { items: [{ name: 'Oil Change' }] } }, { type: 'order_bar', props: {} }],
      },
    ],
  };
}

describe('applyListingServices', () => {
  it('writes the cleaned list into BOTH template-level copies the renderer prefers', () => {
    const d = draft(['Car repair', 'Point of interest', 'Service', 'Establishment']);
    const r = applyListingServices(d, d.services);
    expect(r).toEqual({ services: ['Car repair'], removedBlocks: 0 });
    expect(d.services).toEqual(['Car repair']);
    expect(d.meta.services).toEqual(['Car repair']);
    expect(d.meta.business_name).toBe('X'); // the rest of meta survives
    expect(countServicesBlocks(d)).toBe(2); // a real category keeps the block
  });

  it('⚠️ with nothing declared, removes the services block from BOTH arrays so the scaffold\'s "AC Recharge" cannot surface', () => {
    const d = draft(['Point of interest', 'Service', 'Establishment']);
    const r = applyListingServices(d, d.services);
    expect(r).toEqual({ services: [], removedBlocks: 2 });
    expect(countServicesBlocks(d)).toBe(0);
    // Nothing else moved — and order_bar in particular (a snake_case TYPE the old slug fix nearly ate).
    expect(d.pages[0].content_blocks.map((b: any) => b.type)).toEqual(['hero', 'faq']);
    expect(d.pages[0].blocks.map((b: any) => b.type)).toEqual(['hero', 'order_bar']);
  });

  it('stripServicesBlocks tolerates a draft with no pages', () => {
    expect(stripServicesBlocks({})).toBe(0);
    expect(stripServicesBlocks({ pages: [{}] })).toBe(0);
  });
});

describe('buildSpecFromListing on the sweep-built path', () => {
  it('raw sweep types never reach services or copy', () => {
    const spec = buildSpecFromListing({ name: 'Ferry Street Towing & Roadside Assistance', categories: ['car_repair', 'point_of_interest', 'service', 'establishment'] }, undefined, 'auto_repair');
    expect(spec.services).toEqual(['Car repair']);
    expect(spec.subheadline).not.toMatch(/point of interest|establishment|service —/i);
    expect(spec.about).toMatch(/car repair/i);
  });

  it('a listing with only generic tags yields NO services and falls back to the industry label in copy', () => {
    const spec = buildSpecFromListing({ name: "Robert's Towing LLC", categories: ['point_of_interest', 'service', 'establishment'] }, undefined, 'towing');
    expect(spec.services).toEqual([]);
    expect(spec.subheadline).not.toMatch(/point of interest|establishment/i);
  });

  it('a restaurant path is unchanged: real categories pass through', () => {
    const spec = buildSpecFromListing({ name: 'Hawkers', categories: ['Bar', 'American', 'point_of_interest'] });
    expect(spec.services).toEqual(['Bar', 'American']);
  });
});

describe('the renderer never puts one item under the stock plural heading', () => {
  it('swaps a scaffold-stamped "Our Services" for "What we do" when there is a single item, and keeps a custom title', () => {
    const src = readFileSync('components/admin/templates/render-blocks/services.tsx', 'utf8');
    expect(src).toMatch(/isStockPlural = \/\^our services\$\/i\.test\(explicitHeading\)/);
    expect(src).toMatch(/singleService && isStockPlural/);
  });
});

describe('the trade builder applies the rule after the scaffold', () => {
  it('buildDraftFromListing calls applyListingServices after buildRebuildTemplate', () => {
    const src = readFileSync('lib/outreach/buildDraftFromListing.ts', 'utf8');
    const a = src.indexOf('buildRebuildTemplate({ spec');
    const b = src.indexOf('applyListingServices(tpl.data, spec.services)');
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
});
