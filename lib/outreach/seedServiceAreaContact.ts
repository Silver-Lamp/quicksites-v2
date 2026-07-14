// lib/outreach/seedServiceAreaContact.ts
//
// Auto-point an org-branded pitch site at its org's service area — but only until a real
// address exists ("auto until edited"). Pure: takes a template `data` blob + a service-area
// label/phone, returns the patched data + whether anything changed. The route commits the
// result through the sanctioned commit RPC. See lib/outreach/orgServiceArea.ts.

import { createDefaultBlock } from '@/lib/createDefaultBlock';

type AnyBlock = { type?: string; content?: any; blocks?: AnyBlock[]; content_blocks?: AnyBlock[] };

/** The block array a page renders from — canonical `content_blocks`, legacy `blocks` fallback. */
function pageBlocks(p: any): AnyBlock[] {
  return Array.isArray(p?.content_blocks) ? p.content_blocks : Array.isArray(p?.blocks) ? p.blocks : [];
}

/** Every block across every page, flattened (incl. one level of nesting). */
function allBlocks(data: any): AnyBlock[] {
  const out: AnyBlock[] = [];
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    for (const b of pageBlocks(p)) {
      out.push(b);
      const nested = Array.isArray(b?.content_blocks) ? b.content_blocks : Array.isArray(b?.blocks) ? b.blocks : [];
      if (nested.length) out.push(...nested);
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

/** True when the site already has a contact-form recipient of its own (→ don't seed email). */
export function hasOwnContactEmail(data: any): boolean {
  const m = data?.meta ?? {};
  return !!(
    String(m?.contact_email ?? '').trim() ||
    String(m?.contact?.email ?? '').trim() ||
    String(m?.identity?.contact?.email ?? '').trim()
  );
}

export type SeedResult = { data: any; changed: boolean; addressSet: boolean; emailSet: boolean };

/**
 * Seed an unclaimed campaign pitch site with the org's inheritable identity — a service-area
 * label + phone (address), and the contact-form recipient (email) — each only when the site
 * has none of its own ("auto until edited"). For the address, fills an existing
 * location/contact block or appends a service-area `location` block (non-food scaffolds ship
 * without one). For the email, sets `meta.contact_email`, which resolveContactRecipient reads
 * so leads from the live site reach the operator instead of a dead address.
 */
export function seedServiceAreaContact(
  data: any,
  area: { label?: string | null; phone?: string | null; email?: string | null },
  opts: { force?: boolean } = {},
): SeedResult {
  // force overwrites an existing address/email (the editor "re-find" tool); by default we
  // seed only when the site has none of its own ("auto until edited").
  const force = !!opts.force;
  const wantAddress = !!area?.label && (force || !hasOwnAddress(data));
  const wantEmail = !!area?.email && (force || !hasOwnContactEmail(data));
  if (!wantAddress && !wantEmail) return { data, changed: false, addressSet: false, emailSet: false };

  // Clone so callers/tests keep the input intact.
  const next = typeof structuredClone === 'function' ? structuredClone(data ?? {}) : JSON.parse(JSON.stringify(data ?? {}));
  next.meta = next.meta ?? {};

  if (wantEmail) {
    // Where contact-form submissions go until the operator sets their own.
    next.meta.contact_email = area.email;
  }

  if (wantAddress) {
    const phone = (area.phone ?? '').trim();
    const label = area.label as string;

    // 1) meta.contact — read by analyzeOnPage (clears the NAP readiness blocker) + some SEO.
    next.meta.contact = { ...(next.meta.contact ?? {}), address: label };
    if (phone && !String(next.meta.contact.phone ?? '').trim()) next.meta.contact.phone = phone;

    // 2) Fill an existing location/contact block, else append a service-area location block.
    const target = allBlocks(next).find((b) => b?.type === 'location' || b?.type === 'contact' || b?.type === 'contact_form');
    if (target) {
      target.content = target.content ?? {};
      target.content.address = label;
      if (phone && !String(target.content.phone ?? '').trim()) target.content.phone = phone;
      if (target.type === 'location') target.content.show_map = false; // service area → no street map
    } else {
      if (!Array.isArray(next.pages) || !next.pages.length) next.pages = [{}];
      const page = next.pages[0];
      const arr = pageBlocks(page);
      const loc: any = createDefaultBlock('location');
      loc.content = { ...loc.content, title: 'Service Area', address: label, phone, show_map: false };
      arr.push(loc);
      // Write both fields so the canonical + legacy readers + the live editor all agree.
      page.content_blocks = arr;
      page.blocks = arr;
    }
  }

  return { data: next, changed: true, addressSet: wantAddress, emailSet: wantEmail };
}
