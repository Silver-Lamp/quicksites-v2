// lib/parks/applyOfficeAddressToTemplate.ts
//
// Merge a resolved office address (real park building + synthetic suite) into a template's
// data + canonical columns — the same NAP write the editor's Identity panel performs
// (components/admin/templates/panels/identity-panel.tsx buildDataPatch), but address-only so
// name/phone/industry are untouched. Used by the list's one-click "fill office address"
// action so it writes identically to a manual edit. Pure + deterministic.

import type { RegistryOfficeAddress } from '@/lib/parks/officeAddress';

export type OfficeAddressPatch = {
  /** The patched template `data` (contact mirrored into data.identity + meta.contact + meta.identity). */
  data: any;
  /** Canonical top-level column updates. */
  columns: Record<string, any>;
};

function obj(v: any): any {
  return v && typeof v === 'object' ? v : {};
}

export function applyOfficeAddressToData(prevData: any, addr: RegistryOfficeAddress): OfficeAddressPatch {
  const data = obj(prevData);
  const prevMeta = obj(data.meta);
  const prevContact = obj(prevMeta.contact);
  const prevIdentity = obj(data.identity);
  const prevMetaIdentity = obj(prevMeta.identity);
  const prevIdentityContact = obj(prevIdentity.contact);

  // The suite lands in Address 2 unless the street line already carries one.
  const lineHasSuite = /\b(suite|ste|unit|#|bldg)\b/i.test(addr.line1 || '');
  const address = (addr.line1 || '').trim() || null;
  const address2 = lineHasSuite
    ? (prevContact.address2 ?? null)
    : addr.suite
      ? `Suite ${addr.suite}`
      : (prevContact.address2 ?? null);

  const contactFields = {
    address,
    address2,
    city: addr.city || null,
    state: addr.region || null,
    postal: addr.postalCode || null,
    latitude: addr.lat ?? null,
    longitude: addr.lng ?? null,
  };

  const nextContact = { ...prevContact, ...contactFields };
  const nextIdentityContact = { ...prevIdentityContact, ...contactFields };
  const nextData = {
    ...data,
    identity: { ...prevIdentity, contact: nextIdentityContact },
    meta: {
      ...prevMeta,
      contact: nextContact,
      identity: { ...prevMetaIdentity, contact: nextIdentityContact },
    },
  };

  const columns: Record<string, any> = {
    address_line1: address ?? undefined,
    address_line2: address2 ?? undefined,
    city: addr.city || undefined,
    state: addr.region || undefined,
    postal_code: addr.postalCode || undefined,
    latitude: addr.lat ?? undefined,
    longitude: addr.lng ?? undefined,
  };

  return { data: nextData, columns };
}
