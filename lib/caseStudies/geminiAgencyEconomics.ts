// lib/caseStudies/geminiAgencyEconomics.ts
//
// "A Gemini Case Study" — the slide deck at /pricing/gemini-case-study.
//
// ⚠️ WHAT THIS IS, AND THE RULE IT FOLLOWS. Google's Gemini produced an agency unit-economics
// comparison of QuickSites against 10Web and Framer. It is flattering to us. We did not write it,
// we did not verify its competitor figures, and publishing someone else's favourable maths under
// our own logo without saying so would be the same class of dishonesty as an invented testimonial.
//
// So this deck follows the persona-testing rule (crosstalk/contracts/persona-testing.md): a
// third-party finding is a CLAIM until we agree with it, the attribution lives in the record
// rather than in a badge, and the caveat is rendered verbatim rather than summarised away. Two
// of its slides exist only to say where its assumptions do NOT match our real pricing — which is
// also the more persuasive move, because an agency evaluating us will check.
//
// Every QuickSites number here is DERIVED from the constants the pricing page uses
// (lib/billing/planPricing, lib/commerce/partner-terms). Gemini's own figures are quoted as given
// and labelled as its own. A test asserts our figures are never typed.

import { AGENCY_FOUNDER, AGENCY_PUBLIC, agencyMonthlyCost } from '@/lib/billing/planPricing';
import { PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';

/** The portfolio size Gemini modelled, reused by our reconciliation so the comparison is like-for-like. */
export const PORTFOLIO_SITES = 25;

export type Slide = {
  id: string;
  /** Short label for the progress rail and the deep link. */
  nav: string;
  title: string;
  /** Lead paragraph. */
  body: string;
  /** Optional figure grid. `source` says whose number it is — never omitted. */
  figures?: { label: string; value: string; note?: string }[];
  /** Optional bullet list. */
  points?: string[];
  /** Whose claim this slide carries. Rendered on the slide, not in a footnote. */
  source: 'gemini' | 'quicksites' | 'reconciliation';
};

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

/** Our real cost to an agency at the modelled portfolio size, both tiers. */
export const OUR_COST_AT_PORTFOLIO = {
  founder: agencyMonthlyCost(PORTFOLIO_SITES, AGENCY_FOUNDER),
  public: agencyMonthlyCost(PORTFOLIO_SITES, AGENCY_PUBLIC),
};

export function buildSlides(): Slide[] {
  const partnerPct = Math.round(PARTNER_FEE_SHARE * 100);
  return [
    {
      id: 'what-this-is',
      nav: 'What this is',
      title: 'An analysis we did not write',
      body:
        'Google’s Gemini was asked to compare website platforms on agency unit economics — QuickSites against 10Web (WordPress) and Framer. It concluded QuickSites has the strongest margins for a volume SMB agency. We are publishing it because it is useful, and publishing it with its seams showing because it is not ours.',
      points: [
        'Gemini’s figures are quoted as it produced them, marked “Gemini’s model”.',
        'We did not verify its 10Web or Framer figures, nor its labour-hour estimates. Both vendors now have entries on our comparison pages — sourced by us from their own pricing pages, not from this analysis.',
        'Two slides exist only to show where its assumptions do not match what we actually charge.',
      ],
      source: 'gemini',
    },
    {
      id: 'headline',
      nav: 'The headline',
      title: 'Gross margin on a $199 retainer',
      body:
        'Gemini’s core finding. It holds the client price constant at $199/month and varies only what the platform costs the agency in licence fees and maintenance labour.',
      figures: [
        { label: 'QuickSites', value: '91.2%', note: '$181.50 gross profit' },
        { label: '10Web', value: '70.6%', note: '$140.50 gross profit' },
        { label: 'Framer', value: '68.0%', note: '$135.25 gross profit' },
      ],
      points: [
        'The gap is labour, not licence: it modelled 0.5 maintenance hours a month for QuickSites against 1.5 for WordPress.',
        'Its reasoning: clients edit schema-gated fields, so they cannot break a layout and generate a support ticket.',
      ],
      source: 'gemini',
    },
    {
      id: 'payback',
      nav: 'Payback',
      title: 'The website-as-a-service maths',
      body:
        'Where Gemini is most pointed: for a $0-down model funded by the agency, the platform decides whether the model works at all.',
      figures: [
        { label: 'QuickSites payback', value: '2.8 months', note: '$510 to recover' },
        { label: 'Framer payback', value: '19.2 months', note: '$2,600 to recover' },
      ],
      points: [
        'Its verdict on the Framer version was “structurally unviable” — a client churning before month 20 leaves the agency at a cash loss.',
        'That conclusion is about build labour and a per-seat floor, not about design quality. Gemini rates Framer highest for bespoke work.',
      ],
      source: 'gemini',
    },
    {
      id: 'our-numbers',
      nav: 'Our real price',
      title: 'Where its model and our price list differ',
      body:
        'Gemini modelled our software cost to an agency at $0. That is true for a site on a quicksites.ai subdomain. It is not true for the configuration it describes — client sites on their own domains, under your brand — which is our Agency plan.',
      figures: [
        {
          label: `Agency plan, ${PORTFOLIO_SITES} sites`,
          value: `${usd(OUR_COST_AT_PORTFOLIO.public)}/mo`,
          note: `${usd(AGENCY_PUBLIC.platform)} platform + ${PORTFOLIO_SITES} × ${usd(AGENCY_PUBLIC.perSite)}`,
        },
        {
          label: 'Founder tier',
          value: `${usd(OUR_COST_AT_PORTFOLIO.founder)}/mo`,
          note: `${usd(AGENCY_FOUNDER.platform)} + ${PORTFOLIO_SITES} × ${usd(AGENCY_FOUNDER.perSite)}, grandfathered 12 months`,
        },
      ],
      points: [
        'Our own pricing page has said this all along; the analysis simply did not use it.',
        'Correcting it moves the portfolio margin by a little over three percentage points. It does not change which platform comes first.',
      ],
      source: 'reconciliation',
    },
    {
      id: 'pick-one',
      nav: 'Pick one',
      title: 'You cannot stack the flat plan and the revenue share',
      body:
        'Gemini added a transaction residual on top of the flat Agency plan. Those are two different deals, and our billing code enforces the difference.',
      points: [
        'Agency plan: you pay per user and per site, and your merchants pay no per-order platform fee. Flat and predictable.',
        `Partner route: hosting is free, merchants pay the order fee, and you keep ${partnerPct}% of it for the life of the account.`,
        'A merchant on the Agency plan is fee-exempt in code, so there is no fee left to share. Pick the model that matches how your clients make money.',
      ],
      source: 'reconciliation',
    },
    {
      id: 'two-documents',
      nav: 'Two drafts',
      title: 'The two versions disagree, and that is worth knowing',
      body:
        'We were given two Gemini outputs. The written playbook models a $199 retainer and reports $4,537.50 monthly portfolio profit. The code output models $150 and reports $3,187.50. Same portfolio, different assumptions, no reconciliation between them.',
      points: [
        'Neither is wrong; they answer different questions. But a number lifted from one and quoted beside the other would be.',
        'If you are building a business case, set your own retainer and labour rate first, then run the comparison.',
      ],
      source: 'reconciliation',
    },
    {
      id: 'what-we-stand-behind',
      nav: 'What we’d sign',
      title: 'The parts we will put our name to',
      body:
        'Stripped of the modelling, three claims about QuickSites are ours to defend, and one is not yet.',
      points: [
        'Hosting is genuinely free, including on the free tier with a quicksites.ai subdomain — no card to start.',
        'Clients edit fields, not layouts, so a client cannot break the responsive design. That is the design, not a marketing line.',
        `The partner revenue share is ${partnerPct}% of the platform fee for the life of the account, and it is computed by the ledger, not by hand.`,
        '⚠️ Not yet ours to claim: Gemini calls our white-label “100% vendor invisibility”. Branding, domains and login are ours end to end, but transactional email still sends from our verified domain until a partner verifies their own. One reseller org exists today. Ask us for the current state rather than trusting a slide.',
      ],
      source: 'quicksites',
    },
  ];
}

export const SOURCE_LABEL: Record<Slide['source'], string> = {
  gemini: 'Gemini’s model — quoted as produced, unverified by us',
  reconciliation: 'Our correction — checked against the code that bills',
  quicksites: 'QuickSites’ own claim',
};

/** Where the deck lives. Every surface that promotes it links here. */
export const CASE_STUDY_PATH = '/pricing/gemini-case-study';

/**
 * The competitors the analysis modelled, keyed by their lib/compare slug. Both have FULL,
 * separately-sourced entries in lib/compare/competitors.ts — the case study is why they were
 * added, but nothing in their registry entry comes from it. A test pins that every key here is
 * a real competitor slug.
 */
export const CASE_STUDY_COMPETITORS: Record<string, { label: string }> = {
  '10web': { label: '10Web' },
  framer: { label: 'Framer' },
};

export type CaseStudyFigure = { label: string; value: string; note?: string };

/**
 * What the deck says about one competitor, for the /compare/<slug> callout — READ from the
 * slides, never retyped, so the callout cannot quote a number the deck no longer shows.
 * Returns null for a competitor the analysis did not model.
 */
export function caseStudyFiguresFor(slug: string): {
  label: string;
  margin: { theirs: CaseStudyFigure; ours: CaseStudyFigure };
  payback?: { theirs: CaseStudyFigure; ours: CaseStudyFigure };
} | null {
  const entry = CASE_STUDY_COMPETITORS[slug];
  if (!entry) return null;
  const slides = buildSlides();
  const headline = slides.find((s) => s.id === 'headline');
  const payback = slides.find((s) => s.id === 'payback');
  const byLabel = (figs: CaseStudyFigure[] | undefined, startsWith: string) =>
    figs?.find((f) => f.label.startsWith(startsWith));
  const marginTheirs = byLabel(headline?.figures, entry.label);
  const marginOurs = byLabel(headline?.figures, 'QuickSites');
  if (!marginTheirs || !marginOurs) return null;
  const paybackTheirs = byLabel(payback?.figures, entry.label);
  const paybackOurs = byLabel(payback?.figures, 'QuickSites');
  return {
    label: entry.label,
    margin: { theirs: marginTheirs, ours: marginOurs },
    payback: paybackTheirs && paybackOurs ? { theirs: paybackTheirs, ours: paybackOurs } : undefined,
  };
}

/**
 * The deck's correcting slides, for any surface that promotes the flattering headline: the
 * rule is that the corrections travel WITH the headline, never behind a click.
 */
export function caseStudyCorrections(): Pick<Slide, 'id' | 'title' | 'body'>[] {
  return buildSlides()
    .filter((s) => s.source === 'reconciliation')
    .map(({ id, title, body }) => ({ id, title, body }));
}
