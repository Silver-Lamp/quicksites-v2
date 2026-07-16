// lib/builder/restaurantUxRefresh.ts
//
// "Refresh UX" for existing restaurant drafts: re-apply the scaffold-level
// improvements that new builds get automatically (see the food branch of
// industryScaffold.ts), WITHOUT clobbering real content (OCR'd menus, hours,
// contact info, custom copy). Every step is idempotent and only fires when the
// draft still carries the OLD default it upgrades — an operator-customized value
// is left alone. Add future "apply to all restaurant sites" changes as steps here
// and the Refresh UX button picks them up.
//
// Pure: data in → { data, headerBlock, footerBlock, changed, applied }. The server
// wrapper (lib/outreach/restaurantDomains.ts#refreshRestaurantUx) loads/commits via
// the sanctioned commit RPC.

const FOOD_NAV = [
  { label: 'Menu', href: '#menu', appearance: 'default' },
  { label: 'Location & Hours', href: '#location', appearance: 'default' },
  { label: 'Contact', href: '#contact', appearance: 'default' },
];

/** Old default chrome links that indicate the nav was never customized. */
const STALE_NAV_HREFS = new Set(['/services', '/contact']);

export type UxRefreshResult = {
  data: any;
  headerBlock: any | null;
  footerBlock: any | null;
  changed: boolean;
  /** Which upgrade steps fired (for the toast / audit). */
  applied: string[];
};

const clone = (v: any) => JSON.parse(JSON.stringify(v ?? null));

function phoneFromBlocks(blocks: any[]): string | null {
  for (const type of ['location', 'order_bar', 'contact_form']) {
    const b = blocks.find((x) => x?.type === type);
    const p = b?.content?.phone;
    if (typeof p === 'string' && p.trim()) return p.trim();
  }
  return null;
}

export function applyRestaurantUxRefresh(input: {
  data: any;
  headerBlock?: any | null;
  footerBlock?: any | null;
}): UxRefreshResult {
  const data = clone(input.data) ?? {};
  const applied: string[] = [];

  const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
  const page0 = pages[0];
  const blocks: any[] = Array.isArray(page0?.blocks) ? page0.blocks : [];

  // 1) Drop FAQ blocks — removed from the restaurant scaffold 2026-07 (diners want
  //    menu/hours/order; generic Q&A is filler).
  const withoutFaq = blocks.filter((b) => b?.type !== 'faq');
  if (withoutFaq.length !== blocks.length) {
    page0.blocks = withoutFaq;
    if (Array.isArray(page0.content_blocks)) page0.content_blocks = withoutFaq; // legacy readers
    applied.push('removed_faq');
  }
  const liveBlocks: any[] = page0?.blocks ?? blocks;

  // 2) Hero CTA → #menu, only when it was never pointed anywhere real.
  const hero = liveBlocks.find((b) => b?.type === 'hero');
  const hasMenu = liveBlocks.some((b) => b?.type === 'menu');
  if (hero?.content && hasMenu && 'cta_link' in hero.content) {
    const cur = String(hero.content.cta_link ?? '').trim();
    if (cur === '' || cur === '/') {
      hero.content.cta_link = '#menu';
      applied.push('hero_cta_menu');
    }
  }

  // 3) Contact form: upgrade only the untouched default title.
  const contact = liveBlocks.find((b) => b?.type === 'contact_form');
  if (contact?.content && contact.content.title === 'Contact Us') {
    contact.content.title = 'Questions? Catering? Get in touch';
    applied.push('contact_catering_title');
  }

  // 4) Header/footer nav: swap the stale default page links (Services/Contact pages a
  //    one-page ordering site doesn't have) for same-page anchors. Fires only when a
  //    stale default link is present — customized navs are untouched.
  const headerBlock = clone(input.headerBlock ?? data?.headerBlock ?? null);
  const footerBlock = clone(input.footerBlock ?? data?.footerBlock ?? null);

  const navIsStale = (links: any[]) => links.some((l) => STALE_NAV_HREFS.has(String(l?.href ?? '')));
  if (headerBlock?.content && Array.isArray(headerBlock.content.nav_items) && navIsStale(headerBlock.content.nav_items)) {
    headerBlock.content.nav_items = FOOD_NAV.map((l) => ({ ...l }));
    applied.push('header_anchor_nav');
  }
  if (footerBlock?.content && Array.isArray(footerBlock.content.links) && navIsStale(footerBlock.content.links)) {
    footerBlock.content.links = FOOD_NAV.map((l) => ({ ...l }));
    applied.push('footer_anchor_nav');
  }

  // 5) Placeholder logo: restaurants default to NO logo (the header renders their
  //    name as a wordmark instead) — a placehold.co box reads as "your branding is
  //    incomplete/ours to redo". Clears ONLY the untouched stock placeholder; a real
  //    uploaded/generated logo is the owner's choice and stays.
  const PLACEHOLDER_LOGO_RX = /placehold\.co|placeholder\.com/i;
  if (headerBlock?.content && typeof headerBlock.content.logo_url === 'string' && PLACEHOLDER_LOGO_RX.test(headerBlock.content.logo_url)) {
    headerBlock.content.logo_url = '';
    applied.push('header_placeholder_logo_removed');
  }

  // 6) Footer tap-to-call: add when the site knows its phone and the footer lacks one.
  const phone = phoneFromBlocks(liveBlocks);
  if (phone && footerBlock?.content && Array.isArray(footerBlock.content.links)) {
    const hasTel = footerBlock.content.links.some((l: any) => String(l?.href ?? '').startsWith('tel:'));
    const digits = phone.replace(/[^\d+]/g, '');
    if (!hasTel && digits) {
      footerBlock.content.links.push({ label: `Call ${phone}`, href: `tel:${digits}`, appearance: 'default' });
      applied.push('footer_tap_to_call');
    }
  }

  // Keep the data-bag copies in sync when chrome changed.
  if (applied.some((k) => k.startsWith('header'))) data.headerBlock = headerBlock;
  if (applied.some((k) => k.startsWith('footer'))) data.footerBlock = footerBlock;

  return { data, headerBlock, footerBlock, changed: applied.length > 0, applied };
}
