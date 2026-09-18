/**
 * @jest-environment node
 */
// lib/compare/__tests__/competitors.test.ts
//
// The compare cluster's promise is that its figures are SOURCED. Two things this pins:
//
//   1. Every competitor entry is complete — a mark for every feature row, at least one real
//      source URL, a pricing string. A half entry renders as em-dashes and reads as "we don't
//      know", which on a comparison page reads as evasion.
//   2. The Gemini case study is promoted on /compare WITHOUT its figures being retyped there.
//      10Web and Framer exist in the registry because the deck compares us to them, but their
//      entries were sourced by us — so the compare pages may import the deck's figures, never
//      write them. A literal "91.2%" in a compare page is the shortcut the deck warns against.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMPETITORS,
  COMPETITOR_SLUGS,
  FEATURE_ROWS,
  competitorBySlug,
  pricesVerifiedFor,
  PRICES_VERIFIED,
} from '@/lib/compare/competitors';
import { COMPARE_REGISTRY } from '@/lib/compare/registry';
import {
  CASE_STUDY_COMPETITORS,
  CASE_STUDY_PATH,
  buildSlides,
  caseStudyCorrections,
  caseStudyFiguresFor,
} from '@/lib/caseStudies/geminiAgencyEconomics';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('every competitor entry is complete and sourced', () => {
  it.each(COMPETITOR_SLUGS)('%s has a mark for every feature row', (slug) => {
    const c = competitorBySlug(slug)!;
    for (const row of FEATURE_ROWS) expect(c.marks[row.key]).toBeDefined();
  });

  it.each(COMPETITOR_SLUGS)(
    '%s links at least one https source and has a pricing line',
    (slug) => {
      const c = competitorBySlug(slug)!;
      expect(c.sources.length).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.url).toMatch(/^https:\/\//);
      expect(c.pricing.length).toBeGreaterThan(10);
    }
  );

  it('slugs are unique and URL-safe', () => {
    expect(new Set(COMPETITOR_SLUGS).size).toBe(COMPETITOR_SLUGS.length);
    for (const s of COMPETITOR_SLUGS) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it('a later addition shows its own read date; the rest show the sweep date', () => {
    expect(pricesVerifiedFor(competitorBySlug('wix')!)).toBe(PRICES_VERIFIED);
    expect(pricesVerifiedFor(competitorBySlug('10web')!)).not.toBe(PRICES_VERIFIED);
    expect(pricesVerifiedFor(competitorBySlug('framer')!)).not.toBe(PRICES_VERIFIED);
  });

  it('the audit registry lists every live slug (the cron audits what the page shows)', () => {
    const live = COMPARE_REGISTRY.find((e) => e.key === 'website-builders')!;
    expect(live.competitors).toEqual(COMPETITOR_SLUGS);
  });
});

describe('the Gemini case study on /compare', () => {
  it('every vendor the deck modelled is a real, separately-sourced registry entry', () => {
    for (const [slug, v] of Object.entries(CASE_STUDY_COMPETITORS)) {
      const c = competitorBySlug(slug);
      expect(c).toBeDefined();
      expect(c!.name).toBe(v.label);
      // Sourced from the vendor, not from the analysis.
      for (const s of c!.sources) expect(s.url).not.toMatch(/gemini|google/i);
    }
  });

  it('the per-vendor figures are read from the deck, and match it', () => {
    const headline = buildSlides().find((s) => s.id === 'headline')!;
    for (const [slug, v] of Object.entries(CASE_STUDY_COMPETITORS)) {
      const f = caseStudyFiguresFor(slug)!;
      expect(f).not.toBeNull();
      expect(f.margin.theirs).toEqual(headline.figures!.find((x) => x.label === v.label));
      expect(f.margin.ours).toEqual(headline.figures!.find((x) => x.label === 'QuickSites'));
    }
    expect(caseStudyFiguresFor('wix')).toBeNull();
  });

  it('the corrections that travel with the headline are the reconciliation slides', () => {
    const ids = caseStudyCorrections().map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['our-numbers', 'pick-one', 'two-documents']));
  });

  it('the hub renders the economics section and links the deck', () => {
    const hub = read('app/compare/page.tsx');
    expect(hub).toContain('CaseStudyEconomicsSection');
    const callout = read('components/compare/case-study-callout.tsx');
    expect(callout).toContain('CASE_STUDY_PATH');
    expect(callout).toContain('caseStudyCorrections');
    expect(CASE_STUDY_PATH).toBe('/pricing/gemini-case-study');
  });

  it('the per-competitor page mounts the vendor callout', () => {
    expect(read('app/compare/[slug]/page.tsx')).toContain('CaseStudyVendorCallout');
  });

  it('no Gemini figure is typed into a compare surface — they are imported', () => {
    const geminiLiterals = [
      '91.2%',
      '70.6%',
      '68.0%',
      '2.8 months',
      '19.2 months',
      '4,537.50',
      '3,187.50',
    ];
    for (const file of [
      'app/compare/page.tsx',
      'app/compare/[slug]/page.tsx',
      'components/compare/case-study-callout.tsx',
      'lib/compare/competitors.ts',
    ]) {
      const src = read(file);
      for (const lit of geminiLiterals) expect(src).not.toContain(lit);
    }
  });

  it('the deck no longer claims the vendors are absent from our registry', () => {
    const first = buildSlides().find((s) => s.id === 'what-this-is')!;
    const text = [first.body, ...(first.points ?? [])].join(' ');
    expect(text).not.toMatch(/Neither vendor is in our own comparison registry/);
  });
});
