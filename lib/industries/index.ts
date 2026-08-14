// lib/industries/index.ts

/** Internal keys we use in code & generators (canonical storage) */
export type IndustryKey =
  | 'towing'
  | 'window_washing'
  | 'windshield_repair'
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
  | 'deck_builder'
  // Instant-estimator trades (quote_estimator block; each a <city>-<trade>.com vertical)
  | 'fencing'
  | 'concrete'
  | 'turf'
  | 'epoxy_flooring'
  | 'paving'
  | 'roofing'
  | 'siding'
  | 'retaining_walls'
  | 'real_estate'
  | 'real_estate_agency'
  | 'restaurant'
  | 'lemonade_stand'
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
  | 'author'
  | 'personal'
  | 'faith'
  | 'auto_dealer'
  | 'other';

/** Key → Label (display only; we store the key in DB) */
export const INDUSTRIES: ReadonlyArray<{ key: IndustryKey; label: string }> = [
  { key: 'towing',               label: 'Towing' },
  { key: 'window_washing',       label: 'Window Washing' },
  { key: 'windshield_repair',    label: 'Windshield Repair' },
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
  { key: 'deck_builder',         label: 'Deck Builder' },
  { key: 'fencing',              label: 'Fencing' },
  { key: 'concrete',             label: 'Concrete' },
  { key: 'turf',                 label: 'Artificial Turf' },
  { key: 'epoxy_flooring',       label: 'Epoxy Flooring' },
  { key: 'paving',               label: 'Paving' },
  { key: 'roofing',              label: 'Roofing' },
  { key: 'siding',               label: 'Siding' },
  { key: 'retaining_walls',      label: 'Retaining Walls' },
  { key: 'real_estate',          label: 'Real Estate' },
  { key: 'real_estate_agency',   label: 'Real Estate Agency' },
  { key: 'restaurant',           label: 'Restaurant' },
  { key: 'lemonade_stand',       label: 'Lemonade Stand' },
  { key: 'salon_spa',            label: 'Salon & Spa' },
  { key: 'fitness',              label: 'Fitness' },
  { key: 'photography',          label: 'Photography' },
  { key: 'legal',                label: 'Legal' },
  { key: 'medical_dental',       label: 'Medical / Dental' },

  // aliases/synonyms (same key, different label)
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
  { key: 'author',               label: 'Author' },
  { key: 'personal',             label: 'Personal / About Me' },
  { key: 'faith',                label: 'Church / Faith Community' },
  { key: 'auto_dealer',          label: 'Auto Dealer' },

  { key: 'other',                label: 'Other' },
] as const;

/* ---------------------------- derived maps/arrays --------------------------- */

/** First label per key (preserves order) */
const _KEY_TO_LABEL: Partial<Record<IndustryKey, string>> = {};
for (const { key, label } of INDUSTRIES) {
  if (_KEY_TO_LABEL[key] == null) _KEY_TO_LABEL[key] = label;
}
export const KEY_TO_LABEL = _KEY_TO_LABEL as Record<IndustryKey, string>;

/** Labels → key (case-insensitive), plus add direct key lookups */
const labelPairs: Array<[string, IndustryKey]> = INDUSTRIES.map(i => [
  i.label.toLowerCase(),
  i.key,
]);
for (const { key } of INDUSTRIES) {
  labelPairs.push([key.toLowerCase(), key]); // allow passing the key as “label”
}
export const LABEL_TO_KEY = Object.fromEntries(labelPairs) as Record<string, IndustryKey>;

/** A simple labels list (deduped by key) for display */
export const INDUSTRY_LABELS: ReadonlyArray<string> = Object.values(KEY_TO_LABEL);

/* ---------------------------------- hints ---------------------------------- */

export const INDUSTRY_HINTS: Partial<Record<string, string>> = {
  'Towing': 'Emphasize 24/7 dispatch, rapid ETA, roadside services, transparent pricing.',
  'Window Washing': 'Residential & commercial, safety, streak-free, maintenance plans.',
  'Windshield Repair': 'Safe windshield replacement, damage repair, damage detection, mobile service.',
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
  'Deck Builder': 'Custom decks, railings & pergolas, material choices (PT/cedar/composite), free instant estimates, permits handled.',
  'Fencing': 'Wood/vinyl/chain-link/aluminum fences, gates, repairs, free instant estimates by the foot.',
  'Concrete': 'Patios, driveways, walkways, stamped & colored finishes, free instant estimates by the square foot.',
  'Artificial Turf': 'Lawns, putting greens, pet & playground turf, low-maintenance, free instant estimates.',
  'Epoxy Flooring': 'Garage & commercial floor coatings (flake/metallic), grind prep, durable, free instant estimates.',
  'Paving': 'Asphalt & paver driveways, sealcoating, resurfacing, free instant estimates by the square foot.',
  'Roofing': 'Roof replacement & repair (shingle/metal/tile), tear-offs, storm damage, free instant estimates.',
  'Siding': 'Vinyl/wood/fiber-cement siding, stucco, trim, repairs, free instant estimates by the square foot.',
  'Retaining Walls': 'Block/stone/poured walls, hardscaping, drainage, engineered above 4ft, free instant estimates.',
  'Real Estate': 'Neighborhood expertise, staging/photography, negotiation, transparent fees.',
  'Real Estate Agency': 'A whole brokerage: a roster of agents (each with a headshot, bio, and their own voice), featured listings with audio tours, and seller/buyer lead magnets.',
  'Restaurant': 'Signature dishes, dietary options, delivery/pickup, specials.',
  'Salon & Spa': 'Experience/vibe, memberships, hygiene, before/after gallery.',
  'Fitness': 'Programs, coaching, community, intro specials, class packs.',
  'Photography': 'Style specialties, packages, rights/usage, quick delivery.',
  'Legal': 'Practice focus, plain-language guidance, consults, discretion.',
  'Medical / Dental': 'Comfort, modern tech, insurance handling, preventative plans.',
  'Junk Removal': 'Same-day hauling, volume pricing, recycling/donation focus.',
  'Retail - Boutique': 'Curated apparel & accessories, limited drops, styling, lookbooks.',
  'Personal / About Me': 'Who you are and what you’re about — a warm, audio-forward personal page that can speak in your own voice.',
  'Church / Faith Community': 'Service times, upcoming events, a welcoming word, and a message you can hear — plus an easy way to give and plan a visit.',
  'Auto Dealer': 'Browsable inventory with photos, price & mileage, an audio walkaround for each car, and one-tap “ask about this one”.',
};

/* ----------------------------- key/label helpers ---------------------------- */

/** Canonical resolver: label OR key OR synonym → key */
export function resolveIndustryKey(input?: string | null): IndustryKey {
  const x = (input || '').toLowerCase().trim();
  if (!x) return 'other';
  return LABEL_TO_KEY[x] ?? toIndustryKey(x);
}

export function toIndustryKey(input?: string | null): IndustryKey {
  const x = (input || '').toLowerCase().trim();
  if (!x) return 'other';
  // If it’s an exact key or exact label we’ll have it in LABEL_TO_KEY
  const direct = LABEL_TO_KEY[x];
  if (direct) return direct;

  // loose heuristics
  if (x.includes('tow')) return 'towing';
  if (x.includes('plumb')) return 'plumbing';
  // roof_cleaning is the exterior-CLEANING vertical — require a cleaning cue, so
  // "roofing"/"roofer"/"roof replacement" fall through to the roofing install vertical.
  if (x.includes('roof') && (x.includes('clean') || x.includes('wash'))) return 'roof_cleaning';
  if (x.includes('window')) return 'window_washing';
  if (x.includes('windshield')) return 'windshield_repair';
  if (x.includes('pressure') || x.includes('power wash')) return 'pressure_washing';
  if (x.includes('lawn') || x.includes('landsc')) return 'landscaping';
  if (x.includes('hvac')) return 'hvac';
  if (x.includes('elect')) return 'electrical';
  if (x.includes('dealership') || x.includes('dealer') || x.includes('used car') || x.includes('car lot') || x.includes('car sales') || x.includes('pre-owned')) return 'auto_dealer';
  if (x.includes('auto')) return 'auto_repair';
  if (x.includes('carpet')) return 'carpet_cleaning';
  if (x.includes('move')) return 'moving';
  if (x.includes('pest')) return 'pest_control';
  if (x.includes('paint')) return 'painting';
  if (x.includes('church') || x.includes('faith') || x.includes('ministry') || x.includes('ministries') || x.includes('worship') || x.includes('congregation') || x.includes('parish') || x.includes('synagogue') || x.includes('mosque') || x.includes('temple')) return 'faith';
  if (x.includes('about me') || x.includes('about.me') || x.includes('personal brand') || x.includes('personal site')) return 'personal';
  if (x.includes('deck') || x.includes('pergola')) return 'deck_builder';
  // Estimator trades (checked before the generic roof/contract fallbacks below)
  if (x.includes('roof')) return 'roofing'; // any non-cleaning roof term → install/replace
  if (x.includes('fenc')) return 'fencing';
  if (x.includes('concrete') || x.includes('flatwork')) return 'concrete';
  if (x.includes('turf')) return 'turf';
  if (x.includes('epoxy') || x.includes('garage floor')) return 'epoxy_flooring';
  if (x.includes('paving') || x.includes('paver') || x.includes('asphalt')) return 'paving';
  if (x.includes('siding')) return 'siding';
  if (x.includes('retaining') || x.includes('hardscap')) return 'retaining_walls';
  if (x.includes('contract')) return 'general_contractor';
  // Multi-agent firms → the agency scaffold; single agents fall through to real_estate.
  if (x.includes('brokerage') || x.includes('real estate agency') || x.includes('realty group') || x.includes('realty team') || x.includes('real estate team')) return 'real_estate_agency';
  if (x.includes('real estate') || x.includes('realtor')) return 'real_estate';
  // Before 'restaurant' and before any food match: a lemonade stand is a driveway, not a
  // dining room, and the restaurant scaffold would give it hours, a location map and a
  // catering enquiry form it has no use for.
  if (x.includes('lemonade')) return 'lemonade_stand';
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

/** Resolve both (label/key preferred; fallback to slug detection) */
export function resolveIndustry(input?: string | null, slugOrId?: string | null) {
  const key = resolveIndustryKey(input || slugOrId || '');
  const label = toIndustryLabel(key);
  return { key, label };
}

/**
 * Options for a <Select />.
 * IMPORTANT: value === canonical key (so controlled selects bind correctly).
 */
export function getIndustryOptions(): ReadonlyArray<{ value: IndustryKey; label: string }> {
  const seen = new Set<IndustryKey>();
  const opts: Array<{ value: IndustryKey; label: string }> = [];
  for (const { key, label } of INDUSTRIES) {
    if (seen.has(key)) continue;
    seen.add(key);
    opts.push({ value: key, label });
  }
  return opts;
}
