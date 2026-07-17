// lib/builder/starterSeeds.ts
//
// The SPEC layer of the per-industry starter-templates tool: for every industry, a
// deterministic starter definition — display name, tagline, and (for storefront
// industries) a curated product pack the seeder turns into a real catalog. Pure data
// + pure derivation; the engine that writes rows is lib/builder/seedStarterTemplate.ts.
//
// Curation rules:
//  - Product packs are hand-written (no AI spend) with believable titles/prices —
//    they're the "wow, this is a real store" moment in the Duplicate-a-template
//    picker, and duplication clones them into the new owner's own merchant.
//  - Storefront industries WITHOUT a pack still get a starter (scaffold + empty grid
//    — the editor's store-setup/quick-add flow takes it from there).
//  - Service industries lean on buildIndustryStarter's per-industry services/copy;
//    we only supply a charismatic business name.

import type { IndustryKey } from '@/lib/industries';

export type StarterItemSpec = { title: string; priceUsd: number; description: string };

export type StarterProductPack = {
  tagline: string;
  gridTitle: string;
  items: StarterItemSpec[];
};

export const STARTER_PRODUCT_PACKS: Partial<Record<IndustryKey, StarterProductPack>> = {
  crafts: {
    tagline: 'Small-batch soy candles, hand-poured in reusable vessels.',
    gridTitle: 'The Collection',
    items: [
      { title: 'Lavender Fields — 8oz Soy Candle', priceUsd: 24, description: 'French lavender + bergamot. 45-hour burn, cotton wick, reusable amber jar.' },
      { title: 'Cedar & Sage — 8oz Soy Candle', priceUsd: 26, description: 'Campfire cedar, white sage, a whisper of smoke. Our best seller.' },
      { title: 'Vanilla Bean — 8oz Soy Candle', priceUsd: 22, description: 'Madagascar vanilla and warm sugar. The one everyone gifts.' },
      { title: 'Citrus Grove — 8oz Soy Candle', priceUsd: 24, description: 'Blood orange, grapefruit zest, and neroli. Sunshine in a jar.' },
      { title: 'Seasonal Trio Gift Set', priceUsd: 58, description: 'Three 4oz candles in this season’s scents, boxed and ribboned.' },
      { title: 'Wick Trimmer', priceUsd: 12, description: 'Matte-black steel trimmer for a clean burn, every time.' },
    ],
  },
  handmade: {
    tagline: 'Functional stoneware, thrown by hand and fired to last.',
    gridTitle: 'From the Kiln',
    items: [
      { title: 'Speckled Stoneware Mug', priceUsd: 32, description: '12oz, dishwasher-safe, satin glaze over speckled buff clay. No two alike.' },
      { title: 'Large Serving Bowl', priceUsd: 68, description: 'Generous 10" bowl in midnight glaze — salads, pasta, or the centerpiece.' },
      { title: 'Bud Vase', priceUsd: 38, description: 'A quiet little vase for a single stem. Matte white over toasted clay.' },
      { title: 'Dinner Plate Set (4)', priceUsd: 120, description: 'Four hand-thrown 10.5" plates. Stack beautifully, chip stubbornly.' },
      { title: 'Espresso Cup Pair', priceUsd: 44, description: 'Two 3oz cups with pulled handles. Morning ritual, upgraded.' },
      { title: 'Glaze Sample Tile', priceUsd: 8, description: 'Take a glaze home before committing to a full set.' },
    ],
  },
  artisan_goods: {
    tagline: 'Heirloom-quality pieces, made one at a time at the bench.',
    gridTitle: 'The Bench Collection',
    items: [
      { title: 'Hammered Gold Hoops', priceUsd: 45, description: '14k gold-filled hoops, hand-hammered for shimmer. Everyday weight.' },
      { title: 'Birthstone Necklace', priceUsd: 78, description: 'A genuine stone on a delicate 18" chain — tell us the month at checkout.' },
      { title: 'Stacking Rings — Set of 3', priceUsd: 95, description: 'Smooth, twist, and hammered bands in mixed metals. Made to mingle.' },
      { title: 'Wide Cuff Bracelet', priceUsd: 85, description: 'Brushed sterling cuff, formed and finished by hand.' },
      { title: 'Initial Pendant', priceUsd: 60, description: 'Hand-stamped brass initial on a gold-filled chain.' },
      { title: 'Jewelry Care Kit', priceUsd: 18, description: 'Polishing cloth, cleaning solution, and storage pouch.' },
    ],
  },
  retail_boutique: {
    tagline: 'A tightly-edited closet of pieces you’ll actually wear.',
    gridTitle: 'New This Week',
    items: [
      { title: 'The Weekend Linen Shirt', priceUsd: 68, description: 'Washed linen, relaxed cut, three colors. The shirt that goes everywhere.' },
      { title: 'High-Rise Straight Jeans', priceUsd: 98, description: 'Rigid denim that breaks in like a memory. True to size.' },
      { title: 'Silk Scarf — Botanical Print', priceUsd: 42, description: 'Hand-rolled edges, an instant outfit on a slow day.' },
      { title: 'Everyday Leather Tote', priceUsd: 145, description: 'Full-grain leather, unlined, ages beautifully. Fits a laptop and a life.' },
      { title: 'Gold-Tone Statement Earrings', priceUsd: 36, description: 'Light on the ear, loud in the room.' },
    ],
  },
  retail_home_goods: {
    tagline: 'Warm, useful things for the rooms you live in most.',
    gridTitle: 'For the Home',
    items: [
      { title: 'Waffle-Weave Throw Blanket', priceUsd: 78, description: 'Oversized cotton throw in oat, clay, and moss. Couch gravity, increased.' },
      { title: 'Hand-Blown Glass Carafe', priceUsd: 54, description: 'Bedside water, weeknight wine, morning juice — one carafe, all of it.' },
      { title: 'Oak Serving Board', priceUsd: 62, description: 'Solid white oak, food-safe oil finish. Cheese night’s best friend.' },
      { title: 'Linen Napkin Set (4)', priceUsd: 38, description: 'Stonewashed linen that gets softer with every wash.' },
      { title: 'Ceramic Table Lamp', priceUsd: 128, description: 'A soft glow through a hand-glazed base. Includes linen shade.' },
    ],
  },
  etsy_style: {
    tagline: 'Made-to-order pieces with your name on them — literally.',
    gridTitle: 'Made For You',
    items: [
      { title: 'Custom Name Banner', priceUsd: 34, description: 'Felt letters, hand-stitched. Nurseries, birthdays, book nooks.' },
      { title: 'Personalized Pet Portrait', priceUsd: 65, description: 'Send a photo, receive your pet as a tiny renaissance noble.' },
      { title: 'Hand-Stamped Keychain', priceUsd: 22, description: 'Coordinates, a date, a word you live by — stamped in brass.' },
      { title: 'Embroidered Sweatshirt', priceUsd: 58, description: 'Your word or motif, chain-stitched on a heavyweight crew.' },
      { title: 'Custom Family Recipe Tea Towel', priceUsd: 28, description: 'Grandma’s handwriting, printed on flour-sack cotton.' },
    ],
  },
  gifts_stationery: {
    tagline: 'Cards, paper, and small perfect things.',
    gridTitle: 'The Paper Goods',
    items: [
      { title: 'Letterpress Card Set (8)', priceUsd: 26, description: 'Thick cotton stock, blank inside. For people who still mail things.' },
      { title: 'Linen-Bound Notebook', priceUsd: 24, description: 'Lay-flat binding, 192 pages of dot grid. A pleasure to ruin with ideas.' },
      { title: 'Brass Pen', priceUsd: 48, description: 'Machined brass that patinas with your grip. Smooth-writing refill included.' },
      { title: 'Botanical Wrapping Paper (3 sheets)', priceUsd: 14, description: 'Heavyweight sheets that fold crisp and look better than the gift.' },
      { title: 'Wax Seal Kit', priceUsd: 32, description: 'Brass stamp, two wax colors, and the urge to seal everything.' },
    ],
  },
  custom_apparel: {
    tagline: 'Your design, printed and stitched to order.',
    gridTitle: 'Print Shop',
    items: [
      { title: 'Custom Screen-Print Tee', priceUsd: 28, description: 'Heavyweight combed cotton, your artwork, water-based inks.' },
      { title: 'Embroidered Dad Hat', priceUsd: 32, description: 'Low-profile cap with up to 8k stitches of your logo.' },
      { title: 'Custom Hoodie', priceUsd: 54, description: 'Fleece-lined, front print + sleeve hit. Team orders welcome.' },
      { title: 'Tote With Your Art', priceUsd: 22, description: '12oz canvas tote, single-color print, grocery-tested.' },
      { title: 'Sticker Pack (10)', priceUsd: 12, description: 'Die-cut vinyl, dishwasher-safe. Laptop real estate, claimed.' },
    ],
  },
  print_on_demand: {
    tagline: 'Art prints and merch, produced when you order — zero waste.',
    gridTitle: 'The Print Rack',
    items: [
      { title: 'Giclée Art Print — 12×16', priceUsd: 38, description: 'Archival inks on 240gsm matte. Ships flat, frames easy.' },
      { title: 'Gallery Poster — 18×24', priceUsd: 28, description: 'The statement piece for the empty wall you keep ignoring.' },
      { title: 'Art Tee', priceUsd: 30, description: 'The print, but wearable. Soft-hand DTG on ring-spun cotton.' },
      { title: 'Ceramic Mug — Full Wrap', priceUsd: 20, description: '11oz mug with edge-to-edge artwork. Dishwasher-safe.' },
      { title: 'Canvas Wrap — 16×20', priceUsd: 72, description: 'Ready to hang, no frame needed. Solid-face construction.' },
    ],
  },
  author: {
    tagline: 'Stories worth shelf space — signed, stamped, and shipped.',
    gridTitle: 'The Bookshop',
    items: [
      { title: 'Signed Hardcover — Latest Novel', priceUsd: 28, description: 'First printing, signed on the title page. Personalization at checkout.' },
      { title: 'Paperback — Book One', priceUsd: 16, description: 'Where the series starts. Perfect gateway copy to hook a friend.' },
      { title: 'Audiobook Download', priceUsd: 12, description: 'Narrated by the author. Instant download, DRM-free.' },
      { title: 'Annotated Special Edition', priceUsd: 45, description: 'Margin notes, deleted scenes, and the chapter that almost was.' },
      { title: 'Book Club Bundle (6 + guide)', priceUsd: 84, description: 'Six paperbacks and a discussion guide with questions that start arguments.' },
    ],
  },
  pet_boutique: {
    tagline: 'Good things for very good dogs (and their cats).',
    gridTitle: 'Shop the Pack',
    items: [
      { title: 'Waxed Canvas Collar', priceUsd: 34, description: 'Brass hardware, three sizes, gets handsomer with wear.' },
      { title: 'Small-Batch Peanut Butter Treats', priceUsd: 14, description: 'Four ingredients, zero mystery. Baked weekly.' },
      { title: 'Wool Cat Cave', priceUsd: 58, description: 'Felted merino hideout. Your cat’s new headquarters.' },
      { title: 'Rope Leash — Climbing Grade', priceUsd: 42, description: 'Real climbing rope, whipped ends, park-proof.' },
      { title: 'Personalized Bowl', priceUsd: 30, description: 'Stoneware bowl with their name glazed in. Dinner, dignified.' },
    ],
  },
  antiques_vintage: {
    tagline: 'One-of-one finds with a past life and a future home.',
    gridTitle: 'Latest Finds',
    items: [
      { title: 'Mid-Century Desk Lamp', priceUsd: 145, description: 'Rewired, polished brass, original patina where it counts. 1960s.' },
      { title: 'Vintage Persian Runner — 2×8', priceUsd: 420, description: 'Hand-knotted wool, evenly worn, colors settled into perfection.' },
      { title: 'Set of 6 Etched Coupes', priceUsd: 96, description: 'Deco etched glass, no chips. Champagne’s natural habitat.' },
      { title: 'Oak Library Card Catalog', priceUsd: 650, description: '15 drawers of small-thing storage. The good kind of impractical.' },
      { title: 'French Market Basket', priceUsd: 48, description: 'Woven willow, leather handles, decades of farmers-market experience.' },
    ],
  },
};

/** Charismatic display names for service/food starters (fallback below covers the rest). */
const STARTER_NAMES: Partial<Record<IndustryKey, string>> = {
  towing: 'Summit Towing & Recovery',
  window_washing: 'ClearView Window Washing',
  windshield_repair: 'CrackShot Auto Glass',
  roof_cleaning: 'Ridgeline Roof Cleaning',
  landscaping: 'Evergreen Landscape Co.',
  hvac: 'TrueNorth Heating & Air',
  plumbing: 'Bluebird Plumbing',
  electrical: 'Beacon Electric',
  auto_repair: 'Milepost Auto Repair',
  carpet_cleaning: 'FreshThread Carpet Care',
  moving: 'Steady Hands Moving Co.',
  pest_control: 'Sentinel Pest Control',
  painting: 'Second Coat Painting',
  general_contractor: 'Cornerstone Contracting',
  real_estate: 'Front Porch Realty',
  restaurant: 'The Copper Kettle',
  salon_spa: 'Golden Hour Salon & Spa',
  fitness: 'Northside Strength Club',
  photography: 'Stillwater Photography',
  legal: 'Harbor Law Group',
  medical_dental: 'Lakeside Family Dental',
  pressure_washing: 'JetStream Pressure Washing',
  junk_removal: 'CleanSlate Junk Removal',
  crafts: 'Wildflower Candle Co.',
  handmade: 'Clay & Kiln Studio',
  artisan_goods: 'Golden Thread Jewelry',
  retail_boutique: 'Juniper & Main',
  retail_home_goods: 'Hearth & Harbor',
  retail_electronics: 'Voltage Lane Electronics',
  retail_thrift: 'Second Story Thrift',
  etsy_style: 'The Maker’s Nook',
  gifts_stationery: 'Paper Lantern Goods',
  art_supplies: 'Palette & Co. Art Supply',
  antiques_vintage: 'Attic & Anchor Antiques',
  collectibles: 'Vault 52 Collectibles',
  pet_boutique: 'The Spotted Collar',
  pop_up_shop: 'Corner Pop-Up Market',
  farmers_market_vendor: 'Morning Rows Farm Stand',
  online_reseller: 'Restock Resale Co.',
  print_on_demand: 'Inkwell Print Studio',
  custom_apparel: 'Stitch & Press Apparel',
  author: 'C.M. Hartwell — Author',
};

const FALLBACK_ADJ = ['Summit', 'Harbor', 'Cedar', 'Beacon', 'Bluebird', 'Ridgeline', 'Lantern', 'Compass', 'Prairie', 'Golden'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export type StarterSpec = {
  slug: string;
  industryKey: IndustryKey;
  businessName: string;
  pack: StarterProductPack | null;
};

/** Deterministic starter definition for an industry. */
export function starterSpecFor(industryKey: IndustryKey, label: string): StarterSpec {
  const businessName =
    STARTER_NAMES[industryKey] ?? `${FALLBACK_ADJ[hash(industryKey) % FALLBACK_ADJ.length]} ${label}`;
  return {
    slug: `starter-${industryKey.replace(/_/g, '-')}`,
    industryKey,
    businessName,
    pack: STARTER_PRODUCT_PACKS[industryKey] ?? null,
  };
}
