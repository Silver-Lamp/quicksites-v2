// app/realtors/sample-agency/listings.ts
//
// Shared data for the sample agency demo (the agency page + the per-listing detail pages).
// Kept in one place so the roster/listings render identically wherever they appear.
//
// Why per-listing detail pages exist: "About That" narrates the CONTENT AT A URL. On the
// agency page, every player shares one URL, so they'd all narrate the whole-page overview.
// Each listing therefore gets its own detail page, and the agency card's player is pointed
// (about_that_url) at that page — so it narrates THAT home, not the agency.

// Absolute base for About That's server-side fetch of a listing's detail page (it needs an
// absolute, domain-gated URL — quicksites.ai covers www + subdomains).
export const SITE_BASE = 'https://www.quicksites.ai';

// The minted "Agency voice palette" (HiveJournal About That, gated to quicksites.ai,
// eager_render:false, one distinct narrator voice each — crosstalk 2026-07-20). Each agent
// speaks in a voice that fits their persona; each listing plays in its listing agent's voice.
export const VOICES = {
  veteran: 'f9ddbd1b-fdef-4e74-839f-165a30227486',
  luxury: 'a7e2c1d7-991b-48f7-aaf5-35243d9f8ab5',
  friendly: '5a056dda-2440-45ae-9ab8-2c9c33094589',
  calm: '7b190229-cfe6-4995-8a66-b992888b3577',
  warm: '654881fc-d7ae-400d-bec1-0dbfc805910c',
  deep: 'e43fb611-1693-40e9-afeb-e4b18848fce7',
} as const;

// Fallback embed (the original single realtors demo) — used only if a listing has no voice set.
export const DEMO_EMBED =
  process.env.NEXT_PUBLIC_REALTORS_DEMO_EMBED_ID || '9b0a931f-5277-4de4-bc30-54e0d1e9269f';

export const AGENCY = {
  name: 'Cedar & Vine Realty',
  tagline: 'A boutique brokerage for the Cedar Hollow valley — where every listing talks back.',
};

export type Agent = {
  name: string;
  title: string;
  photo_url: string;
  bio: string;
  email: string;
  about_that_embed_id: string;
};

export const AGENTS: { title: string; subtitle: string; columns: number; agents: Agent[] } = {
  title: 'Meet the Cedar & Vine team',
  subtitle:
    'Three agents, three voices. Tap ▶ on any card to hear them introduce themselves — the same way a buyer hears them scanning a QR on the yard sign.',
  columns: 3,
  agents: [
    {
      name: 'Jordan Avery',
      title: 'Listing Agent',
      photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=256&q=70',
      bio: 'Fifteen years matching families to the right block, not just the right house. Knows every cul-de-sac in the district and prices a home to actually sell.',
      email: 'jordan@example.com',
      about_that_embed_id: VOICES.veteran, // 15-year listing agent → seasoned/veteran voice
    },
    {
      name: 'Priya Nair',
      title: 'Buyer’s Agent',
      photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=70',
      bio: 'First-time buyers are her specialty — patient, straight about the numbers, and relentless on the inspection details that save you later.',
      email: 'priya@example.com',
      about_that_embed_id: VOICES.friendly, // patient first-time-buyer agent → friendly voice
    },
    {
      name: 'Marcus Bellamy',
      title: 'Broker / Owner',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=70',
      bio: 'Runs the desk and the luxury portfolio. If it has a view and a story, Marcus has the pitch — and the comps to back it up.',
      email: 'marcus@example.com',
      about_that_embed_id: VOICES.luxury, // broker/owner, luxury portfolio → luxury voice
    },
  ],
};

export type Listing = {
  slug: string;
  headline: string;
  address: string;
  price: string;
  status: string;
  beds: string;
  baths: string;
  sqft: string;
  agent: string;
  /** The listing agent's voice — so the player narrates in the same voice as their roster card. */
  about_that_embed_id: string;
  description: string;
  cta_text: string;
  images: string[];
  details: Array<[string, string]>;
  features: string[];
};

export const LISTINGS: Listing[] = [
  {
    slug: 'maple-crossing',
    headline: 'Easy-Living 4-Bed on a Cedar Hollow Cul-de-Sac',
    address: '142 Maple Crossing Lane, Cedar Hollow, OR 97402',
    price: '$475,000',
    status: 'For sale',
    beds: '4',
    baths: '2.5',
    sqft: '2,340',
    agent: 'Jordan Avery',
    about_that_embed_id: VOICES.veteran,
    description:
      'Tucked at the end of a quiet cul-de-sac, this 2016-built four-bedroom feels easy to live in — open ' +
      'quartz kitchen with a big island, a bright living space that flows to a covered patio and fully fenced ' +
      'yard, and a finished bonus room downstairs for an office or playroom. Upstairs, the primary suite has a ' +
      'walk-in closet and dual-vanity bath. New 2022 HVAC, hardwood main floor, attached two-car garage. ' +
      'Minutes to parks and downtown, in the sought-after Summit school district. Listed by Jordan Avery.',
    cta_text: 'Request a showing',
    images: [
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=70',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=70',
    ],
    details: [
      ['Property type', 'Single-family'],
      ['Year built', '2016'],
      ['Lot size', '0.28 acre'],
      ['HOA', '$45 / month'],
      ['Property taxes', '≈ $5,200 / year'],
      ['Parking', 'Attached 2-car garage'],
      ['Heating / cooling', 'Forced-air gas + central A/C (new HVAC 2022)'],
      ['Schools', 'Cedar Hollow Elementary · Riverbend Middle · Summit High'],
      ['Flooring', 'Hardwood on the main level'],
    ],
    features: [
      'Open-concept kitchen with quartz counters + island',
      'Primary suite with walk-in closet + dual vanity',
      'Finished bonus room downstairs (office or playroom)',
      'Fully fenced backyard with a covered patio',
      'Quiet cul-de-sac lot',
    ],
  },
  {
    slug: 'vineyard-ridge',
    headline: 'Modern Ridge-View Retreat with Walls of Glass',
    address: '8 Vineyard Ridge, Cedar Hollow, OR 97402',
    price: '$862,000',
    status: 'For sale',
    beds: '3',
    baths: '3',
    sqft: '3,010',
    agent: 'Marcus Bellamy',
    about_that_embed_id: VOICES.luxury,
    description:
      'A luxury ridge-view build with floor-to-ceiling glass framing the valley. The chef’s kitchen — waterfall ' +
      'island, integrated appliances, walk-in pantry — opens to a great room and a wraparound deck built for ' +
      'sunsets. The primary wing has its own view, a spa bath with a soaking tub, and a custom walk-in closet. ' +
      'Two more ensuite bedrooms, a glass-railed office loft, and a three-car garage with EV charging. ' +
      'Radiant floors, whole-home audio, and a low-maintenance native landscape. Listed by Marcus Bellamy.',
    cta_text: 'Request a private tour',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=70',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=70',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=70',
    ],
    details: [
      ['Property type', 'Single-family (custom build)'],
      ['Year built', '2021'],
      ['Lot size', '0.62 acre'],
      ['HOA', '$120 / month'],
      ['Property taxes', '≈ $9,400 / year'],
      ['Parking', 'Attached 3-car garage + EV charging'],
      ['Heating / cooling', 'Radiant floors + multi-zone heat pump'],
      ['Schools', 'Cedar Hollow Elementary · Riverbend Middle · Summit High'],
      ['Flooring', 'White oak + porcelain tile'],
    ],
    features: [
      'Floor-to-ceiling glass with valley views',
      'Chef’s kitchen — waterfall island + walk-in pantry',
      'Primary wing with spa bath + private view',
      'Wraparound deck built for sunsets',
      'Glass-railed office loft + whole-home audio',
    ],
  },
];

export function getListing(slug: string): Listing | undefined {
  return LISTINGS.find((l) => l.slug === slug);
}
