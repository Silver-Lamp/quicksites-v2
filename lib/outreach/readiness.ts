// lib/outreach/readiness.ts
//
// Pure "is this pitch site refined enough to mail?" analysis. Given a template's `data`
// blob + the campaign's industry, it returns the blockers a human would want cleared
// before a postcard/text goes out — so we never mail a placeholder site.
//
// Heuristic, not a crawler. Builds on lib/outreach/onPage.ts for the SEO-ish signals and
// inspects block content for the "still scaffold" tells. Pure → unit-tests in isolation.
// The severity split drives the gate: a `hard` blocker forbids marking refined; `soft`
// blockers are advisory. See docs/RANKED_TARGETING_PLAN.md §5.

import { analyzeOnPage } from '@/lib/outreach/onPage';
import type { IndustryKey } from '@/lib/industries';

export type BlockerSeverity = 'hard' | 'soft';
export type ReadinessBlocker = { id: string; severity: BlockerSeverity; label: string };
export type ReadinessResult = {
  blockers: ReadinessBlocker[];
  /** True when any hard blocker remains — the campaign cannot be marked refined. */
  hardBlocked: boolean;
};

// Mirror of the (unexported) scaffold set — food sites are menu-forward, not services.
// Keep in sync with lib/builder/industryScaffold.ts FOOD_INDUSTRIES.
const FOOD_INDUSTRIES = new Set<string>(['restaurant']);

// Common scaffold/placeholder tells left in hero or menu copy.
const PLACEHOLDER_COPY = /lorem ipsum|describe your|your business name|placeholder|\{\{|headline here|company name here/i;

function collectBlocks(data: any): any[] {
  const out: any[] = [];
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    // Prefer `content_blocks` (canonical, edited live) over the legacy `blocks` mirror.
    const blocks = Array.isArray(p?.content_blocks) ? p.content_blocks : Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      out.push(b);
      const nested = Array.isArray(b?.content_blocks) ? b.content_blocks : Array.isArray(b?.blocks) ? b.blocks : [];
      if (nested.length) out.push(...nested);
    }
  }
  return out;
}

/** True when the site links its Google Business Profile (meta field or a maps/GBP URL). */
export function hasGbpLink(data: any): boolean {
  const meta = data?.meta ?? {};
  if (String(meta.gbp_url ?? meta.google_business_url ?? meta.googleBusinessUrl ?? '').trim()) return true;
  const json = JSON.stringify(data ?? {});
  return /g\.page\/|business\.google\.|maps\.app\.goo\.gl|maps\.google\.|google\.[a-z.]+\/maps|place_id=/i.test(json);
}

/** Last 10 digits of a phone-like string ('' when not enough digits). */
function normPhone(s: string): string {
  const d = (s || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

/** True when more than one distinct phone number appears — a split NAP that hurts citations. */
export function napPhoneInconsistent(data: any): boolean {
  const phones = new Set<string>();
  const mp = normPhone(String(data?.meta?.contact?.phone ?? ''));
  if (mp) phones.add(mp);
  for (const b of collectBlocks(data)) {
    const p = normPhone(String(b?.content?.phone ?? ''));
    if (p) phones.add(p);
  }
  return phones.size > 1;
}

function firstLogoUrl(data: any): string | null {
  const meta = data?.meta ?? {};
  const fromMeta =
    meta.logo_url || meta.branding?.logo_url || data?.logo_url || data?.branding?.logo_url;
  if (fromMeta) return String(fromMeta);
  // Also accept a logo set directly on a header block (content/props), or a top-level
  // headerBlock — some templates store the logo there rather than in meta.
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.content_blocks) ? p.content_blocks : Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      if (b?.type !== 'header') continue;
      const url = b?.content?.logo_url || b?.props?.logo_url || b?.content?.logoUrl || b?.props?.logoUrl;
      if (url) return String(url);
    }
  }
  const hb = data?.headerBlock;
  const hbUrl = hb?.content?.logo_url || hb?.props?.logo_url || hb?.content?.logoUrl || hb?.props?.logoUrl;
  return hbUrl ? String(hbUrl) : null;
}

/** Analyze a pitch site's `data` for outreach readiness. Pure + deterministic. */
export function analyzeReadiness(data: any, industryKey: string): ReadinessResult {
  const blockers: ReadinessBlocker[] = [];
  const onPage = analyzeOnPage(data ?? {});
  const blocks = collectBlocks(data);
  const isFood = FOOD_INDUSTRIES.has(industryKey);

  // ── Hard: contact reachability (a claim CTA is useless without a way to call). ──
  if (!onPage.hasNap) {
    blockers.push({ id: 'no-nap', severity: 'hard', label: 'No business name / address / phone on the site' });
  }
  if (!onPage.hasClickToCall) {
    blockers.push({ id: 'no-click-to-call', severity: 'hard', label: 'No tap-to-call CTA' });
  }

  // ── Hard: hero copy still empty or scaffold placeholder. ──
  const hero = blocks.find((b) => b?.type === 'hero');
  const heroText = `${hero?.content?.headline ?? ''} ${hero?.content?.subheadline ?? ''}`.trim();
  if (hero && !String(hero?.content?.headline ?? '').trim()) {
    blockers.push({ id: 'hero-empty', severity: 'hard', label: 'Hero has no headline' });
  } else if (PLACEHOLDER_COPY.test(heroText)) {
    blockers.push({ id: 'hero-placeholder', severity: 'hard', label: 'Hero still has placeholder copy' });
  }

  if (isFood) {
    // ── Hard: food site needs a menu with real prices. ──
    const menu = blocks.find((b) => b?.type === 'menu');
    const sections: any[] = Array.isArray(menu?.content?.sections) ? menu.content.sections : [];
    const items = sections.flatMap((s) => (Array.isArray(s?.items) ? s.items : []));
    const priced = items.filter((it) => String(it?.price ?? '').trim() || Number(it?.price_cents) > 0);
    if (!menu || items.length === 0) {
      blockers.push({ id: 'no-menu', severity: 'hard', label: 'No menu on the site' });
    } else if (priced.length === 0) {
      blockers.push({ id: 'menu-unpriced', severity: 'hard', label: 'Menu prices not confirmed' });
    }
    if (PLACEHOLDER_COPY.test(JSON.stringify(items).slice(0, 5000))) {
      blockers.push({ id: 'menu-placeholder', severity: 'soft', label: 'Menu still has placeholder item copy' });
    }
  } else {
    // ── Hard: non-food site needs listed services. ──
    const svc = blocks.find((b) => b?.type === 'services' || b?.type === 'service_offer');
    const list: any[] = Array.isArray(svc?.content?.items)
      ? svc.content.items
      : Array.isArray(svc?.content?.services)
        ? svc.content.services
        : [];
    if (!svc || list.length === 0) {
      blockers.push({ id: 'no-services', severity: 'hard', label: 'No services listed' });
    }
  }

  // ── Soft: polish that helps rank/convert but shouldn't block a send. ──
  if (!firstLogoUrl(data)) {
    blockers.push({ id: 'no-logo', severity: 'soft', label: 'No logo' });
  }
  if (!onPage.hasLocalBusinessSchema) {
    blockers.push({ id: 'no-schema', severity: 'soft', label: 'No LocalBusiness schema' });
  }
  if (onPage.pageCount <= 1) {
    blockers.push({ id: 'single-page', severity: 'soft', label: 'Single page (no city/service pages)' });
  }
  if (onPage.titleLen > 0 && (onPage.titleLen < 15 || onPage.titleLen > 60)) {
    blockers.push({ id: 'weak-title', severity: 'soft', label: 'Page title is too short or too long' });
  }

  // ── Soft: citation readiness (local-SEO consistency signals). ──
  if (!hasGbpLink(data)) {
    blockers.push({ id: 'no-gbp', severity: 'soft', label: 'No Google Business Profile link' });
  }
  if (napPhoneInconsistent(data)) {
    blockers.push({ id: 'nap-inconsistent', severity: 'soft', label: 'Phone differs across the site (NAP inconsistent)' });
  }

  return { blockers, hardBlocked: blockers.some((b) => b.severity === 'hard') };
}

// ── Positive checklist (for the in-editor Readiness Coach) ────────────────────

export type ChecklistItem = {
  id: string;
  label: string; // what "done" looks like
  severity: BlockerSeverity;
  ok: boolean;
  hint?: string;
  /** Block type(s) this check maps to — the coach can jump to the block if one exists. */
  blockTypes?: string[];
  /** How to fix it (shown in the info popup when there's no block to jump to). */
  fix?: string;
  /** True when this item is the missing address, fixable by pointing at an org service area. */
  fixableByOrgAddress?: boolean;
  /** True when `ok` comes from an operator manual override (soft items only), not detection. */
  overridden?: boolean;
};

/**
 * The full SEO-readiness checklist for a pitch site — every applicable check with a pass/fail
 * flag, positively framed for checkboxes. Reuses analyzeReadiness so the gate + this view can
 * never disagree.
 */
/** The single highest-priority not-yet-done fix — what to do next + where it lives. */
export type NextStep = {
  id: string;
  cta: string;        // imperative button label ("List your services")
  label: string;      // what "done" looks like
  hint: string | null;
  blockType: string | null; // reveal target in the editor, if the fix is a block
  href?: string | null;     // deep link (filled in when a slug is known — see persistReadiness)
};

export type ReadinessScore = {
  pct: number;
  done: number;
  total: number;
  hardLeft: number;
  nextStep: NextStep | null;
};

// Imperative "do this next" labels keyed by checklist item id (the item's own label
// reads as a done-state, which is awkward on a button).
const NEXT_STEP_CTA: Record<string, string> = {
  nap: 'Add name, address & phone',
  call: 'Add a tap-to-call button',
  hero: 'Write a real hero headline',
  services: 'List your services',
  menu: 'Add a priced menu',
  'menu-copy': 'Fill in the menu copy',
  logo: 'Add a logo',
  schema: 'Add LocalBusiness schema',
  pages: 'Add a city/service page',
  title: 'Set the page title',
  gbp: 'Link Google Business Profile',
  'nap-consistent': 'Use one consistent phone',
};

/** The next step to take on a site: the first unmet check (required before recommended). */
export function readinessNextStep(data: any, industryKey: string): NextStep | null {
  const items = readinessChecklist(data, industryKey);
  const item =
    items.find((i) => i.severity === 'hard' && !i.ok) ??
    items.find((i) => i.severity === 'soft' && !i.ok) ??
    null;
  if (!item) return null;
  return {
    id: item.id,
    cta: NEXT_STEP_CTA[item.id] ?? item.label,
    label: item.label,
    hint: item.hint ?? null,
    blockType: item.blockTypes?.[0] ?? null,
  };
}

/**
 * A single SEO-readiness score for a site — the same number the in-editor Readiness
 * coach shows (done / total of the checklist) + the next step to take. Pure; safe to
 * call per row in a list.
 */
export function readinessScore(data: any, industryKey: string): ReadinessScore {
  const items = readinessChecklist(data, industryKey);
  const total = items.length;
  const done = items.filter((i) => i.ok).length;
  const hardLeft = items.filter((i) => i.severity === 'hard' && !i.ok).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const item =
    items.find((i) => i.severity === 'hard' && !i.ok) ??
    items.find((i) => i.severity === 'soft' && !i.ok) ??
    null;
  const nextStep: NextStep | null = item
    ? {
        id: item.id,
        cta: NEXT_STEP_CTA[item.id] ?? item.label,
        label: item.label,
        hint: item.hint ?? null,
        blockType: item.blockTypes?.[0] ?? null,
      }
    : null;
  return { pct, done, total, hardLeft, nextStep };
}

export function readinessChecklist(data: any, industryKey: string): ChecklistItem[] {
  const { blockers } = analyzeReadiness(data, industryKey);
  const failing = new Set(blockers.map((b) => b.id));
  const isFood = FOOD_INDUSTRIES.has(industryKey);

  const defs: { id: string; ids: string[]; label: string; severity: BlockerSeverity; hint?: string; blockTypes?: string[]; fix?: string; fixableByOrgAddress?: boolean }[] = [
    { id: 'nap', ids: ['no-nap'], label: 'Business name, address & phone shown', severity: 'hard', fixableByOrgAddress: true, blockTypes: ['location', 'contact', 'contact_form'], hint: 'A visible NAP (name/address/phone) is core local-SEO + lets prospects reach the business.', fix: 'Add a Location or Contact block and fill in the address + phone. Tip: on the Prospects page, the Growth Coach can auto-fill your org’s service area.' },
    { id: 'call', ids: ['no-click-to-call'], label: 'Tap-to-call button', severity: 'hard', blockTypes: ['order_bar', 'location', 'contact'], hint: 'A one-tap call CTA is the top mobile conversion action for local services.', fix: 'Add an Order Bar (mobile call/CTA), or set a phone + tap-to-call CTA on the Location/Contact block.' },
    { id: 'hero', ids: ['hero-empty', 'hero-placeholder'], label: 'Real hero headline (no placeholder)', severity: 'hard', blockTypes: ['hero'], hint: 'The hero is the first thing Google + visitors read — make it specific to the business + city.', fix: 'Edit the Hero block: write a specific headline for this business + city (no placeholder text).' },
    ...(isFood
      ? [
          { id: 'menu', ids: ['no-menu', 'menu-unpriced'], label: 'Menu with confirmed prices', severity: 'hard' as BlockerSeverity, blockTypes: ['menu'], hint: 'A priced menu is what makes a restaurant site rank + convert to orders.', fix: 'Add a Menu block with sections, items, and confirmed prices.' },
          { id: 'menu-copy', ids: ['menu-placeholder'], label: 'Menu item copy filled in', severity: 'soft' as BlockerSeverity, blockTypes: ['menu'], fix: 'Open the Menu block and replace the placeholder item names/descriptions with the real menu.' },
        ]
      : [{ id: 'services', ids: ['no-services'], label: 'Services listed', severity: 'hard' as BlockerSeverity, blockTypes: ['services', 'service_offer'], hint: 'Listing services gives Google the keywords to rank you for + tells visitors what you do.', fix: 'Add a Services block and list the services this business offers.' }]),
    { id: 'logo', ids: ['no-logo'], label: 'Logo', severity: 'soft', hint: 'A logo builds trust + brand recognition on the site, postcard, and search snippet.', fix: 'Upload a logo in the Header settings (the header/branding editor), or generate one from the toolbar.' },
    { id: 'schema', ids: ['no-schema'], label: 'LocalBusiness schema', severity: 'soft', hint: 'Structured data helps Google understand the business and its service area.', fix: 'Structured data is emitted from your site’s meta — add a Location block with a real address (that populates LocalBusiness), or set it in Site/SEO settings.' },
    { id: 'pages', ids: ['single-page'], label: 'A city/service subpage', severity: 'soft', hint: 'A dedicated city/service page is a strong extra ranking surface for "<service> in <city>".', fix: 'Add a page from the Pages menu (e.g. “/plumbing-in-renton”) targeting one service + the city.' },
    { id: 'title', ids: ['weak-title'], label: 'Page title 15–60 characters', severity: 'soft', hint: 'The <title> is the biggest single on-page ranking + click-through lever.', fix: 'Set the page title (15–60 chars, include the service + city) in the SEO/Site settings.' },
    { id: 'gbp', ids: ['no-gbp'], label: 'Google Business Profile linked', severity: 'soft', hint: 'A linked GBP is the strongest local-SEO ranking + citation signal for a local business.', fix: 'Add your Google Business Profile URL in Site/SEO settings (meta.gbp_url), or link it from the Contact/Location block.' },
    { id: 'nap-consistent', ids: ['nap-inconsistent'], label: 'Consistent phone across the site', severity: 'soft', hint: 'Citations must match — a different phone in different places splits your NAP and hurts local rank.', fix: 'Use the same phone number everywhere (hero CTA, Contact, Location, footer).' },
  ];

  // Operator manual overrides — soft/recommended items an operator has marked done even
  // when auto-detection can't see it (e.g. a GBP linked off-site, schema handled elsewhere).
  // Never lets a HARD required check be faked — those must genuinely pass.
  const overrides: string[] = Array.isArray(data?.meta?.readiness_overrides)
    ? data.meta.readiness_overrides.map(String)
    : [];

  return defs.map((d) => {
    const autoOk = !d.ids.some((x) => failing.has(x));
    const overridden = !autoOk && d.severity === 'soft' && overrides.includes(d.id);
    return {
      id: d.id,
      label: d.label,
      severity: d.severity,
      ok: autoOk || overridden,
      overridden,
      hint: d.hint,
      blockTypes: d.blockTypes,
      fix: d.fix,
      fixableByOrgAddress: d.fixableByOrgAddress,
    };
  });
}
