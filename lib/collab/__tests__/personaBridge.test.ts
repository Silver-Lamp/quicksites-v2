/**
 * @jest-environment node
 */
// The bridge decides whether a persona finding is about a CLIENT'S OPTION SITE or about our own
// marketing pages. Get that wrong in one direction and findings about quicksites.ai land on a
// customer's private page; wrong in the other and findings about her site never reach it.
import { slugFromTenantUrl } from '../personaBridge';

describe('slugFromTenantUrl', () => {
  it('extracts a tenant slug', () => {
    expect(slugFromTenantUrl('https://gracepoint-cloud-icj0.quicksites.ai/')).toBe('gracepoint-cloud-icj0');
    expect(slugFromTenantUrl('https://foo-ab12.quicksites.ai/services?x=1#y')).toBe('foo-ab12');
  });

  // ⚠️ www is the marketing site, not a tenant. A finding about /compare or the homepage is not
  // feedback on anyone's option, and filing it as such would put unrelated criticism of our own
  // product onto a client's decision page.
  it('rejects the marketing host', () => {
    expect(slugFromTenantUrl('https://www.quicksites.ai/collab/abc')).toBeNull();
  });

  it('rejects other hosts and junk', () => {
    for (const u of [
      'https://quicksites.ai/',                    // apex, not a subdomain
      'https://foo.quicksites.ai.evil.com/',       // suffix-looking impostor
      'https://foo.delivered.menu/',               // a different product's host
      'not a url',
      '',
    ]) {
      expect(slugFromTenantUrl(u)).toBeNull();
    }
  });

  it('is case-insensitive on the host', () => {
    expect(slugFromTenantUrl('https://Foo-AB12.QuickSites.ai/')).toBe('foo-ab12');
  });
});
