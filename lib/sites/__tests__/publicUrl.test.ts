import { publicSiteHost, publicSiteUrl, resumeDownloadPath } from '../publicUrl';

describe('publicSiteHost', () => {
  // ⚠️ Order is not cosmetic: showing the subdomain to someone who bought a domain reads as
  // "the thing I paid for isn't wired up", and teaches the wrong URL to whoever we link.
  it('prefers a custom domain over the platform subdomain', () => {
    expect(publicSiteHost({ custom_domain: 'sandonjurowski.com', slug: 'sandon' })).toBe(
      'sandonjurowski.com'
    );
  });

  it('tolerates a stored scheme or trailing slash', () => {
    expect(publicSiteHost({ custom_domain: 'https://example.com/' })).toBe('example.com');
  });

  it('falls back to the slug subdomain', () => {
    expect(publicSiteHost({ slug: 'sandon' })).toBe('sandon.quicksites.ai');
  });

  it('treats a bare default_subdomain as a label and a dotted one as a host', () => {
    expect(publicSiteHost({ default_subdomain: 'foo', slug: 'x' })).toBe('foo.quicksites.ai');
    expect(publicSiteHost({ default_subdomain: 'foo.example.com', slug: 'x' })).toBe(
      'foo.example.com'
    );
  });

  it('returns null when a site has no address at all', () => {
    expect(publicSiteHost({})).toBeNull();
    expect(publicSiteUrl({ slug: '  ' })).toBeNull();
  });
});

describe('resumeDownloadPath', () => {
  // ⚠️ Slug-based on purpose: the route resolves a template by slug, and a custom domain still
  // rewrites to /sites/<slug>, so one relative path works on both addresses.
  it('builds from the slug, never the host', () => {
    expect(resumeDownloadPath({ custom_domain: 'example.com', slug: 'sandon' }, 'pdf')).toBe(
      '/api/resume/sandon/pdf'
    );
    expect(resumeDownloadPath({ custom_domain: 'example.com' }, 'pdf')).toBeNull();
  });
});
