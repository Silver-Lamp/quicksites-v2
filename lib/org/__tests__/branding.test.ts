// lib/org/__tests__/branding.test.ts
import { buildOrgBranding } from '../branding';
import type { Org } from '../resolveOrg';

const baseOrg: Org = {
  id: 'org-1',
  slug: 'acme',
  name: 'Acme Agency',
  logo_url: 'https://cdn/acme-light.png',
  dark_logo_url: 'https://cdn/acme-dark.png',
  favicon_url: 'https://cdn/acme.ico',
  theme_json: { primary: '#0af' },
  support_email: 'help@acme.example',
  support_url: null,
  billing_mode: 'reseller',
};

describe('buildOrgBranding', () => {
  it('returns the full brand payload for a reseller org', () => {
    const b = buildOrgBranding(baseOrg);
    expect(b).not.toBeNull();
    expect(b).toMatchObject({
      branded: true,
      slug: 'acme',
      name: 'Acme Agency',
      logo_url: 'https://cdn/acme-light.png',
      logo_dark_url: 'https://cdn/acme-dark.png',
      dark_logo_url: 'https://cdn/acme-dark.png', // alias emitted for all consumers
      favicon_url: 'https://cdn/acme.ico',
      support_email: 'help@acme.example',
      billing_mode: 'reseller',
    });
    expect(b!.theme_json).toEqual({ primary: '#0af' });
  });

  it('emits logo_dark_url AND dark_logo_url so every caller resolves the dark logo', () => {
    const b = buildOrgBranding(baseOrg)!;
    expect(b.logo_dark_url).toBe(b.dark_logo_url);
  });

  it('returns null (→ 404, QuickSites fallback) for a central org', () => {
    expect(buildOrgBranding({ ...baseOrg, billing_mode: 'central' })).toBeNull();
  });

  it('returns null for a none / null billing_mode org', () => {
    expect(buildOrgBranding({ ...baseOrg, billing_mode: 'none' })).toBeNull();
    expect(buildOrgBranding({ ...baseOrg, billing_mode: null })).toBeNull();
  });

  it('is null-safe when a reseller org has no logos/theme set', () => {
    const bare: Org = { ...baseOrg, logo_url: null, dark_logo_url: null, favicon_url: null, theme_json: null, support_email: null };
    const b = buildOrgBranding(bare)!;
    expect(b.logo_url).toBeNull();
    expect(b.logo_dark_url).toBeNull();
    expect(b.theme_json).toEqual({}); // defaults to empty object, never null
    expect(b.name).toBe('Acme Agency'); // name still surfaces
  });
});
