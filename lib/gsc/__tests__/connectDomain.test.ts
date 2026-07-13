/**
 * @jest-environment node
 */
// lib/gsc/__tests__/connectDomain.test.ts

import { bareDomain, scDomainSiteUrl, gscAutoConnectEnabled } from '@/lib/gsc/connectDomain';

describe('bareDomain', () => {
  it('strips scheme, www, sc-domain:, path, and trailing punctuation', () => {
    expect(bareDomain('https://www.gallatin-towing.com/')).toBe('gallatin-towing.com');
    expect(bareDomain('sc-domain:gallatin-towing.com')).toBe('gallatin-towing.com');
    expect(bareDomain('GALLATIN-TOWING.COM.')).toBe('gallatin-towing.com');
  });
});

describe('scDomainSiteUrl', () => {
  it('produces the Search Console domain-property id', () => {
    expect(scDomainSiteUrl('gallatin-towing.com')).toBe('sc-domain:gallatin-towing.com');
    expect(scDomainSiteUrl('https://www.renton-plumbing.com/')).toBe('sc-domain:renton-plumbing.com');
  });
});

describe('gscAutoConnectEnabled', () => {
  it('is off without the flag', () => {
    const prev = { ...process.env };
    delete process.env.GSC_AUTO_CONNECT_ENABLED;
    expect(gscAutoConnectEnabled()).toBe(false);
    process.env = prev;
  });

  it('needs both the flag AND client credentials', () => {
    const prev = { ...process.env };
    process.env.GSC_AUTO_CONNECT_ENABLED = '1';
    process.env.GOOGLE_CLIENT_ID = '';
    process.env.GSC_CLIENT_ID = '';
    process.env.GOOGLE_CLIENT_SECRET = '';
    process.env.GSC_CLIENT_SECRET = '';
    expect(gscAutoConnectEnabled()).toBe(false); // flag on but not configured
    process.env.GSC_CLIENT_ID = 'x';
    process.env.GSC_CLIENT_SECRET = 'y';
    expect(gscAutoConnectEnabled()).toBe(true);
    process.env = prev;
  });
});
