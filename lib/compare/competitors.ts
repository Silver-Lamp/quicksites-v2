// lib/compare/competitors.ts
//
// The competitor-comparison data that powers the SEO cluster:
//   /compare                 — hub: QuickSites vs the website-builder field
//   /compare/<slug>          — one page per competitor ("QuickSites vs Wix", etc.)
//
// Pattern borrowed (reimplemented, not shared) from HiveJournal's family-wall/journaling
// compare clusters: ONE data file drives the per-competitor route, the hub matrix, AND the
// sitemap — adding a competitor = one entry here. Honesty-first (the brand rule): every
// competitor gets a fair one-liner, real strengths, and an honest "pick them if" — the
// credibility is the whole point of the wedge.
//
// Positioning grounded in docs/COMPETITIVE_LANDSCAPE.md. Pricing is the competitors' public
// pricing as of PRICES_VERIFIED — plans change, so each competitor carries its source links.

import { MAX_PLATFORM_FEE_PERCENT, PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';

export const PRICES_VERIFIED = 'July 2026';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const keepPct = Math.round(PARTNER_FEE_SHARE * 100);

export type Mark = 'yes' | 'no' | 'partial';

/** A row in the shared feature matrix — QuickSites' own value lives here; each competitor
 *  supplies its mark/note for the same `key`. */
export interface FeatureRow {
  key: string;
  feature: string;
  detail?: string;
  qs: { mark: Mark; note: string };
}

export const FEATURE_ROWS: FeatureRow[] = [
  { key: 'hosting', feature: 'Free hosting', detail: 'What it costs to keep a site live',
    qs: { mark: 'yes', note: 'Free hosting, every plan' } },
  { key: 'takeRate', feature: 'You earn a % of every sale', detail: 'A commerce take-rate that scales with the merchant’s GMV',
    qs: { mark: 'yes', note: `Platform fee up to ${maxFeePct}% via Stripe Connect` } },
  { key: 'residual', feature: 'Lifetime reseller residual on GMV', detail: 'The reseller keeps a cut of every order — ongoing, not a one-time markup',
    qs: { mark: 'yes', note: `Keep ${keepPct}% of every order fee, ongoing` } },
  { key: 'store', feature: 'Native online store', detail: 'Catalog + checkout without a third-party plugin',
    qs: { mark: 'yes', note: 'Stripe Connect checkout, refunds, ledger' } },
  { key: 'pod', feature: 'Print-on-demand (books + merch)', detail: 'Sell physical goods with zero inventory — printed & shipped on order',
    qs: { mark: 'yes', note: 'Lulu (books) + Gelato (apparel/posters) built in' } },
  { key: 'aiSite', feature: 'AI generates a whole site', detail: 'Not just copy — the structure, services, and theme',
    qs: { mark: 'yes', note: 'Industry scaffold seeds a full site + copy + hero' } },
  { key: 'rebuild', feature: 'Rebuild an existing site from a URL', detail: 'Paste a live site → an editable draft, for painless migration',
    qs: { mark: 'yes', note: 'AI rebuild: paste a URL, get a draft in seconds' } },
  { key: 'blocks', feature: 'Industry-specific block library', detail: 'Purpose-built sections beyond generic widgets — menus, estimators, listings, audio',
    qs: { mark: 'yes', note: 'Menu/ordering, estimator, listing cards, gallery, events, audio — per vertical' } },
  { key: 'audio', feature: 'Owner-voice audio (“About That”)', detail: 'The owner/agent talks about the business or listing — a real voice, not stock copy',
    qs: { mark: 'yes', note: 'Audio blocks + QR “listen” pack for signs/flyers' } },
  { key: 'whiteLabel', feature: 'White-label & resell under your brand', detail: 'Your logo, domain, login, and emails — not ours',
    qs: { mark: 'yes', note: 'Brand the builder, login, and emails' } },
  { key: 'crm', feature: 'Customer CRM + email marketing', detail: 'Customer records, segments, campaigns',
    qs: { mark: 'partial', note: 'Built-in CRM + consent-gated email campaigns w/ revenue attribution' } },
];

export interface Competitor {
  slug: string;
  name: string;
  /** Short SEO-facing category, e.g. "website builder", "agency CRM". */
  category: string;
  oneLiner: string;
  pricing: string;
  freeTier: string;
  strengths: string[];
  tradeoffs: string[];
  pickThemIf: string[];
  pickUsIf: string[];
  sources: Array<{ label: string; url: string }>;
  /** Mark/note per FEATURE_ROWS key. Missing keys render as an em-dash. */
  marks: Record<string, { mark: Mark; note: string }>;
}

export const COMPETITORS: Competitor[] = [
  {
    slug: 'wix',
    name: 'Wix',
    category: 'website builder',
    oneLiner: 'The biggest drag-and-drop website builder — enormous template + app library, and a genuinely capable editor.',
    pricing: '~$17–$159/mo (Light → Business Elite); a free plan with Wix ads + a wix.com subdomain',
    freeTier: 'Yes — free with Wix branding + no custom domain; you upgrade to remove ads and connect a domain.',
    strengths: [
      'A massive template gallery and a mature, flexible editor',
      'The largest third-party app market of any builder',
      'Deep feature breadth — bookings, blogs, basic stores, marketing',
      'Years of polish and a huge support ecosystem',
    ],
    tradeoffs: [
      'A monthly subscription per site; hosting is never free the way ours is',
      'No commerce take-rate or reseller residual — you can’t earn a % of a client’s sales',
      'Not built to white-label + resell under your own brand',
      'No AI “rebuild my existing site from a URL”, no industry-specific blocks like menu-ordering or a trade estimator',
    ],
    pickThemIf: [
      'You want the widest template + app selection and will happily pay monthly',
      'You’re building one site for yourself and don’t care about reselling',
      'You want a mature bookings/blog ecosystem out of the box',
    ],
    pickUsIf: [
      'You’re an agency/reseller who wants to earn on client GMV, not a flat markup',
      'You want free hosting and a take-rate instead of a per-site subscription',
      'You want AI to build (or rebuild) the whole site + trade-specific blocks',
    ],
    sources: [{ label: 'Wix pricing', url: 'https://www.wix.com/plans' }],
    marks: {
      hosting: { mark: 'no', note: '$17–$159/mo (free plan has Wix ads)' },
      takeRate: { mark: 'no', note: '0% — you don’t earn on client sales' },
      residual: { mark: 'no', note: 'Not a reseller-residual model' },
      store: { mark: 'yes', note: 'Built-in store on paid plans' },
      pod: { mark: 'partial', note: 'Via third-party apps' },
      aiSite: { mark: 'partial', note: 'AI site generator + copy' },
      rebuild: { mark: 'no', note: 'Manual rebuild' },
      blocks: { mark: 'partial', note: 'Broad generic widgets; not trade-specific' },
      audio: { mark: 'no', note: 'Not offered' },
      whiteLabel: { mark: 'partial', note: 'Partner/Studio tools; not a full white-label resale' },
      crm: { mark: 'partial', note: 'Ascend marketing add-ons' },
    },
  },
  {
    slug: 'squarespace',
    name: 'Squarespace',
    category: 'website builder',
    oneLiner: 'The design-led builder — beautiful, opinionated templates and a clean commerce experience.',
    pricing: '~$16–$52/mo (Personal → Commerce Advanced); free trial only, no permanent free plan',
    freeTier: 'No — a free trial, then a paid subscription is required to stay live.',
    strengths: [
      'The best-looking default templates in the category',
      'A polished, cohesive editing + brand experience',
      'Strong native commerce, plus tools for creators (memberships, courses, scheduling)',
      'Reliable and low-maintenance',
    ],
    tradeoffs: [
      'No free plan and no free hosting — it’s a monthly subscription, always',
      'No take-rate or lifetime reseller residual for agencies',
      'Not designed to white-label + resell under your own brand',
      'No AI whole-site build/rebuild, no menu-ordering or estimator blocks',
    ],
    pickThemIf: [
      'Design is your top priority and you want the most polished templates',
      'You’re a creator selling memberships, courses, or content',
      'You want one clean subscription and don’t need to resell',
    ],
    pickUsIf: [
      'You want free hosting instead of a required subscription',
      'You’re reselling to local businesses and want to earn on their GMV',
      'You want AI to assemble the site + verticalized blocks (menus, listings, estimators)',
    ],
    sources: [{ label: 'Squarespace pricing', url: 'https://www.squarespace.com/pricing' }],
    marks: {
      hosting: { mark: 'no', note: '$16–$52/mo, no free plan' },
      takeRate: { mark: 'no', note: '0% (transaction fee on lower tiers)' },
      residual: { mark: 'no', note: 'Not a reseller-residual model' },
      store: { mark: 'yes', note: 'Strong native commerce' },
      pod: { mark: 'partial', note: 'Via integrations (e.g. Printful)' },
      aiSite: { mark: 'partial', note: 'AI copy + design assist' },
      rebuild: { mark: 'no', note: 'Manual rebuild' },
      blocks: { mark: 'partial', note: 'Elegant but generic blocks' },
      audio: { mark: 'no', note: 'Not offered' },
      whiteLabel: { mark: 'no', note: 'No white-label resale' },
      crm: { mark: 'partial', note: 'Email + basic contacts' },
    },
  },
  {
    slug: 'godaddy',
    name: 'GoDaddy',
    category: 'website + marketing builder',
    oneLiner: 'The everything-under-one-roof SMB play — domains, a simple builder, email, and marketing in one bill.',
    pricing: '~$10–$25/mo (Websites + Marketing plans); frequent promos, then renewal pricing',
    freeTier: 'A free trial; staying live + connecting your domain needs a paid plan.',
    strengths: [
      'Domains, site, email, and marketing bundled with one vendor',
      'Very fast, template-driven setup aimed at non-technical owners',
      'Cheap entry pricing and heavy promotional discounts',
      'Massive brand recognition + phone support',
    ],
    tradeoffs: [
      'The builder is intentionally basic — limited design + structural control',
      'No take-rate or reseller residual; no real agency white-label',
      'Thin, generic section library — no menu-ordering, estimator, or listing blocks',
      'No AI whole-site build or URL rebuild',
    ],
    pickThemIf: [
      'You already buy your domain there and want everything on one bill',
      'You want the simplest possible setup and don’t need much control',
      'Rock-bottom intro price matters most',
    ],
    pickUsIf: [
      'You want a sharper, more capable site with trade-specific blocks',
      'You’re a reseller who wants to earn on client sales, not resell a basic builder',
      'You want AI to build/rebuild the site and free hosting',
    ],
    sources: [{ label: 'GoDaddy Websites + Marketing', url: 'https://www.godaddy.com/websites/website-builder' }],
    marks: {
      hosting: { mark: 'no', note: '$10–$25/mo after promo' },
      takeRate: { mark: 'no', note: '0% on sales' },
      residual: { mark: 'no', note: 'Reseller program is domains/hosting, not GMV' },
      store: { mark: 'partial', note: 'Basic store on higher tiers' },
      pod: { mark: 'no', note: 'Not offered' },
      aiSite: { mark: 'partial', note: 'Airo AI setup + copy' },
      rebuild: { mark: 'no', note: 'Manual rebuild' },
      blocks: { mark: 'no', note: 'Thin generic sections' },
      audio: { mark: 'no', note: 'Not offered' },
      whiteLabel: { mark: 'no', note: 'No builder white-label' },
      crm: { mark: 'partial', note: 'Basic marketing + email' },
    },
  },
  {
    slug: 'webflow',
    name: 'Webflow',
    category: 'designer website builder',
    oneLiner: 'The pro/designer builder — near-code-level visual control and a genuinely powerful CMS.',
    pricing: '~$14–$39/mo site plans (+ ~$29–$212/mo ecommerce); Workspace seats for teams',
    freeTier: 'A free tier on a webflow.io subdomain (limited pages); a paid Site plan to go live on a domain.',
    strengths: [
      'Unmatched visual design control — pixel-precise, production-grade output',
      'A powerful, structured CMS for content-heavy sites',
      'Clean code export and strong performance',
      'The go-to for designers and agencies doing bespoke work',
    ],
    tradeoffs: [
      'A real learning curve — it’s a pro tool, not a 5-minute setup',
      'Ecommerce is a pricey add-on, and there’s no take-rate/residual to earn on client sales',
      'No AI whole-site build or URL rebuild; no verticalized blocks (menus, estimators, listings)',
      'Client hosting is a per-site subscription, not free',
    ],
    pickThemIf: [
      'You’re a designer who wants total, code-level control of the canvas',
      'You’re building a bespoke, content-heavy marketing site',
      'You value clean code export and are comfortable with the learning curve',
    ],
    pickUsIf: [
      'You want a working local-business site in minutes, not hours of design work',
      'You want to earn on client GMV + resell under your brand',
      'You want AI to build/rebuild it and trade-specific blocks out of the box',
    ],
    sources: [{ label: 'Webflow pricing', url: 'https://webflow.com/pricing' }],
    marks: {
      hosting: { mark: 'no', note: '$14–$39/mo site plans' },
      takeRate: { mark: 'no', note: '0% on client sales' },
      residual: { mark: 'no', note: 'Not a reseller-residual model' },
      store: { mark: 'partial', note: 'Ecommerce is a pricier add-on' },
      pod: { mark: 'partial', note: 'Via integrations' },
      aiSite: { mark: 'partial', note: 'AI assist; not a full auto-build' },
      rebuild: { mark: 'no', note: 'Manual rebuild' },
      blocks: { mark: 'partial', note: 'Build anything by hand; nothing trade-specific prebuilt' },
      audio: { mark: 'no', note: 'Not offered' },
      whiteLabel: { mark: 'partial', note: 'Client billing, but not a rebranded builder' },
      crm: { mark: 'no', note: 'Bring your own' },
    },
  },
  {
    slug: 'shopify',
    name: 'Shopify',
    category: 'ecommerce platform',
    oneLiner: 'The gold standard for serious online stores — the deepest commerce engine in the category.',
    pricing: '~$29–$299/mo (Basic → Advanced) + payment/transaction fees; a $5/mo Starter for social selling',
    freeTier: 'No — a trial, then a monthly plan; transaction fees apply unless you use Shopify Payments.',
    strengths: [
      'The most complete commerce engine — inventory, tax, shipping, POS, checkout that converts',
      'A gigantic app + theme ecosystem and world-class reliability at scale',
      'Best-in-class for a high-volume, standalone online store',
      'Deep multichannel selling (social, marketplaces, in-person)',
    ],
    tradeoffs: [
      'A monthly fee plus transaction fees; hosting is never free',
      'It’s a store, not a full local-business website — brochure/marketing pages are secondary',
      'No agency take-rate/residual on your clients’ GMV, no rebranded-builder resale',
      'No AI whole-site build/rebuild, no menu-ordering / estimator / listing blocks for local trades',
    ],
    pickThemIf: [
      'Your primary business is a serious, higher-volume online store',
      'You need deep inventory, multichannel, and POS',
      'You’ll invest in the platform + apps and want maximum commerce power',
    ],
    pickUsIf: [
      'You’re a local business that needs a full site with light, built-in ordering',
      'You’re a reseller who wants to earn on client sales without a per-store Shopify bill',
      'You want free hosting + AI site build + trade-specific blocks, not a store-first tool',
    ],
    sources: [{ label: 'Shopify pricing', url: 'https://www.shopify.com/pricing' }],
    marks: {
      hosting: { mark: 'no', note: '$29–$299/mo + fees' },
      takeRate: { mark: 'partial', note: 'THEY take fees from you; you don’t earn on clients' },
      residual: { mark: 'no', note: 'No reseller residual on GMV' },
      store: { mark: 'yes', note: 'Best-in-class commerce engine' },
      pod: { mark: 'partial', note: 'Via apps (Printful/Printify)' },
      aiSite: { mark: 'partial', note: 'Sidekick/Magic copy + assist' },
      rebuild: { mark: 'no', note: 'Manual rebuild' },
      blocks: { mark: 'partial', note: 'Deep for commerce; not local-trade blocks' },
      audio: { mark: 'no', note: 'Not offered' },
      whiteLabel: { mark: 'no', note: 'No rebranded-builder resale' },
      crm: { mark: 'partial', note: 'Shopify Email + customer data' },
    },
  },
  {
    slug: 'duda',
    name: 'Duda',
    category: 'agency website builder',
    oneLiner: 'The agency/SaaS builder — excellent white-label, team workflows, and a mature store.',
    pricing: '~$19–$149/mo per plan (Basic → Agency), with an eCommerce add-on',
    freeTier: 'A free trial; client sites run on a paid plan.',
    strengths: [
      'Best-in-class white-label + self-serve agency workflows',
      'A mature store (up to ~20k products) with tax/shipping',
      'Strong team/client management and performance',
      'Purpose-built for agencies reselling sites at scale',
    ],
    tradeoffs: [
      'Hosting is a per-site plan — never free',
      'You mark up a flat seat price; there’s no take-rate on client sales',
      'No print-on-demand, no AI whole-site build, no URL rebuild',
      'Generic widget library — nothing trade-specific like menu-ordering or an estimator',
    ],
    pickThemIf: [
      'You’re an agency that wants the most mature white-label + store today',
      'You resell at a flat per-seat markup and are happy with that model',
      'You need up-to-20k-product catalogs',
    ],
    pickUsIf: [
      'You want to earn a lifetime % of client GMV, not a flat markup',
      'You want free hosting, AI site build/rebuild, and trade-specific blocks',
      'You want print-on-demand + owner-voice audio built in',
    ],
    sources: [
      { label: 'Duda pricing', url: 'https://www.duda.co/pricing' },
      { label: 'Duda eCommerce', url: 'https://www.duda.co/ecommerce/pricing' },
    ],
    marks: {
      hosting: { mark: 'no', note: '$19–$149/mo per plan' },
      takeRate: { mark: 'no', note: '0% on store transactions' },
      residual: { mark: 'no', note: 'Flat markup on a fixed seat price' },
      store: { mark: 'yes', note: 'Mature — up to ~20k products' },
      pod: { mark: 'no', note: 'Not offered' },
      aiSite: { mark: 'partial', note: 'Writes copy; can’t build the canvas' },
      rebuild: { mark: 'no', note: 'Manual rebuild' },
      blocks: { mark: 'partial', note: 'Broad generic widgets; not trade-specific' },
      audio: { mark: 'no', note: 'Not offered' },
      whiteLabel: { mark: 'yes', note: 'Excellent, self-serve' },
      crm: { mark: 'partial', note: 'Light' },
    },
  },
  {
    slug: 'gohighlevel',
    name: 'GoHighLevel',
    category: 'agency CRM / marketing SaaS',
    oneLiner: 'The agency marketing OS — dominant two-way SMS, pipelines, and a unified inbox you can resell as SaaS.',
    pricing: '~$97–$497/mo ($97 Starter → $497 SaaS Pro for rebranded resale)',
    freeTier: 'A trial; then a monthly plan (the $497 tier unlocks SaaS-mode resale).',
    strengths: [
      'The category leader in SMS, pipelines, automations, and unified inbox',
      'Resell the whole platform as your own SaaS at the $497 tier',
      'Deep marketing automation + funnels',
      'A large agency community and template marketplace',
    ],
    tradeoffs: [
      'No real ecommerce — no catalog, inventory, or fulfillment to monetize',
      'You resell SaaS seats, not a % of your clients’ sales',
      'Funnels/pages over a rich, trade-specific site builder',
      'Pricey monthly floor; hosting isn’t the point (it’s a CRM)',
    ],
    pickThemIf: [
      'You need best-in-class SMS, pipelines, and marketing automation',
      'You want to resell a rebranded marketing SaaS to clients',
      'Lead nurture + funnels matter more than a store',
    ],
    pickUsIf: [
      'Your clients actually sell things and you want a cut of that GMV',
      'You want a real site builder + native store, not funnels',
      'You want free hosting, AI build/rebuild, POD, and owner-voice audio',
    ],
    sources: [{ label: 'GoHighLevel pricing', url: 'https://www.gohighlevel.com/pricing' }],
    marks: {
      hosting: { mark: 'no', note: '$97–$497/mo' },
      takeRate: { mark: 'no', note: 'No real ecommerce to monetize' },
      residual: { mark: 'partial', note: 'Resell SaaS seats — not sales' },
      store: { mark: 'no', note: 'No catalog / inventory / fulfillment' },
      pod: { mark: 'no', note: 'Not offered' },
      aiSite: { mark: 'partial', note: 'Copy / voice assistants' },
      rebuild: { mark: 'no', note: 'Manual rebuild' },
      blocks: { mark: 'no', note: 'Funnels/pages, thin section library' },
      audio: { mark: 'no', note: 'Not offered' },
      whiteLabel: { mark: 'yes', note: 'Good — $497 SaaS mode' },
      crm: { mark: 'yes', note: 'Dominant — SMS, pipelines, unified inbox' },
    },
  },
];

export const COMPETITOR_SLUGS = COMPETITORS.map((c) => c.slug);

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

/** The mark/note a competitor gives for a feature row (em-dash fallback when unset). */
export function competitorMark(c: Competitor, key: string): { mark: Mark; note: string } {
  return c.marks[key] ?? { mark: 'no', note: '—' };
}
