/**
 * @jest-environment node
 */
// lib/parks/__tests__/applyOfficeAddressToTemplate.test.ts

import { applyOfficeAddressToData } from '@/lib/parks/applyOfficeAddressToTemplate';
import type { RegistryOfficeAddress } from '@/lib/parks/officeAddress';

const addr: RegistryOfficeAddress = {
  line1: '165 Cambridgepark Dr',
  suite: '2C',
  city: 'Cambridge',
  region: 'MA',
  postalCode: '02140',
  lat: 42.39,
  lng: -71.14,
  label: '165 Cambridgepark Dr, Suite 2C, Cambridge, MA 02140',
  source: 'registry',
  placeId: 'p1',
  parkName: 'Cambridgepark',
};

describe('applyOfficeAddressToData', () => {
  it('writes the NAP into columns + data.meta.contact + data.identity.contact', () => {
    const { data, columns } = applyOfficeAddressToData({}, addr);
    expect(columns).toMatchObject({
      address_line1: '165 Cambridgepark Dr',
      address_line2: 'Suite 2C',
      city: 'Cambridge',
      state: 'MA',
      postal_code: '02140',
      latitude: 42.39,
      longitude: -71.14,
    });
    expect(data.meta.contact.address).toBe('165 Cambridgepark Dr');
    expect(data.meta.contact.city).toBe('Cambridge');
    expect(data.identity.contact.address2).toBe('Suite 2C');
    expect(data.meta.identity.contact.state).toBe('MA');
  });

  it('preserves existing name/phone in the contact block (address-only write)', () => {
    const prev = { meta: { contact: { phone: '5551234567', email: 'a@b.com', address: 'old' } } };
    const { data } = applyOfficeAddressToData(prev, addr);
    expect(data.meta.contact.phone).toBe('5551234567');
    expect(data.meta.contact.email).toBe('a@b.com');
    expect(data.meta.contact.address).toBe('165 Cambridgepark Dr'); // overwritten
  });

  it('does not duplicate a suite when the street line already has one', () => {
    const { data, columns } = applyOfficeAddressToData(
      {},
      { ...addr, line1: '165 Cambridgepark Dr, Suite 5', suite: '2C' },
    );
    expect(columns.address_line2).toBeUndefined();
    expect(data.meta.contact.address2).toBeNull();
  });
});
