/**
 * @jest-environment node
 */
// "Our Services" on a listing-built draft: what the business NAMED itself after, then what it declared
// to Google, then — only when those are thin — the trade's standard list with a "call to confirm"
// line. Never Google's taxonomy tags.
import { readFileSync } from 'node:fs';
import {
  MIN_OWN_SERVICES,
  PROMISE_IN_SERVICE_NAME,
  applyListingServices,
  cleanListingCategories,
  countServicesBlocks,
  decideListingServices,
  ensureServicesBlock,
  industryDefaultServices,
  isGenericListingCategory,
  mergeServiceLists,
  servicesFromName,
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
  it('the Ferry Street case: four tags → the one real category', () => {
    expect(cleanListingCategories(['Car repair', 'Point of interest', 'Service', 'Establishment'])).toEqual(['Car repair']);
  });
});

describe('the name layer — the owner\'s own words', () => {
  it('"Ferry Street Towing & Roadside Assistance" names two services', () => {
    expect(servicesFromName('Ferry Street Towing & Roadside Assistance', 'auto_repair')).toEqual(['Roadside Assistance', 'Towing']);
  });
  it('reads the trade words the fleet actually uses', () => {
    expect(servicesFromName("Glover Wrecker Service", 'towing')).toEqual(['Towing & Recovery']);
    expect(servicesFromName('Arab Towing, Muffler & Auto Service', 'auto_repair')).toEqual(['Towing', 'Muffler & Exhaust', 'Auto Repair']);
    expect(servicesFromName("Medrano's Roof Cleaning", 'roof_cleaning')).toEqual(['Roof Cleaning']);
    expect(servicesFromName('Tydi Concrete Cutting & Coring', 'concrete')).toEqual(['Concrete Cutting & Coring']); // "Concrete" folds into the specific one
    expect(servicesFromName('Duvall Electric', 'electrical')).toEqual(['Electrical']);
    expect(servicesFromName('OX HVAC Contractor Seattle LLC', 'general_contractor')).toEqual(['Heating', 'General Contracting']);
  });
  it('a name with no trade word yields nothing — never a guess', () => {
    expect(servicesFromName("Joe's", 'auto_repair')).toEqual([]);
    expect(servicesFromName('Ferry Street Garage', 'auto_repair')).toEqual([]);
  });
  it('⚠️ is skipped for restaurants and people — "Glass House Bistro" repairs no glass', () => {
    expect(servicesFromName('Glass House Bistro', 'restaurant')).toEqual([]);
    expect(servicesFromName('The Tree House Cafe', 'food_cafe')).toEqual([]);
    expect(servicesFromName('Roofing Rick — Résumé', 'personal')).toEqual([]);
  });
  it('labels never carry a promise', () => {
    for (const s of servicesFromName('24/7 Licensed Towing & Roadside Assistance Guaranteed', 'towing')) {
      expect(s).not.toMatch(/24\/7|licensed|guarantee|free|insured/i);
    }
  });
});

describe('the standard list may not promise', () => {
  it('drops "Free Estimates" and the like from every industry default', () => {
    for (const key of ['concrete', 'towing', 'roofing', 'plumbing', 'electrical', 'auto_repair', 'general_contractor', 'roof_cleaning']) {
      for (const s of industryDefaultServices(key)) expect(s).not.toMatch(PROMISE_IN_SERVICE_NAME);
    }
    expect(PROMISE_IN_SERVICE_NAME.test('Free Estimates')).toBe(true);
    expect(PROMISE_IN_SERVICE_NAME.test('24/7 Towing')).toBe(true);
    expect(PROMISE_IN_SERVICE_NAME.test('Licensed & Insured')).toBe(true);
    expect(PROMISE_IN_SERVICE_NAME.test('Winch-Outs')).toBe(false);
  });
});

describe('mergeServiceLists', () => {
  it('canonicalises Google\'s wording so "Car repair" and "Auto Repair" do not both show', () => {
    expect(mergeServiceLists(['Auto Repair'], ['Car repair'])).toEqual(['Auto Repair']);
  });
  it('a raw sweep type we have no canonical word for is at least made readable', () => {
    expect(mergeServiceLists(['shipping_service', 'transportation_service'])).toEqual(['Shipping service', 'Transportation service']);
  });
  it('drops an item another item already contains, keeping the longer one', () => {
    expect(mergeServiceLists(['Towing'], ['Towing & Recovery', 'Roadside Assistance'])).toEqual(['Towing & Recovery', 'Roadside Assistance']);
  });
  it('keeps priority order otherwise', () => {
    expect(mergeServiceLists(['Roadside Assistance', 'Towing'], ['Car repair'])).toEqual(['Roadside Assistance', 'Towing', 'Auto Repair']);
  });
});

describe('decideListingServices — three layers', () => {
  it('Ferry Street: name + declared reach the bar → the owner\'s own list, no disclaimer', () => {
    const r = decideListingServices({ businessName: 'Ferry Street Towing & Roadside Assistance', categories: ['Car repair', 'Point of interest', 'Service', 'Establishment'], industryKey: 'auto_repair' });
    expect(r).toEqual({ services: ['Roadside Assistance', 'Towing', 'Auto Repair'], source: 'listing' });
    expect(r.services.length).toBeGreaterThanOrEqual(MIN_OWN_SERVICES);
  });
  it('Watertown Towing: one own word → topped up with the trade\'s standard list, stamped for the disclaimer', () => {
    const r = decideListingServices({ businessName: 'Watertown Towing', categories: ['Point of interest', 'Service', 'Establishment'], industryKey: 'towing' });
    expect(r.source).toBe('industry_default');
    expect(r.services).not.toContain('Towing'); // folded into the standard "Towing & Recovery", which contains it
    expect(r.services).toContain('Towing & Recovery');
    for (const s of industryDefaultServices('towing')) expect(r.services).toContain(s);
  });
  it('nothing named, nothing declared, no industry → empty', () => {
    expect(decideListingServices({ businessName: "Joe's", categories: [], industryKey: null })).toEqual({ services: [], source: 'industry_default' });
  });
});

function draft(services: string[], withBlock = true) {
  const block = (shape: 'content' | 'props') => ({ type: 'services', [shape]: { items: [{ name: 'Oil Change' }], title: 'Our Services' } });
  return {
    services,
    meta: { services, business_name: 'Watertown Towing' },
    pages: [
      {
        content_blocks: [{ type: 'hero', content: {} }, ...(withBlock ? [block('content')] : []), { type: 'faq', content: {} }],
        blocks: [{ type: 'hero', props: {} }, ...(withBlock ? [block('props')] : []), { type: 'order_bar', props: {} }],
      },
    ],
  } as any;
}

describe('applyListingServices', () => {
  it('writes BOTH template-level copies and the stamp; reads the name off meta when not passed', () => {
    const d = draft(['Point of interest', 'Service', 'Establishment']);
    const r = applyListingServices(d, { categories: d.services, industryKey: 'towing' });
    expect(r.source).toBe('industry_default');
    expect(d.services).toEqual(r.services);
    expect(d.meta.services).toEqual(r.services);
    expect(d.meta.services_source).toBe('industry_default');
    expect(d.meta.business_name).toBe('Watertown Towing');
    expect(r.insertedBlocks).toBe(0);
    expect(countServicesBlocks(d)).toBe(2);
  });
  it('restores a block into BOTH arrays, right after the hero, when an earlier pass removed it', () => {
    const d = draft([], false);
    const r = applyListingServices(d, { categories: [], industryKey: 'towing' });
    expect(r.insertedBlocks).toBe(2);
    expect(d.pages[0].content_blocks.map((b: any) => b.type)).toEqual(['hero', 'services', 'faq']);
    expect(d.pages[0].blocks.map((b: any) => b.type)).toEqual(['hero', 'services', 'order_bar']);
    expect(d.pages[0].content_blocks[1].content.items.map((i: any) => i.name)).toEqual(r.services);
  });
  it('ensureServicesBlock is a no-op when a block exists, and tolerates no pages', () => {
    expect(ensureServicesBlock(draft([]), ['Towing'])).toBe(0);
    expect(ensureServicesBlock({}, ['Towing'])).toBe(0);
    expect(ensureServicesBlock({ pages: [{}] }, ['Towing'])).toBe(0);
  });
});

describe('buildSpecFromListing on the sweep-built path', () => {
  it('raw sweep types never reach services or copy; the name\'s trade words lead', () => {
    const spec = buildSpecFromListing({ name: 'Ferry Street Towing & Roadside Assistance', categories: ['car_repair', 'point_of_interest', 'service', 'establishment'] }, undefined, 'auto_repair');
    expect(spec.services).toEqual(['Roadside Assistance', 'Towing', 'Auto Repair']);
    expect(spec.subheadline).not.toMatch(/point of interest|establishment|service —/i);
  });
  it('a restaurant path is unchanged: real categories pass through, name layer off', () => {
    const spec = buildSpecFromListing({ name: 'Glass House Bar & Grill', categories: ['Bar', 'American', 'point_of_interest'] });
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

describe('the trade builder applies the rule after the scaffold, with the name', () => {
  it('buildDraftFromListing calls applyListingServices with categories + industry + businessName after buildRebuildTemplate', () => {
    const src = readFileSync('lib/outreach/buildDraftFromListing.ts', 'utf8');
    const a = src.indexOf('buildRebuildTemplate({ spec');
    const b = src.indexOf('applyListingServices(tpl.data, { categories: spec.services, industryKey, businessName: spec.businessName })');
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
});
