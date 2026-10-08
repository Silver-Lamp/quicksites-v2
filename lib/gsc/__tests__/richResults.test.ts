/**
 * @jest-environment node
 */
// lib/gsc/__tests__/richResults.test.ts
//
// The other half of a URL inspection (2026-10-08). Search Console's "Merchant listings structured
// data issues" email was about a page that is perfectly indexed; the sweep had been reading only
// the coverage half, and only on custom domains — the platform property the email came from was
// never inspected at all.
import fs from 'node:fs';
import path from 'node:path';
import { parseInspection, parseRichResultErrors, triageInspection } from '@/lib/gsc/indexingTriage';
import { platformTargetsFor } from '@/lib/gsc/urlInspection';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const rawWithError = {
  inspectionResult: {
    indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed' },
    richResultsResult: {
      verdict: 'FAIL',
      detectedItems: [{
        richResultType: 'Merchant listings',
        items: [
          { name: '2019 Honda Civic EX', issues: [{ issueMessage: 'Missing field "image"', severity: 'ERROR' }] },
          { name: '2020 Ford F-150 XLT 4x4', issues: [{ issueMessage: 'Missing field "image"', severity: 'ERROR' }, { issueMessage: 'Missing field "review"', severity: 'WARNING' }] },
        ],
      }],
    },
  },
};

describe('parseRichResultErrors', () => {
  it('collects ERROR issues once each, typed, and ignores warnings', () => {
    expect(parseRichResultErrors(rawWithError)).toEqual(['Merchant listings: Missing field "image"']);
    expect(parseInspection('https://x/', rawWithError).richResultErrors).toHaveLength(1);
  });
  it('is empty when nothing was detected', () => {
    expect(parseRichResultErrors({ inspectionResult: { indexStatusResult: {} } })).toEqual([]);
    expect(parseRichResultErrors(null)).toEqual([]);
  });
});

describe('triage of an indexed page with a rich-result error', () => {
  const facts = parseInspection('https://www.quicksites.ai/sites/starter-auto-dealer', rawWithError);

  it('is fixable by us when the page still carries the broken listing (or we could not look)', () => {
    expect(triageInspection(facts, { liveMerchantListingGaps: 3 }).bucket).toBe('auto_fixable');
    expect(triageInspection(facts, { liveMerchantListingGaps: null }).bucket).toBe('auto_fixable');
    expect(triageInspection(facts, {}).reason).toMatch(/Rich result error — Merchant listings: Missing field "image"/);
  });

  it('is awaiting recrawl once the served page has no merchant listing without an image', () => {
    const t = triageInspection(facts, { liveMerchantListingGaps: 0 });
    expect(t.bucket).toBe('expected');
    expect(t.reason).toMatch(/awaiting recrawl/);
  });

  it('an indexed page with no rich-result error is simply indexed', () => {
    expect(triageInspection({ ...facts, richResultErrors: [] }).bucket).toBe('indexed');
  });
});

describe('platformTargetsFor', () => {
  const templates = [
    { id: 'a', slug: 'starter-auto-dealer', custom_domain: '', published: true, archived: false, data: { pages: [{ slug: 'home' }, { slug: 'inventory' }] } },
    { id: 'b', slug: 'has-domain', custom_domain: 'b.com', published: true, archived: false, data: { pages: [] } },
    { id: 'c', slug: 'campaign-site', custom_domain: null, published: true, archived: false, data: { pages: [] } },
    { id: 'd', slug: 'draft', custom_domain: null, published: false, archived: false, data: { pages: [] } },
    { id: 'e', slug: 'archived', custom_domain: null, published: true, archived: true, data: { pages: [] } },
  ];

  it('inspects published, domain-less, non-campaign sites under the platform property, home without a trailing slash', () => {
    const t = platformTargetsFor(['sc-domain:b.com', 'https://www.quicksites.ai/'], templates, new Set(['c']), 'https://www.quicksites.ai');
    expect(t.map((x) => x.slug)).toEqual(['starter-auto-dealer']);
    expect(t[0].property).toBe('https://www.quicksites.ai/');
    expect(t[0].urls).toEqual(['https://www.quicksites.ai/sites/starter-auto-dealer', 'https://www.quicksites.ai/sites/starter-auto-dealer/inventory']);
  });

  it('yields nothing when the platform property is not connected', () => {
    expect(platformTargetsFor(['sc-domain:b.com'], templates, new Set(), 'https://www.quicksites.ai')).toEqual([]);
  });
});

describe('the sweep wires both halves', () => {
  const cron = strip(read('app/api/cron/gsc-url-inspect/route.ts'));
  it('adds platform-only targets and checks a rich-result error against the served page', () => {
    expect(cron).toMatch(/platformTargetsFor\(properties/);
    expect(cron).toMatch(/if \(facts\.richResultErrors\.length\)/);
    expect(cron).toMatch(/merchantListingGaps\(await r\.text\(\)\)\.length/);
    expect(cron).toMatch(/liveMerchantListingGaps \}\)/);
  });
});
