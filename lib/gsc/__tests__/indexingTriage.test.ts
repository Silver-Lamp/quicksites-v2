/**
 * @jest-environment node
 */
// lib/gsc/__tests__/indexingTriage.test.ts
//
// The rules that turn a Search Console inspection into "fixable by us / needs a person / expected /
// indexed". The same label means opposite things in different places (a redirect on the apex is
// correct; a duplicate on a platform copy is our bug), so the rules are pinned one by one.
import fs from 'node:fs';
import path from 'node:path';
import { parseInspection, triageInspection, sameUrl, BUCKET_ORDER } from '@/lib/gsc/indexingTriage';
import { siteUrls, targetsFor } from '@/lib/gsc/urlInspection';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const facts = (over: Partial<ReturnType<typeof parseInspection>>) => ({
  url: 'https://www.bremerton-towing.com/', verdict: null, coverageState: null, indexingState: null, robotsTxtState: null,
  pageFetchState: null, userCanonical: null, googleCanonical: null, lastCrawlTime: null, crawledAs: null, ...over,
});

describe('parseInspection', () => {
  it('reads the index status fields and never guesses', () => {
    const f = parseInspection('https://x.com/', { inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', googleCanonical: 'https://x.com/', userCanonical: ' https://x.com/ ' } } });
    expect(f.verdict).toBe('PASS');
    expect(f.coverageState).toBe('Submitted and indexed');
    expect(f.userCanonical).toBe('https://x.com/');
    expect(parseInspection('https://x.com/', null).coverageState).toBeNull();
    expect(parseInspection('https://x.com/', { inspectionResult: {} }).verdict).toBeNull();
  });
});

describe('triageInspection', () => {
  it('indexed', () => {
    expect(triageInspection(facts({ verdict: 'PASS', coverageState: 'Submitted and indexed' })).bucket).toBe('indexed');
    expect(triageInspection(facts({ coverageState: 'Indexed, not submitted in sitemap' })).bucket).toBe('indexed');
  });

  it('the bremerton email: duplicate, Google chose a different canonical → fixable by us', () => {
    const t = triageInspection(facts({
      verdict: 'NEUTRAL', coverageState: 'Duplicate, Google chose different canonical than user',
      userCanonical: 'https://bremerton-towing.quicksites.ai/', googleCanonical: 'https://www.bremerton-towing.com/',
    }), { declaredCanonical: 'https://bremerton-towing.quicksites.ai/' });
    expect(t.bucket).toBe('auto_fixable');
    expect(t.remedy).toMatch(/nominate-custom-domain-canonicals/);
  });

  it('…but once we nominate exactly what Google chose, it is expected (awaiting recrawl)', () => {
    const t = triageInspection(facts({
      coverageState: 'Duplicate, Google chose different canonical than user',
      userCanonical: 'https://bremerton-towing.quicksites.ai/', googleCanonical: 'https://www.bremerton-towing.com/',
    }), { declaredCanonical: 'https://www.bremerton-towing.com/' });
    expect(t.bucket).toBe('expected');
  });

  it('our own redirects and proper canonicals are expected, not findings', () => {
    expect(triageInspection(facts({ coverageState: 'Page with redirect' })).bucket).toBe('expected');
    expect(triageInspection(facts({ coverageState: 'Alternate page with proper canonical tag', googleCanonical: 'https://www.x.com/' }), { declaredCanonical: 'https://www.x.com/' }).bucket).toBe('expected');
    expect(triageInspection(facts({ coverageState: 'URL is unknown to Google' })).bucket).toBe('expected');
  });

  it("Google's quality verdicts need a person, and the remedy says a setting will not fix them", () => {
    for (const s of ['Crawled - currently not indexed', 'Discovered - currently not indexed', 'Soft 404']) {
      const t = triageInspection(facts({ coverageState: s }));
      expect(t.bucket).toBe('needs_person');
      expect(t.remedy).toBeTruthy();
    }
  });

  it('server-side faults are ours to fix', () => {
    expect(triageInspection(facts({ coverageState: 'Not found (404)' })).bucket).toBe('auto_fixable');
    expect(triageInspection(facts({ coverageState: 'Blocked by robots.txt' })).bucket).toBe('auto_fixable');
    expect(triageInspection(facts({ coverageState: 'Server error (5xx)' })).bucket).toBe('auto_fixable');
  });

  it('an unrecognised state is unknown, never silently expected', () => {
    expect(triageInspection(facts({ coverageState: 'Some new wording from Google' })).bucket).toBe('unknown');
    expect(triageInspection(facts({})).bucket).toBe('unknown');
  });

  it('sameUrl ignores case of host and a trailing slash, nothing else', () => {
    expect(sameUrl('https://WWW.x.com/', 'https://www.x.com')).toBe(true);
    expect(sameUrl('https://www.x.com/a/', 'https://www.x.com/a')).toBe(true);
    expect(sameUrl('https://www.x.com/', 'https://x.com/')).toBe(false);
    expect(sameUrl(null, 'https://x.com/')).toBe(false);
  });

  it('the display order puts what we can act on first', () => {
    expect(BUCKET_ORDER[0]).toBe('auto_fixable');
    expect(BUCKET_ORDER[BUCKET_ORDER.length - 1]).toBe('indexed');
  });
});

describe('which URLs get inspected', () => {
  it('every page of the site on its canonical origin, root first, no /home', () => {
    expect(siteUrls('https://www.x.com', { pages: [{ slug: 'home' }, { slug: 'services' }, { slug: 'Contact' }] })).toEqual([
      'https://www.x.com/', 'https://www.x.com/services', 'https://www.x.com/contact',
    ]);
    expect(siteUrls('https://www.x.com/', null)).toEqual(['https://www.x.com/']);
  });

  it('matches a property to its site by normalised domain and inspects the NOMINATED origin', () => {
    const targets = targetsFor(
      ['sc-domain:bremerton-towing.com', 'https://www.other.com/'],
      [
        { id: 't1', slug: 'bremerton-towing', custom_domain: null, data: { meta: { canonical_origin: 'https://www.bremerton-towing.com' }, pages: [{ slug: 'home' }] } },
        { id: 't2', slug: 'other', custom_domain: 'other.com', data: { pages: [{ slug: 'home' }] } },
        { id: 't3', slug: 'unconnected', custom_domain: 'nobody.com', data: { pages: [] } },
      ],
      new Map([['t1', 'bremerton-towing.com']]),
    );
    expect(targets.map((t) => [t.property, t.origin])).toEqual([
      ['sc-domain:bremerton-towing.com', 'https://www.bremerton-towing.com'],
      ['https://www.other.com/', 'https://other.com'],
    ]);
    expect(targets[0].urls).toEqual(['https://www.bremerton-towing.com/']);
  });
});

// Source guards: the properties a unit test cannot see.
describe('the sweep', () => {
  const cron = strip(read('app/api/cron/gsc-url-inspect/route.ts'));
  it('upserts latest-per-URL, triages with the nominated canonical, and dedupes tasks on the exact title', () => {
    expect(cron).toMatch(/onConflict: 'property,url'/);
    expect(cron).toMatch(/declaredCanonical: `\$\{target\.origin\}\/`/);
    expect(cron).toMatch(/\.eq\('title', title\)/);
  });
  it('emails only when something NEW needs attention', () => {
    expect(cron).toMatch(/if \(newTasks\.length && to\.length\)/);
  });
  it('is scheduled, reachable from the nav, and the knobs are declared', () => {
    const v = JSON.parse(read('vercel.json'));
    expect(v.crons.some((c: any) => c.path === '/api/cron/gsc-url-inspect')).toBe(true);
    expect(read('components/admin/AppHeader/AdminNavSections.tsx')).toMatch(/href: '\/admin\/seo\/indexing'/);
    expect(read('.env.example')).toMatch(/GSC_INSPECT_MAX=/);
  });
  it('the page reads the same buckets the triage defines', () => {
    const page = strip(read('app/admin/seo/indexing/page.tsx'));
    expect(page).toMatch(/BUCKET_ORDER\.map/);
    expect(page).toMatch(/from\('gsc_url_inspections'\)/);
  });
});
