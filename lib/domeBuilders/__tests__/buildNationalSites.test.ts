/**
 * @jest-environment node
 */
import {
  buildKitMakersSite,
  buildStateChooserSite,
  orgsToEntries,
  BUYER_FACING_CATEGORIES,
} from '@/lib/domeBuilders/buildNationalSites';

const orgs = [
  {
    id: 'pacific-domes',
    name: 'Pacific Domes',
    url: 'https://pacificdomes.com/',
    regions: ['US-OR', 'US', 'worldwide'],
    categories: ['kit-maker'],
    summary: 'Fabric domes.',
    sources: [{ url: 'https://pacificdomes.com/', note: 'x' }],
  },
  {
    id: 'domerama',
    name: 'Domerama',
    url: 'https://www.domerama.com/',
    regions: ['online'],
    categories: ['open-source', 'software'],
    sources: [{ url: 'https://www.domerama.com/' }],
  },
  {
    id: 'no-source-co',
    name: 'No Source Co',
    url: 'https://x.test',
    regions: ['US'],
    categories: ['kit-maker'],
    sources: [],
  },
];
const states = [
  { state: 'Texas', domain: 'texasdomebuilders.com', count: 9 },
  { state: 'Arizona', domain: 'arizonadomebuilders.com', count: 2 },
];

describe('orgsToEntries', () => {
  it('keeps buyer-facing orgs with a source; drops software and unsourced ones', () => {
    const e = orgsToEntries(orgs);
    expect(e.map((x) => x.name)).toEqual(['Pacific Domes']);
    // Feed terms: attribution names the directory and links to THEIR listing, not the org's page.
    expect(e[0].source_label).toBe('Listing from the DomeSketch builders directory');
    expect(e[0].source_url).toBe('https://domesketch.ai/builders#pacific-domes');
    expect(e[0].website).toBe('https://pacificdomes.com/');
    expect(e[0].region).toContain('OR');
    expect(BUYER_FACING_CATEGORIES.has('software')).toBe(false);
  });
});

describe('the national pages', () => {
  const kit = buildKitMakersSite({
    domain: 'geodesicdomebuilders.com',
    orgs,
    calculatorUrl: 'https://domesketch.ai/?utm_source=x',
    states,
  });
  const chooser = buildStateChooserSite({
    domain: 'domebuildersnearme.com',
    states,
    kitMakersDomain: 'geodesicdomebuilders.com',
    calculatorUrl: 'https://domesketch.ai/?utm_source=y',
  });
  it('kit makers: hero → directory → state links → faq → contact; never a business', () => {
    const b = kit.data.pages[0].blocks;
    expect(b.map((x: any) => x.type)).toEqual([
      'hero',
      'builders_directory',
      'text',
      'faq',
      'contact_form',
    ]);
    expect(kit.slug).toBe('geodesicdomebuilders');
    const text = JSON.stringify(kit.data).toLowerCase();
    for (const p of ['welcome to', 'free quote', 'our team', 'call us'])
      expect(text).not.toContain(p);
    expect(kit.data.services).toBeUndefined();
    expect(b[2].content.html).toContain('https://texasdomebuilders.com/');
  });
  it('chooser: lists the states alphabetically and links the kit makers page', () => {
    const b = chooser.data.pages[0].blocks;
    expect(b.map((x: any) => x.type)).toEqual(['hero', 'text', 'faq', 'contact_form']);
    const html: string = b[1].content.html;
    expect(html.indexOf('Arizona')).toBeLessThan(html.indexOf('Texas'));
    expect(html).toContain('https://geodesicdomebuilders.com/');
    expect(chooser.slug).toBe('domebuildersnearme');
  });
});
