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
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      out.push(b);
      if (Array.isArray(b?.blocks)) out.push(...b.blocks);
    }
  }
  return out;
}

function firstLogoUrl(data: any): string | null {
  const meta = data?.meta ?? {};
  return (
    meta.logo_url ||
    meta.branding?.logo_url ||
    data?.logo_url ||
    data?.branding?.logo_url ||
    null
  );
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

  return { blockers, hardBlocked: blockers.some((b) => b.severity === 'hard') };
}
