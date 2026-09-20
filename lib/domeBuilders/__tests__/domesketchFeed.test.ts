/**
 * @jest-environment node
 */
import {
  DIRECTORY_ORDERING_NOTE,
  DOMESKETCH_ATTRIBUTION,
  calculatorUrl,
  isWeakSource,
  orgEntryFields,
  parseFeed,
  sortAlphabetically,
} from '@/lib/domeBuilders/domesketchFeed';
import { buildDirectorySite } from '@/lib/domeBuilders/buildDirectorySite';

// The feed's `terms` block, as DomeSketch published it 2026-09-20. Each rule has a test.
const TERMS = {
  ranking:
    'DomeSketch ranks by stated fit to a design, then alphabetically; there is no paid placement. A consumer that ranks these entries by any other rule must say so on its page.',
  claims:
    'Consumers may state only what a `sources[]` entry supports and must carry the source through. No entry has agreed to anything with DomeSketch beyond being listed.',
  attribution: "Show 'Listing from the DomeSketch builders directory' with a link to https://domesketch.ai/builders#<id>.",
};

describe('attribution', () => {
  it('names the directory and links to their listing by id', () => {
    const f = orgEntryFields({ id: 'ekodome', name: 'Ekodome', url: 'https://ekodome.com/', summary: 'S', sources: [{ url: 'https://ekodome.com/', note: 'read 2026-09-19' }] });
    expect(f.source_label).toBe(DOMESKETCH_ATTRIBUTION);
    expect(TERMS.attribution).toContain(`'${DOMESKETCH_ATTRIBUTION}'`);
    expect(f.source_url).toBe('https://domesketch.ai/builders#ekodome');
    expect(f.summary).toBe('S');
  });
});

describe('claims — weak sources', () => {
  it('an org whose every source is a search listing keeps name/site but loses its summary', () => {
    const weak = { id: 'aidomes', name: 'AiDomes', url: 'https://aidomes.com/', summary: 'Since 1976', sources: [{ url: 'https://aidomes.com/', note: "Diameters 15–48 ft — from the page's search listing" }] };
    expect(isWeakSource(weak)).toBe(true);
    expect(orgEntryFields(weak).summary).toBe('');
    expect(orgEntryFields(weak).website).toBe('https://aidomes.com/');
  });
  it('one first-hand source is enough', () => {
    const mixed = { id: 'x', name: 'X', summary: 'S', sources: [{ note: "from the page's search listing" }, { note: 'homepage read' }] };
    expect(isWeakSource(mixed)).toBe(false);
  });
  it('no sources at all is weak', () => {
    expect(isWeakSource({ sources: [] })).toBe(true);
  });
});

describe('ranking — alphabetical and said on the page', () => {
  it('sorts case-insensitively and stably', () => {
    expect(sortAlphabetically([{ name: 'zip' }, { name: 'Alpha' }, { name: 'beta' }]).map((e) => e.name)).toEqual(['Alpha', 'beta', 'zip']);
  });
  it('a state page lists alphabetically and its subtitle states the rule', () => {
    const site = buildDirectorySite({
      state: 'Texas',
      stateCode: 'TX',
      domain: 'texasdomebuilders.com',
      calculatorUrl: calculatorUrl('texasdomebuilders.com'),
      entries: [
        { name: 'Zeta Domes', source_label: 'Google Maps listing', source_url: 'https://maps.google.com/?cid=1' },
        { name: 'Alpha Domes', source_label: 'Google Maps listing', source_url: 'https://maps.google.com/?cid=2' },
      ],
    });
    const dir = site.data.pages[0].blocks.find((b: any) => b.type === 'builders_directory');
    expect(dir.content.entries.map((e: any) => e.name)).toEqual(['Alpha Domes', 'Zeta Domes']);
    expect(dir.content.subtitle).toContain(DIRECTORY_ORDERING_NOTE);
    expect(DIRECTORY_ORDERING_NOTE).toMatch(/alphabetically/i);
    expect(DIRECTORY_ORDERING_NOTE).toMatch(/no paid placement/i);
    expect(DIRECTORY_ORDERING_NOTE).toMatch(/not an agreement/i);
  });
});

describe('calculator link', () => {
  it("uses DomeSketch's canonical UTM convention", () => {
    expect(calculatorUrl('texasdomebuilders.com')).toBe('https://domesketch.ai/?utm_source=quicksites&utm_medium=referral&utm_campaign=texasdomebuilders.com');
  });
});

describe('parseFeed', () => {
  it('accepts the contracted shape and refuses anything else', () => {
    expect(parseFeed({ format: 'domesketch-orgs', version: 1, orgs: [{ id: 'a', name: 'A' }] }).orgs).toHaveLength(1);
    expect(() => parseFeed([{ id: 'a', name: 'A' }])).toThrow(/shape/);
    expect(() => parseFeed({ format: 'domesketch-orgs', version: 2, orgs: [] })).toThrow(/shape/);
    expect(() => parseFeed({ format: 'domesketch-orgs', version: 1, orgs: [{ name: 'no id' }] })).toThrow(/id/);
  });
});
