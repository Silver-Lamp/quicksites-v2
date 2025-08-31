// lib/generateServices.ts

/** Minimal shape the Services block factory expects. */
export type ServiceSeed = {
  name: string;
  description?: string;
  price?: number | string;
  icon?: string;
  href?: string;
};

/* --------------------------------- keys ---------------------------------- */
/**
 * Internal keys are snake/short names we use for generation.
 * UI stores the *label* (e.g. "Pressure Washing") in templates.industry.
 */
type IndustryKey =
  | 'towing'
  | 'plumbing'
  | 'bakery'
  | 'roofing'
  | 'cleaning'               // generic cleaning
  | 'window_washing'
  | 'pressure_washing'
  | 'lawncare'
  | 'autorepair'
  | 'hvac'
  | 'electrical'
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
  // retail / maker
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
  | 'generic';

/* --------------------------- label ↔ key mapping -------------------------- */

/** Title-case labels you display/store in DB (templates.industry) */
const LABEL_FROM_KEY: Record<IndustryKey, string> = {
  towing: 'Towing',
  plumbing: 'Plumbing',
  bakery: 'Bakery',
  roofing: 'Roof Cleaning',
  cleaning: 'Cleaning',
  window_washing: 'Window Cleaning',
  pressure_washing: 'Pressure Washing',
  lawncare: 'Landscaping',
  autorepair: 'Auto Repair',
  hvac: 'HVAC',
  electrical: 'Electrical',
  carpet_cleaning: 'Carpet Cleaning',
  moving: 'Moving',
  pest_control: 'Pest Control',
  painting: 'Painting',
  general_contractor: 'General Contractor',
  real_estate: 'Real Estate',
  restaurant: 'Restaurant',
  salon_spa: 'Salon & Spa',
  fitness: 'Fitness',
  photography: 'Photography',
  legal: 'Legal',
  medical_dental: 'Medical / Dental',
  retail_boutique: 'Retail - Boutique',
  retail_home_goods: 'Retail - Home Goods',
  retail_electronics: 'Retail - Electronics',
  retail_thrift: 'Retail - Thrift/Resale',
  crafts: 'Crafts',
  handmade: 'Handmade',
  etsy_style: 'Etsy-style Shop',
  gifts_stationery: 'Gifts & Stationery',
  artisan_goods: 'Artisan Goods',
  art_supplies: 'Art Supplies & Crafts',
  antiques_vintage: 'Antiques & Vintage',
  collectibles: 'Collectibles',
  pet_boutique: 'Pet Boutique',
  pop_up_shop: 'Pop-up Shop',
  farmers_market_vendor: 'Farmers Market Vendor',
  online_reseller: 'Online Reseller',
  print_on_demand: 'Print-on-Demand',
  custom_apparel: 'Custom Apparel',
  generic: 'General',
};

/** Patterns to detect a key from a human label or slug. */
const KEY_PATTERNS: Array<{ key: IndustryKey; needles: string[] }> = [
  { key: 'towing', needles: ['tow', 'towing'] },
  { key: 'plumbing', needles: ['plumb'] },
  { key: 'bakery', needles: ['bakery', 'bake'] },
  { key: 'roofing', needles: ['roof'] },
  { key: 'window_washing', needles: ['window wash', 'window clean'] },
  { key: 'pressure_washing', needles: ['pressure wash', 'power wash'] },
  { key: 'cleaning', needles: ['cleaning', 'house clean'] }, // generic
  { key: 'lawncare', needles: ['lawn', 'landsc'] },
  { key: 'autorepair', needles: ['auto repair', 'autorepair', 'mechanic'] },
  { key: 'hvac', needles: ['hvac'] },
  { key: 'electrical', needles: ['electrical', 'electrician'] },
  { key: 'carpet_cleaning', needles: ['carpet clean'] },
  { key: 'moving', needles: ['moving', 'mover'] },
  { key: 'pest_control', needles: ['pest', 'exterminator'] },
  { key: 'painting', needles: ['paint'] },
  { key: 'general_contractor', needles: ['contractor', 'gc'] },
  { key: 'real_estate', needles: ['real estate', 'realtor'] },
  { key: 'restaurant', needles: ['restaurant'] },
  { key: 'salon_spa', needles: ['salon', 'spa'] },
  { key: 'fitness', needles: ['fitness', 'gym'] },
  { key: 'photography', needles: ['photo', 'photograph'] },
  { key: 'legal', needles: ['legal', 'law', 'attorney'] },
  { key: 'medical_dental', needles: ['dental', 'medical', 'clinic'] },
  // retail / maker
  { key: 'retail_boutique', needles: ['boutique'] },
  { key: 'retail_home_goods', needles: ['home goods'] },
  { key: 'retail_electronics', needles: ['electronics'] },
  { key: 'retail_thrift', needles: ['thrift', 'resale', 'consignment'] },
  { key: 'crafts', needles: ['craft'] },
  { key: 'handmade', needles: ['handmade'] },
  { key: 'etsy_style', needles: ['etsy'] },
  { key: 'gifts_stationery', needles: ['gift', 'stationery'] },
  { key: 'artisan_goods', needles: ['artisan'] },
  { key: 'art_supplies', needles: ['art supplies'] },
  { key: 'antiques_vintage', needles: ['antique', 'vintage'] },
  { key: 'collectibles', needles: ['collectible'] },
  { key: 'pet_boutique', needles: ['pet boutique'] },
  { key: 'pop_up_shop', needles: ['pop-up', 'popup'] },
  { key: 'farmers_market_vendor', needles: ['farmers market'] },
  { key: 'online_reseller', needles: ['online reseller'] },
  { key: 'print_on_demand', needles: ['print-on-demand', 'print on demand', 'pod'] },
  { key: 'custom_apparel', needles: ['custom apparel'] },
];

/* ------------------------------- detection -------------------------------- */

/** Infer an *internal* industry key from a slug/id. */
export function detectIndustryKeyFromSlug(s?: string): IndustryKey {
  const x = (s || '').toLowerCase();
  for (const { key, needles } of KEY_PATTERNS) {
    if (needles.some((n) => x.includes(n))) return key;
  }
  if (x.includes('auto')) return 'autorepair';
  if (x.includes('clean')) return 'cleaning';
  return 'generic';
}

/** Infer a key from a *label* (e.g., “Pressure Washing”). */
export function industryKeyFromLabel(label?: string | null): IndustryKey {
  const x = (label || '').toLowerCase();
  for (const { key, needles } of KEY_PATTERNS) {
    if (needles.some((n) => x.includes(n))) return key;
  }
  // simple direct map if label equals our stored label
  const match = (Object.keys(LABEL_FROM_KEY) as IndustryKey[]).find(
    (k) => LABEL_FROM_KEY[k].toLowerCase() === x
  );
  return match ?? 'generic';
}

/** Resolve both: prefer label → key, else slug → key; return a clean label. */
export function resolveIndustry(opts: { industryLabel?: string | null; templateIdOrSlug?: string }) {
  const key =
    industryKeyFromLabel(opts.industryLabel) ||
    detectIndustryKeyFromSlug(opts.templateIdOrSlug);
  const label = (opts.industryLabel && opts.industryLabel.trim()) || LABEL_FROM_KEY[key] || 'General';
  return { key, label };
}

/* -------------------------- default service names -------------------------- */

const SERVICE_NAMES: Record<IndustryKey, string[]> = {
  towing: ['Roadside Assistance', 'Towing & Recovery', 'Battery Jump Start', 'Lockout Service', 'Winch-Outs'],
  plumbing: ['Leak Detection', 'Drain Cleaning', 'Water Heater Install', 'Toilet Repair', 'Pipe Replacement'],
  bakery: ['Custom Cakes', 'Daily Pastries', 'Artisan Breads', 'Catering Trays', 'Gluten-Free Options'],
  roofing: ['Roof Inspection', 'Shingle Replacement', 'Leak Repair', 'Gutter Cleaning', 'Storm Damage Repair'],
  cleaning: ['Standard Home Cleaning', 'Deep Cleaning', 'Move-In/Out Cleaning', 'Office Cleaning', 'Post-Construction Clean'],
  window_washing: ['Exterior Windows', 'Interior Windows', 'Screen Cleaning', 'Hard Water Removal', 'Track & Sill Detail'],
  pressure_washing: ['House Wash', 'Driveway & Sidewalk', 'Roof Soft Wash', 'Deck & Fence', 'Gutter Brightening'],
  lawncare: ['Mowing & Edging', 'Seasonal Cleanup', 'Mulch & Bed Refresh', 'Bush Trimming', 'Fertilization'],
  autorepair: ['Oil Change', 'Brake Service', 'Check Engine Diagnostics', 'AC Recharge', 'Tire Rotation'],
  hvac: ['AC Repair', 'Furnace Repair', 'Duct Cleaning', 'Tune-Ups', 'Thermostat Install'],
  electrical: ['Panel Upgrades', 'Lighting Install', 'Outlet/GFCI', 'EV Charger', 'Safety Inspections'],
  carpet_cleaning: ['Steam Cleaning', 'Spot Treatment', 'Pet Odor Removal', 'Upholstery Cleaning', 'Rug Cleaning'],
  moving: ['Local Moving', 'Packing & Unpacking', 'Long-Distance Moving', 'Furniture Assembly', 'Storage Solutions'],
  pest_control: ['Quarterly Plans', 'Rodent Control', 'Ant Treatments', 'Termite Inspection', 'Bed Bug Treatment'],
  painting: ['Interior Painting', 'Exterior Painting', 'Cabinet Refinishing', 'Drywall Repair', 'Color Consultation'],
  general_contractor: ['Kitchen Remodel', 'Bathroom Remodel', 'Room Additions', 'Basement Finish', 'Permit Handling'],
  real_estate: ['Home Valuation', 'Buyer Representation', 'Listing Services', 'Open Houses', 'Staging & Photos'],
  restaurant: ['Catering', 'Online Ordering', 'Daily Specials', 'Private Events', 'Delivery & Pickup'],
  salon_spa: ['Haircut & Style', 'Color & Highlights', 'Facials', 'Massage Therapy', 'Manicure & Pedicure'],
  fitness: ['Personal Training', 'Group Classes', 'Nutrition Coaching', 'Yoga/Pilates', 'Membership Plans'],
  photography: ['Portrait Sessions', 'Event Coverage', 'Product Photography', 'Real Estate Photos', 'Editing & Retouch'],
  legal: ['Consultations', 'Contract Drafting', 'Estate Planning', 'Business Formation', 'Litigation Support'],
  medical_dental: ['Cleanings & Exams', 'Fillings', 'Whitening', 'Implants', 'Emergency Care'],

  // retail / maker
  retail_boutique: ['New Arrivals', 'Personal Styling', 'Gift Wrapping', 'Loyalty Program', 'Returns & Exchanges'],
  retail_home_goods: ['Room Consultations', 'Delivery & Setup', 'Gift Registry', 'Trade Program', 'Warranty Support'],
  retail_electronics: ['Device Setup', 'Repairs & Diagnostics', 'Trade-In', 'Data Transfer', 'Accessory Bundles'],
  retail_thrift: ['Curated Finds', 'Consignment', 'Seasonal Drops', 'Vintage Collections', 'Donation Drop-Off'],
  crafts: ['Workshops & Classes', 'Custom Orders', 'Materials Kits', 'Community Events', 'Gift Cards'],
  handmade: ['Custom Commissions', 'Limited Runs', 'Gift Wrapping', 'Care Instructions', 'Wholesale Inquiries'],
  etsy_style: ['Custom Orders', 'Made-to-Order', 'Gift Packaging', 'Processing Times', 'Wholesale Inquiries'],
  gifts_stationery: ['Custom Cards', 'Gift Wrapping', 'Monogramming', 'Corporate Gifts', 'Same-Day Pickup'],
  artisan_goods: ['Small-Batch Goods', 'Local Makers', 'Gift Sets', 'Wholesale Program', 'Pop-Up Events'],
  art_supplies: ['Classes & Demos', 'Special Orders', 'Student Discounts', 'Framing Services', 'Bulk Discounts'],
  antiques_vintage: ['Appraisals', 'Restoration', 'Consignment', 'Estate Buying', 'Curated Collections'],
  collectibles: ['Buy/Sell/Trade', 'Authentication', 'Grading Submission', 'Display Cases', 'Live Auction Nights'],
  pet_boutique: ['Sizing Help', 'Special Orders', 'Subscription Boxes', 'Treat Bar', 'Grooming Appointments'],
  pop_up_shop: ['Event Calendar', 'Limited Drops', 'On-Site Setup', 'Collaborations', 'Preorders'],
  farmers_market_vendor: ['Weekly Schedule', 'CSA Sign-Up', 'Bulk Orders', 'Seasonal Specials', 'Local Delivery'],
  online_reseller: ['New Drops', 'Bundle Deals', 'Order Tracking', 'Returns', 'Customer Support'],
  print_on_demand: ['Design Templates', 'No Minimums', 'Bulk Discounts', 'Mockups & Proofs', 'Dropshipping'],
  custom_apparel: ['Design Consult', 'Embroidery', 'Screen Printing', 'Bulk Orders', 'Rush Services'],

  generic: ['Consulting', 'Installation', 'Support', 'Upgrades', 'Maintenance'],
};

/* ----------------------- generation (names + seeds) ------------------------ */

/** Back-compat: original signature that returns *names only*. */
export function generateServiceNames(templateId: string): string[] {
  const key = detectIndustryKeyFromSlug(templateId);
  return SERVICE_NAMES[key] || SERVICE_NAMES.generic;
}

/**
 * New: Blocks-API friendly generator.
 * Returns structured ServiceSeed[] you can place into SeedContext.services.
 *
 * Usage:
 *   const { key, label } = resolveIndustry({ industryLabel, templateIdOrSlug });
 *   const services = generateServices({ industryKey: key });
 *   // Persist `label` to templates.industry; pass `services` → Services block
 */
export function generateServices(
  arg:
    | string
    | { templateId?: string; industry?: string; industryKey?: IndustryKey }
): ServiceSeed[] {
  const templateId = typeof arg === 'string' ? arg : arg?.templateId ?? '';
  const key: IndustryKey =
    (typeof arg !== 'string' && arg?.industryKey) ||
    (typeof arg !== 'string' && industryKeyFromLabel(arg?.industry)) ||
    detectIndustryKeyFromSlug(templateId);

  const names =
    SERVICE_NAMES[key] ??
    SERVICE_NAMES[(key.split(' ')[0] as IndustryKey) || 'generic'] ??
    SERVICE_NAMES.generic;

  return names.map((name) => ({
    name,
    description: undefined,
    // price: undefined,
    // href: `/services/${slugify(name)}` // uncomment if you want links
  }));
}
