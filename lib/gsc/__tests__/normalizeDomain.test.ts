import { normalizeGscDomain } from '../normalizeDomain';

describe('normalizeGscDomain', () => {
  it('strips the sc-domain: prefix', () => {
    expect(normalizeGscDomain('sc-domain:example.com')).toBe('example.com');
  });
  it('strips protocol, www, path and trailing slash', () => {
    expect(normalizeGscDomain('https://www.example.com/')).toBe('example.com');
    expect(normalizeGscDomain('http://example.com/foo/bar')).toBe('example.com');
  });
  it('lowercases and trims', () => {
    expect(normalizeGscDomain('  Example.COM ')).toBe('example.com');
  });
  it('keeps quicksites subdomains intact', () => {
    expect(normalizeGscDomain('foo.quicksites.ai')).toBe('foo.quicksites.ai');
    expect(normalizeGscDomain('https://foo.quicksites.ai/')).toBe('foo.quicksites.ai');
  });
  it('matches the same site across property formats', () => {
    const keys = [
      'sc-domain:pnw-exteriorcleaning.com',
      'https://www.pnw-exteriorcleaning.com/',
      'PNW-ExteriorCleaning.com',
    ].map(normalizeGscDomain);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('pnw-exteriorcleaning.com');
  });
  it('returns empty for blank input', () => {
    expect(normalizeGscDomain('')).toBe('');
    expect(normalizeGscDomain(null)).toBe('');
    expect(normalizeGscDomain(undefined)).toBe('');
  });
});
