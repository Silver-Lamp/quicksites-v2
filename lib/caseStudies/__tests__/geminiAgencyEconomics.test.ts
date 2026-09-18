/**
 * @jest-environment node
 */
// lib/caseStudies/__tests__/geminiAgencyEconomics.test.ts
//
// This deck publishes a THIRD PARTY's flattering analysis of us on our own pricing page. Two
// things must stay true or it becomes an invented testimonial with extra steps:
//
//   1. every slide says whose claim it carries, and the ones correcting the analysis exist;
//   2. every QuickSites figure is DERIVED from the constants that bill, never typed — so the deck
//      cannot keep quoting $140/mo after the plan price changes.

import { buildSlides, OUR_COST_AT_PORTFOLIO, PORTFOLIO_SITES, SOURCE_LABEL } from '@/lib/caseStudies/geminiAgencyEconomics';
import { AGENCY_FOUNDER, AGENCY_PUBLIC, agencyMonthlyCost } from '@/lib/billing/planPricing';
import { PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'lib/caseStudies/geminiAgencyEconomics.ts'), 'utf8');
const slides = buildSlides();

describe('attribution', () => {
  it('every slide declares whose claim it is', () => {
    for (const s of slides) expect(Object.keys(SOURCE_LABEL)).toContain(s.source);
  });

  it('the label makes Gemini’s slides unverified-by-us on their face', () => {
    expect(SOURCE_LABEL.gemini).toMatch(/unverified by us/i);
  });

  it('carries at least two reconciliation slides — the deck must correct, not just flatter', () => {
    expect(slides.filter((s) => s.source === 'reconciliation').length).toBeGreaterThanOrEqual(2);
  });

  it('says the two source documents disagree, rather than picking the better number', () => {
    const s = slides.find((x) => x.id === 'two-documents')!;
    expect(s.body).toContain('4,537.50');
    expect(s.body).toContain('3,187.50');
  });

  it('does not repeat the “100% vendor invisibility” claim as ours', () => {
    const ours = slides.filter((s) => s.source === 'quicksites');
    const text = ours.map((s) => [s.body, ...(s.points ?? [])].join(' ')).join(' ');
    // It may be mentioned — but only as something we do NOT yet claim.
    if (text.includes('100% vendor invisibility') || text.includes('100% Vendor Invisibility')) {
      expect(text).toMatch(/Not yet ours to claim/i);
    }
  });
});

describe('our figures are derived, never typed', () => {
  it('the portfolio cost matches agencyMonthlyCost on both tiers', () => {
    expect(OUR_COST_AT_PORTFOLIO.public).toBe(agencyMonthlyCost(PORTFOLIO_SITES, AGENCY_PUBLIC));
    expect(OUR_COST_AT_PORTFOLIO.founder).toBe(agencyMonthlyCost(PORTFOLIO_SITES, AGENCY_FOUNDER));
    // Sanity: the published rate today.
    expect(OUR_COST_AT_PORTFOLIO.public).toBe(19 + 25 * 6);
  });

  it('the partner share is read from partner-terms, not written into the copy', () => {
    const pickOne = slides.find((s) => s.id === 'pick-one')!;
    const text = pickOne.points!.join(' ');
    expect(text).toContain(`${Math.round(PARTNER_FEE_SHARE * 100)}%`);
    expect(src).toContain('PARTNER_FEE_SHARE');
    expect(src).not.toMatch(/keep 80% of it/);
  });

  it('no QuickSites price is a literal in the source', () => {
    // Gemini's own figures are quoted literally and that is correct; ours must come from imports.
    expect(src).toContain('agencyMonthlyCost');
    expect(src).not.toMatch(/\$140\/mo|\$169\/mo/);
  });

  it('states the plan price it is reconciling against on the corrections slide', () => {
    const s = slides.find((x) => x.id === 'our-numbers')!;
    const values = (s.figures ?? []).map((f) => f.value);
    expect(values).toContain(`$${OUR_COST_AT_PORTFOLIO.public}/mo`);
  });
});

describe('the pricing page and the deck cannot drift apart', () => {
  const page = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8');
  it('the pricing page imports the shared plan constants instead of literals', () => {
    expect(page).toContain("from '@/lib/billing/planPricing'");
    expect(page).not.toMatch(/const FOUNDER_PLAN = \{ platform: \d+/);
  });
  it('the pricing page links the deck', () => {
    expect(page).toContain('/pricing/gemini-case-study');
  });
});
