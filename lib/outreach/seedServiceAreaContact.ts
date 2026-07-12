// lib/outreach/seedServiceAreaContact.ts
//
// Auto-point an org-branded pitch site at its org's service area — but only until a real
// address exists ("auto until edited"). Pure: takes a template `data` blob + a service-area
// label/phone, returns the patched data + whether anything changed. The route commits the
// result through the sanctioned commit RPC. See lib/outreach/orgServiceArea.ts.

import { createDefaultBlock } from '@/lib/createDefaultBlock';

type AnyBlock = { type?: string; content?: any; blocks?: AnyBlock[] };

/** Every block across every page, flattened (incl. one level of nesting). */
function allBlocks(data: any): AnyBlock[] {
  const out: AnyBlock[] = [];
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

/** True when the site already shows a street/textual address somewhere (→ don't seed). */
export function hasOwnAddress(data: any): boolean {
  const metaAddr = String(data?.meta?.contact?.address ?? '').trim();
  if (metaAddr) return true;
  return allBlocks(data).some(
    (b) => (b?.type === 'location' || b?.type === 'contact' || b?.type === 'contact_form') && String(b?.content?.address ?? '').trim(),
  );
}

export type SeedResult = { data: any; changed: boolean };

/**
 * Seed the pitch site's contact with a service-area label + phone, only when it has no
 * address of its own. Sets `meta.contact`, fills an existing location/contact block, and —
 * if the site has no address-bearing block at all — appends a lightweight `location` block
 * so the service area actually renders (non-food scaffolds ship without one).
 */
export function seedServiceAreaContact(data: any, area: { label: string; phone?: string | null }): SeedResult {
  if (!area?.label || hasOwnAddress(data)) return { data, changed: false };

  // Clone so callers/tests keep the input intact.
  const next = typeof structuredClone === 'function' ? structuredClone(data ?? {}) : JSON.parse(JSON.stringify(data ?? {}));
  const phone = (area.phone ?? '').trim();

  // 1) meta.contact — read by analyzeOnPage (clears the NAP readiness blocker) + some SEO.
  next.meta = next.meta ?? {};
  next.meta.contact = { ...(next.meta.contact ?? {}), address: area.label };
  if (phone && !String(next.meta.contact.phone ?? '').trim()) next.meta.contact.phone = phone;

  // 2) Fill an existing location/contact block, else append a service-area location block.
  const blocks = allBlocks(next);
  const target = blocks.find((b) => b?.type === 'location' || b?.type === 'contact' || b?.type === 'contact_form');
  if (target) {
    target.content = target.content ?? {};
    target.content.address = area.label;
    if (phone && !String(target.content.phone ?? '').trim()) target.content.phone = phone;
    if (target.type === 'location') target.content.show_map = false; // service area → no street map
  } else {
    if (!Array.isArray(next.pages)) next.pages = [{ blocks: [] }];
    if (!next.pages.length) next.pages.push({ blocks: [] });
    if (!Array.isArray(next.pages[0].blocks)) next.pages[0].blocks = [];
    const loc: any = createDefaultBlock('location');
    loc.content = { ...loc.content, title: 'Service Area', address: area.label, phone, show_map: false };
    next.pages[0].blocks.push(loc);
  }

  return { data: next, changed: true };
}
