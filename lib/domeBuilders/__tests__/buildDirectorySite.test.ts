/**
 * @jest-environment node
 */
// A <state>domebuilders.com page is a DIRECTORY, not a business. Pinned: it never speaks as a
// company, never lists services of its own, carries a source on every entry it accepts, and
// makes no claim the schema cannot hold (licensed / insured / 24-7 / prices).
import { buildDirectorySite, entryIsClean, DOME_FAQ } from '@/lib/domeBuilders/buildDirectorySite';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';

const site = buildDirectorySite({
  state: 'Texas',
  stateCode: 'TX',
  domain: 'texasdomebuilders.com',
  calculatorUrl: 'https://domesketch.ai/?utm_source=texasdomebuilders.com',
  entries: [
    {
      name: 'Monolithic Constructors',
      city: 'Italy',
      region: 'TX',
      website: 'https://example.com',
      kinds: ['Monolithic'],
      source_label: 'Google Maps',
      source_url: 'https://maps.google.com/?cid=1',
    },
  ],
});

describe('buildDirectorySite', () => {
  const blocks: any[] = site.data.pages[0].blocks;
  const text = JSON.stringify(site.data).toLowerCase();

  it('is hero → directory → faq → contact, and nothing else', () => {
    expect(blocks.map((b) => b.type)).toEqual([
      'hero',
      'builders_directory',
      'faq',
      'contact_form',
    ]);
  });
  it('slug is the apex label of the domain', () => {
    expect(site.slug).toBe('texasdomebuilders');
  });
  it('never speaks as a business', () => {
    for (const p of [
      'welcome to',
      'free quote',
      'our team',
      'we serve',
      'call us',
      'our services',
    ]) {
      expect(text).not.toContain(p);
    }
    expect(site.data.services).toBeUndefined();
    const contact = blocks[3].content;
    expect(contact.phone).toBeUndefined();
    expect(contact.address).toBeUndefined();
  });
  it('the hero CTA is the calculator, and the directory carries the entries with their source', () => {
    expect(blocks[0].content.cta_link).toContain('domesketch.ai');
    expect(blocks[1].content.entries[0].source_url).toContain('maps.google.com');
    expect(blocks[1].content.listing_cta_link).toBe('#contact');
  });
  it('the FAQ makes no claim the IVR would forbid, and quotes no price', () => {
    const faq = DOME_FAQ.map((f) => `${f.question} ${f.answer}`)
      .join(' ')
      .toLowerCase();
    for (const p of FORBIDDEN_IVR_PHRASES) expect(faq).not.toContain(p.toLowerCase());
    expect(faq).not.toMatch(/\$\d/);
  });
  it('is marked as a directory in meta, for every surface that must not treat it as a claimable business', () => {
    expect(site.data.meta.directory).toBe(true);
    expect(site.data.meta.site_type).toBe('directory');
  });
});

describe('entryIsClean', () => {
  it('rejects an entry that asserts what we cannot verify', () => {
    expect(entryIsClean({ name: 'Best Licensed Domes' })).toBe(false);
    expect(entryIsClean({ name: 'Acme Domes', summary: 'Open 24/7' })).toBe(false);
    expect(entryIsClean({ name: 'Acme Domes', kinds: ['Geodesic'] })).toBe(true);
  });
});
