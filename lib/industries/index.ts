// lib/industries/index.ts

/** Internal keys we use in code & generators */
export type IndustryKey =
  | 'towing'
  | 'window_washing'
  | 'roof_cleaning'
  | 'landscaping'
  | 'hvac'
  | 'plumbing'
  | 'electrical'
  | 'auto_repair'
  | 'carpet_cleaning'
  | 'moving'
  | 'pest_control'
  | 'painting'
  | 'general_contractor'
  | 'real_estate'
  | 'restaurant'
  | 'salon_spa'
  | 'fitness'
  | 'photography'
  | 'legal'
  | 'medical_dental'
  | 'pressure_washing'
  | 'junk_removal'
  // retail / maker / resale
  | 'retail_boutique'
  | 'retail_home_goods'
  | 'retail_electronics'
  | 'retail_thrift'
  | 'crafts'
  | 'handmade'
  | 'etsy_style'
  | 'gifts_stationery'
  | 'artisan_goods'
  | 'art_supplies'
  | 'antiques_vintage'
  | 'collectibles'
  | 'pet_boutique'
  | 'pop_up_shop'
  | 'farmers_market_vendor'
  | 'online_reseller'
  | 'print_on_demand'
  | 'custom_apparel'
  | 'other';

/** Key → Label (what we display / store in templates.industry) */
export const INDUSTRIES: ReadonlyArray<{ key: IndustryKey; label: string }> = [
  { key: 'towing',               label: 'Towing' },
  { key: 'window_washing',       label: 'Window Washing' },
  { key: 'roof_cleaning',        label: 'Roof Cleaning' },
  { key: 'landscaping',          label: 'Landscaping' },
  { key: 'hvac',                 label: 'HVAC' },
  { key: 'plumbing',             label: 'Plumbing' },
  { key: 'electrical',           label: 'Electrical' },
  { key: 'auto_repair',          label: 'Auto Repair' },
  { key: 'carpet_cleaning',      label: 'Carpet Cleaning' },
  { key: 'moving',               label: 'Moving' },
  { key: 'pest_control',         label: 'Pest Control' },
  { key: 'painting',             label: 'Painting' },
  { key: 'general_contractor',   label: 'General Contractor' },
  { key: 'real_estate',          label: 'Real Estate' },
  { key: 'restaurant',           label: 'Restaurant' },
  { key: 'salon_spa',            label: 'Salon & Spa' },
  { key: 'fitness',              label: 'Fitness' },
  { key: 'photography',          label: 'Photography' },
  { key: 'legal',                label: 'Legal' },
  { key: 'medical_dental',       label: 'Medical / Dental' },

  // legacy/additional synonyms that share the same key
  { key: 'window_washing',       label: 'Window Cleaning' },
  { key: 'pressure_washing',     label: 'Pressure Washing' },
  { key: 'junk_removal',         label: 'Junk Removal' },

  // retail / maker / resale
  { key: 'retail_boutique',      label: 'Retail - Boutique' },
  { key: 'retail_home_goods',    label: 'Retail - Home Goods' },
  { key: 'retail_electronics',   label: 'Retail - Electronics' },
  { key: 'retail_thrift',        label: 'Retail - Thrift/Resale' },
  { key: 'crafts',               label: 'Crafts' },
  { key: 'handmade',             label: 'Handmade' },
  { key: 'etsy_style',           label: 'Etsy-style Shop' },
  { key: 'gifts_stationery',     label: 'Gifts & Stationery' },
  { key: 'artisan_goods',        label: 'Artisan Goods' },
  { key: 'art_supplies',         label: 'Art Supplies & Crafts' },
  { key: 'antiques_vintage',     label: 'Antiques & Vintage' },
  { key: 'collectibles',         label: 'Collectibles' },
  { key: 'pet_boutique',         label: 'Pet Boutique' },
  { key: 'pop_up_shop',          label: 'Pop-up Shop' },
  { key: 'farmers_market_vendor',label: 'Farmers Market Vendor' },
  { key: 'online_reseller',      label: 'Online Reseller' },
  { key: 'print_on_demand',      label: 'Print-on-Demand' },
  { key: 'custom_apparel',       label: 'Custom Apparel' },

  { key: 'other',                label: 'Other' },
] as const;

/* ---------------------------- derived maps/arrays --------------------------- */

/** First label per key (preserves order of INDUSTRIES) */
const _KEY_TO_LABEL: Partial<Record<IndustryKey, string>> = {};
for (const { key, label } of INDUSTRIES) {
  if (_KEY_TO_LABEL[key] == null) _KEY_TO_LABEL[key] = label;
}
export const KEY_TO_LABEL = _KEY_TO_LABEL as Record<IndustryKey, string>;

/** All labels → key (lowercased) */
export const LABEL_TO_KEY = Object.fromEntries(
  INDUSTRIES.map(i => [i.label.toLowerCase(), i.key])
) as Record<string, IndustryKey>;

/** A simple labels list (de-duped by key) for selects */
export const INDUSTRY_LABELS: ReadonlyArray<string> = Object.values(KEY_TO_LABEL);

/* ---------------------------------- hints ---------------------------------- */

export const INDUSTRY_HINTS: Partial<Record<string, string>> = {
  'Towing': 'Emphasize 24/7 dispatch, rapid ETA, roadside services, transparent pricing.',
  'Window Washing': 'Residential & commercial, safety, streak-free, maintenance plans.',
  'Pressure Washing': 'Driveways/siding/decks, safe pressures, restoration effect, curb appeal.',
  'Landscaping': 'Seasonal maintenance, design/build, irrigation, hardscapes, HOA packages.',
  'HVAC': 'Emergency service, maintenance plans, SEER ratings, financing, IAQ.',
  'Plumbing': 'Leak repair, water heaters, drain clearing, camera inspection, upfront estimates.',
  'Electrical': 'Licensed, panel upgrades, EV chargers, lighting design, permits handled.',
  'Auto Repair': 'Diagnostics, preventative maintenance, warranties, OEM parts.',
  'Carpet Cleaning': 'Pet/odor treatment, fast-dry times, eco-friendly solutions.',
  'Moving': 'Local/long-distance, packing/unpacking, insured, flat-rate options.',
  'Pest Control': 'Eco-aware treatments, quarterly plans, rodent exclusion, same-day service.',
  'Painting': 'Prep, color consult, interior/exterior, fast turnaround, warranties.',
  'General Contractor': 'Licensed/bonded, permits, schedules, change-order transparency.',
  'Real Estate': 'Neighborhood expertise, staging/photography, negotiation, transparent fees.',
  'Restaurant': 'Signature dishes, dietary options, delivery/pickup, specials.',
  'Salon & Spa': 'Experience/vibe, memberships, hygiene, before/after gallery.',
  'Fitness': 'Programs, coaching, community, intro specials, class packs.',
  'Photography': 'Style specialties, packages, rights/usage, quick delivery.',
  'Legal': 'Practice focus, plain-language guidance, consults, discretion.',
  'Medical / Dental': 'Comfort, modern tech, insurance handling, preventative plans.',
  'Junk Removal': 'Same-day hauling, volume pricing, recycling/donation focus.',
  'Retail - Boutique': 'Curated apparel & accessories, limited drops, styling, lookbooks.',
};

/* ----------------------------- key/label helpers ---------------------------- */

export function toIndustryKey(input?: string | null): IndustryKey {
  const x = (input || '').toLowerCase().trim();
  if (!x) return 'other';
  const direct = LABEL_TO_KEY[x];
  if (direct) return direct;

  // loose heuristics
  if (x.includes('tow')) return 'towing';
  if (x.includes('plumb')) return 'plumbing';
  if (x.includes('roof')) return 'roof_cleaning';
  if (x.includes('window')) return 'window_washing';
  if (x.includes('pressure') || x.includes('power wash')) return 'pressure_washing';
  if (x.includes('lawn') || x.includes('landsc')) return 'landscaping';
  if (x.includes('hvac')) return 'hvac';
  if (x.includes('elect')) return 'electrical';
  if (x.includes('auto')) return 'auto_repair';
  if (x.includes('carpet')) return 'carpet_cleaning';
  if (x.includes('move')) return 'moving';
  if (x.includes('pest')) return 'pest_control';
  if (x.includes('paint')) return 'painting';
  if (x.includes('contract')) return 'general_contractor';
  if (x.includes('real estate') || x.includes('realtor')) return 'real_estate';
  if (x.includes('restaurant')) return 'restaurant';
  if (x.includes('salon') || x.includes('spa')) return 'salon_spa';
  if (x.includes('fitness') || x.includes('gym')) return 'fitness';
  if (x.includes('photo')) return 'photography';
  if (x.includes('legal') || x.includes('law')) return 'legal';
  if (x.includes('dental') || x.includes('medical') || x.includes('clinic')) return 'medical_dental';
  if (x.includes('junk')) return 'junk_removal';
  if (x.includes('boutique')) return 'retail_boutique';
  if (x.includes('home goods')) return 'retail_home_goods';
  if (x.includes('electronics')) return 'retail_electronics';
  if (x.includes('thrift') || x.includes('resale')) return 'retail_thrift';
  if (x.includes('etsy')) return 'etsy_style';
  if (x.includes('gift') || x.includes('stationery')) return 'gifts_stationery';
  if (x.includes('artisan')) return 'artisan_goods';
  if (x.includes('art supplies')) return 'art_supplies';
  if (x.includes('antique') || x.includes('vintage')) return 'antiques_vintage';
  if (x.includes('collect')) return 'collectibles';
  if (x.includes('pet boutique')) return 'pet_boutique';
  if (x.includes('pop-up') || x.includes('popup')) return 'pop_up_shop';
  if (x.includes('farmers market')) return 'farmers_market_vendor';
  if (x.includes('online reseller')) return 'online_reseller';
  if (x.includes('print-on-demand') || x.includes('print on demand') || x.includes('pod')) return 'print_on_demand';
  if (x.includes('custom apparel')) return 'custom_apparel';
  return 'other';
}

export function toIndustryLabel(key: IndustryKey): string {
  return KEY_TO_LABEL[key] || 'Other';
}

/** Resolve both (label→key preferred; fallback to slug detection) */
export function resolveIndustry(input?: string | null, slugOrId?: string | null) {
  const key = toIndustryKey(input || slugOrId || '');
  const label = input?.trim() || toIndustryLabel(key);
  return { key, label };
}

/** Options ready for a <select /> (deduped by key, preserves order) */
export function getIndustryOptions(): ReadonlyArray<{ value: string; label: string }> {
  const seen = new Set<string>();
  const opts: { value: string; label: string }[] = [];
  for (const { key, label } of INDUSTRIES) {
    if (seen.has(key)) continue;
    seen.add(key);
    opts.push({ value: label, label });
  }
  // NOTE: do NOT use `as const` here (it’s a variable, not a literal).
  return opts;
}
