// lib/brand/industryMarks.ts
//
// A per-industry icon mark, so a plumber's tab does not show the QuickSites logo.
//
// ⚠️ DRAWN, NOT GENERATED, AND THAT IS A COST AND A CORRECTNESS DECISION BOTH.
//
//   • Cost: a generated logo is ~$0.05 per site. Across the fleet that is real money for
//     something that renders at 16px.
//   • Crispness: a favicon is 16–32px. A raster from an image model is mush at that size;
//     a path is exact at any size.
//   • Honesty: image models put LETTERING on things. Twice in one day this repo shipped
//     generated art with invented words in it — "PEST CONTROL" on a backdrop, "PRÈSSURE" on a
//     hero. A logo with a misspelt word on a real business's tab is worse than a generic one.
//   • Colour: these inherit `currentColor`, so each site tints its own mark with its theme
//     accent for free. A generated PNG is stuck with whatever palette it was born with.
//
// Every mark is drawn on a 24×24 grid, stroke-based, and must read as a silhouette at 16px —
// which rules out interior detail. If a shape needs more than about six strokes to be
// recognisable, it is the wrong shape for a favicon.
//
// Coverage is deliberately partial. The industries below are the ones that actually carry sites
// today; everything else gets `generic`, which is a decent storefront rather than a bad guess.
// Adding one is a single entry — no build step, no asset, no spend.

export type IndustryMark = {
  /** Inner SVG markup on a 24×24 viewBox. Strokes use currentColor. */
  path: string;
  /** Short label, used for the icon's aria-label / alt text. */
  label: string;
};

const S = 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"';

export const INDUSTRY_MARKS: Record<string, IndustryMark> = {
  // A storefront: awning + door. The fallback, and genuinely right for most retail.
  generic: {
    label: 'Storefront',
    path: `<path ${S} d="M3 9l1.8-4.2A1.5 1.5 0 0 1 6.2 4h11.6a1.5 1.5 0 0 1 1.4.8L21 9"/><path ${S} d="M4.5 9v10.5h15V9"/><path ${S} d="M10 19.5v-5h4v5"/>`,
  },

  restaurant: {
    label: 'Restaurant',
    path: `<path ${S} d="M7 3v8a2.5 2.5 0 0 0 5 0V3"/><path ${S} d="M9.5 11v10"/><path ${S} d="M17.5 3c-1.6 1.2-2.4 3-2.4 5.2 0 1.7.8 2.8 2.4 3.1V21"/>`,
  },

  lemonade_stand: {
    label: 'Lemonade stand',
    path: `<path ${S} d="M7 8h10l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3h-4.6a1.5 1.5 0 0 1-1.5-1.3z"/><path ${S} d="M17 10.5h1.8a1.7 1.7 0 0 1 0 3.4H16.6"/><path ${S} d="M9.5 5.2c.9-1.4 3.6-1.6 5 0"/>`,
  },

  towing: {
    label: 'Towing',
    path: `<path ${S} d="M2.5 16.5V9h8l3 3.5h6.5v4"/><circle ${S} cx="7" cy="18" r="1.9"/><circle ${S} cx="17.5" cy="18" r="1.9"/><path ${S} d="M10.5 9L16 3.5"/>`,
  },

  auto_repair: {
    label: 'Auto repair',
    path: `<path ${S} d="M3 16v-3.2l2-4.4A2 2 0 0 1 6.8 7h10.4a2 2 0 0 1 1.8 1.4l2 4.4V16"/><path ${S} d="M5 12.8h14"/><circle ${S} cx="7" cy="16.5" r="1.6"/><circle ${S} cx="17" cy="16.5" r="1.6"/>`,
  },

  // A tap with a falling drop. The first attempt was a bare pipe elbow and read as an abstract
  // bracket at any size — a mark that needs a caption is not a mark.
  plumbing: {
    label: 'Plumbing',
    path: `<path ${S} d="M4 6.5h6.5v4H4z"/><path ${S} d="M10.5 8.5h4.6a2.4 2.4 0 0 1 2.4 2.4v2.3"/><path ${S} d="M17.5 17.2c0 1.2-.9 2.1-2 2.1s-2-.9-2-2.1c0-1.2 2-3.4 2-3.4s2 2.2 2 3.4z"/>`,
  },

  hvac: {
    label: 'Heating & air',
    path: `<path ${S} d="M12 3v18"/><path ${S} d="M4.2 7.5l15.6 9"/><path ${S} d="M19.8 7.5l-15.6 9"/><circle ${S} cx="12" cy="12" r="2.4"/>`,
  },

  electrical: {
    label: 'Electrical',
    path: `<path ${S} d="M13.6 2.5L5 13.4h5.6L9.9 21.5 19 10.4h-5.8z"/>`,
  },

  roofing: {
    label: 'Roofing',
    path: `<path ${S} d="M2.5 12L12 4l9.5 8"/><path ${S} d="M5.5 10.6V20h13v-9.4"/><path ${S} d="M10 20v-4.6h4V20"/>`,
  },

  roof_cleaning: {
    label: 'Roof cleaning',
    path: `<path ${S} d="M2.5 12L12 4l9.5 8"/><path ${S} d="M5.5 10.6V20h13v-9.4"/><path ${S} d="M9 14.5c.9.9.9 2.1 0 3M12.5 13.6c1.3 1.3 1.3 3.1 0 4.4"/>`,
  },

  general_contractor: {
    label: 'Contractor',
    path: `<path ${S} d="M14.7 6.3a3.6 3.6 0 0 0 4.8 4.6l-8 8a2 2 0 0 1-2.9-2.8l8-8z"/><path ${S} d="M5.5 5.5l3.6 3.6"/><path ${S} d="M4 9.4l3.6-3.6"/>`,
  },

  landscaping: {
    label: 'Landscaping',
    path: `<path ${S} d="M12 21v-7"/><path ${S} d="M12 14c-3.4 0-5.6-2.2-5.6-5.4C9.8 8.6 12 10.8 12 14z"/><path ${S} d="M12 14c3.4 0 5.6-2.2 5.6-5.4C14.2 8.6 12 10.8 12 14z"/><path ${S} d="M6 21h12"/>`,
  },

  // ⚠️ A KEY, NOT A HOUSE. The first version was a house and `roofing` is also a house — at 16px
  // they were the same icon, which is worse than one being generic: two industries sharing a mark
  // teaches a visitor nothing and reads as a bug.
  real_estate: {
    label: 'Real estate',
    path: `<circle ${S} cx="8.2" cy="8.2" r="4.2"/><path ${S} d="M11.2 11.2L20 20"/><path ${S} d="M17.2 17.2l-2.2 2.2"/><path ${S} d="M14.6 14.6l-2 2"/>`,
  },

  personal: {
    label: 'Personal site',
    path: `<circle ${S} cx="12" cy="8.4" r="3.6"/><path ${S} d="M4.8 20.2a7.6 7.6 0 0 1 14.4 0"/>`,
  },

  author: {
    label: 'Author',
    path: `<path ${S} d="M4 5.2A11 11 0 0 1 12 7.4 11 11 0 0 1 20 5.2V18a11 11 0 0 0-8 2.2A11 11 0 0 0 4 18z"/><path ${S} d="M12 7.4v12.8"/>`,
  },

  retail_thrift: {
    label: 'Thrift shop',
    path: `<path ${S} d="M8.5 4.5L5 6.6l1.4 3 1.6-.8V20h8V8.8l1.6.8 1.4-3-3.5-2.1"/><path ${S} d="M9.6 4.5a2.4 2.4 0 0 0 4.8 0"/>`,
  },

  fitness: {
    label: 'Fitness',
    path: `<path ${S} d="M4 9.5v5M20 9.5v5M7 7v10M17 7v10"/><path ${S} d="M7 12h10"/>`,
  },

  photography: {
    label: 'Photography',
    path: `<path ${S} d="M3.5 8.5h3.2l1.4-2.2h7.8l1.4 2.2h3.2v10.2H3.5z"/><circle ${S} cx="12" cy="13.2" r="3.2"/>`,
  },

  // Scissors. The leaf-and-stem version was a near-twin of `landscaping` — same problem as the
  // two houses, and spa-leaf is the more replaceable of the two meanings.
  salon_spa: {
    label: 'Salon & spa',
    path: `<circle ${S} cx="6.4" cy="17.6" r="2.6"/><circle ${S} cx="17.6" cy="17.6" r="2.6"/><path ${S} d="M8.4 15.8L18.5 4"/><path ${S} d="M15.6 15.8L5.5 4"/>`,
  },
};

/** Aliases so near-synonym industry keys share a mark rather than falling back to generic. */
const ALIASES: Record<string, string> = {
  window_washing: 'roof_cleaning',
  pressure_washing: 'roof_cleaning',
  carpet_cleaning: 'roof_cleaning',
  concrete: 'general_contractor',
  paving: 'general_contractor',
  fencing: 'general_contractor',
  deck_builder: 'general_contractor',
  siding: 'roofing',
  retaining_walls: 'general_contractor',
  epoxy_flooring: 'general_contractor',
  painting: 'general_contractor',
  junk_removal: 'towing',
  moving: 'towing',
  auto_dealer: 'auto_repair',
  windshield_repair: 'auto_repair',
  real_estate_agency: 'real_estate',
  medical_dental: 'personal',
  legal: 'author',
  faith: 'author',
};

export function markFor(industryKey?: string | null): IndustryMark {
  const key = String(industryKey || '').toLowerCase();
  return INDUSTRY_MARKS[key] ?? INDUSTRY_MARKS[ALIASES[key] ?? ''] ?? INDUSTRY_MARKS.generic;
}

/**
 * A complete SVG document for the mark, tinted with `color`.
 *
 * `padding` matters: a favicon is read at 16px against a browser's own chrome, so the mark needs
 * a little air or it reads as a smudge touching the edges of its box.
 */
export function markSvg(industryKey: string | null | undefined, color = '#0ea5e9', size = 64): string {
  const m = markFor(industryKey);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"`,
    ` role="img" aria-label="${m.label}" style="color:${color}">`,
    m.path,
    '</svg>',
  ].join('');
}
