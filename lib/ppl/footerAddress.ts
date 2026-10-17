// lib/ppl/footerAddress.ts — a pitch site's footer address FOLLOWS the business that answers.
//
// Owner, 2026-10-16: an audit of the 27 tracked lines found 8 footers with a street address and 7
// of them were not where the answering business is — one (graftontowing.com) was a coffee shop's.
// None carried a source. The rule now: the forward-to's listed address when that business sits in
// the campaign's city; otherwise "Serving <city>, <ST>"; nothing invented. Stamped as automatic so
// a re-point moves it and an owner's own address is never clobbered. Pure; the sync module does I/O.
import { cleanCityName } from '@/lib/geo/cleanCityName';

export type ParsedUsAddress = { line1: string; city: string; state: string; postal: string };

/** "4944 County Rd 222, Cullman, AL 35057, USA" → parts. Null when there is no street line. */
export function parseUsAddress(raw: string | null | undefined): ParsedUsAddress | null {
  const parts = String(raw ?? '').split(',').map((p) => p.trim()).filter(Boolean).filter((p) => !/^(usa|united states)$/i.test(p));
  if (parts.length < 2) return null;
  const line1 = parts[0];
  if (!/\d/.test(line1)) return null; // "Sheffield, AL" is a town, not a street
  if (/^p\.?\s*o\.?\s*box\b/i.test(line1)) return null; // a PO box is a mailbox, not a place a footer should send anyone (vashon-handyman, 2026-10-17)
  const stateZip = parts[parts.length - 1];
  const m = /^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/i.exec(stateZip);
  const city = parts.length >= 3 ? parts[parts.length - 2] : '';
  return { line1, city, state: m ? m[1].toUpperCase() : '', postal: m?.[2] ?? '' };
}

export type FooterAddressDecision =
  | { kind: 'street'; line1: string; city: string; state: string; postal: string; lat: number | null; lng: number | null }
  | { kind: 'service_area'; label: string; city: string; state: string }
  | { kind: 'none' };

const sameCity = (a: string, b: string) => cleanCityName(a).toLowerCase() === cleanCityName(b).toLowerCase();

export function footerAddressFor(input: {
  campaignCity: string | null | undefined;
  campaignRegion: string | null | undefined;
  business: { address: string | null | undefined; city?: string | null; lat?: number | null; lng?: number | null } | null;
}): FooterAddressDecision {
  const city = cleanCityName(input.campaignCity ?? '');
  const state = String(input.campaignRegion ?? '').trim().toUpperCase().slice(0, 2);
  const parsed = input.business ? parseUsAddress(input.business.address) : null;
  const bizCity = parsed?.city || String(input.business?.city ?? '').trim();
  if (parsed && city && bizCity && sameCity(bizCity, city)) {
    return { kind: 'street', line1: parsed.line1, city: parsed.city || city, state: parsed.state || state, postal: parsed.postal, lat: input.business?.lat ?? null, lng: input.business?.lng ?? null };
  }
  if (city) return { kind: 'service_area', label: `Serving ${city}${state ? `, ${state}` : ''}`, city, state };
  return { kind: 'none' };
}

export const FOOTER_ADDRESS_SOURCE_KINDS = ['forward_to', 'service_area'] as const;
type AutoKind = (typeof FOOTER_ADDRESS_SOURCE_KINDS)[number];

/** True when the site's address is ours to move: none yet, or one this rule wrote. An owner's own stays. */
export function footerAddressIsAuto(data: any): boolean {
  const contact = data?.meta?.contact ?? {};
  const existing = String(contact.address ?? '').trim();
  if (!existing) return true;
  const kind = contact.address_source?.kind;
  return kind === 'forward_to' || kind === 'service_area';
}

export type FooterAddressPatch = { data: any; columns: Record<string, unknown>; changed: boolean; kind: FooterAddressDecision['kind'] | 'kept' };

/** Apply the decision to template data + the canonical columns, mirrored where the footer and identity readers look. */
export function applyFooterAddress(prevData: any, decision: FooterAddressDecision, opts: { forwardTo: string | null; force?: boolean; now?: string }): FooterAddressPatch {
  const data = typeof structuredClone === 'function' ? structuredClone(prevData ?? {}) : JSON.parse(JSON.stringify(prevData ?? {}));
  if (!opts.force && !footerAddressIsAuto(data)) return { data: prevData, columns: {}, changed: false, kind: 'kept' };
  if (decision.kind === 'none') return { data: prevData, columns: {}, changed: false, kind: 'none' };

  const fields =
    decision.kind === 'street'
      ? { address: decision.line1, address2: null, city: decision.city, state: decision.state, postal: decision.postal || null, latitude: decision.lat, longitude: decision.lng }
      : // The label carries the city; the footer skips its city line for a "Serving …" address.
        { address: decision.label, address2: null, city: decision.city, state: decision.state, postal: null, latitude: null, longitude: null };
  const source = { kind: (decision.kind === 'street' ? 'forward_to' : 'service_area') as AutoKind, forward_to: opts.forwardTo, at: opts.now ?? new Date().toISOString() };

  data.meta = data.meta ?? {};
  data.meta.contact = { ...(data.meta.contact ?? {}), ...fields, address_source: source };
  data.meta.identity = { ...(data.meta.identity ?? {}), contact: { ...((data.meta.identity ?? {}).contact ?? {}), ...fields } };
  data.identity = { ...(data.identity ?? {}), contact: { ...((data.identity ?? {}).contact ?? {}), ...fields } };
  // Any location/contact block that shows an address of its own follows too (the service-area
  // seed wrote there, and a block address outranks meta in some renderers).
  for (const pg of Array.isArray(data.pages) ? data.pages : []) {
    for (const key of ['blocks', 'content_blocks']) {
      for (const b of Array.isArray(pg?.[key]) ? pg[key] : []) {
        if (!b || (b.type !== 'location' && b.type !== 'contact')) continue;
        for (const c of [b.content, b.props]) {
          if (!c || typeof c !== 'object' || !String(c.address ?? '').trim()) continue;
          c.address = fields.address;
          if (b.type === 'location') c.show_map = decision.kind === 'street';
        }
      }
    }
  }
  const columns: Record<string, unknown> = { address_line1: fields.address, address_line2: null, city: fields.city, state: fields.state, postal_code: fields.postal, latitude: fields.latitude, longitude: fields.longitude };
  return { data, columns, changed: true, kind: decision.kind };
}
