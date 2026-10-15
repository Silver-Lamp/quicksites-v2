/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { isSimulationSite } from '@/lib/booking/simulation';
import { isLinkExemptDemo } from '@/lib/booking/partnerLink';
import { classifyListing } from '@/lib/delivered/listing';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('the simulation flag', () => {
  it('is meta.is_simulation === true and nothing looser', () => {
    expect(isSimulationSite({ meta: { is_simulation: true } })).toBe(true);
    expect(isSimulationSite({ meta: { is_simulation: 'true' } })).toBe(false);
    expect(isSimulationSite({ meta: { is_demo: true } })).toBe(false);
    expect(isSimulationSite(null)).toBe(false);
  });
  it('a simulation is NOT a link-exempt demo — the owner must link it like a real site', () => {
    expect(isLinkExemptDemo({ meta: { is_simulation: true, is_demo: false } })).toBe(false);
    expect(isLinkExemptDemo({ meta: { is_simulation: true } })).toBe(false);
  });
  it('a simulation never lists on the delivered.menu directory, published or not', () => {
    const menu = { meta: { is_simulation: true, noindex: true }, pages: [{ blocks: [{ type: 'menu', content: { sections: [{ name: 'Primi', items: Array.from({ length: 9 }, (_, i) => ({ name: `Piatto ${i}`, price: '€ 12' })) }] } }] }] };
    const base = { slug: 'trattoria-simulazione', business_name: 'Trattoria Simulazione', industry: 'restaurant', industry_label: null, hero_url: null, logo_url: null, data: menu };
    expect(classifyListing({ ...base, is_site: true, published: true, owner_id: 'op' }, new Set(['op']))).toBeNull();
    expect(classifyListing({ ...base, claim_source: 'operator_draft', owner_id: 'op' }, new Set(['op']))).toBeNull();
  });
});

describe('the guest booking route under simulation', () => {
  const src = read('app/api/booking/[templateId]/book/route.ts');
  it('lifts the per-IP limit only for a SIGNED call on a SIMULATION site that is LINKED', () => {
    expect(src).toMatch(/const unthrottled = partnerCheck === 'ok' && simulation && \(await isPartnerLinked\(templateId\)\)/);
    expect(src).toMatch(/if \(!unthrottled\) \{\s*const limited = await rateLimitOr429\(req, 'booking-book', 12, 3600\)/);
  });
  it('reads the raw body before the signature check, and parses after', () => {
    expect(src.indexOf('await req.text()')).toBeLessThan(src.indexOf('checkBookingPartner(req, raw)'));
    expect(src.indexOf('checkBookingPartner(req, raw)')).toBeLessThan(src.indexOf('JSON.parse(raw'));
  });
  it('sends no email for a simulation, still re-derives the slot, still writes source=web', () => {
    expect(src).toMatch(/if \(!simulation\) \{\s*after\(async \(\) => \{[^]*?notifyBooking\(/);
    expect(src).toMatch(/const slots = await availability\(site, date, party\)/);
    expect(src).toMatch(/source: 'web'/);
    expect(src).not.toMatch(/source: 'simulation'/);
  });
});
