// lib/__tests__/emailBrand.test.ts
import { buildEmailBrand, extractEmailAddress } from '../email';

describe('extractEmailAddress', () => {
  it('pulls the address out of a "Name <addr>" string', () => {
    expect(extractEmailAddress('Acme Agency <hello@acme.io>', 'x@y.z')).toBe('hello@acme.io');
  });
  it('passes through a bare address', () => {
    expect(extractEmailAddress('hello@acme.io', 'x@y.z')).toBe('hello@acme.io');
  });
  it('falls back when the input has no address', () => {
    expect(extractEmailAddress('Acme Agency', 'fallback@qs.ai')).toBe('fallback@qs.ai');
    expect(extractEmailAddress('', 'fallback@qs.ai')).toBe('fallback@qs.ai');
    expect(extractEmailAddress(null, 'fallback@qs.ai')).toBe('fallback@qs.ai');
  });
});

describe('buildEmailBrand', () => {
  it('uses the org brand for a reseller org', () => {
    const b = buildEmailBrand({
      orgName: 'Acme Agency',
      branded: true,
      logoUrl: 'https://cdn/acme.png',
      supportEmail: 'help@acme.io',
    });
    expect(b.name).toBe('Acme Agency');
    expect(b.from).toBe('Acme Agency <noreply@quicksites.ai>'); // platform address, org display name
    expect(b.footer).toBe('— The Acme Agency Team');
    expect(b.supportEmail).toBe('help@acme.io');
    expect(b.logoUrl).toBe('https://cdn/acme.png');
    expect(b.branded).toBe(true);
  });

  it('stays QuickSites for a non-reseller org (branded=false)', () => {
    const b = buildEmailBrand({ orgName: 'Some Central Org', branded: false, logoUrl: 'https://cdn/x.png' });
    expect(b.name).toBe('QuickSites');
    expect(b.from).toBe('QuickSites <noreply@quicksites.ai>');
    expect(b.footer).toBe('— The QuickSites Team');
    expect(b.logoUrl).toBeNull(); // don't leak a logo for a non-branded org
    expect(b.supportEmail).toBe('support@quicksites.ai');
  });

  it('falls back to QuickSites when a reseller org has no name', () => {
    const b = buildEmailBrand({ orgName: null, branded: true });
    expect(b.name).toBe('QuickSites');
  });

  it('keeps the sending address from EMAIL_FROM but overrides the display name', () => {
    const b = buildEmailBrand({ orgName: 'Acme', branded: true, envFrom: 'QuickSites <mail@send.quicksites.ai>' });
    expect(b.from).toBe('Acme <mail@send.quicksites.ai>');
    expect(b.fromAddress).toBe('mail@send.quicksites.ai');
  });

  it('honors a custom default address', () => {
    const b = buildEmailBrand({ orgName: 'Acme', branded: true, defaultAddress: 'no-reply@platform.dev' });
    expect(b.fromAddress).toBe('no-reply@platform.dev');
  });
});
