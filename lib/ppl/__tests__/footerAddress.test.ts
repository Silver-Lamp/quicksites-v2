// lib/ppl/__tests__/footerAddress.test.ts — the footer address follows the answering business.
import fs from 'node:fs';
import path from 'node:path';
import { applyFooterAddress, footerAddressFor, footerAddressIsAuto, parseUsAddress } from '@/lib/ppl/footerAddress';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('parseUsAddress', () => {
  it('splits a Places address; a bare town is not a street', () => {
    expect(parseUsAddress('4944 County Rd 222, Cullman, AL 35057, USA')).toEqual({ line1: '4944 County Rd 222', city: 'Cullman', state: 'AL', postal: '35057' });
    expect(parseUsAddress('222 E Bruneau Ave # B, Kennewick, WA 99336, USA')).toMatchObject({ line1: '222 E Bruneau Ave # B', city: 'Kennewick', state: 'WA' });
    expect(parseUsAddress('Sheffield, AL')).toBeNull();
    expect(parseUsAddress('')).toBeNull();
  });
});

describe('footerAddressFor', () => {
  it('the business in the campaign city → its street address (Cullman / Trimble)', () => {
    expect(footerAddressFor({ campaignCity: 'Cullman', campaignRegion: 'AL', business: { address: '4944 County Rd 222, Cullman, AL 35057, USA', lat: 34.1, lng: -86.8 } })).toEqual({ kind: 'street', line1: '4944 County Rd 222', city: 'Cullman', state: 'AL', postal: '35057', lat: 34.1, lng: -86.8 });
  });
  it('the business in the next town → "Serving <city>, <ST>" (Richland / Ken’s in Kennewick)', () => {
    expect(footerAddressFor({ campaignCity: 'Richland', campaignRegion: 'WA', business: { address: '222 E Bruneau Ave # B, Kennewick, WA 99336, USA' } })).toEqual({ kind: 'service_area', label: 'Serving Richland, WA', city: 'Richland', state: 'WA' });
  });
  it('no business, or a town-only address → service area; no city at all → none', () => {
    expect(footerAddressFor({ campaignCity: 'Lynn', campaignRegion: 'MA', business: null }).kind).toBe('service_area');
    expect(footerAddressFor({ campaignCity: 'Florence', campaignRegion: 'AL', business: { address: 'Sheffield, AL' } })).toMatchObject({ kind: 'service_area', label: 'Serving Florence, AL' });
    expect(footerAddressFor({ campaignCity: null, campaignRegion: null, business: null })).toEqual({ kind: 'none' });
  });
  it('"Serving Renton, WA" as a campaign city is cleaned before matching', () => {
    expect(footerAddressFor({ campaignCity: 'Serving Renton, WA', campaignRegion: 'WA', business: { address: '1 Main St, Renton, WA 98057, USA' } }).kind).toBe('street');
  });
});

describe('applyFooterAddress', () => {
  const street = footerAddressFor({ campaignCity: 'Cullman', campaignRegion: 'AL', business: { address: '4944 County Rd 222, Cullman, AL 35057, USA' } });
  const area = footerAddressFor({ campaignCity: 'Richland', campaignRegion: 'WA', business: null });
  it('writes meta.contact + both identity mirrors + the columns, stamped as automatic', () => {
    const p = applyFooterAddress({ meta: { contact: { phone: '+15097745284' } } }, street, { forwardTo: '+12567474444', now: '2026-10-17T00:00:00Z' });
    expect(p.changed).toBe(true);
    expect(p.data.meta.contact).toMatchObject({ address: '4944 County Rd 222', city: 'Cullman', state: 'AL', postal: '35057', phone: '+15097745284', address_source: { kind: 'forward_to', forward_to: '+12567474444' } });
    expect(p.data.identity.contact.address).toBe('4944 County Rd 222');
    expect(p.data.meta.identity.contact.city).toBe('Cullman');
    expect(p.columns).toMatchObject({ address_line1: '4944 County Rd 222', city: 'Cullman', state: 'AL', postal_code: '35057' });
  });
  it('a service area carries the label and no postal; a location block follows and loses its map', () => {
    const data = { meta: {}, pages: [{ blocks: [{ type: 'location', content: { address: '1600 7th Ave', show_map: true } }], content_blocks: [{ type: 'location', content: { address: '1600 7th Ave', show_map: true } }] }] };
    const p = applyFooterAddress(data, area, { forwardTo: '+12622853022' });
    expect(p.data.meta.contact).toMatchObject({ address: 'Serving Richland, WA', postal: null, address_source: { kind: 'service_area' } });
    expect(p.data.pages[0].blocks[0].content).toMatchObject({ address: 'Serving Richland, WA', show_map: false });
    expect(p.data.pages[0].content_blocks[0].content.address).toBe('Serving Richland, WA');
    expect(data.pages[0].blocks[0].content.address).toBe('1600 7th Ave'); // input untouched
  });
  it('an owner’s own address is kept unless forced; an automatic one is replaced', () => {
    const owned = { meta: { contact: { address: '12 Owner Way' } } };
    expect(footerAddressIsAuto(owned)).toBe(false);
    expect(applyFooterAddress(owned, area, { forwardTo: null })).toMatchObject({ changed: false, kind: 'kept' });
    expect(applyFooterAddress(owned, area, { forwardTo: null, force: true }).changed).toBe(true);
    const auto = { meta: { contact: { address: 'Serving Lynn, MA', address_source: { kind: 'service_area' } } } };
    expect(applyFooterAddress(auto, street, { forwardTo: '+1' }).data.meta.contact.address).toBe('4944 County Rd 222');
    expect(applyFooterAddress({}, { kind: 'none' }, { forwardTo: null }).changed).toBe(false);
  });
});

describe('the wiring (source guards)', () => {
  it('set-forward and provision-number sync the footer right after the forward-to is written', () => {
    for (const p of ['app/api/admin/prospects/geo-campaign/set-forward/route.ts', 'app/api/admin/prospects/geo-campaign/provision-number/route.ts']) {
      const src = read(p);
      const wrote = src.indexOf('setCampaignForwardTo(campaignId');
      const sync = src.indexOf('syncForwardAddressToSite(campaignId)');
      expect(wrote).toBeGreaterThan(-1);
      expect(sync).toBeGreaterThan(wrote);
    }
  });
  it('the footer shows a "Serving …" label without a second city line and never geocodes it', () => {
    const src = read('components/admin/templates/render-blocks/footer.tsx');
    expect(src).toMatch(/const isServiceArea = \/\^serving\\b\/i\.test\(addressLine1\)/);
    expect(src).toMatch(/isServiceArea \? '' : cityStatePostal/);
    expect(src).toMatch(/const fullAddressForGeocode = isServiceArea\s*\?\s*null/);
  });
  it('the business lookup narrows server-side (PostgREST returns at most 1,000 rows)', () => {
    const src = read('lib/ppl/syncForwardAddress.ts');
    expect(src).toMatch(/\.or\(`phone\.ilike\.%\$\{dashed\},phone\.ilike\.%\$\{tail7\}`\)/);
  });
});
