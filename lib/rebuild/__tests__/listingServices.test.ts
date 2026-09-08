/**
 * @jest-environment node
 */
// "Our Services" on a listing-built draft shows the business's own categories when it declared any,
// else the trade's standard list WITH a "call to confirm" line — never Google's taxonomy tags.
import { readFileSync } from 'node:fs';
import {
  applyListingServices,
  cleanListingCategories,
  countServicesBlocks,
  ensureServicesBlock,
  industryDefaultServices,
  isGenericListingCategory,
} from '../listingServices';
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

  it('a towing listing tagged only with plumbing → nothing declared', () => {
    expect(cleanListingCategories(['Point of interest', 'Service', 'Establishment'])).toEqual([]);
  });

  it('dedupes case-insensitively and keeps order', () => {
    expect(cleanListingCategories(['Roofing contractor', 'roofing_contractor', 'General contractor'])).toEqual(['Roofing contractor', 'General contractor']);
  });
});

function draft(services: string[], withBlock = true) {
  const block = (shape: 'content' | 'props') => ({ type: 'services', [shape]: { items: [{ name: 'Oil Change' }, { name: 'AC Recharge' }], title: 'Our Services' } });
  return {
    services,
    meta: { services, business_name: 'X' },
    pages: [
      {
        content_blocks: [{ type: 'hero', content: {} }, ...(withBlock ? [block('content')] : []), { type: 'faq', content: {} }],
        blocks: [{ type: 'hero', props: {} }, ...(withBlock ? [block('props')] : []), { type: 'order_bar', props: {} }],
      },
    ],
  } as any;
}

describe('applyListingServices', () => {
  it('declared categories win and are stamped `listing`, written into BOTH template-level copies', () => {
    const d = draft(['Car repair', 'Point of interest', 'Service', 'Establishment']);
    const r = applyListingServices(d, d.services, 'auto_repair');
    expect(r).toEqual({ services: ['Car repair'], source: 'listing', insertedBlocks: 0 });
    expect(d.services).toEqual(['Car repair']);
    expect(d.meta.services).toEqual(['Car repair']);
    expect(d.meta.services_source).toBe('listing');
    expect(d.meta.business_name).toBe('X'); // the rest of meta survives
  });

  it('⚠️ nothing declared → the trade\'s standard list, stamped `industry_default` so the page adds "call to confirm"', () => {
    const d = draft(['Point of interest', 'Service', 'Establishment']);
    const r = applyListingServices(d, d.services, 'towing');
    expect(r.source).toBe('industry_default');
    expect(r.services).toEqual(industryDefaultServices('towing'));
    expect(r.services.length).toBeGreaterThan(2);
    expect(r.services.some((s) => /tow/i.test(s))).toBe(true);
    expect(d.meta.services_source).toBe('industry_default');
    expect(countServicesBlocks(d)).toBe(2); // the existing blocks were kept, none added
    expect(r.insertedBlocks).toBe(0);
  });

  it('restores a block into BOTH arrays, right after the hero, when an earlier pass removed it', () => {
    const d = draft([], false);
    expect(countServicesBlocks(d)).toBe(0);
    const r = applyListingServices(d, [], 'towing');
    expect(r.insertedBlocks).toBe(2);
    expect(d.pages[0].content_blocks.map((b: any) => b.type)).toEqual(['hero', 'services', 'faq']);
    expect(d.pages[0].blocks.map((b: any) => b.type)).toEqual(['hero', 'services', 'order_bar']);
    const items = d.pages[0].content_blocks[1].content.items.map((i: any) => i.name);
    expect(items).toEqual(industryDefaultServices('towing'));
  });

  it('ensureServicesBlock is a no-op when a block exists, and tolerates no pages', () => {
    const d = draft([]);
    expect(ensureServicesBlock(d, ['Towing'])).toBe(0);
    expect(ensureServicesBlock({}, ['Towing'])).toBe(0);
    expect(ensureServicesBlock({ pages: [{}] }, ['Towing'])).toBe(0);
  });

  it('no industry and nothing declared → empty, and says so (the script skips these)', () => {
    const d = draft([]);
    const r = applyListingServices(d, [], null);
    expect(r).toEqual({ services: [], source: 'industry_default', insertedBlocks: 0 });
  });
});

describe('buildSpecFromListing on the sweep-built path', () => {
  it('raw sweep types never reach services or copy', () => {
    const spec = buildSpecFromListing({ name: 'Ferry Street Towing & Roadside Assistance', categories: ['car_repair', 'point_of_interest', 'service', 'establishment'] }, undefined, 'auto_repair');
    expect(spec.services).toEqual(['Car repair']);
    expect(spec.subheadline).not.toMatch(/point of interest|establishment|service —/i);
    expect(spec.about).toMatch(/car repair/i);
  });

  it('a listing with only generic tags yields NO declared services and falls back to the industry label in copy', () => {
    const spec = buildSpecFromListing({ name: "Robert's Towing LLC", categories: ['point_of_interest', 'service', 'establishment'] }, undefined, 'towing');
    expect(spec.services).toEqual([]);
    expect(spec.subheadline).not.toMatch(/point of interest|establishment/i);
  });

  it('a restaurant path is unchanged: real categories pass through', () => {
    const spec = buildSpecFromListing({ name: 'Hawkers', categories: ['Bar', 'American', 'point_of_interest'] });
    expect(spec.services).toEqual(['Bar', 'American']);
  });
});

describe('the renderer', () => {
  const src = readFileSync('components/admin/templates/render-blocks/services.tsx', 'utf8');
  it('never puts one item under the stock plural heading; a custom title still wins', () => {
    expect(src).toMatch(/isStockPlural = \/\^our services\$\/i\.test\(explicitHeading\)/);
    expect(src).toMatch(/singleService && isStockPlural/);
  });
  it('prints "call to confirm" under a default list, in BOTH shells, and only then', () => {
    expect(src).toMatch(/services_source === 'industry_default'/);
    expect(src).toMatch(/call to confirm/i);
    expect((src.match(/\{confirmNote\}/g) ?? []).length).toBe(2);
  });
});

describe('the trade builder applies the rule after the scaffold', () => {
  it('buildDraftFromListing calls applyListingServices with the industry after buildRebuildTemplate', () => {
    const src = readFileSync('lib/outreach/buildDraftFromListing.ts', 'utf8');
    const a = src.indexOf('buildRebuildTemplate({ spec');
    const b = src.indexOf('applyListingServices(tpl.data, spec.services, industryKey)');
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
});
