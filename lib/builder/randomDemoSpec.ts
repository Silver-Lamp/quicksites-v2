// lib/builder/randomDemoSpec.ts
//
// Pure (no-cost) generator of a random demo-site spec: a realistic industry,
// business name, locale, and an AI prompt. Feeds the automated demo generator
// (drives /api/dev/seed ideation + template build). Deterministic when given a
// `seed` so runs are reproducible/loggable.

export type DemoSpec = {
  industryLabel: string; // matches the seeder's INDUSTRY_HINTS keys (e.g. 'Towing')
  businessName: string;
  city: string;
  state: string;
  productType: 'service' | 'physical' | 'mixed' | 'meal';
  productsCount: number;
  aiPrompt: string;
};

// Industries the seeder has strong hints for, with a service noun + product type.
const INDUSTRIES: Array<{ label: string; noun: string; type: DemoSpec['productType'] }> = [
  { label: 'Towing', noun: 'Towing', type: 'service' },
  { label: 'Window Washing', noun: 'Window Cleaning', type: 'service' },
  { label: 'Roof Cleaning', noun: 'Roof Cleaning', type: 'service' },
  { label: 'Pressure Washing', noun: 'Pressure Washing', type: 'service' },
  { label: 'Landscaping', noun: 'Landscaping', type: 'service' },
  { label: 'HVAC', noun: 'Heating & Air', type: 'service' },
  { label: 'Plumbing', noun: 'Plumbing', type: 'service' },
  { label: 'Electrical', noun: 'Electric', type: 'service' },
  { label: 'Auto Repair', noun: 'Auto Repair', type: 'service' },
  { label: 'Carpet Cleaning', noun: 'Carpet Cleaning', type: 'service' },
  { label: 'Pest Control', noun: 'Pest Control', type: 'service' },
  { label: 'Painting', noun: 'Painting', type: 'service' },
  { label: 'Junk Removal', noun: 'Junk Removal', type: 'service' },
  { label: 'Salon & Spa', noun: 'Salon & Spa', type: 'service' },
  { label: 'Restaurant', noun: 'Kitchen', type: 'meal' },
  { label: 'Retail - Boutique', noun: 'Boutique', type: 'physical' },
  { label: 'Handmade', noun: 'Makers', type: 'physical' },
  { label: 'Pet Boutique', noun: 'Pet Co.', type: 'physical' },
  { label: 'Real Estate', noun: 'Realty', type: 'service' },
  { label: 'Legal', noun: 'Law', type: 'service' },
  { label: 'Medical / Dental', noun: 'Dental', type: 'service' },
  { label: 'Photography', noun: 'Photography', type: 'service' },
  { label: 'Fitness', noun: 'Fitness', type: 'service' },
  { label: 'Moving', noun: 'Movers', type: 'service' },
  { label: 'General Contractor', noun: 'Contracting', type: 'service' },
  { label: 'Windshield Repair', noun: 'Auto Glass', type: 'service' },
  { label: 'Retail - Home Goods', noun: 'Home Goods', type: 'physical' },
  { label: 'Gifts & Stationery', noun: 'Gift Shop', type: 'physical' },
  { label: 'Custom Apparel', noun: 'Apparel', type: 'physical' },
  { label: 'Antiques & Vintage', noun: 'Vintage', type: 'physical' },
  { label: 'Author', noun: 'Books', type: 'mixed' },
];

/** All categories the generator can pick from (for coverage checks). */
export const DEMO_INDUSTRY_LABELS: string[] = INDUSTRIES.map((i) => i.label);

const CITIES: Array<[string, string]> = [
  ['Tacoma', 'WA'], ['Boise', 'ID'], ['Bend', 'OR'], ['Spokane', 'WA'], ['Reno', 'NV'],
  ['Boulder', 'CO'], ['Asheville', 'NC'], ['Savannah', 'GA'], ['Frisco', 'TX'], ['Naperville', 'IL'],
  ['Ann Arbor', 'MI'], ['Bozeman', 'MT'], ['Chattanooga', 'TN'], ['Fresno', 'CA'], ['Akron', 'OH'],
  ['Provo', 'UT'], ['Tempe', 'AZ'], ['Plano', 'TX'], ['Eugene', 'OR'], ['Madison', 'WI'],
];

const ADJECTIVES = ['Reliable', 'Summit', 'Evergreen', 'Pioneer', 'Apex', 'Cornerstone', 'Bluebird', 'Ironwood', 'Lakeside', 'Northgate'];
const FIRST_NAMES = ['Marco', 'Dana', 'Priya', 'Hector', 'Nora', 'Wes', 'Lena', 'Ravi', 'Cole', 'Ada'];

// Small seeded PRNG (mulberry32) so a spec is reproducible from a seed string.
function rngFromSeed(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomDemoSpec(seed?: string, avoidLabels?: string[]): DemoSpec {
  const s = seed ?? `${Math.floor(Math.random() * 1e9)}`;
  const rnd = rngFromSeed(s);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

  // Prefer a category not yet used, so each demo broadens coverage. Fall back to
  // the full list once every category has been used.
  const avoid = new Set((avoidLabels ?? []).map((l) => l.toLowerCase()));
  const pool = INDUSTRIES.filter((i) => !avoid.has(i.label.toLowerCase()));
  const ind = pick(pool.length ? pool : INDUSTRIES);
  const [city, state] = pick(CITIES);

  const pattern = Math.floor(rnd() * 4);
  const businessName =
    pattern === 0 ? `${city} ${ind.noun}`
    : pattern === 1 ? `${pick(ADJECTIVES)} ${ind.noun} Co.`
    : pattern === 2 ? `${pick(FIRST_NAMES)}'s ${ind.noun}`
    : `${pick(ADJECTIVES)} ${ind.noun} of ${city}`;

  const productsCount = 4 + Math.floor(rnd() * 5); // 4–8

  const aiPrompt = [
    `Create a believable local ${ind.label} business based in ${city}, ${state}.`,
    `Business name: "${businessName}".`,
    `Warm, trustworthy, conversion-oriented copy tuned for local SEO.`,
  ].join(' ');

  return { industryLabel: ind.label, businessName, city, state, productType: ind.type, productsCount, aiPrompt };
}
