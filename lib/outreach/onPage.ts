// lib/outreach/onPage.ts
//
// Pure on-page SEO signal extraction from a pitch site's template `data` (no external
// call). Feeds the ranking recommendations engine. Heuristic, not a full crawler.

export type OnPageSignals = {
  pageCount: number;
  hasLocalBusinessSchema: boolean;
  hasCityServicePage: boolean; // any page beyond the homepage
  hasNap: boolean; // name/address/phone present (contact or location block)
  hasClickToCall: boolean; // a tap-to-call CTA
  hasHours: boolean;
  titleLen: number;
};

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

export function analyzeOnPage(data: any): OnPageSignals {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const blocks = collectBlocks(data);
  const types = new Set(blocks.map((b) => String(b?.type || '')));
  const meta = data?.meta ?? {};

  const contact = blocks.find((b) => b?.type === 'contact' || b?.type === 'location');
  const hasNap = !!(
    meta?.contact?.phone ||
    meta?.contact?.address ||
    contact?.content?.phone ||
    contact?.content?.address
  );

  const hasClickToCall = blocks.some(
    (b) =>
      b?.type === 'order_bar' ||
      b?.content?.cta_action === 'call_phone' ||
      !!b?.content?.cta_phone ||
      !!b?.content?.phone,
  );

  const title = String(meta?.title || meta?.seo?.title || data?.business_name || '');

  return {
    pageCount: pages.length,
    hasLocalBusinessSchema: !!(meta?.schema?.localBusiness || meta?.local_business_schema || meta?.jsonld),
    hasCityServicePage: pages.length > 1,
    hasNap,
    hasClickToCall,
    hasHours: types.has('hours'),
    titleLen: title.length,
  };
}
