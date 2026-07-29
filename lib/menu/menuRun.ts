// lib/menu/menuRun.ts
//
// The "menu run": an operator drives a short route, picks up a paper menu at each restaurant,
// photographs it, and leaves a postcard.
//
// WHY IT EXISTS. Four of the five restaurants on renton-restaurant.com had no menu we could
// honestly publish. Not for want of trying — the OCR pipeline ran against all of them and
// found ZERO menus among their Google listing photos (food plates, interiors, storefronts),
// and every one is `(no website)`, which is exactly why they were listing-import prospects.
// There is no online source. A person walking through the door is the only source.
//
// The OCR half already works and is simply starving: given real menu photographs it produced
// 32 accurate items for Eyman's Pizza. This closes the gap between "the pipeline works" and
// "the pipeline has something to read".
//
// The postcard is the second half and the reason the order matters: a walker leaves a card
// saying "your menu is already live at <slug>.delivered.menu — scan to claim it", which is a
// far stronger pitch than a cold "we could build you a site". It's true by the time they read
// it, because the OCR runs the same day.
//
// Operator-only by design. This is not a public gig: it involves driving between stops and
// speaking for QuickSites at a stranger's counter, neither of which belongs in an unpaid
// public gig board.
import { optimizeRoute } from '@/lib/route/optimizeRoute';
import { hasRealMenu } from '@/lib/menu/menuBlocks';

export type MenuRunStop = {
  prospectId: string;
  templateId: string;
  slug: string;
  businessName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  /** Live URL the postcard's QR points at. */
  siteUrl: string;
  /** Already has an honest menu — shown as done rather than hidden, so a run reads complete. */
  done: boolean;
};

type ProspectRow = {
  id: string;
  business_name: string | null;
  template_id: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
};

type TemplateRow = { id: string; slug: string; data: any };

/**
 * Build the stop list for a campaign, ordered by a nearest-neighbour route from `start`.
 *
 * Stops that already have a real menu are kept and flagged `done` rather than dropped: a run
 * where two of five are finished should look like a run with two finished, not a shorter run.
 */
export function buildMenuRun(
  prospects: ProspectRow[],
  templates: TemplateRow[],
  menuBaseDomain: string,
  start?: { latitude: number; longitude: number } | null,
): MenuRunStop[] {
  const byId = new Map(templates.map((t) => [t.id, t]));

  const stops: MenuRunStop[] = prospects
    .map((p) => {
      const t = byId.get(p.template_id);
      if (!t?.slug) return null;
      return {
        prospectId: p.id,
        templateId: p.template_id,
        slug: t.slug,
        businessName: p.business_name || t.slug,
        address: p.address ?? null,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        phone: p.phone ?? null,
        siteUrl: `https://${t.slug}.${menuBaseDomain}`,
        done: hasRealMenu(t.data),
      };
    })
    .filter((s): s is MenuRunStop => !!s);

  const locatable = stops.filter((s) => s.latitude != null && s.longitude != null);
  const unlocatable = stops.filter((s) => s.latitude == null || s.longitude == null);

  // Without a start point there is nothing to optimise from; alphabetical beats arbitrary.
  if (!start || !locatable.length) {
    return [...stops].sort((a, b) => a.businessName.localeCompare(b.businessName));
  }

  const ordered = optimizeRoute(
    start.latitude,
    start.longitude,
    locatable as Array<MenuRunStop & { latitude: number; longitude: number }>,
  );
  // Stops we can't place go last — they still need visiting, they just can't be sequenced.
  return [...ordered, ...unlocatable];
}

/** Postcard line for a stop. True only because the OCR runs the same day as the visit. */
export function postcardLineFor(stop: MenuRunStop): string {
  return stop.done
    ? `${stop.businessName}: your menu is live at ${stop.siteUrl} — scan to claim it.`
    : `${stop.businessName}: your page is live at ${stop.siteUrl} — scan to claim it.`;
}
