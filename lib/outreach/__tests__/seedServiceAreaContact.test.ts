/**
 * @jest-environment node
 */
// lib/outreach/__tests__/seedServiceAreaContact.test.ts

import { seedServiceAreaContact, hasOwnAddress } from '@/lib/outreach/seedServiceAreaContact';

const area = { label: 'Serving Renton, WA & nearby', phone: '425-555-0100' };

describe('hasOwnAddress', () => {
  it('detects meta.contact.address and block addresses', () => {
    expect(hasOwnAddress({ meta: { contact: { address: '1 Main St' } } })).toBe(true);
    expect(hasOwnAddress({ pages: [{ blocks: [{ type: 'location', content: { address: '2 Oak Ave' } }] }] })).toBe(true);
    expect(hasOwnAddress({ pages: [{ blocks: [{ type: 'contact_form', content: {} }] }] })).toBe(false);
  });
});

describe('seedServiceAreaContact', () => {
  it('fills an existing location block + meta.contact, disables the map', () => {
    const data = { pages: [{ blocks: [{ type: 'hero', content: {} }, { type: 'location', content: { address: '' } }] }] };
    const { data: out, changed } = seedServiceAreaContact(data, area);
    expect(changed).toBe(true);
    const loc = out.pages[0].blocks.find((b: any) => b.type === 'location');
    expect(loc.content.address).toBe(area.label);
    expect(loc.content.phone).toBe(area.phone);
    expect(loc.content.show_map).toBe(false);
    expect(out.meta.contact.address).toBe(area.label);
    // input untouched
    expect(data.pages[0].blocks.find((b: any) => b.type === 'location')?.content.address).toBe('');
  });

  it('appends a location block when the site has no address-bearing block', () => {
    const data = { pages: [{ blocks: [{ type: 'hero', content: {} }, { type: 'services', content: { items: [] } }] }] };
    const { data: out, changed } = seedServiceAreaContact(data, area);
    expect(changed).toBe(true);
    const loc = out.pages[0].blocks.find((b: any) => b.type === 'location');
    expect(loc).toBeTruthy();
    expect(loc.content.address).toBe(area.label);
    expect(loc.content.show_map).toBe(false);
  });

  it('fills a contact_form block address when that is all there is', () => {
    const data = { pages: [{ blocks: [{ type: 'contact_form', content: {} }] }] };
    const { data: out, changed } = seedServiceAreaContact(data, area);
    expect(changed).toBe(true);
    const cf = out.pages[0].blocks.find((b: any) => b.type === 'contact_form');
    expect(cf.content.address).toBe(area.label);
  });

  it('reads/writes the canonical content_blocks field (edited-data shape)', () => {
    // Editor data uses content_blocks; a stale legacy `blocks` should be ignored.
    const data = { pages: [{ content_blocks: [{ type: 'hero', content: { headline: 'Hi' } }], blocks: [] }] };
    const { data: out, changed } = seedServiceAreaContact(data, area);
    expect(changed).toBe(true);
    const loc = out.pages[0].content_blocks.find((b: any) => b.type === 'location');
    expect(loc?.content.address).toBe(area.label);
  });

  it('does NOT overwrite a site that already has its own address', () => {
    const data = { pages: [{ blocks: [{ type: 'location', content: { address: '100 Real St, Renton WA' } }] }] };
    const { changed } = seedServiceAreaContact(data, area);
    expect(changed).toBe(false);
  });

  it('is a no-op without a label', () => {
    expect(seedServiceAreaContact({ pages: [] }, { label: '' }).changed).toBe(false);
  });
});
