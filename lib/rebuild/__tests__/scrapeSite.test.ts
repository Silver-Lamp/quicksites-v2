/**
 * @jest-environment node
 */
// lib/rebuild/__tests__/scrapeSite.test.ts
//
// The rebuild scraper fetches an attacker-controllable URL server-side, so the SSRF
// guard (assertPublicHttpUrl) is security-load-bearing — these pin the blocked hosts
// and schemes. Also covers the pure parseHtml extraction + cleanBusinessName chrome
// stripping, which decide what the AI (and the resulting draft) actually see.

import {
  assertPublicHttpUrl,
  cleanBusinessName,
  parseHtml,
  scrapeMenuPages,
  ScrapeError,
} from '@/lib/rebuild/scrapeSite';

describe('assertPublicHttpUrl (SSRF guard)', () => {
  it('accepts public http(s) URLs', () => {
    expect(assertPublicHttpUrl('https://example.com').hostname).toBe('example.com');
    expect(assertPublicHttpUrl('http://acme.co/path?q=1').hostname).toBe('acme.co');
    expect(assertPublicHttpUrl('  https://www.foo.com  ').hostname).toBe('www.foo.com');
  });

  it('rejects non-http(s) schemes', () => {
    for (const u of ['file:///etc/passwd', 'ftp://x.com', 'gopher://x', 'javascript:alert(1)']) {
      expect(() => assertPublicHttpUrl(u)).toThrow(ScrapeError);
    }
  });

  it('rejects invalid URLs', () => {
    for (const u of ['not a url', '', 'http://']) {
      expect(() => assertPublicHttpUrl(u)).toThrow(ScrapeError);
    }
  });

  it('blocks loopback / internal hostnames', () => {
    for (const u of [
      'http://localhost',
      'http://localhost:3000',
      'http://api.localhost',
      'http://db.internal',
      'http://printer.local',
      'http://0.0.0.0',
    ]) {
      expect(() => assertPublicHttpUrl(u)).toThrow(/not reachable/i);
    }
  });

  it('blocks private + link-local + metadata IPv4 literals', () => {
    for (const u of [
      'http://127.0.0.1',
      'http://10.0.0.5',
      'http://192.168.1.1',
      'http://172.16.9.9',
      'http://172.31.255.255',
      'http://169.254.169.254', // cloud metadata endpoint
      'http://100.64.0.1', // CGNAT
    ]) {
      expect(() => assertPublicHttpUrl(u)).toThrow(/not reachable/i);
    }
  });

  it('allows public IPv4 literals that are not in a private range', () => {
    expect(assertPublicHttpUrl('http://8.8.8.8').hostname).toBe('8.8.8.8');
    expect(assertPublicHttpUrl('http://172.15.0.1').hostname).toBe('172.15.0.1'); // just below the private block
  });

  it('blocks IPv6 loopback / ULA / link-local literals', () => {
    for (const u of ['http://[::1]', 'http://[fc00::1]', 'http://[fd12::1]', 'http://[fe80::1]']) {
      expect(() => assertPublicHttpUrl(u)).toThrow(/not reachable/i);
    }
  });
});

describe('cleanBusinessName', () => {
  it('strips "Home | Brand" / "Brand - tagline" chrome', () => {
    expect(cleanBusinessName('Home | Acme Plumbing')).toBe('Acme Plumbing');
    expect(cleanBusinessName('Acme Plumbing - Trusted since 1990')).toBe('Acme Plumbing');
    expect(cleanBusinessName('Welcome to Bob’s Diner')).toBe('Bob’s Diner');
  });

  it('returns null on empty and passes through a plain name', () => {
    expect(cleanBusinessName(null)).toBeNull();
    expect(cleanBusinessName('   ')).toBeNull();
    expect(cleanBusinessName('Joe Coffee')).toBe('Joe Coffee');
  });
});

describe('parseHtml', () => {
  const html = `
    <html><head>
      <title>Home | Sunrise Bakery</title>
      <meta name="description" content="Fresh bread daily in Austin.">
      <meta property="og:site_name" content="Sunrise Bakery">
      <meta property="og:image" content="/img/hero.jpg">
      <meta name="theme-color" content="#F59E0B">
    </head><body>
      <nav><a href="/">Home</a><a href="/menu">Menu</a><a href="/catering">Catering</a></nav>
      <h1>Fresh Bread, Baked Daily</h1>
      <h2>Order Catering</h2>
      <script>var x = 1;</script>
      <p>We bake sourdough, baguettes, and pastries every morning.</p>
      <img src="/img/loaf.png">
    </body></html>`;

  const out = parseHtml(html, 'https://sunrise.example.com/', 'https://sunrise.example.com/');

  it('extracts the business name from og:site_name', () => {
    expect(out.businessName).toBe('Sunrise Bakery');
  });

  it('extracts description, headings, and nav labels', () => {
    expect(out.description).toBe('Fresh bread daily in Austin.');
    expect(out.headings).toEqual(['Fresh Bread, Baked Daily', 'Order Catering']);
    expect(out.navLabels).toEqual(expect.arrayContaining(['Menu', 'Catering']));
  });

  it('absolutizes the hero image and drops script/style from body text', () => {
    expect(out.heroImage).toBe('https://sunrise.example.com/img/hero.jpg');
    expect(out.bodyText).toContain('sourdough');
    expect(out.bodyText).not.toContain('var x');
  });

  it('normalizes the theme-color to a lowercase hex', () => {
    expect(out.accentColor).toBe('#f59e0b');
  });

  it('collects in-page links (label + absolute href)', () => {
    expect(out.links).toEqual(
      expect.arrayContaining([
        { label: 'Menu', href: 'https://sunrise.example.com/menu' },
        { label: 'Catering', href: 'https://sunrise.example.com/catering' },
      ]),
    );
  });
});

describe('scrapeMenuPages', () => {
  const scraped: any = {
    sourceUrl: 'https://cafe.example.com/',
    finalUrl: 'https://cafe.example.com/',
    links: [
      { label: 'Home', href: 'https://cafe.example.com/' },
      { label: 'Breakfast', href: 'https://cafe.example.com/menus/breakfast' },
      { label: 'Lunch', href: 'https://cafe.example.com/menus/lunch' },
      { label: 'Facebook', href: 'https://facebook.com/cafe' }, // cross-origin → skip
      { label: 'About Us', href: 'https://cafe.example.com/about' }, // not menu-ish → skip
    ],
  };

  const fakeFetch = async (url: string) =>
    ({
      ok: true,
      status: 200,
      url,
      headers: { get: () => 'text/html' },
      body: null,
      text: async () => `<html><body><h1>Menu</h1><p>Pancakes $10. Eggs $8.</p></body></html>`,
    }) as any;

  it('follows only same-origin, menu-like links and returns their text', async () => {
    const pages = await scrapeMenuPages(scraped, fakeFetch as any, 6);
    expect(pages.map((p) => p.label).sort()).toEqual(['Breakfast', 'Lunch']);
    expect(pages[0].text).toContain('Pancakes');
  });

  it('respects the maxPages cap', async () => {
    const pages = await scrapeMenuPages(scraped, fakeFetch as any, 1);
    expect(pages).toHaveLength(1);
  });
});
