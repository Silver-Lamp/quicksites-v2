// lib/generateServices.ts

/** Minimal shape the Services block / seeding expects. */
export type ServiceSeed = {
  name: string;
  description?: string;
  price?: number | string;
  icon?: string;
  href?: string;
};

import type { IndustryKey } from '@/lib/industries';
import { resolveIndustry, toIndustryKey } from '@/lib/industries';

/* -------------------------------- helpers -------------------------------- */

const KEY_ALIASES: Record<string, IndustryKey> = {
  // legacy → current keys
  roofing: 'roof_cleaning',
  lawncare: 'landscaping',
  autorepair: 'auto_repair',
  bakery: 'restaurant',
  generic: 'other',
};

function coerceKey(input?: string | null): IndustryKey {
  if (!input) return 'other';
  const x = String(input).toLowerCase();
  if (KEY_ALIASES[x]) return KEY_ALIASES[x];
  return toIndustryKey(x);
}

/* -------------------------- service name catalogs ------------------------- */
/** Partial map; unknown keys fall back to 'other'. */
const SERVICE_NAMES: Partial<Record<IndustryKey, string[]>> = {
  towing: ['Roadside Assistance', 'Towing & Recovery', 'Battery Jump Start', 'Lockout Service', 'Winch-Outs'],

  window_washing: ['Exterior Windows', 'Interior Windows', 'Screen Cleaning', 'Hard Water Removal', 'Track & Sill Detail'],
  roof_cleaning: ['Roof Soft Wash', 'Moss Treatment', 'Gutter Cleaning', 'Skylight Detailing', 'Solar Panel Wash'],
  pressure_washing: ['House Wash', 'Driveway & Sidewalk', 'Deck & Fence', 'Patio/Pool Deck', 'Gutter Brightening'],

  landscaping: ['Mowing & Edging', 'Seasonal Cleanup', 'Mulch & Bed Refresh', 'Bush Trimming', 'Fertilization'],
  hvac: ['AC Repair', 'Furnace Repair', 'Duct Cleaning', 'Tune-Ups', 'Thermostat Install'],
  plumbing: ['Leak Detection', 'Drain Cleaning', 'Water Heater Install', 'Toilet Repair', 'Pipe Replacement'],
  electrical: ['Panel Upgrades', 'Lighting Install', 'Outlet/GFCI', 'EV Charger', 'Safety Inspections'],
  auto_repair: ['Oil Change', 'Brake Service', 'Check Engine Diagnostics', 'AC Recharge', 'Tire Rotation'],
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
  junk_removal: ['Same-Day Hauling', 'Garage Cleanouts', 'Furniture Removal', 'Curbside Pickup', 'Donation/Recycle'],

  // retail / maker / resale
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

  other: ['Consulting', 'Installation', 'Support', 'Upgrades', 'Maintenance'],
};

function namesForKey(key: IndustryKey): string[] {
  return SERVICE_NAMES[key] ?? SERVICE_NAMES.other!;
}

/* ---------------------------- exported functions --------------------------- */

/** Back-compat: original signature that returns *names only*. */
export function generateServiceNames(
  templateOrId:
    | string
    | { slug?: string; id?: string; data?: { meta?: { industry?: string } } }
): string[] {
  const label =
    typeof templateOrId === 'object'
      ? String(templateOrId?.data?.meta?.industry ?? '')
      : '';
  const slugOrId =
    typeof templateOrId === 'object'
      ? String(templateOrId?.slug ?? templateOrId?.id ?? '')
      : String(templateOrId ?? '');

  // Prefer label → key; else derive from slug/id
  const key =
    (label && toIndustryKey(label)) ||
    coerceKey(slugOrId) ||
    'other';

  return namesForKey(key);
}

/**
 * New: Blocks-API friendly generator.
 * Returns structured ServiceSeed[] you can place into seeding or blocks.
 *
 * Usage:
 *   const { key } = resolveIndustry(metaIndustryLabel, template.slug || template.id);
 *   const seeds = generateServices({ industryKey: key });
 *   // If you only need names: seeds.map(s => s.name)
 */
export function generateServices(
  arg:
    | string
    | {
        template?: { slug?: string; id?: string; data?: { meta?: { industry?: string } } };
        industryKey?: IndustryKey;
        industryLabel?: string;
      }
): ServiceSeed[] {
  if (typeof arg === 'string') {
    const key = coerceKey(arg);
    return namesForKey(key).map((name) => ({ name }));
  }

  const label = String(arg.industryLabel ?? arg.template?.data?.meta?.industry ?? '');
  const slugOrId = String(arg.template?.slug ?? arg.template?.id ?? '');
  const key: IndustryKey =
    arg.industryKey || (label ? toIndustryKey(label) : coerceKey(slugOrId));

  return namesForKey(key).map((name) => ({
    name,
    // description: undefined,
    // price: undefined,
    // href: `/services/${slugify(name)}` // uncomment if you decide to add links
  }));
}
