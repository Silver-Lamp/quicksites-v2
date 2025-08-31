// Industry hints and prompt builder
export const INDUSTRY_HINTS: Record<string, string> = {
  'Towing': 'Emphasize 24/7 dispatch, rapid ETA, roadside assistance (lockouts, jumpstarts), transparent pricing.',
  'Window Washing': 'Residential & commercial streak-free results, safety, water-fed poles, maintenance plans.',
  'Window Cleaning': 'Residential & commercial streak-free results, safety, water-fed poles, maintenance plans.',
  'Roof Cleaning': 'Soft-wash, moss/algae removal, protect shingles, before/after proof, warranties.',
  'Landscaping': 'Seasonal maintenance, design/build, irrigation, hardscapes, curb appeal, HOA packages.',
  'HVAC': 'Emergency service, maintenance plans, SEER ratings, financing, heat pump expertise, indoor air quality.',
  'Plumbing': 'Emergency leaks, water heaters, drain clearing, camera inspection, upfront estimates.',
  'Electrical': 'Licensed, panel upgrades, EV chargers, lighting design, safety inspections, permits handled.',
  'Auto Repair': 'Diagnostics, preventative maintenance, warranties, OEM parts, rideshare/loaner support.',
  'Carpet Cleaning': 'Pet/odor treatment, fast-dry times, eco-friendly solutions, bundled room pricing.',
  'Moving': 'Local/long-distance, packing/unpacking, insured, flat-rate options, careful handling.',
  'Pest Control': 'Eco-aware treatments, quarterly plans, rodent exclusion, same-day service.',
  'Painting': 'Prep, color consult, clean job sites, interior/exterior, fast turnaround, warranties.',
  'General Contractor': 'Licensed/bonded, permits, schedules, change-order transparency, portfolio credibility.',
  'Real Estate': 'Neighborhood expertise, staging/photography, negotiation strength, transparent fees.',
  'Restaurant': 'Signature dishes, local sourcing, dietary options, delivery/pickup, lunch/dinner promos.',
  'Salon & Spa': 'Experience/luxe vibe, memberships/packages, hygiene, before/after gallery.',
  'Fitness': 'Programs, coaching, community, intro specials, class packs, transformation stories.',
  'Photography': 'Style specialties, packages, rights/usage, fast delivery, portfolio highlights.',
  'Legal': 'Practice focus, plain-language guidance, consults, discretion, outcome orientation.',
  'Medical / Dental': 'Patient comfort, modern tech, insurance handling, preventative plans, trust & hygiene.',
  'Pressure Washing': 'Driveways/siding/decks, safe pressures, restoration effect, curb appeal before/after.',
  'Junk Removal': 'Same-day hauling, volume-based pricing, recycling/donation focus, property cleanouts.',
  // Retail/crafts/resell
  'Retail - Boutique': 'Curated apparel & accessories, limited drops, styling, gift bundles, loyalty & lookbooks.',
  'Retail - Home Goods': 'Quality, durability, room-by-room curation, bundles, warranties, easy returns.',
  'Retail - Electronics': 'Specs clarity, warranties, trade-in, certified refurbished, accessories, bundles.',
  'Retail - Thrift/Resale': 'Sustainable bargains, rotating inventory, condition grading, treasure-hunt vibe.',
  'Crafts': 'Handmade quality, custom orders, local sourcing, portfolio/gallery, social presence.',
  'Handmade': 'Artisan story, small batches, customization, care instructions, gift packaging.',
  'Etsy-style Shop': 'SEOed listings, variants, personalization prompts, shipping/timeframes, reviews.',
  'Gifts & Stationery': 'Occasion bundles, personalization, gift wrap, turnaround times.',
  'Artisan Goods': 'Materials, craftsmanship, provenance, limited runs, authenticity.',
  'Art Supplies & Crafts': 'Project kits, classes/workshops, repeatables, seasonal campaigns.',
  'Antiques & Vintage': 'Era/provenance, condition notes, authenticity, care, limited one-offs.',
  'Collectibles': 'Rarity, grading, authenticity, protective cases, series/sets.',
  'Pet Boutique': 'Sizing guides, safe materials, breed-specific picks, bundles, subscriptions.',
  'Pop-up Shop': 'Dates/locations, limited runs, preorders, QR to follow/social.',
  'Farmers Market Vendor': 'Local sourcing, seasonal availability, freshness/ingredients, tastings.',
  'Online Reseller': 'Sourcing transparency, quality grading, returns, bundle deals, shipping speeds.',
  'Print-on-Demand': 'Design previews, size charts, fabric/finish options, production times.',
  'Custom Apparel': 'Size charts, materials, care, design proofs, minimums, turnaround windows.',
};

export function buildIndustryPrompt(
  industry?: string,
  base?: string,
  productType?: 'meal'|'physical'|'digital'|'service'|'mixed'
): string | undefined {
  const ind = (industry || '').trim();
  const hint = INDUSTRY_HINTS[ind] || '';
  if (!ind && !base) return undefined;

  const typeLine = ind === 'Restaurant' || productType === 'meal'
    ? 'Product focus: meals, sides, desserts, and bundles.'
    : 'Product focus: clear service packages and physical goods with value tiers.';

  return [ ind ? `Industry: ${ind}.` : '', hint, typeLine, (base || '').trim(),
    'Keep copy concise, conversion-oriented, and SEO-friendly for local search.'
  ].filter(Boolean).join(' ');
}
